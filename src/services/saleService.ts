// ─────────────────────────────────────────────────────────────
// Sale Service — src/services/saleService.ts
//
// UI creates sale document only.
// Cloud Function (saleEngine.ts) owns ALL side effects:
//   - invoice number generation (atomic counter)
//   - stock decrease per line item
//   - customer balance update
//   - receipt document creation (cash/partial)
//   - audit log entry
//   - owner notification on void
//
// Client CANNOT:
//   - Write stockMovements
//   - Write customer currentBalance
//   - Generate invoice numbers
//   - Edit confirmed sales
//   - Delete any sale (void only)
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
import type { Sale, SaleLineItem, SalePaymentType, PaymentMethod } from '@/pages/sales/saleData';

// ── Create sale ───────────────────────────────────────────────
// Creates the sale document in 'pending' status.
// CF picks it up, generates invoice number, processes stock+balance,
// then updates status to 'confirmed'.
export async function createSale(
  companyId: string,
  uid:       string,
  data: {
    customerId:     string;
    date:           Date;
    items:          SaleLineItem[];
    subtotal:       number;
    discountTotal:  number;
    grandTotal:     number;
    paymentType:    SalePaymentType;
    amountReceived: number;
    amountDue:      number;
    paymentMethod:  PaymentMethod | null;
    notes:          string | null;
    creditOverride: {
      overridden:       boolean;
      reason:           string;
      by:               string;    // uid of who approved
      oldBalance:       number;    // customer balance before this sale
      saleAmount:       number;    // amountDue being added
      projectedBalance: number;    // oldBalance + saleAmount
      creditLimit:      number;    // the limit that was exceeded
    } | null;
  }
): Promise<string> {
  const ref = doc(collection(db, SUB(companyId).sales));

  await setDoc(ref, {
    companyId,
    customerId:      data.customerId,
    // invoiceNumber: assigned by CF atomically — not set here
    invoiceNumber:   null,
    date:            data.date,
    items:           data.items,
    subtotal:        data.subtotal,
    discountTotal:   data.discountTotal,
    grandTotal:      data.grandTotal,
    paymentType:     data.paymentType,
    amountReceived:  data.amountReceived,
    amountDue:       data.amountDue,
    paymentMethod:   data.paymentMethod,
    notes:           data.notes,
    creditOverride:  data.creditOverride,
    isVoid:          false,
    voidReason:      null,
    voidedAt:        null,
    voidedBy:        null,
    receiptId:       null,
    stockProcessed:  false,
    balanceProcessed:false,
    // CF will update status to 'confirmed' after processing
    status:          'pending',
    createdAt:       serverTimestamp(),
    updatedAt:       serverTimestamp(),
    createdBy:       uid,
  });

  return ref.id;
}

// ── Void sale ─────────────────────────────────────────────────
// Client sets isVoid = true + voidReason.
// CF detects the change and reverses:
//   - stock movements (adds back)
//   - customer balance (subtracts amountDue)
//   - marks linked receipt as voided
//   - writes audit log
//   - notifies owner via FCM
export async function voidSale(
  companyId: string,
  saleId:    string,
  uid:       string,
  reason:    string
): Promise<void> {
  if (!reason.trim()) throw new Error('Void reason is required');

  await updateDoc(doc(db, SUB(companyId).sales, saleId), {
    isVoid:    true,
    voidReason:reason.trim(),
    voidedAt:  serverTimestamp(),
    voidedBy:  uid,
    status:    'voided',
    updatedAt: serverTimestamp(),
    // stockProcessed and balanceProcessed will be reset by CF
    // after it reverses the impacts
  });
}

// ── Real-time sales list ──────────────────────────────────────
export function subscribeToSales(
  companyId: string,
  callback:  (sales: Sale[]) => void
): Unsubscribe {
  const q = query(
    collection(db, SUB(companyId).sales),
    where('companyId', '==', companyId),
    orderBy('date', 'desc')
  );
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale)))
  );
}

// ── Real-time single sale ─────────────────────────────────────
export function subscribeToSale(
  companyId: string,
  saleId:    string,
  callback:  (sale: Sale | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, SUB(companyId).sales, saleId),
    snap => callback(snap.exists() ? { id: snap.id, ...snap.data() } as Sale : null)
  );
}
