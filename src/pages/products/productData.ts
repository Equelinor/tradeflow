import { Timestamp } from 'firebase/firestore';

export interface Product {
  id:            string;
  companyId:     string;
  code:          string;
  name:          string;
  category:      string | null;
  unit:          string;
  purchasePrice: number;
  sellingPrice:  number;
  currentStock:  number;
  minStockLevel: number;
  status:        'active' | 'inactive';
  createdAt:     Timestamp;
  updatedAt:     Timestamp;
  createdBy:     string;
}

export interface StockMovement {
  id:          string;
  companyId:   string;
  productId:   string;
  productName: string;
  type:        'OPENING' | 'SALE' | 'SALE_VOID' | 'PURCHASE' | 'PURCHASE_VOID'
             | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
  qty:         number;   // positive = in, negative = out
  refId:       string | null;
  refType:     string | null;
  notes:       string | null;
  createdAt:   Timestamp;
  createdBy:   string;
}

// ── Sample categories ─────────────────────────────────────────
export const PRODUCT_UNITS = [
  'PCS', 'KG', 'G', 'LTR', 'ML',
  'BOX', 'CTN', 'BAG', 'PKT', 'DOZ',
  'MTR', 'SET', 'PAIR', 'ROLL',
];

export const PRODUCT_CATEGORIES = [
  'Food & Grocery',
  'Beverages',
  'Cleaning Products',
  'Personal Care',
  'Electronics',
  'Stationery',
  'Clothing',
  'Tools & Hardware',
  'Other',
];

// ── Sample data — replace with Firestore hooks ────────────────
export const sampleProducts: Product[] = [
  {
    id: 'p1', companyId: 'demo', code: 'PRD-001',
    name: 'Rice 25kg Bag', category: 'Food & Grocery',
    unit: 'BAG', purchasePrice: 18.500, sellingPrice: 22.000,
    currentStock: 3, minStockLevel: 10,
    status: 'active',
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(), createdBy: 'owner',
  },
  {
    id: 'p2', companyId: 'demo', code: 'PRD-002',
    name: 'Olive Oil 5L', category: 'Food & Grocery',
    unit: 'CTN', purchasePrice: 12.000, sellingPrice: 15.500,
    currentStock: 5, minStockLevel: 12,
    status: 'active',
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(), createdBy: 'owner',
  },
  {
    id: 'p3', companyId: 'demo', code: 'PRD-003',
    name: 'Sugar 50kg', category: 'Food & Grocery',
    unit: 'BAG', purchasePrice: 22.000, sellingPrice: 26.500,
    currentStock: 7, minStockLevel: 15,
    status: 'active',
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(), createdBy: 'owner',
  },
  {
    id: 'p4', companyId: 'demo', code: 'PRD-004',
    name: 'Canned Tomatoes 400g', category: 'Food & Grocery',
    unit: 'CTN', purchasePrice: 4.500, sellingPrice: 6.000,
    currentStock: 22, minStockLevel: 20,
    status: 'active',
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(), createdBy: 'owner',
  },
  {
    id: 'p5', companyId: 'demo', code: 'PRD-005',
    name: 'Vegetable Oil 1L', category: 'Food & Grocery',
    unit: 'CTN', purchasePrice: 8.000, sellingPrice: 10.500,
    currentStock: 40, minStockLevel: 30,
    status: 'active',
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(), createdBy: 'owner',
  },
  {
    id: 'p6', companyId: 'demo', code: 'PRD-006',
    name: 'Mineral Water 1.5L', category: 'Beverages',
    unit: 'CTN', purchasePrice: 2.500, sellingPrice: 3.500,
    currentStock: 60, minStockLevel: 40,
    status: 'active',
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(), createdBy: 'owner',
  },
  {
    id: 'p7', companyId: 'demo', code: 'PRD-007',
    name: 'Laundry Detergent 5kg', category: 'Cleaning Products',
    unit: 'CTN', purchasePrice: 6.000, sellingPrice: 8.500,
    currentStock: 0, minStockLevel: 10,
    status: 'active',
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(), createdBy: 'owner',
  },
  {
    id: 'p8', companyId: 'demo', code: 'PRD-008',
    name: 'Dates 1kg Premium', category: 'Food & Grocery',
    unit: 'BOX', purchasePrice: 5.000, sellingPrice: 7.500,
    currentStock: 15, minStockLevel: 10,
    status: 'inactive',
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(), createdBy: 'owner',
  },
];

export const sampleStockMovements: StockMovement[] = [
  {
    id: 'sm1', companyId: 'demo', productId: 'p1', productName: 'Rice 25kg Bag',
    type: 'OPENING', qty: 20, refId: null, refType: null,
    notes: 'Opening stock', createdAt: Timestamp.fromDate(new Date('2026-05-01')), createdBy: 'owner',
  },
  {
    id: 'sm2', companyId: 'demo', productId: 'p1', productName: 'Rice 25kg Bag',
    type: 'SALE', qty: -8, refId: 'INV-2026-0012', refType: 'sale',
    notes: null, createdAt: Timestamp.fromDate(new Date('2026-05-10')), createdBy: 'owner',
  },
  {
    id: 'sm3', companyId: 'demo', productId: 'p1', productName: 'Rice 25kg Bag',
    type: 'PURCHASE', qty: 15, refId: 'PUR-2026-0005', refType: 'purchase',
    notes: null, createdAt: Timestamp.fromDate(new Date('2026-05-20')), createdBy: 'owner',
  },
  {
    id: 'sm4', companyId: 'demo', productId: 'p1', productName: 'Rice 25kg Bag',
    type: 'SALE', qty: -12, refId: 'INV-2026-0019', refType: 'sale',
    notes: null, createdAt: Timestamp.fromDate(new Date('2026-05-25')), createdBy: 'owner',
  },
  {
    id: 'sm5', companyId: 'demo', productId: 'p1', productName: 'Rice 25kg Bag',
    type: 'SALE', qty: -12, refId: 'INV-2026-0024', refType: 'sale',
    notes: null, createdAt: Timestamp.fromDate(new Date('2026-06-05')), createdBy: 'owner',
  },
];
