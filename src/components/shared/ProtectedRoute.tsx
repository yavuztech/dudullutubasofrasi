import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import type { UserRole } from '../../types';

interface Props {
  allowedRoles: UserRole[];
}

export default function ProtectedRoute({ allowedRoles }: Props) {
  const { user, loading, error } = useAuthStore();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Yükleniyor…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow p-6 max-w-sm w-full text-center">
          <p className="text-red-600 font-semibold mb-2">Giriş Hatası</p>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <a href="/login" className="btn-primary inline-block">Tekrar Giriş Yap</a>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.some((r) => user.roles.includes(r))) return <Navigate to="/login" replace />;

  return <Outlet />;
}
