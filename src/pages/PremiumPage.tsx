import { Check, Crown, ShieldCheck, Zap, Sparkles, FileText, Smartphone, Users, ArrowRight, HelpCircle, MessageCircle, PartyPopper } from 'lucide-react';
import { useState, useRef } from 'react';
import { Button, Card, Badge } from '../components/UI';
import { useSettings } from '../hooks/useData';
import { useAuth } from '../contexts/AuthContext';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function PremiumPage() {
  const { settings } = useSettings();
  const { user, isPremium, openAuthModal } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const processingRef = useRef(false);
  
  const price = settings?.price || '999';
  const originalPrice = settings?.originalPrice || '2,499';

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleUpgrade = async () => {
    if (processingRef.current) return;
    
    if (!user) {
      openAuthModal();
      return;
    }

    if (isPremium) {
      toast.success("You already have Premium access!");
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);
    
    // 1. Ensure Razorpay script is loaded
    const isScriptLoaded = await loadRazorpayScript();
    if (!isScriptLoaded) {
      toast.error("Failed to load payment gateway. Please check your internet connection.");
      setIsProcessing(false);
      processingRef.current = false;
      return;
    }

    let razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
    
    // Fallback: Fetch key from server if env var is missing
    if (!razorpayKey) {
      try {
        const configRes = await fetch('/api/config');
        if (configRes.ok) {
          const configData = await configRes.json();
          razorpayKey = configData.razorpayKeyId;
        }
      } catch (err) {
        console.error("Failed to fetch config from server:", err);
      }
    }
    
    if (!razorpayKey) {
      toast.error(
        <div className="flex flex-col gap-2">
          <span className="font-bold">Payment Configuration Missing</span>
          <span className="text-xs">Please ensure VITE_RAZORPAY_KEY_ID is set in the platform settings.</span>
          <span className="text-[10px] opacity-70">Note: If you just added it, try restarting the dev server.</span>
        </div>,
        { duration: 6000 }
      );
      setIsProcessing(false);
      processingRef.current = false;
      return;
    }

    try {
      // 2. Create Order on Server
      const amountInPaise = parseInt(price.replace(/,/g, '')) * 100;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const orderRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountInPaise }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!orderRes.ok) {
        const err = await orderRes.json();
        throw new Error(err.error || 'Failed to initialize payment');
      }

      const orderData = await orderRes.json();

      // 3. Open Razorpay Checkout
      const options = {
        key: razorpayKey,
        amount: orderData.amount,
        currency: orderData.currency,
        name: settings?.appName || "PreCall",
        description: "Premium One Season Access",
        image: "/icon.svg",
        order_id: orderData.id,
        handler: async function (response: any) {
          try {
            toast.loading("Verifying payment...", { id: 'payment-verify' });
            
            // 4. Verify the payment on our backend
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                userId: user.uid
              })
            });

            if (!verifyRes.ok) {
              const errData = await verifyRes.json();
              throw new Error(errData.error || 'Verification failed');
            }
            
            toast.success("Payment verified! Welcome to Premium.", { id: 'payment-verify' });
            
            // Trigger Confetti
            confetti({
              particleCount: 150,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#7c3aed', '#f59e0b', '#10b981']
            });

            setShowSuccessModal(true);
            setIsProcessing(false);
            processingRef.current = false;
          } catch (error: any) {
            console.error("Error verifying payment:", error);
            toast.error(error.message || "Payment successful but failed to update status. Please contact support.", { id: 'payment-verify' });
            setIsProcessing(false);
            processingRef.current = false;
          }
        },
        prefill: {
          name: user.displayName || "",
          email: user.email || "",
        },
        theme: {
          color: "#7c3aed",
        },
        modal: {
          ondismiss: function() {
            setIsProcessing(false);
            processingRef.current = false;
          }
        }
      };

      const rzp = new window.Razorpay(options);
      
      rzp.on('payment.failed', function (response: any) {
        console.error("Payment failed:", response.error);
        toast.error(`Payment failed: ${response.error.description}`);
        setIsProcessing(false);
        processingRef.current = false;
      });

      rzp.open();
    } catch (error: any) {
      console.error("Payment initialization failed:", error);
      const errorMsg = error.name === 'AbortError' 
        ? "Request timed out. Please try again." 
        : (error.message || "Failed to load payment gateway.");
      
      toast.error(errorMsg);
      setIsProcessing(false);
      processingRef.current = false;
    }
  };

  const benefits = [
    {
      title: '100+ High-Yield Topics',
      description: 'Comprehensive revision cards covering Polity, History, Economy, and more.',
      icon: Zap,
    },
    {
      title: 'Premium Revision PDFs',
      description: 'Downloadable, print-friendly summaries for offline revision.',
      icon: FileText,
    },
    {
      title: 'Trap Zone & Elimination',
      description: 'Master the logic UPSC uses to frame options and learn to eliminate them.',
      icon: ShieldCheck,
    },
    {
      title: 'PYQ Orientation',
      description: 'Every topic is mapped to previous year question patterns.',
      icon: Users,
    },
    {
      title: 'PWA Mobile Experience',
      description: 'Install on your phone for quick revision during commutes or breaks.',
      icon: Smartphone,
    },
    {
      title: 'Priority Support',
      description: 'Direct access to our team for content queries and technical help.',
      icon: Crown,
    },
  ];

  const faqs = [
    { q: "Is this a one-time payment?", a: "Yes, PreCall Premium is a one-time payment for one season access (valid till 25th May 2026). No monthly subscriptions." },
    { q: "Will I get new topics?", a: "Absolutely. All future subjects and topic updates are included for free." },
    { q: "Can I download PDFs?", a: "Yes, every subject has a dedicated high-yield PDF summary for offline study." },
  ];

  return (
    <div className="container-wide py-16 lg:py-24 pb-32">
      <div className="text-center mb-16 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-widest mb-6 shadow-sm">
          <Crown className="h-3.5 w-3.5" />
          PreCall Premium
        </div>
        <h1 className="text-4xl font-bold text-violet-950 mb-6 tracking-tight sm:text-5xl lg:text-6xl text-balance">
          Revision that actually <span className="text-violet-600">sticks.</span>
        </h1>
        <p className="text-lg text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed text-balance">
          Stop drowning in massive textbooks. Switch to high-yield, recall-focused revision designed for the modern UPSC aspirant.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-3 mb-24 items-start">
        <div className="lg:col-span-2 grid gap-6 sm:grid-cols-2">
          {benefits.map((benefit) => (
            <Card key={benefit.title} className="p-8 border-slate-100 shadow-sm hover:shadow-md transition-all hover:border-violet-200">
              <div className="mb-6 inline-flex p-3 rounded-xl bg-violet-50 text-violet-600 border border-violet-100">
                <benefit.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-violet-950 mb-2 tracking-tight">{benefit.title}</h3>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">{benefit.description}</p>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-24 p-8 border-violet-100 bg-violet-50/30 shadow-xl shadow-violet-100/20 overflow-hidden rounded-3xl">
            <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-violet-200/20 blur-[80px]" />
            
            <div className="relative z-10">
              <div className="mb-6 flex items-center justify-end">
                <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                  <ShieldCheck className="h-3 w-3" />
                  Verified
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-violet-950 mb-2 tracking-tight">One Season Access</h3>
              <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">One-time payment. No subscriptions. All future updates included.</p>
              
              <div className="mb-8">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-violet-950">₹{price}</span>
                  <span className="text-slate-400 line-through font-bold text-lg">₹{originalPrice}</span>
                </div>
                <div className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-widest">
                  Save 60% Today
                </div>
              </div>

              <ul className="space-y-4 mb-10">
                {['All Subjects Unlocked', 'Unlimited PDF Downloads', 'Ad-free Experience', 'Priority Content Updates'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm font-bold text-violet-900">
                    <div className="rounded-full bg-emerald-100 p-1 text-emerald-600">
                      <Check className="h-3 w-3" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>

              <Button 
                size="lg" 
                className="w-full h-16 text-lg font-bold shadow-lg shadow-violet-200 group rounded-xl active:scale-[0.98] transition-all"
                onClick={handleUpgrade}
                loading={isProcessing}
                disabled={isPremium}
              >
                {isPremium ? 'Already Premium' : (isProcessing ? 'Processing...' : 'Unlock Premium Access')}
                {!isPremium && !isProcessing && <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />}
              </Button>
              
              <div className="mt-6 flex flex-col items-center gap-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Secure Payment via Razorpay
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* FAQ Section */}
      <section className="mb-24 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-violet-950 mb-10 text-center tracking-tight">Common Questions</h2>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="p-6 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm">
              <h4 className="text-base font-bold text-violet-950 mb-2 tracking-tight">{faq.q}</h4>
              <p className="text-slate-600 text-sm font-medium leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="rounded-[3rem] bg-slate-900 p-12 text-center text-white relative overflow-hidden shadow-xl shadow-slate-200/50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(124,58,237,0.2),transparent)]" />
        
        <div className="relative z-10 max-w-2xl mx-auto">
          <Sparkles className="h-10 w-10 text-amber-400 mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4 tracking-tight">Join the Revision Revolution</h2>
          <p className="text-lg text-slate-400 font-medium mb-10 leading-relaxed">
            Join hundreds of aspirants who are refining their revision strategy with PreCall.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a 
              href="mailto:support@precall.app" 
              className="w-full sm:w-auto"
            >
              <Button variant="ghost" className="text-slate-400 hover:text-white w-full px-8 h-12">
                Email Support
              </Button>
            </a>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-md w-full text-center shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-violet-600 via-amber-400 to-emerald-500" />
              
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-inner">
                <PartyPopper className="h-8 w-8" />
              </div>
              
              <h2 className="text-2xl font-bold text-violet-950 mb-3 tracking-tight">Welcome to Premium!</h2>
              <p className="text-slate-600 text-sm font-medium mb-8 leading-relaxed">
                Your payment was successful. You now have full access to all high-yield topics and premium downloads.
              </p>
              
              <Button 
                className="w-full h-12 text-base rounded-xl shadow-lg shadow-violet-200"
                onClick={() => window.location.reload()}
              >
                Start Learning Now
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
