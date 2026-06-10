// ─────────────────────────────────────────────────────────────
// Cloud Function: Receipt Engine
// Region: europe-west1
// Transaction rule: ALL reads before ALL writes.
// ─────────────────────────────────────────────────────────────

import * as functions from 'firebase-functions/v2';
import { getFirestore, FieldValue, Transaction } from 'firebase-admin/firestore';

const db     = getFirestore();
const REGION = 'europe-west1';

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

export const onReceiptWrite = functions.firestore.onDocumentWritten(
  { document: 'companies/{companyId}/receipts/{receiptId}', region: REGION },
  async (event) => {
    const companyId = event.params.companyId;
    const receiptId = event.params.receiptId;
    const before    = event.data?.before?.data();
    const after     = event.data?.after?.data();
    if (!after) return;

    if (after.status === 'pending' && !after.balanceProcessed) {
      await processReceiptCreation(companyId, receiptId, after);
      return;
    }
    if (after.isVoid && !after.voidProcessed && before && !before.isVoid) {
      await processReceiptVoid(companyId, receiptId, after);
      return;
    }
  }
);

async function processReceiptCreation(
  companyId: string,
  receiptId: string,
  receipt:   FirebaseFirestore.DocumentData
): Promise<void> {
  const base       = `companies/${companyId}`;
  const receiptRef = db.doc(`${base}/receipts/${receiptId}`);

  try {
    await db.runTransaction(async txn => {

      // ══ PHASE 1 — ALL READS ══════════════════════════════

      // Idempotency check
      const liveSnap = await txn.get(receiptRef);
      if (!liveSnap.exists) return;
      if (liveSnap.data()!.balanceProcessed) {
        console.log(`[receiptEngine] already processed: ${receiptId}`);
        return;
      }

      // Counter read
      const receiptNumber = await generateReceiptNumber(companyId, txn);

      // Customer read
      const customerRef  = db.doc(`${base}/customers/${receipt.customerId}`);
      const customerSnap = await txn.get(customerRef);
      if (!customerSnap.exists) throw new Error(`Customer not found: ${receipt.customerId}`);

      // ══ PHASE 2 — ALL WRITES ════════════════════════════

      // Decrease customer balance
      txn.update(customerRef, {
        currentBalance:   FieldValue.increment(-receipt.amount),
        balanceUpdatedAt: FieldValue.serverTimestamp(),
      });

      // Audit log
      txn.set(db.collection('auditLog').doc(), {
        companyId, action: 'RECEIPT_CONFIRMED', entityType: 'receipt', entityId: receiptId,
        data: { receiptNumber, customerId: receipt.customerId, amount: receipt.amount,
                paymentMethod: receipt.paymentMethod, referenceNo: receipt.referenceNo },
        performedBy: receipt.createdBy, createdAt: FieldValue.serverTimestamp(),
      });

      // Confirm
      txn.update(receiptRef, {
        receiptNumber, balanceProcessed: true,
        status: 'confirmed', updatedAt: FieldValue.serverTimestamp(),
      });
    });

    console.log(`[receiptEngine] confirmed: ${companyId}/${receiptId}`);

  } catch (err) {
    await receiptRef.update({ status: 'failed', failureReason: String(err), updatedAt: FieldValue.serverTimestamp() });
    console.error(`[receiptEngine] failed: ${receiptId}`, err);
    const isPermanent = String(err).includes('Customer not found');
    if (!isPermanent) throw err;
  }
}

async function processReceiptVoid(
  companyId: string,
  receiptId: string,
  receipt:   FirebaseFirestore.DocumentData
): Promise<void> {
  const base       = `companies/${companyId}`;
  const receiptRef = db.doc(`${base}/receipts/${receiptId}`);

  await db.runTransaction(async txn => {

    // ══ PHASE 1 — READS ══════════════════════════════════════
    const liveSnap = await txn.get(receiptRef);
    if (!liveSnap.exists) return;
    if (liveSnap.data()!.voidProcessed) {
      console.log(`[receiptEngine] void already processed: ${receiptId}`);
      return;
    }

    const customerRef  = db.doc(`${base}/customers/${receipt.customerId}`);
    const customerSnap = await txn.get(customerRef);

    // ══ PHASE 2 — WRITES ══════════════════════════════════════

    // Restore customer balance
    if (customerSnap.exists) {
      txn.update(customerRef, {
        currentBalance:   FieldValue.increment(receipt.amount),
        balanceUpdatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Audit log
    txn.set(db.collection('auditLog').doc(), {
      companyId, action: 'RECEIPT_VOIDED', entityType: 'receipt', entityId: receiptId,
      data: { receiptNumber: receipt.receiptNumber, customerId: receipt.customerId,
              amount: receipt.amount, voidReason: receipt.voidReason },
      performedBy: receipt.voidedBy, createdAt: FieldValue.serverTimestamp(),
    });

    // CF sets status
    txn.update(receiptRef, { status: 'voided', voidProcessed: true, updatedAt: FieldValue.serverTimestamp() });
  });

  console.log(`[receiptEngine] voided: ${companyId}/${receiptId}`);
}
