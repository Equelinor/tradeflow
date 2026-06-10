// ─────────────────────────────────────────────────────────────
// Purchase Service — src/services/purchaseService.ts
//
// UI creates purchase document only (status: pending).
// Cloud Function (purchaseEngine.ts) owns ALL side effects:
//   - purchase number generation (atomic counter)
//   - stock INCREASE per line item
//   - supplier balance update (amountDue only)
//   - payment record for cash/partial
//   - audit log entry
//   - void reversal (stock decrease, balance decrease)
//
// Balance formula:
//   currentBalance += amountDue (NOT grandTotal)
//   Cash:    amountDue = 0         → no payable impact
//   Credit:  amountDue = grandTotal → full amount to payable
//   Partial: amountDue = remainder  → only unpaid to payable
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
import type { Purchase, PurchaseLineItem, PurchasePaymentType } from '@/pages/purchases/purchaseData';
import type { PaymentMethod } from '@/pages/sales/saleData';

// ── Create purchase ───────────────────────────────────────────
export async function createPurchase(
  companyId: string,
  uid:       string,
  data: {
    supplierId:        string;
    supplierInvoiceNo: string | null;
    date:              Date;
    items:             PurchaseLineItem[];
    subtotal:          number;
    discountTotal:     number;
    grandTotal:        number;
    paymentType:       PurchasePaymentType;
    amountPaid:        number;
    amountDue:         number;
    paymentMethod:     PaymentMethod | null;
    referenceNo:       string | null;
    notes:             string | null;
  }
): Promise<string> {
  const ref = doc(collection(db, SUB(companyId).purchases));
  await setDoc(ref, {
    companyId,
    supplierId:        data.supplierId,
    supplierInvoiceNo: data.supplierInvoiceNo,
    purchaseNumber:    null,   // assigned by CF atomically
    date:              data.date,
    items:             data.items,
    subtotal:          data.subtotal,
    discountTotal:     data.discountTotal,
    grandTotal:        data.grandTotal,
    paymentType:       data.paymentType,
    amountPaid:        data.amountPaid,
    amountDue:         data.amountDue,
    paymentMethod:     data.paymentMethod,
    referenceNo:       data.referenceNo,
    notes:             data.notes,
    isVoid:            false,
    voidReason:        null,
    voidedAt:          null,
    voidedBy:          null,
    stockProcessed:    false,
    balanceProcessed:  false,
    voidProcessed:     false,
    status:            'pending',
    failureReason:     null,
    createdAt:         serverTimestamp(),
    updatedAt:         serverTimestamp(),
    createdBy:         uid,
  });
  return ref.id;
}

// ── Void purchase ─────────────────────────────────────────────
// Client sets void intent only. CF sets status: 'voided'.
export async function voidPurchase(
  companyId:  string,
  purchaseId: string,
  uid:        string,
  reason:     string
): Promise<void> {
  if (!reason.trim()) throw new Error('Void reason is required');
  await updateDoc(doc(db, SUB(companyId).purchases, purchaseId), {
    isVoid:    true,
    voidReason:reason.trim(),
    voidedAt:  serverTimestamp(),
    voidedBy:  uid,
    updatedAt: serverTimestamp(),
    // status: NOT SET HERE — CF owns this
  });
}

// ── Real-time list ────────────────────────────────────────────
export function subscribeToPurchases(
  companyId: string,
  callback:  (purchases: Purchase[]) => void
): Unsubscribe {
  const q = query(
    collection(db, SUB(companyId).purchases),
    where('companyId', '==', companyId),
    orderBy('date', 'desc')
  );
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Purchase)))
  );
}

// ── Real-time single purchase ─────────────────────────────────
export function subscribeToPurchase(
  companyId:  string,
  purchaseId: string,
  callback:   (purchase: Purchase | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, SUB(companyId).purchases, purchaseId),
    snap => callback(snap.exists() ? { id: snap.id, ...snap.data() } as Purchase : null)
  );
}
