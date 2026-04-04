import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Auth
import { useAuthStore } from './stores/authStore';
import ProtectedRoute from './components/shared/ProtectedRoute';
import StaffLayout from './components/shared/StaffLayout';

// Pages — Customer
import CustomerMenu from './pages/CustomerMenu';
import PackageOrder from './pages/PackageOrder';
import LoginPage from './pages/LoginPage';

// Kitchen
import KitchenOrders   from './pages/kitchen/KitchenOrders';
import KitchenProducts from './pages/kitchen/KitchenProducts';
import KitchenTables   from './pages/kitchen/KitchenTables';

// Waiter
import WaiterNotifications from './pages/waiter/WaiterNotifications';
import WaiterTables        from './pages/waiter/WaiterTables';

// Cashier
import CashierPage from './pages/cashier/CashierPage';

// Admin
import AdminTables    from './pages/admin/AdminTables';
import AdminStaff    from './pages/admin/AdminStaff';
import AdminOrders   from './pages/admin/AdminOrders';
import AdminProducts from './pages/admin/AdminProducts';
import AdminTakeaway from './pages/admin/AdminTakeaway';

// FCM token sync
import { getFCMToken } from './lib/notifications';

function App() {
  const { init, user } = useAuthStore();

  useEffect(() => {
    const unsub = init();
    return unsub;
  }, []);

  // Sync FCM token whenever user logs in
  useEffect(() => {
    if (!user) return;
    (async () => {
      const token = await getFCMToken();
      if (token) useAuthStore.getState().setFCMToken(token);
    })();
  }, [user?.uid]);

  return (
    <>
      <BrowserRouter>
        <Routes>
          {/* ── Public customer routes ── */}
          <Route path="/menu/:qrToken" element={<CustomerMenu />} />
          <Route path="/order"         element={<PackageOrder />} />
          <Route path="/login"         element={<LoginPage />} />

          {/* ── Kitchen routes (role: kitchen | admin) ── */}
          <Route element={<ProtectedRoute allowedRoles={['kitchen', 'admin']} />}>
            <Route path="/kitchen" element={
              <StaffLayout title="Mutfak">
                <KitchenOrders />
              </StaffLayout>
            }>
            </Route>
            <Route path="/kitchen/orders" element={
              <StaffLayout title="Mutfak — Siparişler">
                <KitchenOrders />
              </StaffLayout>
            } />
            <Route path="/kitchen/products" element={
              <StaffLayout title="Mutfak — Ürünler">
                <KitchenProducts />
              </StaffLayout>
            } />
            <Route path="/kitchen/tables" element={
              <StaffLayout title="Mutfak — Masalar">
                <KitchenTables />
              </StaffLayout>
            } />
          </Route>

          {/* ── Cashier routes (role: cashier | admin) ── */}
          <Route element={<ProtectedRoute allowedRoles={['cashier', 'admin']} />}>
            <Route path="/cashier" element={
              <StaffLayout title="Kasa">
                <CashierPage />
              </StaffLayout>
            } />
          </Route>

          {/* ── Waiter routes (role: waiter | admin) ── */}
          <Route element={<ProtectedRoute allowedRoles={['waiter', 'admin']} />}>
            <Route path="/waiter" element={
              <StaffLayout title="Garson — Bildirimler">
                <WaiterNotifications />
              </StaffLayout>
            } />
            <Route path="/waiter/tables" element={
              <StaffLayout title="Garson — Masalar">
                <WaiterTables />
              </StaffLayout>
            } />
          </Route>

          {/* ── Admin routes ── */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin/staff" element={
              <StaffLayout title="Yönetim — Personel">
                <AdminStaff />
              </StaffLayout>
            } />
            <Route path="/admin/tables" element={
              <StaffLayout title="Yönetim — Masalar">
                <AdminTables />
              </StaffLayout>
            } />
            <Route path="/admin/products" element={
              <StaffLayout title="Yönetim — Ürünler">
                <AdminProducts />
              </StaffLayout>
            } />
            <Route path="/admin/orders" element={
              <StaffLayout title="Yönetim — Siparişler">
                <AdminOrders />
              </StaffLayout>
            } />
            <Route path="/admin/takeaway" element={
              <StaffLayout title="Yönetim — Gel Al">
                <AdminTakeaway />
              </StaffLayout>
            } />
          </Route>

          {/* ── Fallback ── */}
          <Route path="/"      element={<Navigate to="/order" replace />} />
          <Route path="/admin" element={<Navigate to="/login" replace />} />
          <Route path="*" element={
            <div className="min-h-screen flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="text-6xl mb-4">404</p>
                <p className="text-lg font-semibold">Sayfa bulunamadı</p>
              </div>
            </div>
          } />
        </Routes>
      </BrowserRouter>

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: { borderRadius: '12px', fontFamily: 'inherit', fontSize: '14px' },
        }}
      />
    </>
  );
}

export default App;
