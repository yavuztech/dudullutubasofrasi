// ─────────────────────────────────────────────
//  Domain types for Dudullu Tuba Sofrası
// ─────────────────────────────────────────────

export type UserRole = 'admin' | 'kitchen' | 'waiter' | 'cashier';

export interface StaffUser {
  uid: string;
  email: string;
  displayName: string;
  roles: UserRole[];
  fcmToken?: string;
  createdAt: Date;
}

// ─── Table ──────────────────────────────────
export type TableStatus =
  | 'available'        // boş, temiz
  | 'occupied'         // müşteri var, sipariş var
  | 'needs_cleaning'   // masa kapandı, temizlenmeli
  | 'being_cleaned';   // garson temizliyor

export interface Table {
  id: string;
  number: number;
  capacity: number;
  status: TableStatus;
  currentOrderId?: string;
  qrToken: string; // random token embedded in QR URL
  sessionId: string; // changes on every new customer visit (payment collected)
  updatedAt: Date;
}

// ─── Product ────────────────────────────────
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  available: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

// ─── Order ──────────────────────────────────
export type OrderType = 'table' | 'takeaway';

export type OrderStatus =
  | 'pending'     // Onay bekliyor (mutfağa düştü)
  | 'preparing'   // Hazırlanıyor
  | 'ready'       // Hazır (garson alacak / müşteri gelecek)
  | 'delivered'   // Masaya/müşteriye teslim edildi
  | 'paid'        // Ödendi, masa kapatıldı
  | 'cancelled';  // İptal

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

export interface Order {
  id: string;
  type: OrderType;
  tableId?: string;
  tableNumber?: number;
  items: OrderItem[];
  status: OrderStatus;
  // Takeaway customer info
  customerName?: string;
  customerPhone?: string;
  // Web Push / FCM token of customer device
  customerPushToken?: string;
  // Estimated preparation time in minutes (for takeaway)
  estimatedMinutes?: number;
  notes?: string;
  sessionId?: string; // table session when order was placed
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Notification record ────────────────────
export interface NotificationRecord {
  id: string;
  type:
    | 'order_ready_waiter'
    | 'order_ready_customer'
    | 'table_needs_cleaning'
    | 'table_cleaned';
  orderId?: string;
  tableId?: string;
  tableNumber?: number;
  message: string;
  sentAt: Date;
  read: boolean;
  targetRole: UserRole | 'customer';
}

// ─── Gel Al Settings (Firestore: settings/gel-al) ───
export interface GelAlSettings {
  phoneVerification: boolean;
  whatsappEnabled: boolean;
  whatsappNumber: string;
  staffDiscount: boolean;       // Personel indirimi aktif mi
  staffDiscountRate: number;    // 0-100 arası yüzde
}

// ─── Cart (client-side only) ─────────────────
export interface CartItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
}
