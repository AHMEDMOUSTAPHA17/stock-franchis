export type UserRole = 'founder' | 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  is_active: number;
  must_change_password?: number;
  created_at?: string;
  last_login_at?: string | null;
}

export interface StoreSettings {
  store_name: string;
  store_phone: string;
  store_address: string;
  currency: string;
  markup_cash_percent: number;
  markup_installment_percent: number;
  rounding_unit: number;
  low_stock_threshold: number;
  language: string;
  theme: string;
}

export interface Product {
  id: string;
  prd_ref: string;
  design: string;
  qty: number;
  cost_price?: number; // Hidden from user role
  cash_price: number;
  installment_12m_price: number;
  is_low_stock?: boolean;
  is_out_of_stock?: boolean;
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id?: string;
  product_id: string;
  prd_ref: string;
  design: string;
  qty: number;
  unit_price: number;
  line_total: number;
}

export interface Sale {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_phone?: string;
  payment_type: 'cash' | 'installment';
  installment_months: number;
  subtotal: number;
  total_amount: number;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  items?: SaleItem[];
  items_count?: number;
}

export interface PurchaseItem {
  id?: string;
  product_id?: string;
  prd_ref: string;
  design: string;
  qty: number;
  unit_cost: number;
  line_total: number;
}

export interface Purchase {
  id: string;
  supplier: string;
  note?: string;
  source: 'flb' | 'excel' | 'manual';
  total_cost: number;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  items?: PurchaseItem[];
  items_count?: number;
}

export interface CashTransaction {
  id: string;
  type: 'inflow' | 'outflow';
  amount: number;
  date: string;
  source: string;
  description: string;
  reference?: string;
  payment_method: string;
  origin: 'automatic' | 'manual';
  sale_id?: string | null;
  created_by: string;
  created_by_name?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string | null;
  username: string;
  action: string;
  entity: string;
  entity_id?: string | null;
  details?: string;
  ip?: string;
  created_at: string;
}
