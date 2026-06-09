import { Timestamp } from 'firebase/firestore';

// ── Ledger entry — derived from multiple collections ──────────
// Not stored as a separate collection. Built client-side by
// combining sales, receipts, creditNotes filtered by customerId.
export interface LedgerEntry {
  id:          string;
  date:        Timestamp;
  type:        'sale' | 'receipt' | 'credit_note' | 'opening';
  description: string;
  refNumber:   string | null;
  debit:       number;   // amount that increases balance (sale)
  credit:      number;   // amount that decreases balance (receipt, credit note)
  balance:     number;   // running balance — calculated client-side
  isVoid:      boolean;
  paymentType: 'cash' | 'credit' | null;
}

export type LedgerFilter = {
  dateFrom:    string;   // ISO date string
  dateTo:      string;
  type:        'all' | 'sale' | 'receipt' | 'credit_note';
  status:      'all' | 'paid' | 'unpaid';
};

// ── Sample data — replace with Firestore hooks ────────────────
export const sampleCustomers = [
  {
    id: 'c1', companyId: 'demo', name: 'Gulf Foods Co.',
    phone: '97336100001', whatsapp: '97336100001',
    address: 'Block 342, Road 1205, Manama', crNumber: 'CR-001',
    openingBalance: 500, currentBalance: 2500,
    creditLimit: 5000, status: 'active',
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(), createdBy: 'owner',
  },
  {
    id: 'c2', companyId: 'demo', name: 'XYZ Store',
    phone: '97336100002', whatsapp: '97336100002',
    address: 'Seef District, Bahrain', crNumber: null,
    openingBalance: 0, currentBalance: 1800,
    creditLimit: 3000, status: 'active',
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(), createdBy: 'owner',
  },
  {
    id: 'c3', companyId: 'demo', name: 'City Mart',
    phone: '97336100003', whatsapp: '97336100003',
    address: 'Isa Town, Bahrain', crNumber: 'CR-003',
    openingBalance: 0, currentBalance: 980,
    creditLimit: 2000, status: 'active',
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(), createdBy: 'owner',
  },
  {
    id: 'c4', companyId: 'demo', name: 'Bahrain Retail Ltd.',
    phone: '97336100004', whatsapp: '97336100004',
    address: 'Budaiya Highway, Bahrain', crNumber: 'CR-004',
    openingBalance: 200, currentBalance: 640,
    creditLimit: null, status: 'active',
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(), createdBy: 'owner',
  },
  {
    id: 'c5', companyId: 'demo', name: 'Manama Store',
    phone: '97336100005', whatsapp: '97336100005',
    address: 'Manama Souq Area', crNumber: null,
    openingBalance: 0, currentBalance: 500,
    creditLimit: 1000, status: 'active',
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(), createdBy: 'owner',
  },
  {
    id: 'c6', companyId: 'demo', name: 'Al Fardan Trading',
    phone: '97336100006', whatsapp: null,
    address: 'Muharraq, Bahrain', crNumber: 'CR-006',
    openingBalance: 0, currentBalance: 0,
    creditLimit: 2000, status: 'active',
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(), createdBy: 'owner',
  },
];

export const sampleLedgerEntries: LedgerEntry[] = [
  {
    id: 'l1', date: Timestamp.fromDate(new Date('2026-05-01')),
    type: 'opening', description: 'Opening balance',
    refNumber: null, debit: 500, credit: 0, balance: 500,
    isVoid: false, paymentType: null,
  },
  {
    id: 'l2', date: Timestamp.fromDate(new Date('2026-05-10')),
    type: 'sale', description: 'Sale — 5 items',
    refNumber: 'INV-2026-0012', debit: 850, credit: 0, balance: 1350,
    isVoid: false, paymentType: 'credit',
  },
  {
    id: 'l3', date: Timestamp.fromDate(new Date('2026-05-18')),
    type: 'receipt', description: 'Payment received — cash',
    refNumber: 'RCT-2026-0008', debit: 0, credit: 600, balance: 750,
    isVoid: false, paymentType: 'cash',
  },
  {
    id: 'l4', date: Timestamp.fromDate(new Date('2026-05-25')),
    type: 'sale', description: 'Sale — 8 items',
    refNumber: 'INV-2026-0019', debit: 1200, credit: 0, balance: 1950,
    isVoid: false, paymentType: 'credit',
  },
  {
    id: 'l5', date: Timestamp.fromDate(new Date('2026-06-01')),
    type: 'credit_note', description: 'Return — 2 items damaged',
    refNumber: 'CN-2026-0003', debit: 0, credit: 200, balance: 1750,
    isVoid: false, paymentType: null,
  },
  {
    id: 'l6', date: Timestamp.fromDate(new Date('2026-06-05')),
    type: 'sale', description: 'Sale — 3 items',
    refNumber: 'INV-2026-0024', debit: 750, credit: 0, balance: 2500,
    isVoid: false, paymentType: 'credit',
  },
];
