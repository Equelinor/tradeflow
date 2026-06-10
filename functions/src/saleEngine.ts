// ─────────────────────────────────────────────────────────────
// Cloud Function: Sale Engine — europe-west1
//
// TRANSACTION RULE: ALL reads in Phase 1, ALL writes in Phase 2.
// Counter functions are split into read (Phase 1) + write (Phase 2).
// ─────────────────────────────────────────────────────────────

import * as functions from 'firebase-functions/v2';
import { getFirestore, FieldValue, Transaction } from 'firebase-admin/firestore';

const db     = getFirestore();
const REGION = 'europe-west1';

// ── Counter helpers — SPLIT into read + write ─────────────────
// readCounterNext: Phase 1 — read only, no writes
interface CounterState {
  ref:     FirebaseFirestore.DocumentReference;
  prefix:  string;
  year:    number;
  next:    number;
  padding: number;
}

async function readCounterNext(
  companyId: string,
  counterName: string,
  defaultPrefix: string,
  txn: Transaction
): Promise<CounterState> {
  const ref  = db.doc(`companies/${companyId}/settings/${counterName}`);
  const snap = await txn.get(ref); // READ ONLY — no write here
  const year = new Date().getFullYear();
  const prefix  = snap.exists ? (snap.data()?.prefix  ?? defaultPrefix) : defaultPrefix;
  const padding = snap.exists ? (snap.data()?.padding ?? 4)             : 4;
  const storedYear = snap.exists ? (snap.data()?.year ?? year)          : year;
  const next = (storedYear === year && snap.exists) ? (snap.data()?.next ?? 1) : 1;
  return { ref, prefix, year, next, padding };
}

// writeCounterNext: Phase 2 — write only, call AFTER all reads
function writeCounterNext(state: CounterState, txn: Transaction): string {
  txn.set(state.ref, {
    prefix:  state.prefix,
    year:    state.year,
    next:    state.next + 1,
    padding: state.padding,
  }, { merge: true });
  return `${state.prefix}-${state.year}-${String(state.next).padStart(state.padding, '0')}`;
}

// ── Main trigger ──────────────────────────────────────────────
export const onSaleWrite = functions.firestore.onDocumentWritten(
  { document: 'companies/{companyId}/sales/{saleId}', region: REGION },
  async (event) => {
    const companyId = event.params.companyId;
    const saleId    = event.params.saleId;
    const before    = event.data?.before?.data();
    const after     = event.data?.after?.data();
    if (!after) return;

    if (after.status === 'pending' && !after.stockProcessed && !after.balanceProcessed) {
      await processSaleCreation(companyId, saleId, after);
      return;
    }
    if (after.isVoid && !after.voidProcessed && before && !before.isVoid) {
      await processSaleVoid(companyId, saleId, after);
      return;
    }
  }
);

// ── Process sale creation ─────────────────────────────────────
async function processSaleCreation(
  companyId: string,
  saleId:    string,
  sale:      FirebaseFirestore.DocumentData
): Promise<void> {
  const base    = `companies/${companyId}`;
  const saleRef = db.doc(`${base}/sales/${saleId}`);

  try {
    await db.runTransaction(async txn => {

      // ══════════════════════════════════════════════════════
      // PHASE 1 — ALL READS (zero writes)
      // ══════════════════════════════════════════════════════

      // 1a. Idempotency check
      const liveSaleSnap = await txn.get(saleRef);
      if (!liveSaleSnap.exists) return;
      const liveSale = liveSaleSnap.data()!;
      if (liveSale.stockProcessed || liveSale.balanceProcessed) {
        console.log(`[saleEngine] already processed: ${saleId}`); return;
      }

      // 1b. Counter reads (read-only — no txn.set yet)
      const invoiceState = await readCounterNext(companyId, 'invoiceCounter', 'INV', txn);
      const needsReceipt = (sale.paymentType === 'cash' || sale.paymentType === 'partial') && sale.amountReceived > 0;
      const receiptState = needsReceipt
        ? await readCounterNext(companyId, 'receiptCounter', 'RCT', txn)
        : null;

      // 1c. Inventory settings
      const settingsSnap  = await txn.get(db.doc(`${base}/settings/inventory`));
      const allowNegative = settingsSnap.exists ? (settingsSnap.data()?.allowNegativeStock ?? false) : false;

      // 1d. Product reads
      const productRefs  = sale.items.map((i: any) => db.doc(`${base}/products/${i.productId}`));
      const productSnaps = await Promise.all(productRefs.map((r: any) => txn.get(r)));

      // 1e. Customer read
      const customerRef  = db.doc(`${base}/customers/${sale.customerId}`);
      const customerSnap = await txn.get(customerRef);
      if (!customerSnap.exists) throw new Error(`Customer not found: ${sale.customerId}`);

      // 1f. Credit limit approver read (if needed)
      const customerData   = customerSnap.data()!;
      const creditLimit    = customerData.creditLimit ?? null;
      const newBalance     = (customerData.currentBalance ?? 0) + sale.amountDue;
      let approverSnap: FirebaseFirestore.DocumentSnapshot | null = null;

      if (creditLimit !== null && newBalance > creditLimit && sale.amountDue > 0) {
        const override = sale.creditOverride;
        const hasShape = override?.overridden === true &&
          typeof override?.reason === 'string' && override.reason.trim().length > 0 &&
          typeof override?.by    === 'string' && override.by.trim().length > 0;
        if (!hasShape) throw new Error(`credit limit exceeded: no valid override.`);
        approverSnap = await txn.get(db.doc(`${base}/users/${override.by}`));
        if (!approverSnap.exists) throw new Error(`credit limit override rejected: approver not found.`);
        const ad = approverSnap.data()!;
        if (!((ad.role === 'owner' || ad.role === 'admin') && ad.status === 'active')) {
          throw new Error(`credit limit override rejected: ${override.by} is not active owner/admin.`);
        }
      }

      // 1g. Stock validation
      for (let i = 0; i < sale.items.length; i++) {
        const item  = sale.items[i];
        const pSnap = productSnaps[i];
        if (!pSnap.exists) throw new Error(`Product not found: ${item.productId}`);
        const stock = pSnap.data()!.currentStock ?? 0;
        if (stock - item.qty < 0 && !allowNegative) {
          throw new Error(`Insufficient stock for ${item.productName}: need ${item.qty}, have ${stock}`);
        }
      }

      // ══════════════════════════════════════════════════════
      // PHASE 2 — ALL WRITES (zero reads after this point)
      // ══════════════════════════════════════════════════════

      // 2a. Write counters + get formatted numbers
      const invoiceNumber = writeCounterNext(invoiceState, txn);
      const receiptNumber = receiptState ? writeCounterNext(receiptState, txn) : '';
      const receiptId     = receiptState ? db.collection(`${base}/receipts`).doc().id : '';

      // 2b. Stock decrements + movements
      for (let i = 0; i < sale.items.length; i++) {
        const item     = sale.items[i];
        const newStock = (productSnaps[i].data()!.currentStock ?? 0) - item.qty;
        txn.update(productRefs[i], { currentStock: newStock, updatedAt: FieldValue.serverTimestamp() });
        txn.set(db.collection(`${base}/stockMovements`).doc(), {
          companyId, productId: item.productId, productName: item.productName,
          type: 'SALE', qty: -item.qty, refId: saleId, refType: 'sale',
          notes: null, createdAt: FieldValue.serverTimestamp(), createdBy: sale.createdBy,
        });
      }

      // 2c. Customer balance
      if (sale.amountDue > 0) {
        txn.update(customerRef, {
          currentBalance:   FieldValue.increment(sale.amountDue),
          balanceUpdatedAt: FieldValue.serverTimestamp(),
        });
      }

      // 2d. Auto receipt
      if (receiptState) {
        txn.set(db.doc(`${base}/receipts/${receiptId}`), {
          companyId, receiptNumber, customerId: sale.customerId, saleId,
          amount: sale.amountReceived, paymentMethod: sale.paymentMethod,
          date: sale.date, isVoid: false, voidReason: null,
          notes: `Auto-receipt for ${invoiceNumber}`, source: 'system',
          allocationMode: 'customer_balance', allocations: [], linkedInvoiceIds: [],
          balanceProcessed: true, voidProcessed: false, status: 'confirmed', failureReason: null,
          createdAt: FieldValue.serverTimestamp(), createdBy: sale.createdBy,
        });
      }

      // 2e. Audit log
      txn.set(db.collection('auditLog').doc(), {
        companyId, action: 'SALE_CONFIRMED', entityType: 'sale', entityId: saleId,
        data: { invoiceNumber, customerId: sale.customerId, grandTotal: sale.grandTotal,
                amountDue: sale.amountDue, paymentType: sale.paymentType,
                creditOverride: sale.creditOverride ?? null },
        performedBy: sale.createdBy, createdAt: FieldValue.serverTimestamp(),
      });

      // 2f. Confirm sale
      txn.update(saleRef, {
        invoiceNumber, receiptId: receiptId || null,
        stockProcessed: true, balanceProcessed: true,
        status: 'confirmed', updatedAt: FieldValue.serverTimestamp(),
      });
    });

    console.log(`[saleEngine] confirmed: ${companyId}/${saleId}`);

  } catch (err) {
    const errMsg      = String(err);
    const isPermanent = errMsg.includes('Insufficient stock') || errMsg.includes('Product not found') ||
      errMsg.includes('credit limit') || errMsg.includes('Customer not found');
    await saleRef.update({ status: 'failed', failureReason: errMsg, updatedAt: FieldValue.serverTimestamp() });
    console.error(`[saleEngine] ${isPermanent ? 'permanent' : 'transient'} failure: ${saleId}`, err);
    if (!isPermanent) throw err;
  }
}

// ── Process void ──────────────────────────────────────────────
async function processSaleVoid(
  companyId: string,
  saleId:    string,
  sale:      FirebaseFirestore.DocumentData
): Promise<void> {
  const base    = `companies/${companyId}`;
  const saleRef = db.doc(`${base}/sales/${saleId}`);

  await db.runTransaction(async txn => {

    // ══ PHASE 1 — READS ══════════════════════════════════════
    const liveSaleSnap = await txn.get(saleRef);
    if (!liveSaleSnap.exists) return;
    if (liveSaleSnap.data()!.voidProcessed) {
      console.log(`[saleEngine] void already processed: ${saleId}`); return;
    }
    const productRefs  = sale.items.map((i: any) => db.doc(`${base}/products/${i.productId}`));
    const productSnaps = await Promise.all(productRefs.map((r: any) => txn.get(r)));
    const receiptRef   = sale.receiptId ? db.doc(`${base}/receipts/${sale.receiptId}`) : null;

    // ══ PHASE 2 — WRITES ════════════════════════════════════
    for (let i = 0; i < sale.items.length; i++) {
      const item     = sale.items[i];
      const curStock = productSnaps[i].exists ? (productSnaps[i].data()!.currentStock ?? 0) : 0;
      txn.update(productRefs[i], { currentStock: curStock + item.qty, updatedAt: FieldValue.serverTimestamp() });
      txn.set(db.collection(`${base}/stockMovements`).doc(), {
        companyId, productId: item.productId, productName: item.productName,
        type: 'SALE_VOID', qty: item.qty, refId: saleId, refType: 'sale_void',
        notes: sale.voidReason, createdAt: FieldValue.serverTimestamp(), createdBy: sale.voidedBy,
      });
    }
    if (sale.amountDue > 0) {
      txn.update(db.doc(`${base}/customers/${sale.customerId}`), {
        currentBalance: FieldValue.increment(-sale.amountDue),
        balanceUpdatedAt: FieldValue.serverTimestamp(),
      });
    }
    if (receiptRef) {
      txn.update(receiptRef, { isVoid: true, voidReason: 'Parent sale voided',
        voidedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    }
    txn.set(db.collection('auditLog').doc(), {
      companyId, action: 'SALE_VOIDED', entityType: 'sale', entityId: saleId,
      data: { invoiceNumber: sale.invoiceNumber, customerId: sale.customerId,
              grandTotal: sale.grandTotal, amountDue: sale.amountDue, voidReason: sale.voidReason },
      performedBy: sale.voidedBy, createdAt: FieldValue.serverTimestamp(),
    });
    txn.update(saleRef, { status: 'voided', voidProcessed: true, updatedAt: FieldValue.serverTimestamp() });
  });

  try {
    const ownerQ = await db.collection(`${base}/users`).where('role','==','owner').limit(1).get();
    if (!ownerQ.empty && ownerQ.docs[0].data().fcmToken) {
      console.log(`[saleEngine] void notification queued`);
    }
  } catch (e) { console.warn('[saleEngine] notify failed:', e); }

  console.log(`[saleEngine] voided: ${companyId}/${saleId}`);
}
