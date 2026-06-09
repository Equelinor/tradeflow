// ─────────────────────────────────────────────────────────────
// SAMPLE DATA — replace each export with a real Firestore hook
// when Firebase is connected. Component structure stays the same.
// ─────────────────────────────────────────────────────────────

export interface DashboardKpis {
  salesToday:        number;
  collectedToday:    number;
  receiptsToday:     number;
  overdueCount:      number;
  overdueAmount:     number;
  stockValue:        number;
  lowStockCount:     number;
  totalOwedToUs:     number;
  totalWeOwe:        number;
}

export interface RecentTransaction {
  id:       string;
  type:     'sale' | 'purchase' | 'receipt' | 'payment';
  party:    string;
  amount:   number;
  time:     string;
  isToday:  boolean;
}

export interface TopDebtor {
  id:         string;
  name:       string;
  initials:   string;
  amount:     number;
  daysOverdue:number;
  phone:      string;
}

export interface LowStockItem {
  id:           string;
  name:         string;
  currentStock: number;
  minStock:     number;
  unit:         string;
}

export interface WeeklySale {
  day:    string;
  amount: number;
}

export interface BusinessSnapshot {
  activeCustomers:    number;
  activeSuppliers:    number;
  totalProducts:      number;
  pendingCollections: number;
  lowStockItems:      number;
  supplierPaymentsDue:number;
}

// ── Sample data ───────────────────────────────────────────────

export const sampleKpis: DashboardKpis = {
  salesToday:      1480,
  collectedToday:  1100,
  receiptsToday:   2,
  overdueCount:    4,
  overdueAmount:   8420,
  stockValue:      84600,
  lowStockCount:   3,
  totalOwedToUs:   28340,
  totalWeOwe:      11200,
};

export const sampleTransactions: RecentTransaction[] = [
  { id: '1', type: 'sale',     party: 'Gulf Foods Co.',    amount:  380,  time: '10:24 AM', isToday: true  },
  { id: '2', type: 'purchase', party: 'Al Jazeera Import', amount:  640,  time: '09:10 AM', isToday: true  },
  { id: '3', type: 'receipt',  party: 'Bahrain Retail',    amount: 1100,  time: '08:50 AM', isToday: true  },
  { id: '4', type: 'sale',     party: 'City Mart',         amount:  220,  time: 'Yesterday', isToday: false },
  { id: '5', type: 'purchase', party: 'Manama Supplies',   amount:  920,  time: 'Yesterday', isToday: false },
];

export const sampleDebtors: TopDebtor[] = [
  { id: '1', name: 'Gulf Foods Co.',  initials: 'GF', amount: 2500, daysOverdue: 42, phone: '97336100001' },
  { id: '2', name: 'XYZ Store',       initials: 'XY', amount: 1800, daysOverdue: 28, phone: '97336100002' },
  { id: '3', name: 'City Mart',       initials: 'CM', amount:  980, daysOverdue: 14, phone: '97336100003' },
  { id: '4', name: 'Bahrain Retail',  initials: 'BR', amount:  640, daysOverdue:  7, phone: '97336100004' },
  { id: '5', name: 'Manama Store',    initials: 'MS', amount:  500, daysOverdue:  5, phone: '97336100005' },
];

export const sampleLowStock: LowStockItem[] = [
  { id: '1', name: 'Rice 25kg Bag',    currentStock:  3, minStock: 10, unit: 'BAG' },
  { id: '2', name: 'Olive Oil 5L',     currentStock:  5, minStock: 12, unit: 'CTN' },
  { id: '3', name: 'Sugar 50kg',       currentStock:  7, minStock: 15, unit: 'BAG' },
  { id: '4', name: 'Canned Tomatoes',  currentStock: 22, minStock: 20, unit: 'CTN' },
  { id: '5', name: 'Vegetable Oil 1L', currentStock: 40, minStock: 30, unit: 'CTN' },
];

export const sampleWeeklySales: WeeklySale[] = [
  { day: 'Mon', amount: 980  },
  { day: 'Tue', amount: 1240 },
  { day: 'Wed', amount: 860  },
  { day: 'Thu', amount: 1580 },
  { day: 'Fri', amount: 1100 },
  { day: 'Sat', amount: 2000 },
  { day: 'Today', amount: 1480 },
];

export const sampleSnapshot: BusinessSnapshot = {
  activeCustomers:     84,
  activeSuppliers:     17,
  totalProducts:      248,
  pendingCollections: 8420,
  lowStockItems:        3,
  supplierPaymentsDue:  2,
};
