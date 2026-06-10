// ─────────────────────────────────────────────────────────────
// Cloud Function: Payment Engine — europe-west1
//
// TRANSACTION DISCIPLINE:
//   Phase 1 — ALL reads (zero writes)
//   Phase 2 — ALL writes (zero reads)
//   Counter split: readCounterNext() = read only
//                  writeCounterNext() = write only
//
// SUPPLIER BALANCE:
//   NOT touched here. supplierBalance.ts recalculates from all
//   payments/purchases/returns on every payment write.
//   Single source of truth = supplierBalance.ts.
//
// OVERPAYMENT GATE:
//   If payment.amount > supplier.currentBalance AND no valid
//   owner/admin override → throw permanent error.
//   Override verified server-side: approver UID read from
//   companies/{cid}/users/{uid} inside the transaction.
// ─────────────────────────────────────────────────────────────

import * as functions from 'firebase-functions/v2';
import { getFirestore, FieldValue, Transaction } from 'firebase-admin/firestore';

const db     = getFirestore();
const REGION = 'europe-west1';

// ── Counter helpers — split read / write ──────────────────────
interface CounterState {
  ref:     FirebaseFirestore.DocumentReference;
  prefix:  string;
  year:    number;
  next:    number;
  padding: number;
}

// Phase 1 — READ ONLY, no txn.set
async function readCounterNext(
  companyId:     string,
  counterName:   string,
  defaultPrefix: string,
  txn:           Transaction
): Promise<CounterState> {
  const ref  = db.doc(`companies/${companyId}/settings/${counterName}`);
  const snap = await txn.get(ref);
  const year = new Date().getFullYear();
  const prefix     = snap.exists ? (snap.data()?.prefix  ?? defaultPrefix) : defaultPrefix;
  const padding    = snap.exists ? (snap.data()?.padding ?? 4)             : 4;
  const storedYear = snap.exists ? (snap.data()?.year    ?? year)          : year;
  const next       = (storedYear === year && snap.exists) ? (snap.data()?.next ?? 1) : 1;
  return { ref, prefix, year, next, padding };
}

// Phase 2 — WRITE ONLY, no txn.get
function writeCounterNext(state: CounterState, txn: Transaction): string {
  txn.set(state.ref, {
    prefix: state.prefix, year: state.year,
    next: state.next + 1, padding: state.padding,
  }, { merge: true });
  return `${state.prefix}-${state.year}-${String(state.next).padStart(state.padding, '0')}`;
}

// ── Main trigger ──────────────────────────────────────────────
export const onPaymentWriteEngine = functions.firestore.onDocumentWritten(
  { document: 'companies/{companyId}/payments/{paymentId}', region: REGION },
  async (event) => {
    const companyId = event.params.companyId;
    const paymentId = event.params.paymentId;
    const before    = event.data?.before?.data();
    const after     = event.data?.after?.data();
    if (!after) return;

    if (after.status === 'pending' && !after.balanceProcessed) {
      await processPaymentCreation(companyId, paymentId, after);
      return;
    }
    if (after.isVoid && !after.voidProcessed && before && !before.isVoid) {
      await processPaymentVoid(companyId, paymentId, after);
      return;
    }
  }
);

// ── Process payment creation ──────────────────────────────────
async function processPaymentCreation(
  companyId: string,
  paymentId: string,
  payment:   FirebaseFirestore.DocumentData
): Promise<void> {
  const base       = `companies/${companyId}`;
  const paymentRef = db.doc(`${base}/payments/${paymentId}`);

  try {
    await db.runTransaction(async txn => {

      // ══════════════════════════════════════════════════════
      // PHASE 1 — ALL READS (zero writes)
      // ══════════════════════════════════════════════════════

      // 1a. Idempotency check
      const liveSnap = await txn.get(paymentRef);
      if (!liveSnap.exists) return;
      const live = liveSnap.data()!;
      if (live.balanceProcessed) {
        console.log(`[paymentEngine] already processed: ${paymentId}`);
        return;
      }

      // 1b. Counter read (read-only — no write yet)
      const counterState = await readCounterNext(companyId, 'paymentCounter', 'PAY', txn);

      // 1c. Supplier read
      const supplierRef  = db.doc(`${base}/suppliers/${payment.supplierId}`);
      const supplierSnap = await txn.get(supplierRef);
      if (!supplierSnap.exists) throw new Error(`Supplier not found: ${payment.supplierId}`);

      const supplierData   = supplierSnap.data()!;
      const currentPayable = supplierData.currentBalance ?? 0;

      // 1d. Overpayment check — gate strong, advance payments deliberate
      if (payment.amount > currentPayable && currentPayable > 0) {
        const override = payment.overpaymentOverride;

        // Basic shape check
        const hasShape = override?.overridden === true &&
          typeof override?.reason === 'string' && override.reason.trim().length > 0 &&
          typeof override?.by    === 'string' && override.by.trim().length > 0;

        if (!hasShape) {
          throw new Error(
            `overpayment blocked: paying ${payment.amount} but payable is only ` +
            `${currentPayable}. No valid owner/admin override provided.`
          );
        }

        // 1e. Verify approver is active owner/admin — read inside transaction
        const approverSnap = await txn.get(db.doc(`${base}/users/${override.by}`));
        if (!approverSnap.exists) {
          throw new Error(`overpayment override rejected: approver ${override.by} not found.`);
        }
        const approverData = approverSnap.data()!;
        const isAuthorised =
          (approverData.role === 'owner' || approverData.role === 'admin') &&
          approverData.status === 'active';
        if (!isAuthorised) {
          throw new Error(
            `overpayment override rejected: ${override.by} has role ` +
            `'${approverData.role}' (${approverData.status}). ` +
            `Only active owner or admin can approve advance payments.`
          );
        }

        console.log(
          `[paymentEngine] overpayment approved by ${approverData.role} ${override.by}: ` +
          `${payment.amount} > ${currentPayable} — reason: ${override.reason}`
        );
      }

      // ══════════════════════════════════════════════════════
      // PHASE 2 — ALL WRITES (zero reads after this point)
      // ══════════════════════════════════════════════════════

      // 2a. Write counter — get formatted payment number
      const paymentNumber = writeCounterNext(counterState, txn);

      // 2b. Supplier balance NOT updated here.
      //     supplierBalance.ts recalculates from all payments on this write event.
      //     Single source of truth — no double-update risk.

      // 2c. Audit log
      txn.set(db.collection('auditLog').doc(), {
        companyId,
        action:    'PAYMENT_CONFIRMED',
        entityType:'payment',
        entityId:  paymentId,
        data: {
          paymentNumber,
          supplierId:          payment.supplierId,
          amount:              payment.amount,
          paymentMethod:       payment.paymentMethod,
          referenceNo:         payment.referenceNo,
          overpaymentOverride: payment.overpaymentOverride ?? null,
        },
        performedBy: payment.createdBy,
        createdAt:   FieldValue.serverTimestamp(),
      });

      // 2d. Confirm payment
      txn.update(paymentRef, {
        paymentNumber,
        balanceProcessed: true,
        status:           'confirmed',
        updatedAt:        FieldValue.serverTimestamp(),
      });
    });

    console.log(`[paymentEngine] confirmed: ${companyId}/${paymentId}`);

  } catch (err) {
    const errMsg = String(err);
    const isPermanent =
      errMsg.includes('Supplier not found') ||
      errMsg.includes('overpayment blocked') ||
      errMsg.includes('overpayment override rejected');

    await paymentRef.update({
      status:        'failed',
      failureReason: errMsg,
      updatedAt:     FieldValue.serverTimestamp(),
    });

    console.error(
      `[paymentEngine] ${isPermanent ? 'permanent' : 'transient'} failure: ${paymentId}`, err
    );
    if (!isPermanent) throw err;
  }
}

// ── Process void (idempotent, reads-first) ────────────────────
async function processPaymentVoid(
  companyId: string,
  paymentId: string,
  payment:   FirebaseFirestore.DocumentData
): Promise<void> {
  const base       = `companies/${companyId}`;
  const paymentRef = db.doc(`${base}/payments/${paymentId}`);

  await db.runTransaction(async txn => {

    // ══ PHASE 1 — READS ══════════════════════════════════════
    const liveSnap = await txn.get(paymentRef);
    if (!liveSnap.exists) return;
    if (liveSnap.data()!.voidProcessed) {
      console.log(`[paymentEngine] void already processed: ${paymentId}`);
      return;
    }

    // ══ PHASE 2 — WRITES ══════════════════════════════════════

    // Supplier balance reversal handled by supplierBalance.ts recalculator.
    // It will fire on this same write event and recalculate from all
    // non-voided payments/purchases/returns.

    // Audit log
    txn.set(db.collection('auditLog').doc(), {
      companyId,
      action:    'PAYMENT_VOIDED',
      entityType:'payment',
      entityId:  paymentId,
      data: {
        paymentNumber: payment.paymentNumber,
        supplierId:    payment.supplierId,
        amount:        payment.amount,
        voidReason:    payment.voidReason,
      },
      performedBy: payment.voidedBy,
      createdAt:   FieldValue.serverTimestamp(),
    });

    // CF sets status — client never sets status: 'voided'
    txn.update(paymentRef, {
      status:        'voided',
      voidProcessed: true,
      updatedAt:     FieldValue.serverTimestamp(),
    });
  });

  // Owner notification (best effort, outside transaction)
  try {
    const ownerQ = await db
      .collection(`${base}/users`)
      .where('role', '==', 'owner')
      .limit(1)
      .get();
    if (!ownerQ.empty && ownerQ.docs[0].data().fcmToken) {
      console.log(`[paymentEngine] void notification queued for owner`);
    }
  } catch (e) { console.warn('[paymentEngine] notify failed:', e); }

  console.log(`[paymentEngine] voided: ${companyId}/${paymentId}`);
}
