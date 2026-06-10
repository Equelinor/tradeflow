import { Timestamp } from 'firebase/firestore';
import type { PaymentMethod } from '@/pages/sales/saleData';

export type PurchasePaymentType = 'cash' | 'credit' | 'partial';

export interface PurchaseLineItem {
  productId:   string;
  productName: string;
  productCode: string;
  unit:        string;
  qty:         number;
  unitCost:    number;   // purchase cost — not selling price
  discount:    number;
  lineTotal:   number;   // (qty * unitCost) - discount
}

// ── Purchase document ─────────────────────────────────────────
// Created by UI. Stock + supplier balance updated by Cloud Function.
export interface Purchase {
  id:                string;
  companyId:         string;
  purchaseNumber:    string;        // server-generated e.g. PUR-2026-0001
  supplierId:        string;
  supplierName:      string;
  supplierInvoiceNo: string | null; // optional supplier's own invoice number
  date:              Timestamp;
  invoiceDate:       Timestamp;        // always = purchase date for MVP
  dueDate:           Timestamp | null; // nullable — for future credit terms
  creditDays:        number | null;    // nullable — e.g. 30, 60, 90
  items:             PurchaseLineItem[];
  subtotal:          number;
  discountTotal:     number;
  grandTotal:        number;
  paymentType:       PurchasePaymentType;
  amountPaid:        number;        // cash: = grandTotal, credit: 0, partial: amount now
  amountDue:         number;        // grandTotal - amountPaid → goes to supplier payable
  paymentMethod:     PaymentMethod | null;
  referenceNo:       string | null; // payment reference / cheque number
  notes:             string | null;
  isVoid:            boolean;
  voidReason:        string | null;
  voidedAt:          Timestamp | null;
  voidedBy:          string | null;
  // CF-managed fields
  stockProcessed:    boolean;
  balanceProcessed:  boolean;
  voidProcessed:     boolean;
  status:            'pending' | 'confirmed' | 'voided' | 'failed';
  failureReason:     string | null;
  createdAt:         Timestamp;
  updatedAt:         Timestamp;
  createdBy:         string;
}

export interface NewPurchaseLineItem {
  productId:   string;
  productName: string;
  productCode: string;
  unit:        string;
  qty:         string;
  unitCost:    string;
  discount:    string;
}

// ── Sample data ───────────────────────────────────────────────
export const samplePurchases: Purchase[] = [
  {
    id: 'pur1', companyId: 'demo',
    purchaseNumber: 'PUR-2026-0001',
    supplierId: 's1', supplierName: 'Gulf Imports Co.',
    supplierInvoiceNo: 'GIC-2026-1234',
    date: Timestamp.fromDate(new Date('2026-05-08')),
    invoiceDate: Timestamp.fromDate(new Date('2026-05-08')),
    dueDate: null,
    creditDays: null,
    items: [
      { productId: 'p1', productName: 'Rice 25kg Bag', productCode: 'PRD-001',
        unit: 'BAG', qty: 20, unitCost: 18.500, discount: 0, lineTotal: 370.000 },
      { productId: 'p3', productName: 'Sugar 50kg', productCode: 'PRD-003',
        unit: 'BAG', qty: 10, unitCost: 22.000, discount: 20.000, lineTotal: 200.000 },
    ],
    subtotal: 590.000, discountTotal: 20.000, grandTotal: 570.000,
    paymentType: 'credit', amountPaid: 0, amountDue: 570.000,
    paymentMethod: null, referenceNo: null, notes: null,
    isVoid: false, voidReason: null, voidedAt: null, voidedBy: null,
    stockProcessed: true, balanceProcessed: true, voidProcessed: false,
    status: 'confirmed', failureReason: null,
    createdAt: Timestamp.fromDate(new Date('2026-05-08')),
    updatedAt: Timestamp.fromDate(new Date('2026-05-08')),
    createdBy: 'owner',
  },
  {
    id: 'pur2', companyId: 'demo',
    purchaseNumber: 'PUR-2026-0002',
    supplierId: 's2', supplierName: 'Al Jazeera Foods',
    supplierInvoiceNo: null,
    date: Timestamp.fromDate(new Date('2026-05-28')),
    invoiceDate: Timestamp.fromDate(new Date('2026-05-28')),
    dueDate: null,
    creditDays: null,
    items: [
      { productId: 'p6', productName: 'Mineral Water 1.5L', productCode: 'PRD-006',
        unit: 'CTN', qty: 50, unitCost: 2.500, discount: 0, lineTotal: 125.000 },
      { productId: 'p4', productName: 'Canned Tomatoes 400g', productCode: 'PRD-004',
        unit: 'CTN', qty: 30, unitCost: 4.500, discount: 0, lineTotal: 135.000 },
    ],
    subtotal: 260.000, discountTotal: 0, grandTotal: 260.000,
    paymentType: 'partial', amountPaid: 100.000, amountDue: 160.000,
    paymentMethod: 'bank_transfer', referenceNo: 'TRF-20260528', notes: 'Balance due next week',
    isVoid: false, voidReason: null, voidedAt: null, voidedBy: null,
    stockProcessed: true, balanceProcessed: true, voidProcessed: false,
    status: 'confirmed', failureReason: null,
    createdAt: Timestamp.fromDate(new Date('2026-05-28')),
    updatedAt: Timestamp.fromDate(new Date('2026-05-28')),
    createdBy: 'owner',
  },
];
