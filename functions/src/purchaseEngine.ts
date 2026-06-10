// ─────────────────────────────────────────────────────────────
// Cloud Function: Purchase Engine — europe-west1
// Counter split into read (Phase 1) + write (Phase 2).
// Supplier balance NOT touched here — owned by supplierBalance.ts
// ─────────────────────────────────────────────────────────────

import * as functions from 'firebase-functions/v2';
import { getFirestore, FieldValue, Transaction } from 'firebase-admin/firestore';

const db     = getFirestore();
const REGION = 'europe-west1';

interface CounterState {
  ref: FirebaseFirestore.DocumentReference;
  prefix: string; year: number; next: number; padding: number;
}

async function readCounterNext(
  companyId: string, counterName: string, defaultPrefix: string, txn: Transaction
): Promise<CounterState> {
  const ref  = db.doc(`companies/${companyId}/settings/${counterName}`);
  const snap = await txn.get(ref); // READ ONLY
  const year = new Date().getFullYear();
  const prefix     = snap.exists ? (snap.data()?.prefix  ?? defaultPrefix) : defaultPrefix;
  const padding    = snap.exists ? (snap.data()?.padding ?? 4)             : 4;
  const storedYear = snap.exists ? (snap.data()?.year    ?? year)          : year;
  const next       = (storedYear === year && snap.exists) ? (snap.data()?.next ?? 1) : 1;
  return { ref, prefix, year, next, padding };
}

function writeCounterNext(state: CounterState, txn: Transaction): string {
  txn.set(state.ref, { prefix: state.prefix, year: state.year,
    next: state.next + 1, padding: state.padding }, { merge: true });
  return `${state.prefix}-${state.year}-${String(state.next).padStart(state.padding, '0')}`;
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
      await processPurchaseCreation(companyId, purchaseId, after); return;
    }
    if (after.isVoid && !after.voidProcessed && before && !before.isVoid) {
      await processPurchaseVoid(companyId, purchaseId, after); return;
    }
  }
);

async function processPurchaseCreation(
  companyId: string, purchaseId: string, purchase: FirebaseFirestore.DocumentData
): Promise<void> {
  const base        = `companies/${companyId}`;
  const purchaseRef = db.doc(`${base}/purchases/${purchaseId}`);

  try {
    await db.runTransaction(async txn => {

      // ══ PHASE 1 — ALL READS ══════════════════════════════

      // Idempotency
      const liveSnap = await txn.get(purchaseRef);
      if (!liveSnap.exists) return;
      const live = liveSnap.data()!;
      if (live.stockProcessed || live.balanceProcessed) {
        console.log(`[purchaseEngine] already processed: ${purchaseId}`); return;
      }

      // Counter read (no write yet)
      const counterState = await readCounterNext(companyId, 'purchaseCounter', 'PUR', txn);

      // Supplier existence check
      const supplierSnap = await txn.get(db.doc(`${base}/suppliers/${purchase.supplierId}`));
      if (!supplierSnap.exists) throw new Error(`Supplier not found: ${purchase.supplierId}`);

      // Product reads
      const productRefs  = purchase.items.map((i: any) => db.doc(`${base}/products/${i.productId}`));
      const productSnaps = await Promise.all(productRefs.map((r: any) => txn.get(r)));
      for (let i = 0; i < purchase.items.length; i++) {
        if (!productSnaps[i].exists) throw new Error(`Product not found: ${purchase.items[i].productId}`);
      }

      // ══ PHASE 2 — ALL WRITES ════════════════════════════

      // Write counter
      const purchaseNumber = writeCounterNext(counterState, txn);

      // Stock increases
      for (let i = 0; i < purchase.items.length; i++) {
        const item     = purchase.items[i];
        const newStock = (productSnaps[i].data()!.currentStock ?? 0) + item.qty;
        txn.update(productRefs[i], { currentStock: newStock, updatedAt: FieldValue.serverTimestamp() });
        txn.set(db.collection(`${base}/stockMovements`).doc(), {
          companyId, productId: item.productId, productName: item.productName,
          type: 'PURCHASE', qty: +item.qty, refId: purchaseId, refType: 'purchase',
          notes: purchase.supplierInvoiceNo ?? null,
          createdAt: FieldValue.serverTimestamp(), createdBy: purchase.createdBy,
        });
      }

      // Supplier balance intentionally NOT updated here.
      // supplierBalance.ts recalculates from ledger on this same write event.

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

async function processPurchaseVoid(
  companyId: string, purchaseId: string, purchase: FirebaseFirestore.DocumentData
): Promise<void> {
  const base        = `companies/${companyId}`;
  const purchaseRef = db.doc(`${base}/purchases/${purchaseId}`);

  await db.runTransaction(async txn => {

    // ══ PHASE 1 — READS ══════════════════════════════════════
    const liveSnap = await txn.get(purchaseRef);
    if (!liveSnap.exists) return;
    if (liveSnap.data()!.voidProcessed) {
      console.log(`[purchaseEngine] void already processed: ${purchaseId}`); return;
    }
    const productRefs  = purchase.items.map((i: any) => db.doc(`${base}/products/${i.productId}`));
    const productSnaps = await Promise.all(productRefs.map((r: any) => txn.get(r)));

    // ══ PHASE 2 — WRITES ══════════════════════════════════════
    for (let i = 0; i < purchase.items.length; i++) {
      const item     = purchase.items[i];
      const curStock = productSnaps[i].exists ? (productSnaps[i].data()!.currentStock ?? 0) : 0;
      txn.update(productRefs[i], { currentStock: curStock - item.qty, updatedAt: FieldValue.serverTimestamp() });
      txn.set(db.collection(`${base}/stockMovements`).doc(), {
        companyId, productId: item.productId, productName: item.productName,
        type: 'PURCHASE_VOID', qty: -item.qty, refId: purchaseId, refType: 'purchase_void',
        notes: purchase.voidReason, createdAt: FieldValue.serverTimestamp(), createdBy: purchase.voidedBy,
      });
    }

    // Supplier balance reversal handled by supplierBalance.ts recalculator.

    txn.set(db.collection('auditLog').doc(), {
      companyId, action: 'PURCHASE_VOIDED', entityType: 'purchase', entityId: purchaseId,
      data: { purchaseNumber: purchase.purchaseNumber, supplierId: purchase.supplierId,
              grandTotal: purchase.grandTotal, amountDue: purchase.amountDue, voidReason: purchase.voidReason },
      performedBy: purchase.voidedBy, createdAt: FieldValue.serverTimestamp(),
    });

    txn.update(purchaseRef, { status: 'voided', voidProcessed: true, updatedAt: FieldValue.serverTimestamp() });
  });

  try {
    const ownerQ = await db.collection(`${base}/users`).where('role','==','owner').limit(1).get();
    if (!ownerQ.empty && ownerQ.docs[0].data().fcmToken) console.log(`[purchaseEngine] void notification queued`);
  } catch (e) { console.warn('[purchaseEngine] notify failed:', e); }

  console.log(`[purchaseEngine] voided: ${companyId}/${purchaseId}`);
}
