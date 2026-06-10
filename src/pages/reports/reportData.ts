import { Timestamp } from 'firebase/firestore';
import { sampleCustomers } from '@/pages/customers/customerData';
import { sampleSuppliers } from '@/pages/suppliers/supplierData';
import { sampleProducts }  from '@/pages/products/productData';
import { sampleSales }     from '@/pages/sales/saleData';
import { samplePurchases } from '@/pages/purchases/purchaseData';
import { sampleReceipts }  from '@/pages/receipts/receiptData';
import { sampleStockMovements } from '@/pages/products/productData';

// ─────────────────────────────────────────────────────────────
// IMPORTANT: Reports are READ-ONLY aggregations.
// No report function writes to Firestore.
// All calculations happen client-side on read data.
//
// DEMO DATA: Currently aggregating from sampleX arrays.
// TODO: Replace each sampleX with a Firestore hook when Firebase
// is connected. Pattern: replace sampleSales with useSales(companyId),
// sampleCustomers with useCustomers(companyId), etc.
// This is a pre-deploy blocker — do not deploy to production
// with sample data hooks.
// ─────────────────────────────────────────────────────────────

// ── Aging buckets ─────────────────────────────────────────────
// MVP: age from invoiceDate (today - invoiceDate)
// Future: age from dueDate when credit terms are introduced
export type AgingBucket = 'current' | '31-60' | '61-90' | '90+';

export function getAgingBucket(invoiceDate: Timestamp): AgingBucket {
  const ageDays = Math.floor(
    (Date.now() - invoiceDate.toDate().getTime()) / (1000 * 60 * 60 * 24)
  );
  if (ageDays <= 30)  return 'current';
  if (ageDays <= 60)  return '31-60';
  if (ageDays <= 90)  return '61-90';
  return '90+';
}

export function getAgeDays(invoiceDate: Timestamp): number {
  return Math.floor(
    (Date.now() - invoiceDate.toDate().getTime()) / (1000 * 60 * 60 * 24)
  );
}

// ── Report types ──────────────────────────────────────────────

export interface AgingRow {
  id:        string;
  name:      string;
  current:   number;
  d31_60:    number;
  d61_90:    number;
  d90plus:   number;
  total:     number;
}

export interface TopDebtorRow {
  id:              string;
  name:            string;
  outstanding:     number;
  lastSaleDate:    Timestamp | null;
  lastReceiptDate: Timestamp | null;
  oldestInvoiceDays: number;
}

export interface StockSummaryRow {
  id:           string;
  code:         string;
  name:         string;
  unit:         string;
  currentStock: number;
  unitCost:     number;
  stockValue:   number;
  isLow:        boolean;
  minStock:     number;
}

export interface DeadStockRow {
  id:               string;
  code:             string;
  name:             string;
  unit:             string;
  currentStock:     number;
  stockValue:       number;
  lastMovementDate: Timestamp | null;
  daysSinceMovement:number;
}

export interface SalesReportRow {
  period:      string;
  salesCount:  number;
  revenue:     number;
  outstanding: number;
  collected:   number;
}

export interface SalesByCustomerRow {
  customerId:  string;
  customerName:string;
  salesCount:  number;
  revenue:     number;
  outstanding: number;
}

export interface SalesByProductRow {
  productId:   string;
  productName: string;
  productCode: string;
  unit:        string;
  totalQty:    number;
  totalRevenue:number;
}

export interface CollectionRow {
  customerId:   string;
  customerName: string;
  receiptCount: number;
  totalCollected:number;
  lastReceiptDate: Timestamp | null;
}

// ── Aggregation functions — READ ONLY ─────────────────────────

export function buildAgingReceivables(): AgingRow[] {
  const activeSales = sampleSales.filter(s => !s.isVoid && s.amountDue > 0);
  const map = new Map<string, AgingRow>();

  for (const sale of activeSales) {
    const bucket = getAgingBucket(sale.invoiceDate ?? sale.date);
    const existing = map.get(sale.customerId) ?? {
      id: sale.customerId, name: sale.customerName,
      current: 0, d31_60: 0, d61_90: 0, d90plus: 0, total: 0,
    };
    if (bucket === 'current') existing.current += sale.amountDue;
    if (bucket === '31-60')   existing.d31_60  += sale.amountDue;
    if (bucket === '61-90')   existing.d61_90  += sale.amountDue;
    if (bucket === '90+')     existing.d90plus += sale.amountDue;
    existing.total += sale.amountDue;
    map.set(sale.customerId, existing);
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export function buildAgingPayables(): AgingRow[] {
  const activePurchases = samplePurchases.filter(p => !p.isVoid && p.amountDue > 0);
  const map = new Map<string, AgingRow>();

  for (const purchase of activePurchases) {
    const bucket = getAgingBucket(purchase.invoiceDate ?? purchase.date);
    const existing = map.get(purchase.supplierId) ?? {
      id: purchase.supplierId, name: purchase.supplierName,
      current: 0, d31_60: 0, d61_90: 0, d90plus: 0, total: 0,
    };
    if (bucket === 'current') existing.current += purchase.amountDue;
    if (bucket === '31-60')   existing.d31_60  += purchase.amountDue;
    if (bucket === '61-90')   existing.d61_90  += purchase.amountDue;
    if (bucket === '90+')     existing.d90plus += purchase.amountDue;
    existing.total += purchase.amountDue;
    map.set(purchase.supplierId, existing);
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export function buildTopDebtors(): TopDebtorRow[] {
  return sampleCustomers
    .filter(c => c.currentBalance > 0 && c.status === 'active')
    .map(c => {
      const customerSales = sampleSales.filter(s => s.customerId === c.id && !s.isVoid);
      const customerReceipts = sampleReceipts.filter(r => r.customerId === c.id && !r.isVoid);
      const lastSale = customerSales.sort((a, b) =>
        b.date.toDate().getTime() - a.date.toDate().getTime())[0];
      const lastReceipt = customerReceipts.sort((a, b) =>
        b.date.toDate().getTime() - a.date.toDate().getTime())[0];
      const oldestUnpaidSale = customerSales
        .filter(s => s.amountDue > 0)
        .sort((a, b) => a.date.toDate().getTime() - b.date.toDate().getTime())[0];

      return {
        id:              c.id,
        name:            c.name,
        outstanding:     c.currentBalance,
        lastSaleDate:    lastSale?.date ?? null,
        lastReceiptDate: lastReceipt?.date ?? null,
        oldestInvoiceDays: oldestUnpaidSale
          ? getAgeDays(oldestUnpaidSale.invoiceDate ?? oldestUnpaidSale.date) : 0,
      };
    })
    .sort((a, b) => b.outstanding - a.outstanding);
}

export function buildStockSummary(): StockSummaryRow[] {
  return sampleProducts
    .filter(p => p.status === 'active')
    .map(p => ({
      id:           p.id,
      code:         p.code,
      name:         p.name,
      unit:         p.unit,
      currentStock: p.currentStock,
      unitCost:     p.purchasePrice,
      stockValue:   p.currentStock * p.purchasePrice,
      isLow:        p.currentStock < p.minStockLevel,
      minStock:     p.minStockLevel,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function buildDeadStock(thresholdDays = 60): DeadStockRow[] {
  const today = Date.now();
  return sampleProducts
    .filter(p => p.status === 'active' && p.currentStock > 0)
    .map(p => {
      const movements = sampleStockMovements.filter(m => m.productId === p.id);
      const lastMovement = movements.sort((a, b) =>
        b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime())[0];
      const lastDate = lastMovement?.createdAt ?? null;
      const daysSince = lastDate
        ? Math.floor((today - lastDate.toDate().getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      return {
        id:               p.id,
        code:             p.code,
        name:             p.name,
        unit:             p.unit,
        currentStock:     p.currentStock,
        stockValue:       p.currentStock * p.purchasePrice,
        lastMovementDate: lastDate,
        daysSinceMovement:daysSince,
      };
    })
    .filter(row => row.daysSinceMovement >= thresholdDays)
    .sort((a, b) => b.daysSinceMovement - a.daysSinceMovement);
}

export function buildSalesReport(
  dateFrom: Date | null,
  dateTo:   Date | null
): { byPeriod: SalesReportRow[]; byCustomer: SalesByCustomerRow[]; byProduct: SalesByProductRow[] } {
  let sales = sampleSales.filter(s => !s.isVoid);
  if (dateFrom) sales = sales.filter(s => s.date.toDate() >= dateFrom);
  if (dateTo)   sales = sales.filter(s => s.date.toDate() <= dateTo);

  // By month
  const monthMap = new Map<string, SalesReportRow>();
  for (const sale of sales) {
    const d     = sale.date.toDate();
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    const row   = monthMap.get(key) ?? { period: label, salesCount: 0, revenue: 0, outstanding: 0, collected: 0 };
    row.salesCount++;
    row.revenue     += sale.grandTotal;
    row.outstanding += sale.amountDue;
    row.collected   += sale.amountReceived;
    monthMap.set(key, row);
  }

  // By customer
  const custMap = new Map<string, SalesByCustomerRow>();
  for (const sale of sales) {
    const row = custMap.get(sale.customerId) ?? {
      customerId: sale.customerId, customerName: sale.customerName,
      salesCount: 0, revenue: 0, outstanding: 0,
    };
    row.salesCount++;
    row.revenue     += sale.grandTotal;
    row.outstanding += sale.amountDue;
    custMap.set(sale.customerId, row);
  }

  // By product
  const prodMap = new Map<string, SalesByProductRow>();
  for (const sale of sales) {
    for (const item of sale.items) {
      const row = prodMap.get(item.productId) ?? {
        productId: item.productId, productName: item.productName,
        productCode: item.productCode, unit: item.unit,
        totalQty: 0, totalRevenue: 0,
      };
      row.totalQty     += item.qty;
      row.totalRevenue += item.lineTotal;
      prodMap.set(item.productId, row);
    }
  }

  return {
    byPeriod:   Array.from(monthMap.values()).sort((a, b) => a.period.localeCompare(b.period)),
    byCustomer: Array.from(custMap.values()).sort((a, b) => b.revenue - a.revenue),
    byProduct:  Array.from(prodMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue),
  };
}

export function buildCollectionSummary(
  dateFrom: Date | null,
  dateTo:   Date | null
): CollectionRow[] {
  let receipts = sampleReceipts.filter(r => !r.isVoid);
  if (dateFrom) receipts = receipts.filter(r => r.date.toDate() >= dateFrom);
  if (dateTo)   receipts = receipts.filter(r => r.date.toDate() <= dateTo);

  const map = new Map<string, CollectionRow>();
  for (const receipt of receipts) {
    const row = map.get(receipt.customerId) ?? {
      customerId:    receipt.customerId,
      customerName:  receipt.customerName,
      receiptCount:  0,
      totalCollected:0,
      lastReceiptDate: null,
    };
    row.receiptCount++;
    row.totalCollected += receipt.amount;
    if (!row.lastReceiptDate ||
        receipt.date.toDate() > row.lastReceiptDate.toDate()) {
      row.lastReceiptDate = receipt.date;
    }
    map.set(receipt.customerId, row);
  }

  return Array.from(map.values()).sort((a, b) => b.totalCollected - a.totalCollected);
}
