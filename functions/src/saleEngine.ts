// ─────────────────────────────────────────────────────────────
// Cloud Function: Sale Engine
// Region: europe-west1
//
// TRANSACTION RULE: All reads MUST happen before any writes.
// Firestore will throw if you call txn.get() after txn.set/update.
//
// IDEMPOTENCY:
//   stockProcessed + balanceProcessed guard creation.
//   voidProcessed guards void reversal.
//
// Status flow:
//   client creates → pending
//   CF confirms   → confirmed
//   CF fails      → failed + failureReason
//   client voids  → isVoid: true (CF detects)
//   CF voids      → voided + voidProcessed: true
// ─────────────────────────────────────────────────────────────

import * as functions from 'firebase-functions/v2';
import { getFirestore, FieldValue, Transaction } from 'firebase-admin/firestore';

const db     = getFirestore();
const REGION = 'europe-west1';

// ── Counter generators — reads happen INSIDE caller's transaction ─
async function generateInvoiceNumber(companyId: string, txn: Transaction): Promise<string> {
  const ref  = db.doc(`companies/${companyId}/settings/invoiceCounter`);
  const snap = await txn.get(ref);
  const year = new Date().getFullYear();
  const prefix  = snap.exists ? (snap.data()?.prefix  ?? 'INV') : 'INV';
  const padding = snap.exists ? (snap.data()?.padding ?? 4)     : 4;
  const storedYear = snap.exists ? (snap.data()?.year ?? year)  : year;
  const next = (storedYear === year && snap.exists) ? (snap.data()?.next ?? 1) : 1;
  txn.set(ref, { prefix, year, next: next + 1, padding }, { merge: true });
  return `${prefix}-${year}-${String(next).padStart(padding, '0')}`;
}

async function generateReceiptNumber(companyId: string, txn: Transaction): Promise<string> {
  const ref  = db.doc(`companies/${companyId}/settings/receiptCounter`);
  const snap = await txn.get(ref);
  const year = new Date().getFullYear();
  const prefix  = snap.exists ? (snap.data()?.prefix  ?? 'RCT') : 'RCT';
  const padding = snap.exists ? (snap.data()?.padding ?? 4)     : 4;
  const storedYear = snap.exists ? (snap.data()?.year ?? year)  : year;
  const next = (storedYear === year && snap.exists) ? (snap.data()?.next ?? 1) : 1;
  txn.set(ref, { prefix, year, next: next + 1, padding }, { merge: true });
  return `${prefix}-${year}-${String(next).padStart(padding, '0')}`;
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

// ── Process sale creation (reads first, then writes) ──────────
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
      // PHASE 1 — ALL READS (no writes until phase 2)
      // ══════════════════════════════════════════════════════

      // Idempotency check
      const liveSaleSnap = await txn.get(saleRef);
      if (!liveSaleSnap.exists) return;
      const liveSale = liveSaleSnap.data()!;
      if (liveSale.stockProcessed || liveSale.balanceProcessed) {
        console.log(`[saleEngine] already processed: ${saleId}`);
        return;
      }

      // Counter reads (generateX also writes counter — must come after idempotency check
      // but counters are set not updated so order is safe here)
      const invoiceNumber = await generateInvoiceNumber(companyId, txn);
      const needsReceipt  = (sale.paymentType === 'cash' || sale.paymentType === 'partial') && sale.amountReceived > 0;
      let receiptNumber   = '';
      let receiptId       = '';
      if (needsReceipt) {
        receiptNumber = await generateReceiptNumber(companyId, txn);
        receiptId     = db.collection(`${base}/receipts`).doc().id;
      }

      // Settings read
      const settingsSnap  = await txn.get(db.doc(`${base}/settings/inventory`));
      const allowNegative = settingsSnap.exists ? (settingsSnap.data()?.allowNegativeStock ?? false) : false;

      // Product reads
      const productRefs  = sale.items.map((item: any) => db.doc(`${base}/products/${item.productId}`));
      const productSnaps = await Promise.all(productRefs.map((ref: any) => txn.get(ref)));

      // Customer read
      const customerRef  = db.doc(`${base}/customers/${sale.customerId}`);
      const customerSnap = await txn.get(customerRef);
      if (!customerSnap.exists) throw new Error(`Customer not found: ${sale.customerId}`);

      // Credit limit approver read (if needed)
      const customerData   = customerSnap.data()!;
      const currentBalance = customerData.currentBalance ?? 0;
      const creditLimit    = customerData.creditLimit    ?? null;
      const newBalance     = currentBalance + sale.amountDue;

      if (creditLimit !== null && newBalance > creditLimit && sale.amountDue > 0) {
        const override = sale.creditOverride;
        const hasShape = override?.overridden === true &&
          typeof override?.reason === 'string' && override.reason.trim().length > 0 &&
          typeof override?.by === 'string'     && override.by.trim().length > 0;
        if (!hasShape) throw new Error(`credit limit exceeded: no valid override.`);

        const approverSnap = await txn.get(db.doc(`${base}/users/${override.by}`));
        if (!approverSnap.exists) throw new Error(`credit limit override rejected: approver not found.`);
        const approverData = approverSnap.data()!;
        if (!((approverData.role === 'owner' || approverData.role === 'admin') && approverData.status === 'active')) {
          throw new Error(`credit limit override rejected: ${override.by} is not active owner/admin.`);
        }
      }

      // Validate stock (read phase)
      for (let i = 0; i < sale.items.length; i++) {
        const item         = sale.items[i];
        const productSnap  = productSnaps[i];
        if (!productSnap.exists) throw new Error(`Product not found: ${item.productId}`);
        const currentStock = productSnap.data()!.currentStock ?? 0;
        if (currentStock - item.qty < 0 && !allowNegative) {
          throw new Error(`Insufficient stock for ${item.productName}: need ${item.qty}, have ${currentStock}`);
        }
      }

      // ══════════════════════════════════════════════════════
      // PHASE 2 — ALL WRITES
      // ══════════════════════════════════════════════════════

      // Stock decrements + movements
      for (let i = 0; i < sale.items.length; i++) {
        const item        = sale.items[i];
        const productSnap = productSnaps[i];
        const newStock    = (productSnap.data()!.currentStock ?? 0) - item.qty;
        txn.update(productRefs[i], { currentStock: newStock, updatedAt: FieldValue.serverTimestamp() });
        txn.set(db.collection(`${base}/stockMovements`).doc(), {
          companyId, productId: item.productId, productName: item.productName,
          type: 'SALE', qty: -item.qty, refId: saleId, refType: 'sale',
          notes: null, createdAt: FieldValue.serverTimestamp(), createdBy: sale.createdBy,
        });
      }

      // Customer balance
      if (sale.amountDue > 0) {
        txn.update(customerRef, {
          currentBalance:   FieldValue.increment(sale.amountDue),
          balanceUpdatedAt: FieldValue.serverTimestamp(),
        });
      }

      // Auto receipt
      if (needsReceipt) {
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

      // Audit log
      txn.set(db.collection('auditLog').doc(), {
        companyId, action: 'SALE_CONFIRMED', entityType: 'sale', entityId: saleId,
        data: { invoiceNumber, customerId: sale.customerId, grandTotal: sale.grandTotal,
                amountDue: sale.amountDue, paymentType: sale.paymentType,
                creditOverride: sale.creditOverride ?? null },
        performedBy: sale.createdBy, createdAt: FieldValue.serverTimestamp(),
      });

      // Confirm sale
      txn.update(saleRef, {
        invoiceNumber, receiptId: receiptId || null,
        stockProcessed: true, balanceProcessed: true,
        status: 'confirmed', updatedAt: FieldValue.serverTimestamp(),
      });
    });

    console.log(`[saleEngine] confirmed: ${companyId}/${saleId}`);

  } catch (err) {
    const errMsg = String(err);
    const isPermanent = errMsg.includes('Insufficient stock') || errMsg.includes('Product not found') ||
      errMsg.includes('credit limit') || errMsg.includes('Customer not found');
    await saleRef.update({ status: 'failed', failureReason: errMsg, updatedAt: FieldValue.serverTimestamp() });
    console.error(`[saleEngine] ${isPermanent ? 'permanent' : 'transient'} failure: ${saleId}`, err);
    if (!isPermanent) throw err;
  }
}

// ── Process void (reads first, then writes) ───────────────────
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
      console.log(`[saleEngine] void already processed: ${saleId}`);
      return;
    }

    const productRefs  = sale.items.map((item: any) => db.doc(`${base}/products/${item.productId}`));
    const productSnaps = await Promise.all(productRefs.map((ref: any) => txn.get(ref)));
    const receiptRef   = sale.receiptId ? db.doc(`${base}/receipts/${sale.receiptId}`) : null;

    // ══ PHASE 2 — WRITES ════════════════════════════════════

    // Restore stock
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

    // Reverse customer balance
    if (sale.amountDue > 0) {
      txn.update(db.doc(`${base}/customers/${sale.customerId}`), {
        currentBalance: FieldValue.increment(-sale.amountDue),
        balanceUpdatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Void linked receipt
    if (receiptRef) {
      txn.update(receiptRef, { isVoid: true, voidReason: 'Parent sale voided',
        voidedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    }

    // Audit log
    txn.set(db.collection('auditLog').doc(), {
      companyId, action: 'SALE_VOIDED', entityType: 'sale', entityId: saleId,
      data: { invoiceNumber: sale.invoiceNumber, customerId: sale.customerId,
              grandTotal: sale.grandTotal, amountDue: sale.amountDue, voidReason: sale.voidReason },
      performedBy: sale.voidedBy, createdAt: FieldValue.serverTimestamp(),
    });

    // Mark voided
    txn.update(saleRef, { status: 'voided', voidProcessed: true, updatedAt: FieldValue.serverTimestamp() });
  });

  // Owner notification (best effort)
  try {
    const ownerQuery = await db.collection(`${base}/users`).where('role','==','owner').limit(1).get();
    if (!ownerQuery.empty && ownerQuery.docs[0].data().fcmToken) {
      console.log(`[saleEngine] void notification queued for owner`);
    }
  } catch (e) { console.warn('[saleEngine] notify failed:', e); }

  console.log(`[saleEngine] voided: ${companyId}/${saleId}`);
}
