import { Timestamp } from 'firebase/firestore';

export interface Supplier {
  id:             string;
  companyId:      string;
  code:           string;
  name:           string;
  contactPerson:  string | null;
  phone:          string;
  whatsapp:       string | null;
  email:          string | null;
  address:        string | null;
  crNumber:       string | null;
  openingBalance: number;
  currentBalance: number;   // owned by Cloud Function — never client-written
  status:         'active' | 'inactive';
  createdAt:      Timestamp;
  updatedAt:      Timestamp;
  createdBy:      string;
}

// ── Supplier ledger entry ─────────────────────────────────────
// Built client-side by combining purchases, payments,
// purchaseReturns, supplierDebits filtered by supplierId.
// Never stored as a separate collection.
export interface SupplierLedgerEntry {
  id:          string;
  date:        Timestamp;
  // Renamed from debit_note/credit_note to unambiguous functional names
  type:        'purchase' | 'payment' | 'purchase_return' | 'supplier_debit' | 'opening';
  description: string;
  refNumber:   string | null;
  debit:       number;   // reduces what we owe (payment, purchase_return)
  credit:      number;   // increases what we owe (purchase, supplier_debit)
  balance:     number;   // running balance — calculated client-side for display
  isVoid:      boolean;
  paymentType: 'cash' | 'credit' | 'cheque' | null;
}

export type SupplierLedgerFilter = {
  dateFrom: string;
  dateTo:   string;
  type:     'all' | 'purchase' | 'payment' | 'purchase_return' | 'supplier_debit';
  status:   'all' | 'paid' | 'unpaid';
};

// ── Sample data — replace with Firestore hooks ────────────────
export const sampleSuppliers: Supplier[] = [
  {
    id: 's1', companyId: 'demo', code: 'SUP-001',
    name: 'Gulf Imports Co.', contactPerson: 'Mohammed Al Rashid',
    phone: '97317100001', whatsapp: '97317100001',
    email: 'info@gulfimports.com', address: 'Sitra Industrial Area, Bahrain',
    crNumber: 'CR-S001',
    openingBalance: 1200, currentBalance: 3400,
    status: 'active',
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(), createdBy: 'owner',
  },
  {
    id: 's2', companyId: 'demo', code: 'SUP-002',
    name: 'Al Jazeera Foods', contactPerson: 'Khalid Hassan',
    phone: '97317100002', whatsapp: '97317100002',
    email: null, address: 'Manama, Bahrain',
    crNumber: 'CR-S002',
    openingBalance: 0, currentBalance: 1850,
    status: 'active',
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(), createdBy: 'owner',
  },
  {
    id: 's3', companyId: 'demo', code: 'SUP-003',
    name: 'Premium Distributors LLC', contactPerson: 'Ahmed Yousuf',
    phone: '97317100003', whatsapp: null,
    email: 'sales@premiumdist.com', address: 'Seef District, Bahrain',
    crNumber: null,
    openingBalance: 0, currentBalance: 920,
    status: 'active',
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(), createdBy: 'owner',
  },
  {
    id: 's4', companyId: 'demo', code: 'SUP-004',
    name: 'Bahrain Food Supply', contactPerson: null,
    phone: '97317100004', whatsapp: '97317100004',
    email: null, address: 'Muharraq, Bahrain',
    crNumber: 'CR-S004',
    openingBalance: 500, currentBalance: 500,
    status: 'active',
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(), createdBy: 'owner',
  },
  {
    id: 's5', companyId: 'demo', code: 'SUP-005',
    name: 'Old Supplier Co.', contactPerson: null,
    phone: '97317100005', whatsapp: null,
    email: null, address: null,
    crNumber: null,
    openingBalance: 0, currentBalance: 0,
    status: 'inactive',
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(), createdBy: 'owner',
  },
];

export const sampleSupplierLedger: SupplierLedgerEntry[] = [
  {
    id: 'sl1', date: Timestamp.fromDate(new Date('2026-05-01')),
    type: 'opening', description: 'Opening balance',
    refNumber: null, debit: 0, credit: 1200, balance: 1200,
    isVoid: false, paymentType: null,
  },
  {
    id: 'sl2', date: Timestamp.fromDate(new Date('2026-05-08')),
    type: 'purchase', description: 'Purchase — 12 items',
    refNumber: 'PUR-2026-0003', debit: 0, credit: 1800, balance: 3000,
    isVoid: false, paymentType: 'credit',
  },
  {
    id: 'sl3', date: Timestamp.fromDate(new Date('2026-05-15')),
    type: 'payment', description: 'Payment — bank transfer',
    refNumber: 'PAY-2026-0002', debit: 800, credit: 0, balance: 2200,
    isVoid: false, paymentType: 'cash',
  },
  {
    id: 'sl4', date: Timestamp.fromDate(new Date('2026-05-28')),
    type: 'purchase', description: 'Purchase — 8 items',
    refNumber: 'PUR-2026-0008', debit: 0, credit: 1400, balance: 3600,
    isVoid: false, paymentType: 'credit',
  },
  {
    id: 'sl5', date: Timestamp.fromDate(new Date('2026-06-03')),
    type: 'purchase_return', description: 'Return — 2 items rejected',
    refNumber: 'PR-2026-0001', debit: 200, credit: 0, balance: 3400,
    isVoid: false, paymentType: null,
  },
];
