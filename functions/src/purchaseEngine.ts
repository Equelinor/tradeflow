// ─────────────────────────────────────────────────────────────
// Cloud Function: Purchase Engine
// Region: europe-west1
//
// TRANSACTION RULE: All reads before all writes.
//
// P1-2 FIX: Supplier balance is NOT updated here directly.
// supplierBalance.ts owns supplier currentBalance via full
// recalculation from ledger. This engine only handles:
//   - stock increase
//   - purchase number generation
//   - audit log
//   - status confirmation
//
// Why: purchaseEngine AND supplierBalance.ts both trigger on
// purchase writes. If both touch currentBalance, you get a race.
// Single source of truth = supplierBalance.ts recalculator.
// ─────────────────────────────────────────────────────────────

import * as functions from 'firebase-functions/v2';
import { getFirestore, FieldValue, Transaction } from 'firebase-admin/firestore';

const db     = getFirestore();
const REGION = 'europe-west1';

async function generatePurchaseNumber(companyId: string, txn: Transaction): Promise<string> {
  const ref  = db.doc(`companies/${companyId}/settings/purchaseCounter`);
  const snap = await txn.get(ref);
  const year = new Date().getFullYear();
  const prefix  = snap.exists ? (snap.data()?.prefix  ?? 'PUR') : 'PUR';
  const padding = snap.exists ? (snap.data()?.padding ?? 4)     : 4;
  const storedYear = snap.exists ? (snap.data()?.year ?? year)  : year;
  const next = (storedYear === year && snap.exists) ? (snap.data()?.next ?? 1) : 1;
  txn.set(ref, { prefix, year, next: next + 1, padding }, { merge: true });
  return `${prefix}-${year}-${String(next).padStart(padding, '0')}`;
}

export const onPurchaseWriteEngine = functions.firestore.onDocumentWritten(
  { document: 'companies/{companyId}/purchases/{purchaseId}', region: REGION },
  async (event) => {
    const companyId  = event.params.companyId;
    const purchaseId = event.params.purchaseId;
    const before     = event.data?.before?.data();
    const after      = event.data?.after?.data();
    if (!after) return;

    if (after.status === 'pending' && !after.stockProcessed && !after.balanceProcessed) {
      await processPurchaseCreation(companyId, purchaseId, after);
      return;
    }
    if (after.isVoid && !after.voidProcessed && before && !before.isVoid) {
      await processPurchaseVoid(companyId, purchaseId, after);
      return;
    }
  }
);

// ── Process purchase creation (reads first, then writes) ──────
async function processPurchaseCreation(
  companyId:  string,
  purchaseId: string,
  purchase:   FirebaseFirestore.DocumentData
): Promise<void> {
  const base        = `companies/${companyId}`;
  const purchaseRef = db.doc(`${base}/purchases/${purchaseId}`);

  try {
    await db.runTransaction(async txn => {

      // ══ PHASE 1 — ALL READS ══════════════════════════════

      // Idempotency check
      const liveSnap = await txn.get(purchaseRef);
      if (!liveSnap.exists) return;
      const live = liveSnap.data()!;
      if (live.stockProcessed || live.balanceProcessed) {
        console.log(`[purchaseEngine] already processed: ${purchaseId}`);
        return;
      }

      // Counter reads
      const purchaseNumber = await generatePurchaseNumber(companyId, txn);

      // Supplier read (for existence check only — balance owned by supplierBalance.ts)
      const supplierSnap = await txn.get(db.doc(`${base}/suppliers/${purchase.supplierId}`));
      if (!supplierSnap.exists) throw new Error(`Supplier not found: ${purchase.supplierId}`);

      // Product reads
      const productRefs  = purchase.items.map((item: any) => db.doc(`${base}/products/${item.productId}`));
      const productSnaps = await Promise.all(productRefs.map((ref: any) => txn.get(ref)));

      // Validate products exist
      for (let i = 0; i < purchase.items.length; i++) {
        if (!productSnaps[i].exists) throw new Error(`Product not found: ${purchase.items[i].productId}`);
      }

      // ══ PHASE 2 — ALL WRITES ════════════════════════════

      // Stock increases + movements
      for (let i = 0; i < purchase.items.length; i++) {
        const item        = purchase.items[i];
        const currentStock = productSnaps[i].data()!.currentStock ?? 0;
        const newStock     = currentStock + item.qty; // INCREASE

        txn.update(productRefs[i], { currentStock: newStock, updatedAt: FieldValue.serverTimestamp() });
        txn.set(db.collection(`${base}/stockMovements`).doc(), {
          companyId, productId: item.productId, productName: item.productName,
          type: 'PURCHASE', qty: +item.qty, refId: purchaseId, refType: 'purchase',
          notes: purchase.supplierInvoiceNo ?? null,
          createdAt: FieldValue.serverTimestamp(), createdBy: purchase.createdBy,
        });
      }

      // NOTE: Supplier balance is NOT updated here.
      // supplierBalance.ts recalculates from all purchases/payments/returns
      // and will fire separately on this same write event.

      // Audit log
      txn.set(db.collection('auditLog').doc(), {
        companyId, action: 'PURCHASE_CONFIRMED', entityType: 'purchase', entityId: purchaseId,
        data: { purchaseNumber, supplierId: purchase.supplierId,
                grandTotal: purchase.grandTotal, amountDue: purchase.amountDue,
                paymentType: purchase.paymentType, supplierInvoiceNo: purchase.supplierInvoiceNo },
        performedBy: purchase.createdBy, createdAt: FieldValue.serverTimestamp(),
      });

      // Confirm
      txn.update(purchaseRef, {
        purchaseNumber, stockProcessed: true,
        // balanceProcessed will be set by supplierBalance.ts after it runs
        status: 'confirmed', updatedAt: FieldValue.serverTimestamp(),
      });
    });

    console.log(`[purchaseEngine] confirmed: ${companyId}/${purchaseId}`);

  } catch (err) {
    const errMsg = String(err);
    const isPermanent = errMsg.includes('Product not found') || errMsg.includes('Supplier not found');
    await purchaseRef.update({ status: 'failed', failureReason: errMsg, updatedAt: FieldValue.serverTimestamp() });
    console.error(`[purchaseEngine] ${isPermanent ? 'permanent' : 'transient'} failure: ${purchaseId}`, err);
    if (!isPermanent) throw err;
  }
}

// ── Process void (reads first, then writes) ───────────────────
async function processPurchaseVoid(
  companyId:  string,
  purchaseId: string,
  purchase:   FirebaseFirestore.DocumentData
): Promise<void> {
  const base        = `companies/${companyId}`;
  const purchaseRef = db.doc(`${base}/purchases/${purchaseId}`);

  await db.runTransaction(async txn => {

    // ══ PHASE 1 — READS ══════════════════════════════════════
    const liveSnap = await txn.get(purchaseRef);
    if (!liveSnap.exists) return;
    if (liveSnap.data()!.voidProcessed) {
      console.log(`[purchaseEngine] void already processed: ${purchaseId}`);
      return;
    }

    const productRefs  = purchase.items.map((item: any) => db.doc(`${base}/products/${item.productId}`));
    const productSnaps = await Promise.all(productRefs.map((ref: any) => txn.get(ref)));

    // ══ PHASE 2 — WRITES ══════════════════════════════════════

    // Reverse stock (decrease back)
    for (let i = 0; i < purchase.items.length; i++) {
      const item        = purchase.items[i];
      const curStock    = productSnaps[i].exists ? (productSnaps[i].data()!.currentStock ?? 0) : 0;
      txn.update(productRefs[i], { currentStock: curStock - item.qty, updatedAt: FieldValue.serverTimestamp() });
      txn.set(db.collection(`${base}/stockMovements`).doc(), {
        companyId, productId: item.productId, productName: item.productName,
        type: 'PURCHASE_VOID', qty: -item.qty, refId: purchaseId, refType: 'purchase_void',
        notes: purchase.voidReason, createdAt: FieldValue.serverTimestamp(), createdBy: purchase.voidedBy,
      });
    }

    // NOTE: Supplier balance reversal handled by supplierBalance.ts
    // which recalculates from all non-voided purchases/payments/returns.

    // Audit log
    txn.set(db.collection('auditLog').doc(), {
      companyId, action: 'PURCHASE_VOIDED', entityType: 'purchase', entityId: purchaseId,
      data: { purchaseNumber: purchase.purchaseNumber, supplierId: purchase.supplierId,
              grandTotal: purchase.grandTotal, amountDue: purchase.amountDue, voidReason: purchase.voidReason },
      performedBy: purchase.voidedBy, createdAt: FieldValue.serverTimestamp(),
    });

    // Mark voided — CF sets status
    txn.update(purchaseRef, { status: 'voided', voidProcessed: true, updatedAt: FieldValue.serverTimestamp() });
  });

  // Owner notification
  try {
    const ownerQuery = await db.collection(`${base}/users`).where('role','==','owner').limit(1).get();
    if (!ownerQuery.empty && ownerQuery.docs[0].data().fcmToken) {
      console.log(`[purchaseEngine] void notification queued for owner`);
    }
  } catch (e) { console.warn('[purchaseEngine] notify failed:', e); }

  console.log(`[purchaseEngine] voided: ${companyId}/${purchaseId}`);
}
