import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, ChefHat, UtensilsCrossed, LayoutDashboard, ClipboardList, Users, Bell, Package, Banknote } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';

interface Props {
  children: ReactNode;
  title: string;
}

const navItems = {
  kitchen: [
    { path: '/kitchen/orders', label: 'Siparişler', icon: ChefHat },
    { path: '/kitchen/products', label: 'Ürünler', icon: UtensilsCrossed },
  ],
  waiter: [
    { path: '/waiter', label: 'Bildirimler', icon: Bell },
    { path: '/waiter/tables', label: 'Masalar', icon: LayoutDashboard },
  ],
  cashier: [
    { path: '/cashier', label: 'Kasa', icon: Banknote },
  ],
  admin: [
    { path: '/admin/orders',   label: 'Siparişler',  icon: ClipboardList },
    { path: '/admin/takeaway', label: 'Gel Al',       icon: Package },
    { path: '/admin/products', label: 'Ürünler',     icon: UtensilsCrossed },
    { path: '/admin/tables',   label: 'Masalar',     icon: LayoutDashboard },
    { path: '/admin/staff',    label: 'Personel',    icon: Users },
  ],
};

export default function StaffLayout({ children, title }: Props) {
  const { user, signOut } = useAuthStore();
  const { unreadCount } = useNotificationStore();
  const location = useLocation();
  const navigate = useNavigate();

  const items = user
    ? user.roles
        .flatMap((r) => navItems[r] ?? [])
        .filter((item, i, arr) => arr.findIndex((x) => x.label === item.label) === i)
    : [];

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* ── Sidebar (desktop) ── */}
      {items.length > 0 && (
        <aside className="hidden sm:flex flex-col w-56 flex-shrink-0 bg-white border-r border-gray-200">
          {/* sticky içinde kalması için iç wrapper sticky yapıyoruz */}
          <div className="sticky top-0 flex flex-col h-screen">
            <div className="h-14 flex items-center gap-2.5 px-4 border-b border-gray-200 flex-shrink-0">
              <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <ChefHat className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-gray-900 text-sm">Tuba Sofrası</span>
            </div>
            <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
              {items.map(({ path, label, icon: Icon }) => {
                const active = location.pathname === path;
                return (
                  <Link
                    key={path}
                    to={path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      active ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>
      )}

      {/* ── Content column ── */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="bg-white border-b border-gray-200 h-14 flex items-center justify-between sticky top-0 z-20 flex-shrink-0">
          <div className="flex items-center gap-2 px-4">
            <div className="sm:hidden w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <ChefHat className="w-4 h-4 text-white" />
            </div>
            <h1 className="font-semibold text-gray-800 text-base">{title}</h1>
            {unreadCount > 0 && (
              <span className="badge bg-red-500 text-white">{unreadCount}</span>
            )}
          </div>
          <div className="flex items-center gap-2 px-4">
            <span className="text-sm text-gray-500 hidden sm:block">{user?.displayName}</span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors text-sm"
              aria-label="Çıkış Yap"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Çıkış</span>
            </button>
          </div>
        </header>

        <main className="flex-1 pb-20 sm:pb-6">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      {items.length > 0 && (
        <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex sm:hidden z-30">
          {items.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex-1 flex flex-col items-center justify-center py-2 text-xs font-medium transition-colors ${
                  active ? 'text-brand-600' : 'text-gray-500'
                }`}
              >
                <Icon className="w-5 h-5 mb-0.5" />
                {label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
