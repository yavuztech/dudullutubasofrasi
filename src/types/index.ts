// ─────────────────────────────────────────────
//  Domain types for Dudullu Tuba Sofrası
// ─────────────────────────────────────────────

export type UserRole =
  | 'admin'
  | 'kitchen'
  | 'waiter'
  | 'waiter_ladies'
  | 'cashier'
  | 'cashier_ladies'
  | 'clothing';

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
  | 'available'        // boş
  | 'occupied';        // müşteri var, sipariş var

export type TableSection = 'normal' | 'family' | 'ladies';

export interface Table {
  id: string;
  number: number;
  capacity: number;
  status: TableStatus;
  currentOrderId?: string;
  qrToken: string; // random token embedded in QR URL
  sessionId: string; // changes on every new customer visit (payment collected)
  updatedAt: Date;
  section?: TableSection; // undefined = 'normal' (geriye dönük uyumlu)
  displayName?: string;
  originalCapacity?: number;
  parentTableId?: string;
  splitGroupIds?: string[];
  // Fiziksel masa birleştirme
  mergedTableIds?: string[];     // Bu masaya eklenen masaların ID'leri (primary masada)
  mergedTableNumbers?: number[]; // Görüntülemek için numara listesi (primary masada)
  mergedIntoId?: string;         // Bu masa başka bir masaya eklendiyse o masanın ID'si
}

// ─── Product ────────────────────────────────
export type ProductDepartment = 'food' | 'clothing';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  available: boolean;
  sortOrder: number;
  department?: ProductDepartment; // undefined = 'food' (geriye dönük uyumlu)
  stock?: number;                 // undefined = sınırsız (gıda), number = stok takipli (giyim)
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  department?: ProductDepartment; // undefined = 'food'
  kitchenStation?: string;        // 'station1' Fırın | 'station2' Izgara | 'station3' Kasa | 'station4' Burger
}

// ─── Clothing Sale ──────────────────────────
export interface ClothingSaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface ClothingSale {
  id: string;
  items: ClothingSaleItem[];
  customerName?: string;
  totalAmount: number;
  discountApplied: boolean;
  discountRate: number;
  createdAt: Date;
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
  categoryId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber?: string;
  type: OrderType;
  tableId?: string;
  tableNumber?: number;
  tableLabel?: string;
  items: OrderItem[];
  status: OrderStatus;
  tableSection?: TableSection;
  kitchenPrintRequestId?: string;
  kitchenPrintHandled?: Record<string, string>;
  paymentStatus?: 'paid' | 'credit';
  debtId?: string;
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

export interface CashDebt {
  id: string;
  customerName: string;
  tableId: string;
  tableLabel: string;
  tableSection?: TableSection;
  orderIds: string[];
  items: OrderItem[];
  subtotal?: number;
  discountAmount?: number;
  totalAmount: number;
  paidAmount: number;
  status: 'open' | 'paid';
  createdAt: Date;
  updatedAt: Date;
}

// ─── Notification record ────────────────────
export interface NotificationRecord {
  id: string;
  type:
    | 'order_ready_waiter'
    | 'order_ready_customer';
  orderId?: string;
  tableId?: string;
  tableNumber?: number;
  tableLabel?: string;
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

// ─── Printer Settings (Firestore: settings/printer-config) ───
export interface PrinterSettings {
  enabled: boolean;                         // Otomatik yazdırma aktif mi
  stationMapping?: Record<string, string>;  // Legacy single-bridge mapping
  bridgeUrl?: string;                       // Bridge service URL (varsayılan: http://localhost:3001)
  bridgeUrls?: Record<string, string>;      // Bridge URL per station
}

// ─── Cart (client-side only) ─────────────────
export interface CartItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
}
