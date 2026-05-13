export interface Category {
  id: string;
  name: string;
  display_order: number;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  is_available: boolean;
  stock_quantity: number;
}

export interface RestaurantTable {
  id: string;
  table_number: string;
  status: 'available' | 'occupied' | 'reserved';
}

export interface Order {
  id: string;
  table_id: string;
  customer_name: string;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'served' | 'completed' | 'cancelled';
  payment_method: 'cash' | 'qris';
  payment_status: 'unpaid' | 'paid';
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  table?: RestaurantTable;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  price_at_order: number;
  menu_item?: MenuItem;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}
