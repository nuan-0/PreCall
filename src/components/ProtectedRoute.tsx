import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Skeleton } from './UI';
import { ShieldCheck } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAdmin = false }) => {
  const { user, loading, isAdmin, logout, openAuthModal } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!user) {
    // Redirect to login or landing page if not logged in
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    // Show unauthorized screen or redirect
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
        <div className="max-w-md space-y-8">
          <div className="mx-auto relative">
            <div className="absolute inset-0 bg-red-100 rounded-full blur-2xl opacity-50 animate-pulse" />
            <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-white border-2 border-red-50 shadow-xl shadow-red-100/50 text-red-600">
              <ShieldCheck className="h-12 w-12" />
            </div>
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black text-violet-950 tracking-tight leading-tight">Access Restricted</h1>
            <p className="text-slate-500 font-medium text-lg leading-relaxed">
              This area is reserved for approved administrators. If you believe you should have access, please ensure you are signed in with your approved account.
            </p>
          </div>
          <div className="flex flex-col gap-4 pt-4">
            <button 
              onClick={() => navigate('/')}
              className="inline-flex h-16 items-center justify-center rounded-2xl bg-violet-600 px-10 text-base font-black text-white shadow-2xl shadow-violet-200 transition-all hover:bg-violet-700 hover:shadow-violet-300 active:scale-95"
            >
              Back to Safety
            </button>
            <button 
              onClick={async () => { 
                await logout();
                openAuthModal();
              }}
              className="text-sm font-bold text-slate-400 hover:text-violet-600 transition-colors"
            >
              Sign in with a different account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
