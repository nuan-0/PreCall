import { useLocation, BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Footer, Navbar } from './components/Layout';
import { AdminPanel } from './pages/AdminPanel';
import { Dashboard } from './pages/Dashboard';
import { LandingPage } from './pages/LandingPage';
import { PremiumPage } from './pages/PremiumPage';
import { SubjectPage } from './pages/SubjectPage';
import { TopicPage } from './pages/TopicPage';
import { ProfilePage } from './pages/ProfilePage';
import { NotificationsPage } from './pages/NotificationsPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import TermsPage from './pages/TermsPage';
import { useSettings } from './hooks/useData';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { InstallPWA } from './components/InstallPWA';
import { cn } from './lib/utils';

export default function App() {
  const { settings } = useSettings();
  const isAdminRoute = window.location.pathname.startsWith('/admin');

  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppContent settings={settings} />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

function AppContent({ settings }: { settings: any }) {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      <Toaster position="top-center" richColors />
      <InstallPWA />
      {!isAdminRoute && <Navbar />}
      <main className={cn("flex-1", !isAdminRoute && "pt-0")}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/subject/:slug" element={<SubjectPage />} />
          <Route path="/topic/:slug" element={<TopicPage />} />
          <Route path="/premium" element={<PremiumPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/*" 
            element={
              <ProtectedRoute requireAdmin>
                <AdminPanel />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </main>
      {!isAdminRoute && <Footer settings={settings} />}
    </div>
  );
}
