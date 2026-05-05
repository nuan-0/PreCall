import { BookOpen, ChevronRight, LayoutDashboard, Lock, Menu, X, ShieldCheck, LogOut, LogIn, User as UserIcon, Download, Bell, ShoppingCart } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Button, Badge } from './UI';
import { useSettings, useUserProfile, useNotifications, useAvatarUnlock } from '../hooks/useData';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from './AuthModal';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const location = useLocation();
  const { settings } = useSettings();
  const { user, isAdmin, isPremium, openAuthModal, logout } = useAuth();
  const { profile } = useUserProfile(user?.uid);
  const { notifications } = useNotifications(user?.uid);
  const { isInstallable, installApp } = usePWAInstall();
  const { isUnlocked } = useAvatarUnlock(user?.uid);
  const [avatarError, setAvatarError] = useState(false);

  const userAvatar = (isUnlocked && !avatarError) ? (profile?.avatarUrl || user?.photoURL || (user?.uid ? `https://api.dicebear.com/9.x/avataaars/svg?seed=${user.uid}` : null)) : null;
  const userDisplayName = profile?.displayName || user?.displayName || 'Aspirant';

  useEffect(() => {
    setAvatarError(false);
  }, [user?.uid, profile?.avatarUrl]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsOpen(false);
    setIsUserMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { name: 'Home', path: '/', icon: BookOpen },
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'PDF Store', path: '/pdf-store', icon: ShoppingCart },
    { name: 'Notifications', path: '/notifications', icon: Bell },
    { name: 'Premium', path: '/premium', icon: ShieldCheck, hideIfPaid: true },
  ].filter(item => !item.hideIfPaid || (!isPremium && !isAdmin));

  return (
    <nav className={cn(
      "sticky top-0 z-50 w-full transition-all duration-200 border-b-4 border-violet-400",
      scrolled ? "bg-white/90 backdrop-blur-md py-2 shadow-lg" : "bg-white py-3"
    )}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-12 items-center justify-between">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="flex h-10 w-10 items-center justify-center border-2 border-violet-400 bg-violet-600 text-white font-black text-lg shadow-[3px_3px_0px_0px_rgba(167,139,250,1)] transition-transform group-hover:scale-105">
                {settings?.appName?.substring(0, 2).toUpperCase() || 'PC'}
              </div>
              <span className="text-2xl font-black tracking-tighter text-violet-950 uppercase italic">{settings?.appName || 'PreCall'}</span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:block">
            <div className="flex items-center space-x-1">
              {isInstallable && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={installApp}
                  className="mr-2 rounded-xl text-violet-600 font-bold hover:bg-violet-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Install App
                </Button>
              )}
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all relative',
                    location.pathname === item.path
                      ? 'bg-violet-50 text-violet-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-violet-700'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                  {item.name === 'Notifications' && notifications.length > 0 && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500 border border-white" />
                  )}
                </Link>
              ))}
              
              <div className="ml-4 pl-4 border-l border-slate-100 flex items-center gap-2">
                {user ? (
                  <div className="relative">
                    <button
                      onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                      className="flex items-center gap-2.5 p-1 pr-3 rounded-full hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
                    >
                      <div className="h-8 w-8 rounded-full bg-violet-100 overflow-hidden border border-violet-200 shadow-sm">
                        {userAvatar ? (
                          <img 
                            src={userAvatar} 
                            alt={userDisplayName} 
                            className="h-full w-full object-cover" 
                            referrerPolicy="no-referrer"
                            onError={() => setAvatarError(true)}
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-violet-600">
                            <UserIcon className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <span className="text-sm font-bold text-slate-700 truncate max-w-[100px]">
                        {userDisplayName.split(' ')[0]}
                      </span>
                    </button>

                    <AnimatePresence>
                      {isUserMenuOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setIsUserMenuOpen(false)} 
                          />
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-slate-100 shadow-xl shadow-slate-200/50 z-50 overflow-hidden"
                          >
                            <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Signed in as</p>
                              <p className="text-sm font-bold text-slate-900 truncate mb-2">{user.email}</p>
                              <div className="flex gap-1">
                                {isAdmin && (
                                  <Badge variant="live" className="text-[8px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200">Admin</Badge>
                                )}
                                {isPremium ? (
                                  <Badge variant="live" className="text-[8px] px-1.5 py-0 bg-violet-100 text-violet-700 border-violet-200">Premium</Badge>
                                ) : (
                                  <Badge variant="free" className="text-[8px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border-emerald-200">Free</Badge>
                                )}
                              </div>
                            </div>
                            
                            <div className="p-2">
                              <Link
                                to="/profile"
                                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                              >
                                <div className="p-1.5 rounded-lg bg-slate-100">
                                  <UserIcon className="h-4 w-4" />
                                </div>
                                My Profile
                              </Link>

                              {isAdmin && (
                                <Link
                                  to="/admin"
                                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-bold text-amber-600 hover:bg-amber-50 transition-colors"
                                >
                                  <div className="p-1.5 rounded-lg bg-amber-100">
                                    <Lock className="h-4 w-4" />
                                  </div>
                                  Admin Panel
                                </Link>
                              )}
                              
                              <button
                                onClick={() => { logout(); setIsUserMenuOpen(false); }}
                                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                              >
                                <div className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-red-100">
                                  <LogOut className="h-4 w-4" />
                                </div>
                                Sign Out
                              </button>
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" onClick={openAuthModal} className="rounded-xl text-slate-600 font-bold hover:text-violet-600">
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="md:hidden">
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)} className="rounded-xl">
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {isOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-white border-b border-violet-100 px-4 pt-2 pb-6 space-y-2 shadow-xl animate-in slide-in-from-top-2 duration-200">
          {isInstallable && (
            <button
              onClick={() => { installApp(); setIsOpen(false); }}
              className="flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-base font-bold text-violet-700 bg-violet-50 active:bg-violet-100 transition-colors mb-2"
            >
              <div className="p-2 rounded-xl bg-violet-100">
                <Download className="h-5 w-5" />
              </div>
              Install App
            </button>
          )}
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={cn(
                'flex items-center gap-4 rounded-2xl px-4 py-4 text-base font-bold transition-colors',
                location.pathname === item.path
                  ? 'bg-violet-50 text-violet-700'
                  : 'text-slate-600 active:bg-slate-50'
              )}
            >
              <div className={cn(
                "p-2 rounded-xl",
                location.pathname === item.path ? "bg-violet-100" : "bg-slate-100"
              )}>
                <item.icon className="h-5 w-5" />
              </div>
              {item.name}
              {item.name === 'Notifications' && notifications.length > 0 && (
                <span className="ml-auto h-2 w-2 rounded-full bg-rose-500" />
              )}
            </Link>
          ))}
          
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setIsOpen(false)}
              className={cn(
                "flex items-center gap-4 rounded-2xl px-4 py-4 text-base font-bold transition-colors",
                location.pathname.startsWith('/admin') ? "bg-amber-50 text-amber-700" : "text-slate-600"
              )}
            >
              <div className="p-2 rounded-xl bg-amber-100">
                <Lock className="h-5 w-5" />
              </div>
              Admin Panel
            </Link>
          )}

          <div className="pt-4 border-t border-slate-50">
            {user ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-2xl">
                  <div className="h-10 w-10 rounded-full bg-violet-100 overflow-hidden border border-violet-200">
                    {userAvatar ? (
                      <img 
                        src={userAvatar} 
                        alt={userDisplayName} 
                        className="h-full w-full object-cover" 
                        referrerPolicy="no-referrer"
                        onError={() => setAvatarError(true)}
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-violet-600">
                        <UserIcon className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">{userDisplayName}</p>
                    <div className="flex gap-1 mt-0.5">
                      {isAdmin && (
                        <Badge variant="live" className="text-[8px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200">Admin</Badge>
                      )}
                      {isPremium ? (
                        <Badge variant="live" className="text-[8px] px-1.5 py-0 bg-violet-100 text-violet-700 border-violet-200">Premium</Badge>
                      ) : (
                        <Badge variant="free" className="text-[8px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border-emerald-200">Free</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Link
                  to="/profile"
                  onClick={() => setIsOpen(false)}
                  className="flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-base font-bold text-slate-600 active:bg-slate-50 transition-colors"
                >
                  <div className="p-2 rounded-xl bg-slate-100">
                    <UserIcon className="h-5 w-5" />
                  </div>
                  My Profile
                </Link>
                <button 
                  onClick={() => { logout(); setIsOpen(false); }}
                  className="flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-base font-bold text-red-600 active:bg-red-50 transition-colors"
                >
                  <div className="p-2 rounded-xl bg-red-50">
                    <LogOut className="h-5 w-5" />
                  </div>
                  Sign Out
                </button>
              </div>
            ) : (
              <button 
                onClick={() => { openAuthModal(); setIsOpen(false); }}
                className="flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-base font-bold text-violet-700 active:bg-violet-50 transition-colors"
              >
                <div className="p-2 rounded-xl bg-violet-50">
                  <LogIn className="h-5 w-5" />
                </div>
                Sign In
              </button>
            )}
          </div>
        </div>
      )}
      <AuthModal />
    </nav>
  );
}

export function Footer({ settings }: { settings?: any }) {
  const { isAdmin, isPremium } = useAuth();

  return (
    <footer className="bg-white border-t-4 border-violet-400 pt-20 pb-12">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-16">
          <div>
            <Link to="/" className="flex items-center gap-2.5 mb-8">
              <div className="flex h-10 w-10 items-center justify-center border-2 border-violet-400 bg-violet-600 text-white font-black shadow-[3px_3px_0px_0px_rgba(167,139,250,1)]">
                {settings?.appName?.substring(0, 2).toUpperCase() || 'PC'}
              </div>
              <span className="text-2xl font-black tracking-tighter text-violet-950 uppercase italic">{settings?.appName || 'PreCall'}</span>
            </Link>
            <p className="text-slate-500 text-sm leading-relaxed max-w-sm mb-6">
              High-yield revision topics for UPSC Prelims. Focused on trap zones, elimination logic, and rapid recall.
            </p>
            {settings?.sponsorText && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Partner</span>
                <span className="text-xs font-bold text-violet-700">{settings.sponsorText}</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Platform</h4>
              <ul className="space-y-4">
                <li><Link to="/dashboard" className="text-sm font-bold text-slate-600 hover:text-violet-600 transition-colors">Dashboard</Link></li>
                {(!isPremium && !isAdmin) && (
                  <li><Link to="/premium" className="text-sm font-bold text-slate-600 hover:text-violet-600 transition-colors">Premium</Link></li>
                )}
                <li><Link to="/qr" className="text-sm font-bold text-slate-600 hover:text-violet-600 transition-colors">QR Code</Link></li>
                {isAdmin && (
                  <li><Link to="/admin" className="text-sm font-bold text-amber-600 hover:text-amber-700 transition-colors">Admin</Link></li>
                )}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Support</h4>
              <ul className="space-y-4">
                <li><Link to="/about" className="text-sm font-bold text-slate-600 hover:text-violet-600 transition-colors">About Us</Link></li>
                <li><Link to="/contact" className="text-sm font-bold text-slate-600 hover:text-violet-600 transition-colors">Contact</Link></li>
                <li><Link to="/terms" className="text-sm font-bold text-slate-600 hover:text-violet-600 transition-colors">Terms</Link></li>
                <li><Link to="/privacy" className="text-sm font-bold text-slate-600 hover:text-violet-600 transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="pt-8 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs font-bold text-slate-400">
            © 2026 {settings?.appName || 'PreCall'}. {settings?.footerText || 'All rights reserved.'}
          </p>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
