// ─────────────────────────────────────────────────────────────
// Cloud Function: Supplier Balance Engine
// Region: europe-west1
//
// THE ONLY PLACE currentPayable (currentBalance) IS WRITTEN
// after supplier creation. No client, no form, no service
// ever writes currentBalance directly.
//
// Transaction types and their effect on what we owe:
//
//   PURCHASE         → we owe MORE   (+)  supplier delivers goods
//   PAYMENT          → we owe LESS   (-)  we pay the supplier
//   PURCHASE_RETURN  → we owe LESS   (-)  we return goods to supplier
//   SUPPLIER_DEBIT   → we owe MORE   (+)  supplier charges us extra
//                                         (freight, penalty, price adjustment)
//
// Formula:
//   currentBalance = openingBalance
//                  + sum(purchases       where !isVoid)
//                  - sum(payments        where !isVoid)
//                  - sum(purchaseReturns where !isVoid)
//                  + sum(supplierDebits  where !isVoid)
//
// Note on naming clarity (GPT audit catch):
//   "credit note" and "debit note" are ambiguous terms.
//   TradeFlow uses explicit functional names to avoid sign errors:
//   purchaseReturns = we return goods → reduces what we owe (-)
//   supplierDebits  = supplier charges us extra → increases what we owe (+)
// ─────────────────────────────────────────────────────────────

import * as functions from 'firebase-functions/v2';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const db     = getFirestore();
const REGION = 'europe-west1';

// ── Core balance recalculator ─────────────────────────────────
async function recalculateSupplierBalance(
  companyId:  string,
  supplierId: string
): Promise<void> {
  const base = `companies/${companyId}`;

  const [
    supplierSnap,
    purchasesSnap,
    paymentsSnap,
    purchaseReturnsSnap,
    supplierDebitsSnap,
  ] = await Promise.all([
    db.doc(`${base}/suppliers/${supplierId}`).get(),

    // Purchases — increases what we owe (+)
    db.collection(`${base}/purchases`)
      .where('supplierId', '==', supplierId)
      .where('isVoid', '==', false)
      .get(),

    // Payments — reduces what we owe (-)
    db.collection(`${base}/payments`)
      .where('supplierId', '==', supplierId)
      .where('isVoid', '==', false)
      .get(),

    // Purchase returns — we return goods, reduces what we owe (-)
    db.collection(`${base}/purchaseReturns`)
      .where('supplierId', '==', supplierId)
      .where('isVoid', '==', false)
      .get(),

    // Supplier debits — extra charges from supplier, increases what we owe (+)
    db.collection(`${base}/supplierDebits`)
      .where('supplierId', '==', supplierId)
      .where('isVoid', '==', false)
      .get(),
  ]);

  if (!supplierSnap.exists) {
    console.error(`[supplierBalance] not found: ${companyId}/${supplierId}`);
    return;
  }

  const openingBalance     = supplierSnap.data()?.openingBalance ?? 0;
  const totalPurchases     = purchasesSnap.docs.reduce(       (s, d) => s + (d.data().total  ?? 0), 0);
  const totalPayments      = paymentsSnap.docs.reduce(        (s, d) => s + (d.data().amount ?? 0), 0);
  const totalReturns       = purchaseReturnsSnap.docs.reduce( (s, d) => s + (d.data().total  ?? 0), 0);
  const totalSupplierDebits= supplierDebitsSnap.docs.reduce(  (s, d) => s + (d.data().total  ?? 0), 0);

  const newBalance =
    openingBalance
    + totalPurchases      // (+) we owe more
    - totalPayments       // (-) we paid
    - totalReturns        // (-) we returned goods
    + totalSupplierDebits;// (+) supplier charged us extra

  // Round to 3 decimal places (BHD/Gulf standard)
  const rounded = Math.round(newBalance * 1000) / 1000;

  await db.doc(`${base}/suppliers/${supplierId}`).update({
    currentBalance:   rounded,
    balanceUpdatedAt: FieldValue.serverTimestamp(),
  });

  console.log(
    `[supplierBalance] ${supplierId}: ` +
    `${openingBalance} ` +
    `+ purchases(${totalPurchases}) ` +
    `- payments(${totalPayments}) ` +
    `- returns(${totalReturns}) ` +
    `+ supplierDebits(${totalSupplierDebits}) ` +
    `= ${rounded}`
  );
}

// ── Triggers ──────────────────────────────────────────────────

export const onPurchaseWrite = functions.firestore.onDocumentWritten(
  { document: 'companies/{companyId}/purchases/{id}', region: REGION },
  async (event) => {
    const cid = event.params.companyId;
    const sid = event.data?.after?.data()?.supplierId
             ?? event.data?.before?.data()?.supplierId;
    if (!sid) return;
    await recalculateSupplierBalance(cid, sid);
  }
);

export const onPaymentWrite = functions.firestore.onDocumentWritten(
  { document: 'companies/{companyId}/payments/{id}', region: REGION },
  async (event) => {
    const cid = event.params.companyId;
    const sid = event.data?.after?.data()?.supplierId
             ?? event.data?.before?.data()?.supplierId;
    if (!sid) return;
    await recalculateSupplierBalance(cid, sid);
  }
);

export const onPurchaseReturnWrite = functions.firestore.onDocumentWritten(
  { document: 'companies/{companyId}/purchaseReturns/{id}', region: REGION },
  async (event) => {
    const cid = event.params.companyId;
    const sid = event.data?.after?.data()?.supplierId
             ?? event.data?.before?.data()?.supplierId;
    if (!sid) return;
    await recalculateSupplierBalance(cid, sid);
  }
);

export const onSupplierDebitWrite = functions.firestore.onDocumentWritten(
  { document: 'companies/{companyId}/supplierDebits/{id}', region: REGION },
  async (event) => {
    const cid = event.params.companyId;
    const sid = event.data?.after?.data()?.supplierId
             ?? event.data?.before?.data()?.supplierId;
    if (!sid) return;
    await recalculateSupplierBalance(cid, sid);
  }
);
