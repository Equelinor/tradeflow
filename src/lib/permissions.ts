import type { UserRole, Plan } from '@/types';

export const can = {
  createSale:     (role: UserRole) => ['owner','admin','sales'].includes(role),
  voidSale:       (role: UserRole) => ['owner','admin'].includes(role),
  createPurchase: (role: UserRole) => ['owner','admin'].includes(role),
  voidPurchase:   (role: UserRole) => ['owner','admin'].includes(role),
  createReceipt:  (role: UserRole) => ['owner','admin','sales'].includes(role),
  voidReceipt:    (role: UserRole) => ['owner','admin'].includes(role),
  createPayment:  (role: UserRole) => ['owner','admin'].includes(role),
  voidPayment:    (role: UserRole) => ['owner','admin'].includes(role),
  manageCustomers:(role: UserRole) => ['owner','admin','sales'].includes(role),
  manageSuppliers:(role: UserRole) => ['owner','admin'].includes(role),
  manageProducts: (role: UserRole) => ['owner','admin'].includes(role),
  viewReports:    (role: UserRole) => ['owner','admin','accountant'].includes(role),
  viewInventory:  (_role: UserRole) => true,
  manageUsers:    (role: UserRole) => role === 'owner',
  manageSettings: (role: UserRole) => role === 'owner',
  accessPro:      (plan: Plan)     => plan === 'pro',
};

export function requireRole(role: UserRole, allowed: UserRole[]): boolean {
  return allowed.includes(role);
}
