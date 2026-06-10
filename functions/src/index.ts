// ─────────────────────────────────────────────────────────────
// Firebase Cloud Functions — index.ts
// Region: europe-west1
// Deploy: npm run deploy:functions
// ─────────────────────────────────────────────────────────────

export { onSaleWrite }                                          from './saleEngine';
export { onPurchaseWriteEngine }                                from './purchaseEngine';
export { onReceiptWrite }                                       from './receiptEngine';
export { onPaymentWriteEngine }                                 from './paymentEngine';
export { onPurchaseWrite, onPaymentWrite,
         onPurchaseReturnWrite, onSupplierDebitWrite }          from './supplierBalance';
