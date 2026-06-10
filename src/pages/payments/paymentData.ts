import { Timestamp } from 'firebase/firestore';
import type { PaymentMethod } from '@/pages/sales/saleData';

// ── Payment document ──────────────────────────────────────────
// A payment records money sent to a supplier.
// It reduces supplier payable balance.
// Supplier balance is owned by supplierBalance.ts recalculator —
// NOT by paymentEngine.ts directly.
export interface Payment {
  id:              string;
  companyId:       string;
  paymentNumber:   string;         // server-generated e.g. PAY-2026-0001
  supplierId:      string;
  supplierName:    string;
  amount:          number;
  paymentMethod:   PaymentMethod;
  referenceNo:     string | null;
  date:            Timestamp;
  notes:           string | null;
  // Overpayment override (if payment > supplier payable)
  overpaymentOverride: {
    overridden:       boolean;
    reason:           string;
    by:               string;
    currentPayable:   number;
    paymentAmount:    number;
    approvedAt:       Timestamp;
  } | null;
  // CF-managed
  isVoid:          boolean;
  voidReason:      string | null;
  voidedAt:        Timestamp | null;
  voidedBy:        string | null;
  voidProcessed:   boolean;
  balanceProcessed:boolean;
  source:          'manual';
  status:          'pending' | 'confirmed' | 'voided' | 'failed';
  failureReason:   string | null;
  createdAt:       Timestamp;
  updatedAt:       Timestamp;
  createdBy:       string;
}

// ── Sample data ───────────────────────────────────────────────
export const samplePayments: Payment[] = [
  {
    id: 'pay1', companyId: 'demo',
    paymentNumber: 'PAY-2026-0001',
    supplierId: 's1', supplierName: 'Gulf Imports Co.',
    amount: 800.000,
    paymentMethod: 'bank_transfer',
    referenceNo: 'TRF-20260515',
    date: Timestamp.fromDate(new Date('2026-05-15')),
    notes: null,
    overpaymentOverride: null,
    isVoid: false, voidReason: null, voidedAt: null, voidedBy: null,
    voidProcessed: false, balanceProcessed: true,
    source: 'manual', status: 'confirmed', failureReason: null,
    createdAt: Timestamp.fromDate(new Date('2026-05-15')),
    updatedAt: Timestamp.fromDate(new Date('2026-05-15')),
    createdBy: 'owner',
  },
  {
    id: 'pay2', companyId: 'demo',
    paymentNumber: 'PAY-2026-0002',
    supplierId: 's2', supplierName: 'Al Jazeera Foods',
    amount: 100.000,
    paymentMethod: 'cash',
    referenceNo: null,
    date: Timestamp.fromDate(new Date('2026-06-02')),
    notes: 'Partial payment on account',
    overpaymentOverride: null,
    isVoid: false, voidReason: null, voidedAt: null, voidedBy: null,
    voidProcessed: false, balanceProcessed: true,
    source: 'manual', status: 'confirmed', failureReason: null,
    createdAt: Timestamp.fromDate(new Date('2026-06-02')),
    updatedAt: Timestamp.fromDate(new Date('2026-06-02')),
    createdBy: 'owner',
  },
];
