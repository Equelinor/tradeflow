import { Timestamp } from 'firebase/firestore';
import type { PaymentMethod } from '@/pages/sales/saleData';

// ── Receipt document ──────────────────────────────────────────
// A receipt records money received from a customer.
// It reduces customer receivable balance.
//
// allocationMode and allocations fields are present but unused
// in MVP — they support future invoice allocation (FIFO or manual).
// This avoids a data model rebuild when traders ask:
// "which invoice did this payment settle?"
export interface Receipt {
  id:             string;
  companyId:      string;
  receiptNumber:  string;         // server-generated e.g. RCT-2026-0001
  customerId:     string;
  customerName:   string;
  amount:         number;
  paymentMethod:  PaymentMethod;
  referenceNo:    string | null;  // cheque no., transfer ref.
  date:           Timestamp;
  notes:          string | null;
  // Invoice allocation — unused in MVP, ready for future use
  allocationMode: 'customer_balance' | 'invoice_allocation';
  allocations:    ReceiptAllocation[];  // empty in MVP
  linkedInvoiceIds: string[];           // empty in MVP
  // CF-managed
  isVoid:         boolean;
  voidReason:     string | null;
  voidedAt:       Timestamp | null;
  voidedBy:       string | null;
  voidProcessed:  boolean;
  balanceProcessed: boolean;
  source:         'manual' | 'system'; // system = auto-created from sale
  status:         'pending' | 'confirmed' | 'voided' | 'failed';
  failureReason:  string | null;
  createdAt:      Timestamp;
  updatedAt:      Timestamp;
  createdBy:      string;
}

// Future invoice allocation structure — ready but unused in MVP
export interface ReceiptAllocation {
  invoiceId:  string;
  invoiceNo:  string;
  amount:     number;
}

// ── Sample data ───────────────────────────────────────────────
export const sampleReceipts: Receipt[] = [
  {
    id: 'rct1', companyId: 'demo',
    receiptNumber: 'RCT-2026-0001',
    customerId: 'c1', customerName: 'Gulf Foods Co.',
    amount: 600.000,
    paymentMethod: 'bank_transfer',
    referenceNo: 'TRF-20260518',
    date: Timestamp.fromDate(new Date('2026-05-18')),
    notes: null,
    allocationMode: 'customer_balance',
    allocations: [],
    linkedInvoiceIds: [],
    isVoid: false, voidReason: null, voidedAt: null, voidedBy: null,
    voidProcessed: false, balanceProcessed: true,
    source: 'manual', status: 'confirmed', failureReason: null,
    createdAt: Timestamp.fromDate(new Date('2026-05-18')),
    updatedAt: Timestamp.fromDate(new Date('2026-05-18')),
    createdBy: 'owner',
  },
  {
    id: 'rct2', companyId: 'demo',
    receiptNumber: 'RCT-2026-0002',
    customerId: 'c3', customerName: 'City Mart',
    amount: 50.000,
    paymentMethod: 'cash',
    referenceNo: null,
    date: Timestamp.fromDate(new Date('2026-06-01')),
    notes: 'Partial payment on account',
    allocationMode: 'customer_balance',
    allocations: [],
    linkedInvoiceIds: [],
    isVoid: false, voidReason: null, voidedAt: null, voidedBy: null,
    voidProcessed: false, balanceProcessed: true,
    source: 'system', status: 'confirmed', failureReason: null,
    createdAt: Timestamp.fromDate(new Date('2026-06-01')),
    updatedAt: Timestamp.fromDate(new Date('2026-06-01')),
    createdBy: 'owner',
  },
];
