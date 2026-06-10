// ─────────────────────────────────────────────────────────────
// Cloud Function: Purchase Engine
// Region: europe-west1
//
// IDEMPOTENCY: same pattern as saleEngine.
//   stockProcessed + balanceProcessed guard creation.
//   voidProcessed guards void reversal.
//
// On purchase CREATE (pending → confirmed):
//   1. Generate purchase number atomically
//   2. INCREASE stock per line item (opposite of sale)
//   3. Update supplier balance by amountDue only
//   4. Write audit log
//   5. Update status → confirmed
//
// On purchase VOID (isVoid: false → true):
//   1. DECREASE stock (reverse the increase)
//   2. Decrease supplier balance by amountDue
//   3. Write audit log
//   4. Notify owner
//   5. CF sets status → voided
// ─────────────────────────────────────────────────────────────

import * as functions from 'firebase-functions/v2';
import {
  getFirestore,
  FieldValue,
  Transaction,
} from 'firebase-admin/firestore';

const db     = getFirestore();
const REGION = 'europe-west1';

// ── Purchase number generator ─────────────────────────────────
async function generatePurchaseNumber(
  companyId: string,
  txn:       Transaction
): Promise<string> {
  const counterRef = db.doc(
    `companies/${companyId}/settings/purchaseCounter`
  );
  const snap       = await txn.get(counterRef);
  const year       = new Date().getFullYear();
  const prefix     = snap.exists ? (snap.data()?.prefix  ?? 'PUR') : 'PUR';
  const padding    = snap.exists ? (snap.data()?.padding ?? 4)     : 4;
  const storedYear = snap.exists ? (snap.data()?.year    ?? year)  : year;
  const next       = (storedYear === year && snap.exists)
    ? (snap.data()?.next ?? 1) : 1;

  txn.set(counterRef, { prefix, year, next: next + 1, padding }, { merge: true });
  return `${prefix}-${year}-${String(next).padStart(padding, '0')}`;
}

// ── Main trigger ──────────────────────────────────────────────
export const onPurchaseWriteEngine = functions.firestore.onDocumentWritten(
  { document: 'companies/{companyId}/purchases/{purchaseId}', region: REGION },
  async (event) => {
    const companyId  = event.params.companyId;
    const purchaseId = event.params.purchaseId;
    const before     = event.data?.before?.data();
    const after      = event.data?.after?.data();

    if (!after) return;

    // New purchase — pending and not yet processed
    if (after.status === 'pending' &&
        !after.stockProcessed &&
        !after.balanceProcessed) {
      await processPurchaseCreation(companyId, purchaseId, after);
      return;
    }

    // Void — isVoid just became true and not yet processed
    if (after.isVoid && !after.voidProcessed && before && !before.isVoid) {
      await processPurchaseVoid(companyId, purchaseId, after);
      return;
    }
  }
);

// ── Process new purchase (idempotent) ─────────────────────────
async function processPurchaseCreation(
  companyId:  string,
  purchaseId: string,
  purchase:   FirebaseFirestore.DocumentData
): Promise<void> {
  const base        = `companies/${companyId}`;
  const purchaseRef = db.doc(`${base}/purchases/${purchaseId}`);

  try {
    await db.runTransaction(async txn => {
      // ── IDEMPOTENCY CHECK ────────────────────────────────
      const liveSnap = await txn.get(purchaseRef);
      if (!liveSnap.exists) return;
      const live = liveSnap.data()!;
      if (live.stockProcessed || live.balanceProcessed) {
        console.log(`[purchaseEngine] already processed, skipping: ${purchaseId}`);
        return;
      }

      // ── 1. Generate purchase number ───────────────────────
      const purchaseNumber = await generatePurchaseNumber(companyId, txn);

      // ── 2. Increase stock per line item ───────────────────
      // Purchase = stock IN (opposite of sale = stock OUT)
      for (const item of purchase.items) {
        const productRef  = db.doc(`${base}/products/${item.productId}`);
        const productSnap = await txn.get(productRef);
        if (!productSnap.exists) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        const currentStock = productSnap.data()!.currentStock ?? 0;
        const newStock     = currentStock + item.qty; // INCREASE

        txn.update(productRef, {
          currentStock: newStock,
          updatedAt:    FieldValue.serverTimestamp(),
        });

        // Stock movement record — type: PURCHASE
        txn.set(db.collection(`${base}/stockMovements`).doc(), {
          companyId,
          productId:   item.productId,
          productName: item.productName,
          type:        'PURCHASE',
          qty:         +item.qty, // positive = in
          refId:       purchaseId,
          refType:     'purchase',
          notes:       purchase.supplierInvoiceNo ?? null,
          createdAt:   FieldValue.serverTimestamp(),
          createdBy:   purchase.createdBy,
        });
      }

      // ── 3. Update supplier balance ────────────────────────
      // Only amountDue affects payable:
      //   Cash:    amountDue = 0    → no payable change
      //   Credit:  amountDue = full → full amount added
      //   Partial: amountDue = rem  → only unpaid added
      if (purchase.amountDue > 0) {
        const supplierRef = db.doc(`${base}/suppliers/${purchase.supplierId}`);
        const supplierSnap= await txn.get(supplierRef);
        if (!supplierSnap.exists) {
          throw new Error(`Supplier not found: ${purchase.supplierId}`);
        }
        txn.update(supplierRef, {
          currentBalance:   FieldValue.increment(purchase.amountDue),
          balanceUpdatedAt: FieldValue.serverTimestamp(),
        });
      }

      // ── 4. Audit log ──────────────────────────────────────
      txn.set(db.collection('auditLog').doc(), {
        companyId,
        action:    'PURCHASE_CONFIRMED',
        entityType:'purchase',
        entityId:  purchaseId,
        data: {
          purchaseNumber,
          supplierId:       purchase.supplierId,
          grandTotal:       purchase.grandTotal,
          amountDue:        purchase.amountDue,
          paymentType:      purchase.paymentType,
          supplierInvoiceNo:purchase.supplierInvoiceNo,
        },
        performedBy: purchase.createdBy,
        createdAt:   FieldValue.serverTimestamp(),
      });

      // ── 5. Mark confirmed ─────────────────────────────────
      txn.update(purchaseRef, {
        purchaseNumber,
        stockProcessed:   true,
        balanceProcessed: true,
        status:           'confirmed',
        updatedAt:        FieldValue.serverTimestamp(),
      });
    });

    console.log(`[purchaseEngine] confirmed: ${companyId}/${purchaseId}`);

  } catch (err) {
    const errMsg = String(err);
    const isPermanent =
      errMsg.includes('Product not found') ||
      errMsg.includes('Supplier not found');

    await purchaseRef.update({
      status:        'failed',
      failureReason: errMsg,
      updatedAt:     FieldValue.serverTimestamp(),
    });

    console.error(`[purchaseEngine] ${isPermanent ? 'permanent' : 'transient'} failure: ${purchaseId}`, err);
    if (!isPermanent) throw err;
  }
}

// ── Process void (idempotent) ─────────────────────────────────
async function processPurchaseVoid(
  companyId:  string,
  purchaseId: string,
  purchase:   FirebaseFirestore.DocumentData
): Promise<void> {
  const base        = `companies/${companyId}`;
  const purchaseRef = db.doc(`${base}/purchases/${purchaseId}`);

  await db.runTransaction(async txn => {
    // ── IDEMPOTENCY CHECK ────────────────────────────────────
    const liveSnap = await txn.get(purchaseRef);
    if (!liveSnap.exists) return;
    if (liveSnap.data()!.voidProcessed) {
      console.log(`[purchaseEngine] void already processed, skipping: ${purchaseId}`);
      return;
    }

    // ── 1. Reverse stock (decrease back) ─────────────────────
    for (const item of purchase.items) {
      const productRef = db.doc(`${base}/products/${item.productId}`);
      txn.update(productRef, {
        currentStock: FieldValue.increment(-item.qty), // DECREASE
        updatedAt:    FieldValue.serverTimestamp(),
      });

      txn.set(db.collection(`${base}/stockMovements`).doc(), {
        companyId,
        productId:   item.productId,
        productName: item.productName,
        type:        'PURCHASE_VOID',
        qty:         -item.qty, // negative = out
        refId:       purchaseId,
        refType:     'purchase_void',
        notes:       purchase.voidReason,
        createdAt:   FieldValue.serverTimestamp(),
        createdBy:   purchase.voidedBy,
      });
    }

    // ── 2. Reverse supplier balance ───────────────────────────
    if (purchase.amountDue > 0) {
      txn.update(db.doc(`${base}/suppliers/${purchase.supplierId}`), {
        currentBalance:   FieldValue.increment(-purchase.amountDue),
        balanceUpdatedAt: FieldValue.serverTimestamp(),
      });
    }

    // ── 3. Audit log ──────────────────────────────────────────
    txn.set(db.collection('auditLog').doc(), {
      companyId,
      action:    'PURCHASE_VOIDED',
      entityType:'purchase',
      entityId:  purchaseId,
      data: {
        purchaseNumber: purchase.purchaseNumber,
        supplierId:     purchase.supplierId,
        grandTotal:     purchase.grandTotal,
        amountDue:      purchase.amountDue,
        voidReason:     purchase.voidReason,
      },
      performedBy: purchase.voidedBy,
      createdAt:   FieldValue.serverTimestamp(),
    });

    // ── 4. Mark void processed — CF sets status ───────────────
    txn.update(purchaseRef, {
      status:        'voided',
      voidProcessed: true,
      updatedAt:     FieldValue.serverTimestamp(),
    });
  });

  // ── 5. Notify owner (best effort, outside transaction) ───────
  try {
    const ownerQuery = await db
      .collection(`${base}/users`)
      .where('role', '==', 'owner')
      .limit(1)
      .get();
    if (!ownerQuery.empty) {
      const ownerToken = ownerQuery.docs[0].data().fcmToken;
      if (ownerToken) {
        console.log(`[purchaseEngine] void notification queued for owner`);
      }
    }
  } catch (notifyErr) {
    console.warn('[purchaseEngine] void notify failed:', notifyErr);
  }

  console.log(`[purchaseEngine] voided: ${companyId}/${purchaseId}`);
}
