// ─────────────────────────────────────────────────────────────
// Payment Service — src/services/paymentService.ts
//
// Payment reduces supplier payable balance.
// Supplier balance is owned by supplierBalance.ts recalculator —
// paymentEngine.ts does NOT touch currentBalance directly.
//
// Overpayment (payment > currentBalance) blocked by default.
// Requires owner/admin override with reason, verified server-side
// in paymentEngine.ts against live Firestore data.
// ─────────────────────────────────────────────────────────────

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { SUB } from '@/config';
import type { Payment } from '@/pages/payments/paymentData';
import type { PaymentMethod } from '@/pages/sales/saleData';

// ── Create payment ────────────────────────────────────────────
export async function createPayment(
  companyId: string,
  uid:       string,
  data: {
    supplierId:    string;
    amount:        number;
    paymentMethod: PaymentMethod;
    referenceNo:   string | null;
    date:          Date;
    notes:         string | null;
    overpaymentOverride: {
      overridden:     boolean;
      reason:         string;
      by:             string;
      currentPayable: number;
      paymentAmount:  number;
    } | null;
  }
): Promise<string> {
  const ref = doc(collection(db, SUB(companyId).payments));
  await setDoc(ref, {
    companyId,
    supplierId:      data.supplierId,
    paymentNumber:   null,   // assigned by CF atomically — never set by client
    amount:          data.amount,
    paymentMethod:   data.paymentMethod,
    referenceNo:     data.referenceNo,
    date:            data.date,
    notes:           data.notes,
    overpaymentOverride: data.overpaymentOverride,
    isVoid:          false,
    voidReason:      null,
    voidedAt:        null,
    voidedBy:        null,
    voidProcessed:   false,
    balanceProcessed:false,
    source:          'manual',
    status:          'pending',
    failureReason:   null,
    createdAt:       serverTimestamp(),
    updatedAt:       serverTimestamp(),
    createdBy:       uid,
  });
  return ref.id;
}

// ── Void payment ──────────────────────────────────────────────
// Client sets void intent only. CF sets status: 'voided'.
export async function voidPayment(
  companyId: string,
  paymentId: string,
  uid:       string,
  reason:    string
): Promise<void> {
  if (!reason.trim()) throw new Error('Void reason is required');
  await updateDoc(doc(db, SUB(companyId).payments, paymentId), {
    isVoid:    true,
    voidReason:reason.trim(),
    voidedAt:  serverTimestamp(),
    voidedBy:  uid,
    updatedAt: serverTimestamp(),
    // status: NOT SET HERE — CF owns this
  });
}

// ── Real-time list ────────────────────────────────────────────
export function subscribeToPayments(
  companyId: string,
  callback:  (payments: Payment[]) => void
): Unsubscribe {
  const q = query(
    collection(db, SUB(companyId).payments),
    where('companyId', '==', companyId),
    orderBy('date', 'desc')
  );
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment)))
  );
}
