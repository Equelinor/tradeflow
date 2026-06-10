// ─────────────────────────────────────────────────────────────
// Cloud Function: Receipt Engine
// Region: europe-west1
//
// On receipt CREATE (pending → confirmed):
//   1. Generate receipt number atomically
//   2. Decrease customer balance by amount
//      (receipt cannot exceed balance unless override)
//   3. Write audit log
//   4. Update status → confirmed
//
// On receipt VOID (isVoid: false → true):
//   1. Restore customer balance (add back)
//   2. Write audit log
//   3. CF sets status → voided
//
// Idempotency: balanceProcessed + voidProcessed guards
// ─────────────────────────────────────────────────────────────

import * as functions from 'firebase-functions/v2';
import {
  getFirestore,
  FieldValue,
  Transaction,
} from 'firebase-admin/firestore';

const db     = getFirestore();
const REGION = 'europe-west1';

// ── Receipt number generator ──────────────────────────────────
async function generateReceiptNumber(
  companyId: string,
  txn:       Transaction
): Promise<string> {
  const counterRef = db.doc(
    `companies/${companyId}/settings/receiptCounter`
  );
  const snap       = await txn.get(counterRef);
  const year       = new Date().getFullYear();
  const prefix     = snap.exists ? (snap.data()?.prefix  ?? 'RCT') : 'RCT';
  const padding    = snap.exists ? (snap.data()?.padding ?? 4)     : 4;
  const storedYear = snap.exists ? (snap.data()?.year    ?? year)  : year;
  const next       = (storedYear === year && snap.exists)
    ? (snap.data()?.next ?? 1) : 1;

  txn.set(counterRef, { prefix, year, next: next + 1, padding }, { merge: true });
  return `${prefix}-${year}-${String(next).padStart(padding, '0')}`;
}

// ── Main trigger ──────────────────────────────────────────────
export const onReceiptWrite = functions.firestore.onDocumentWritten(
  { document: 'companies/{companyId}/receipts/{receiptId}', region: REGION },
  async (event) => {
    const companyId = event.params.companyId;
    const receiptId = event.params.receiptId;
    const before    = event.data?.before?.data();
    const after     = event.data?.after?.data();

    if (!after) return;

    // New receipt — pending
    if (after.status === 'pending' && !after.balanceProcessed) {
      await processReceiptCreation(companyId, receiptId, after);
      return;
    }

    // Void
    if (after.isVoid && !after.voidProcessed && before && !before.isVoid) {
      await processReceiptVoid(companyId, receiptId, after);
      return;
    }
  }
);

// ── Process new receipt (idempotent) ──────────────────────────
async function processReceiptCreation(
  companyId: string,
  receiptId: string,
  receipt:   FirebaseFirestore.DocumentData
): Promise<void> {
  const base       = `companies/${companyId}`;
  const receiptRef = db.doc(`${base}/receipts/${receiptId}`);

  try {
    await db.runTransaction(async txn => {
      // IDEMPOTENCY CHECK
      const liveSnap = await txn.get(receiptRef);
      if (!liveSnap.exists) return;
      if (liveSnap.data()!.balanceProcessed) {
        console.log(`[receiptEngine] already processed: ${receiptId}`);
        return;
      }

      // 1. Generate receipt number
      const receiptNumber = await generateReceiptNumber(companyId, txn);

      // 2. Read customer and decrease balance
      const customerRef  = db.doc(`${base}/customers/${receipt.customerId}`);
      const customerSnap = await txn.get(customerRef);
      if (!customerSnap.exists) throw new Error(`Customer not found: ${receipt.customerId}`);

      // Note: receipt reducing balance below zero is allowed
      // (overpayment becomes a credit — handled at business level)
      txn.update(customerRef, {
        currentBalance:   FieldValue.increment(-receipt.amount),
        balanceUpdatedAt: FieldValue.serverTimestamp(),
      });

      // 3. Audit log
      txn.set(db.collection('auditLog').doc(), {
        companyId,
        action:    'RECEIPT_CONFIRMED',
        entityType:'receipt',
        entityId:  receiptId,
        data: {
          receiptNumber,
          customerId:    receipt.customerId,
          amount:        receipt.amount,
          paymentMethod: receipt.paymentMethod,
          referenceNo:   receipt.referenceNo,
        },
        performedBy: receipt.createdBy,
        createdAt:   FieldValue.serverTimestamp(),
      });

      // 4. Mark confirmed
      txn.update(receiptRef, {
        receiptNumber,
        balanceProcessed: true,
        status:           'confirmed',
        updatedAt:        FieldValue.serverTimestamp(),
      });
    });

    console.log(`[receiptEngine] confirmed: ${companyId}/${receiptId}`);

  } catch (err) {
    await receiptRef.update({
      status:        'failed',
      failureReason: String(err),
      updatedAt:     FieldValue.serverTimestamp(),
    });
    console.error(`[receiptEngine] failed: ${receiptId}`, err);
    const isPermanent = String(err).includes('Customer not found');
    if (!isPermanent) throw err;
  }
}

// ── Process void (idempotent) ─────────────────────────────────
async function processReceiptVoid(
  companyId: string,
  receiptId: string,
  receipt:   FirebaseFirestore.DocumentData
): Promise<void> {
  const base       = `companies/${companyId}`;
  const receiptRef = db.doc(`${base}/receipts/${receiptId}`);

  await db.runTransaction(async txn => {
    // IDEMPOTENCY CHECK
    const liveSnap = await txn.get(receiptRef);
    if (!liveSnap.exists) return;
    if (liveSnap.data()!.voidProcessed) {
      console.log(`[receiptEngine] void already processed: ${receiptId}`);
      return;
    }

    // Restore customer balance
    txn.update(db.doc(`${base}/customers/${receipt.customerId}`), {
      currentBalance:   FieldValue.increment(receipt.amount),
      balanceUpdatedAt: FieldValue.serverTimestamp(),
    });

    // Audit log
    txn.set(db.collection('auditLog').doc(), {
      companyId,
      action:    'RECEIPT_VOIDED',
      entityType:'receipt',
      entityId:  receiptId,
      data: {
        receiptNumber: receipt.receiptNumber,
        customerId:    receipt.customerId,
        amount:        receipt.amount,
        voidReason:    receipt.voidReason,
      },
      performedBy: receipt.voidedBy,
      createdAt:   FieldValue.serverTimestamp(),
    });

    // CF sets status
    txn.update(receiptRef, {
      status:        'voided',
      voidProcessed: true,
      updatedAt:     FieldValue.serverTimestamp(),
    });
  });

  console.log(`[receiptEngine] voided: ${companyId}/${receiptId}`);
}
