// ─────────────────────────────────────────────────────────────
// Receipt Service — src/services/receiptService.ts
//
// Receipt reduces customer receivable balance.
// CF owns: receipt number generation, balance update, audit log.
//
// Data model is MVP-ready AND future-proof:
//   allocationMode: 'customer_balance' — applies to overall balance
//   allocations: []                     — empty now, used later for FIFO
//   linkedInvoiceIds: []                — empty now, used later for matching
//
// This means adding invoice allocation later requires no schema change —
// just populate allocations and change allocationMode.
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
import type { Receipt } from '@/pages/receipts/receiptData';
import type { PaymentMethod } from '@/pages/sales/saleData';

// ── Create receipt ────────────────────────────────────────────
export async function createReceipt(
  companyId: string,
  uid:       string,
  data: {
    customerId:    string;
    amount:        number;
    paymentMethod: PaymentMethod;
    referenceNo:   string | null;
    date:          Date;
    notes:         string | null;
  }
): Promise<string> {
  const ref = doc(collection(db, SUB(companyId).receipts));
  await setDoc(ref, {
    companyId,
    customerId:       data.customerId,
    receiptNumber:    null,   // assigned by CF
    amount:           data.amount,
    paymentMethod:    data.paymentMethod,
    referenceNo:      data.referenceNo,
    date:             data.date,
    notes:            data.notes,
    // MVP: apply to overall customer balance
    // Future: change allocationMode and populate allocations
    allocationMode:   'customer_balance',
    allocations:      [],
    linkedInvoiceIds: [],
    isVoid:           false,
    voidReason:       null,
    voidedAt:         null,
    voidedBy:         null,
    voidProcessed:    false,
    balanceProcessed: false,
    source:           'manual',
    status:           'pending',
    failureReason:    null,
    createdAt:        serverTimestamp(),
    updatedAt:        serverTimestamp(),
    createdBy:        uid,
  });
  return ref.id;
}

// ── Void receipt ──────────────────────────────────────────────
// Client sets void intent. CF sets status: 'voided'.
export async function voidReceipt(
  companyId: string,
  receiptId: string,
  uid:       string,
  reason:    string
): Promise<void> {
  if (!reason.trim()) throw new Error('Void reason is required');
  await updateDoc(doc(db, SUB(companyId).receipts, receiptId), {
    isVoid:    true,
    voidReason:reason.trim(),
    voidedAt:  serverTimestamp(),
    voidedBy:  uid,
    updatedAt: serverTimestamp(),
    // status: NOT SET HERE — CF owns this
  });
}

// ── Real-time list ────────────────────────────────────────────
export function subscribeToReceipts(
  companyId: string,
  callback:  (receipts: Receipt[]) => void
): Unsubscribe {
  const q = query(
    collection(db, SUB(companyId).receipts),
    where('companyId', '==', companyId),
    orderBy('date', 'desc')
  );
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Receipt)))
  );
}
