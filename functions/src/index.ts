// ─────────────────────────────────────────────────────────────
// Firebase Cloud Functions — index.ts
// Region: europe-west1
// Deploy: npm run deploy:functions
// ─────────────────────────────────────────────────────────────

// initializeApp MUST be first — before any Firebase service import.
// Required for both emulator and production environments.
import { initializeApp } from 'firebase-admin/app';
initializeApp();

export { onSaleWrite }                                          from './saleEngine';
export { onPurchaseWriteEngine }                                from './purchaseEngine';
export { onReceiptWrite }                                       from './receiptEngine';
export { onPaymentWriteEngine }                                 from './paymentEngine';
export { onPurchaseWrite, onPaymentWrite,
         onPurchaseReturnWrite, onSupplierDebitWrite }          from './supplierBalance';
