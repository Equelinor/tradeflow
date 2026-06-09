import { Timestamp } from 'firebase/firestore';

export type UserRole = 'owner' | 'admin' | 'sales' | 'accountant' | 'viewer';
export type Plan     = 'basic' | 'pro';
export type SubStatus = 'trial' | 'active' | 'grace_period' | 'suspended' | 'cancelled';
export type DocStatus = 'active' | 'voided' | 'inactive';
export type PaymentType = 'cash' | 'credit';

// ── Company ───────────────────────────────────────────────────
export interface Company {
  companyId:      string;
  ownerUid:       string;
  name:           string;
  address:        string;
  phone:          string;
  email:          string;
  crNumber:       string | null;
  vatNumber:      string | null;
  logoUrl:        string | null;
  themeColor:     string | null;
  currency:       string;
  plan:           Plan;
  status:         'active' | 'suspended' | 'trial';
  trialStartDate: Timestamp | null;
  createdAt:      Timestamp;
  updatedAt:      Timestamp;
}

// ── User ──────────────────────────────────────────────────────
export interface CompanyUser {
  companyId:  string;
  uid:        string;
  name:       string;
  phone:      string;
  email:      string;
  role:       UserRole;
  status:     'active' | 'inactive';
  fcmToken:   string | null;
  createdAt:  Timestamp;
  updatedAt:  Timestamp;
  createdBy:  string;
}

// ── Customer ──────────────────────────────────────────────────
export interface Customer {
  companyId:      string;
  name:           string;
  phone:          string;
  whatsapp:       string | null;
  address:        string | null;
  crNumber:       string | null;
  openingBalance: number;
  currentBalance: number;
  creditLimit:    number | null;
  status:         DocStatus;
  createdAt:      Timestamp;
  updatedAt:      Timestamp;
  createdBy:      string;
}

// ── Supplier ──────────────────────────────────────────────────
export interface Supplier {
  companyId:      string;
  name:           string;
  phone:          string;
  email:          string | null;
  address:        string | null;
  country:        string | null;
  openingBalance: number;
  currentBalance: number;
  status:         DocStatus;
  createdAt:      Timestamp;
  updatedAt:      Timestamp;
  createdBy:      string;
}

// ── Product ───────────────────────────────────────────────────
export interface Product {
  companyId:     string;
  code:          string;
  name:          string;
  category:      string | null;
  unit:          string;
  purchasePrice: number;
  sellingPrice:  number;
  currentStock:  number;
  minStockLevel: number;
  status:        DocStatus;
  createdAt:     Timestamp;
  updatedAt:     Timestamp;
  createdBy:     string;
}

// ── Sale ──────────────────────────────────────────────────────
export interface Sale {
  companyId:    string;
  customerId:   string;
  customerName: string;
  date:         Timestamp;
  subtotal:     number;
  discount:     number;
  total:        number;
  paid:         number;
  balance:      number;
  paymentType:  PaymentType;
  notes:        string | null;
  isVoid:       boolean;
  voidedBy:     string | null;
  voidedAt:     Timestamp | null;
  status:       DocStatus;
  createdAt:    Timestamp;
  updatedAt:    Timestamp;
  createdBy:    string;
}

export interface SaleItem {
  companyId:   string;
  saleId:      string;
  productId:   string;
  productName: string;
  productCode: string;
  unit:        string;
  qty:         number;
  rate:        number;
  discount:    number;
  total:       number;
  createdAt:   Timestamp;
  createdBy:   string;
}

// ── Purchase ──────────────────────────────────────────────────
export interface Purchase {
  companyId:    string;
  supplierId:   string;
  supplierName: string;
  date:         Timestamp;
  subtotal:     number;
  discount:     number;
  total:        number;
  paid:         number;
  balance:      number;
  paymentType:  PaymentType;
  notes:        string | null;
  isVoid:       boolean;
  voidedBy:     string | null;
  voidedAt:     Timestamp | null;
  status:       DocStatus;
  createdAt:    Timestamp;
  updatedAt:    Timestamp;
  createdBy:    string;
}

export interface PurchaseItem {
  companyId:    string;
  purchaseId:   string;
  productId:    string;
  productName:  string;
  productCode:  string;
  unit:         string;
  qty:          number;
  rate:         number;
  discount:     number;
  total:        number;
  createdAt:    Timestamp;
  createdBy:    string;
}

// ── Receipt ───────────────────────────────────────────────────
export interface Receipt {
  companyId:    string;
  customerId:   string;
  customerName: string;
  amount:       number;
  date:         Timestamp;
  method:       'cash' | 'bank' | 'cheque';
  reference:    string | null;
  notes:        string | null;
  isVoid:       boolean;
  voidedBy:     string | null;
  voidedAt:     Timestamp | null;
  status:       DocStatus;
  createdAt:    Timestamp;
  updatedAt:    Timestamp;
  createdBy:    string;
}

// ── Payment ───────────────────────────────────────────────────
export interface Payment {
  companyId:    string;
  supplierId:   string;
  supplierName: string;
  amount:       number;
  date:         Timestamp;
  method:       'cash' | 'bank' | 'cheque';
  reference:    string | null;
  notes:        string | null;
  isVoid:       boolean;
  voidedBy:     string | null;
  voidedAt:     Timestamp | null;
  status:       DocStatus;
  createdAt:    Timestamp;
  updatedAt:    Timestamp;
  createdBy:    string;
}

// ── Stock Movement ────────────────────────────────────────────
export type StockMovementType =
  | 'OPENING' | 'SALE' | 'SALE_VOID'
  | 'PURCHASE' | 'PURCHASE_VOID'
  | 'CREDIT_NOTE' | 'DEBIT_NOTE'
  | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';

export interface StockMovement {
  companyId:   string;
  productId:   string;
  productName: string;
  type:        StockMovementType;
  qty:         number;
  refId:       string;
  refType:     string;
  notes:       string | null;
  createdAt:   Timestamp;
  createdBy:   string;
}

// ── Auth Context ──────────────────────────────────────────────
export interface AuthState {
  uid:           string;
  companyId:     string;
  role:          UserRole;
  plan:          Plan;
  name:          string;
  loading:       boolean;
  companyStatus: SubStatus;
}

// ── Branding Context ──────────────────────────────────────────
export interface BrandingState {
  companyName: string;
  logoUrl:     string | null;
  themeColor:  string;
  address:     string;
  phone:       string;
  email:       string;
  crNumber:    string | null;
  vatNumber:   string | null;
  currency:    string;
}
