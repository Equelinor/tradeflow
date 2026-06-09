export const APP_NAME          = 'TradeFlow';
export const DEFAULT_CURRENCY  = 'BHD';
export const DEFAULT_THEME     = '#1D9E75';
export const MAX_USERS_BASIC   = 2;
export const MAX_USERS_PRO     = 10;
export const TRIAL_DAYS        = 30;
export const GRACE_PERIOD_DAYS = 7;

export const COLLECTIONS = {
  companies:     'companies',
  subscriptions: 'subscriptions',
  auditLog:      'auditLog',
  agents:        'agents',
  adminConfig:   'adminConfig',
  phoneIndex:    'phoneIndex',
} as const;

// ── Sub-collections under companies/{companyId} ───────────────
// Naming convention:
//   Customer-side: creditNotes    = discount/return we give the customer
//   Supplier-side: purchaseReturns = goods we return to supplier
//                  supplierDebits  = extra charges supplier bills us
// These names make the accounting sign self-evident.
export const SUB = (companyId: string) => ({
  users:           `companies/${companyId}/users`,
  customers:       `companies/${companyId}/customers`,
  suppliers:       `companies/${companyId}/suppliers`,
  products:        `companies/${companyId}/products`,
  sales:           `companies/${companyId}/sales`,
  saleItems:       `companies/${companyId}/saleItems`,
  purchases:       `companies/${companyId}/purchases`,
  purchaseItems:   `companies/${companyId}/purchaseItems`,
  receipts:        `companies/${companyId}/receipts`,
  payments:        `companies/${companyId}/payments`,
  stockMovements:  `companies/${companyId}/stockMovements`,
  // Customer-side notes
  creditNotes:     `companies/${companyId}/creditNotes`,
  // Supplier-side notes (renamed from debitNotes for clarity)
  purchaseReturns: `companies/${companyId}/purchaseReturns`,
  supplierDebits:  `companies/${companyId}/supplierDebits`,
  // Other
  shipments:       `companies/${companyId}/shipments`,
  uploadedInvoices:`companies/${companyId}/uploadedInvoices`,
  settings:        `companies/${companyId}/settings`,
});
