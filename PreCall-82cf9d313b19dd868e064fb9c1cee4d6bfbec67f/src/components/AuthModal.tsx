import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Modal, Button } from './UI';
import { Sparkles, ShieldCheck, Mail, Lock, ArrowRight, UserPlus, LogIn } from 'lucide-react';
import { toast } from 'sonner';

export function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, login, loginWithEmail, signup } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authMode, setAuthMode] = useState<'google' | 'email-login' | 'email-signup'>('google');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await login();
      toast.success('Welcome to PreCall!');
    } catch (error: any) {
      console.error('Login error:', error);
      let errorMessage = 'Failed to sign in. Please try again.';
      
      if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Popup blocked! Please allow popups for this site in your browser settings.';
      } else if (error.code === 'auth/unauthorized-domain') {
        errorMessage = 'This domain is not authorized for sign-in. Please contact support.';
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = 'Sign-in was cancelled. Please try again.';
      } else if (error.code) {
        errorMessage = `Sign-in error: ${error.code}. Please try again.`;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoggingIn(true);
    try {
      if (authMode === 'email-signup') {
        await signup(email, password);
        toast.success('Account created! Please check your email for verification.');
      } else {
        await loginWithEmail(email, password);
        toast.success('Welcome back!');
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      let msg = 'Authentication failed';
      if (error.code === 'auth/email-already-in-use') msg = 'Email already in use';
      if (error.code === 'auth/weak-password') msg = 'Password should be at least 6 characters';
      if (error.code === 'auth/invalid-credential') msg = 'Invalid email or password';
      if (error.code === 'auth/user-not-found') msg = 'No account found with this email';
      if (error.code === 'auth/wrong-password') msg = 'Incorrect password';
      toast.error(msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <Modal
      isOpen={isAuthModalOpen}
      onClose={closeAuthModal}
      title={authMode === 'email-signup' ? "Create account" : "Welcome back"}
    >
      <div className="space-y-6">
        {authMode === 'google' ? (
          <>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-slate-500 font-medium text-sm">
                  Join thousands of aspirants using high-yield revision to master the UPSC Prelims.
                </p>
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-violet-50/50 border border-violet-100/50 text-xs font-bold text-slate-700">
                  <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                  <span>100+ High-Yield Topics</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-blue-50/50 border border-blue-100/50 text-xs font-bold text-slate-700">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                  <span>Save progress & bookmarks</span>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <Button
                onClick={handleGoogleLogin}
                loading={isLoggingIn}
                className="w-full h-14 text-base bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-violet-300 shadow-sm transition-all active:scale-[0.98]"
              >
                {!isLoggingIn && (
                  <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                )}
                Continue with Google
              </Button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest"><span className="bg-white px-4 text-slate-400">Or use email</span></div>
              </div>

              <button
                onClick={() => setAuthMode('email-login')}
                className="w-full py-2 text-slate-400 hover:text-violet-600 font-bold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <Mail className="h-3.5 w-3.5" />
                Sign in with Email
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <Button
              type="submit"
              loading={isLoggingIn}
              className="w-full h-14 shadow-lg shadow-violet-100"
            >
              {authMode === 'email-signup' ? 'Create Account' : 'Sign In'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <div className="flex flex-col gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAuthMode(authMode === 'email-login' ? 'email-signup' : 'email-login')}
                className="text-xs font-bold text-violet-600 hover:text-violet-700 flex items-center justify-center gap-1.5"
              >
                {authMode === 'email-login' ? (
                  <><UserPlus className="h-3.5 w-3.5" /> Don't have an account? Sign up</>
                ) : (
                  <><LogIn className="h-3.5 w-3.5" /> Already have an account? Sign in</>
                )}
              </button>
              
              <button
                type="button"
                onClick={() => setAuthMode('google')}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                Back to Google Login
              </button>
            </div>
          </form>
        )}
        
        <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          {authMode === 'google' ? 'Simple. Secure. No Passwords.' : 'Your data is safe and encrypted.'}
        </p>
      </div>
    </Modal>
  );
}
