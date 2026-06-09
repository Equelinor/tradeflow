// ─────────────────────────────────────────────────────────────
// Firebase Cloud Functions — index.ts
// Region: europe-west1 (matches frontend config)
//
// All functions must be exported here to be deployed.
// Deploy: npm run deploy:functions
// ─────────────────────────────────────────────────────────────

export { onSaleWrite }                                       from './saleEngine';
export { onPurchaseWrite, onPaymentWrite,
         onPurchaseReturnWrite, onSupplierDebitWrite }       from './supplierBalance';
