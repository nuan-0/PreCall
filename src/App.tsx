import { useEffect } from 'react';
import { useLocation, BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { setupErrorHandling } from './lib/errorReporter';
import { Footer, Navbar } from './components/Layout';
import { AdminPanel } from './pages/AdminPanel';
import { Dashboard } from './pages/Dashboard';
import { LandingPage } from './pages/LandingPage';
import { PremiumPage } from './pages/PremiumPage';
import { SubjectPage } from './pages/SubjectPage';
import { TopicPage } from './pages/TopicPage';
import { ProfilePage } from './pages/ProfilePage';
import { NotificationsPage } from './pages/NotificationsPage';
import { PdfStorePage } from './pages/PdfStorePage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import QRCodePage from './pages/QRCodePage';
import { useSettings, useSubjects } from './hooks/useData';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { InstallPWA } from './components/InstallPWA';
import { ScrollToTop } from './components/ScrollToTop';
import { cn } from './lib/utils';

export default function App() {
  const { settings, loading: settingsLoading } = useSettings();
  const { loading: subjectsLoading } = useSubjects();

  useEffect(() => {
    setupErrorHandling();
  }, []);

  const totalLoading = settingsLoading || subjectsLoading;

  if (totalLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-500 animate-pulse">Initializing PreCall...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
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
      {!isAdminRoute && <Navbar />}
      <main className={cn("flex-1", !isAdminRoute && "pt-0")}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route 
            path="/pdf-store" 
            element={<PdfStorePage />} 
          />
          <Route 
            path="/subject/:slug" 
            element={<SubjectPage />} 
          />
          <Route 
            path="/topic/:slug" 
            element={<TopicPage />} 
          />
          <Route path="/premium" element={<PremiumPage />} />
          <Route 
            path="/notifications" 
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            } 
          />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/qr" element={<QRCodePage />} />
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
