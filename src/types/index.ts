// ─────────────────────────────────────────────
//  Domain types for Dudullu Tuba Sofrası
// ─────────────────────────────────────────────

export type UserRole = 'admin' | 'kitchen' | 'waiter' | 'cashier' | 'clothing';

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

export type TableSection = 'normal' | 'family';

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
  kitchenStation?: string;        // 'station1' | 'station2' | 'station3' | undefined
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
  enableTableCleaning: boolean; // Masa temizleme işi gösterilsin mi (garson ekranında)
}

// ─── Printer Settings (Firestore: settings/printer-config) ───
export interface PrinterSettings {
  enabled: boolean;                         // Otomatik yazdırma aktif mi
  stationMapping: Record<string, string>;   // { station1: "EPSON TM-T88V", station2: "Star TSP100" }
  bridgeUrl?: string;                       // Bridge service URL (varsayılan: http://localhost:3001)
}

// ─── Cart (client-side only) ─────────────────
export interface CartItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
}
