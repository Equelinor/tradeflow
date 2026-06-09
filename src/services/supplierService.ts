// ─────────────────────────────────────────────────────────────
// Supplier Service — src/services/supplierService.ts
//
// BALANCE RULE — enforced at every layer:
//
//   currentBalance = openingBalance
//                  + purchases       (+) supplier delivers goods
//                  - payments        (-) we pay the supplier
//                  - purchaseReturns (-) we return goods
//                  + supplierDebits  (+) supplier charges us extra
//
// This file owns client-side supplier writes.
// currentBalance is NEVER written here — Cloud Function territory.
// See: functions/src/supplierBalance.ts
// ─────────────────────────────────────────────────────────────

import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { SUB } from '@/config';
import type { Supplier } from '@/pages/suppliers/supplierData';

// ── Create ────────────────────────────────────────────────────
// openingBalance is set ONCE here and never changed after.
// currentBalance starts equal to openingBalance.
// From this point, only the Cloud Function writes currentBalance.
export async function createSupplier(
  companyId: string,
  uid:       string,
  data: {
    code:           string;
    name:           string;
    contactPerson:  string | null;
    phone:          string;
    whatsapp:       string | null;
    email:          string | null;
    address:        string | null;
    crNumber:       string | null;
    openingBalance: number;
  }
): Promise<string> {
  const ref = doc(collection(db, SUB(companyId).suppliers));
  await setDoc(ref, {
    companyId,
    code:           data.code.toUpperCase().trim(),
    name:           data.name.trim(),
    contactPerson:  data.contactPerson  || null,
    phone:          data.phone.trim(),
    whatsapp:       data.whatsapp       || data.phone.trim(),
    email:          data.email          || null,
    address:        data.address        || null,
    crNumber:       data.crNumber       || null,
    openingBalance: data.openingBalance,
    currentBalance: data.openingBalance, // CF owns this from here
    status:         'active',
    createdAt:      serverTimestamp(),
    updatedAt:      serverTimestamp(),
    createdBy:      uid,
  });
  return ref.id;
}

// ── Update profile only ───────────────────────────────────────
// currentBalance and openingBalance are INTENTIONALLY absent.
// Firestore rules enforce this via immutableFields().
export async function updateSupplierProfile(
  companyId:  string,
  supplierId: string,
  data: {
    code:          string;
    name:          string;
    contactPerson: string | null;
    phone:         string;
    whatsapp:      string | null;
    email:         string | null;
    address:       string | null;
    crNumber:      string | null;
  }
): Promise<void> {
  await updateDoc(doc(db, SUB(companyId).suppliers, supplierId), {
    code:          data.code.toUpperCase().trim(),
    name:          data.name.trim(),
    contactPerson: data.contactPerson || null,
    phone:         data.phone.trim(),
    whatsapp:      data.whatsapp      || data.phone.trim(),
    email:         data.email         || null,
    address:       data.address       || null,
    crNumber:      data.crNumber      || null,
    updatedAt:     serverTimestamp(),
    // currentBalance: NOT HERE — Cloud Function only
    // openingBalance: NOT HERE — immutable after creation
  });
}

// ── Status toggle ─────────────────────────────────────────────
export async function deactivateSupplier(
  companyId: string, supplierId: string
): Promise<void> {
  await updateDoc(doc(db, SUB(companyId).suppliers, supplierId), {
    status: 'inactive', updatedAt: serverTimestamp(),
  });
}

export async function reactivateSupplier(
  companyId: string, supplierId: string
): Promise<void> {
  await updateDoc(doc(db, SUB(companyId).suppliers, supplierId), {
    status: 'active', updatedAt: serverTimestamp(),
  });
}

// ── Real-time list ────────────────────────────────────────────
export function subscribeToSuppliers(
  companyId: string,
  callback:  (suppliers: Supplier[]) => void
): Unsubscribe {
  const q = query(
    collection(db, SUB(companyId).suppliers),
    where('companyId', '==', companyId),
    orderBy('name', 'asc')
  );
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)))
  );
}

// ── Real-time single supplier ─────────────────────────────────
export function subscribeToSupplier(
  companyId:  string,
  supplierId: string,
  callback:   (supplier: Supplier | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, SUB(companyId).suppliers, supplierId),
    snap => callback(
      snap.exists() ? { id: snap.id, ...snap.data() } as Supplier : null
    )
  );
}
