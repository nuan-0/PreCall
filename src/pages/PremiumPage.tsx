import { Check, Crown, ShieldCheck, Zap, Sparkles, FileText, Smartphone, Users, ArrowRight, HelpCircle, MessageCircle, PartyPopper } from 'lucide-react';
import { useState } from 'react';
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
  
  const price = settings?.price || '999';
  const originalPrice = settings?.originalPrice || '2,499';

  const handleUpgrade = async () => {
    if (!user) {
      openAuthModal();
      return;
    }

    if (isPremium) {
      toast.success("You already have Premium access!");
      return;
    }

    setIsProcessing(true);
    
    const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
    
    if (!razorpayKey) {
      toast.error("Payment system is not configured. Please contact support.");
      setIsProcessing(false);
      return;
    }

    const options = {
      key: razorpayKey,
      amount: parseInt(price.replace(/,/g, '')) * 100, // Amount in paise
      currency: "INR",
      name: settings?.appName || "PreCall",
      description: "Premium One Season Access",
      image: "/icon.svg",
      handler: async function (response: any) {
        try {
          // In a production app, you MUST verify the payment on the server
          const userRef = doc(db, 'users', user.uid);
          await setDoc(userRef, { 
            isPremium: true,
            premiumPaymentId: response.razorpay_payment_id,
            premiumOrderId: response.razorpay_order_id,
            premiumSignature: response.razorpay_signature,
            premiumActivatedAt: new Date().toISOString()
          }, { merge: true });
          
          // Add premium notification
          await addDoc(collection(db, 'notifications'), {
            userId: user.uid,
            title: 'Premium Activated! 👑',
            message: 'You now have full access to all high-yield topics and premium PDF downloads. Happy studying!',
            type: 'premium',
            createdAt: new Date().toISOString()
          });

          // Trigger Confetti
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#7c3aed', '#f59e0b', '#10b981']
          });

          setShowSuccessModal(true);
          setIsProcessing(false);
        } catch (error) {
          console.error("Error updating premium status:", error);
          toast.error("Payment successful but failed to update status. Please contact support.");
          setIsProcessing(false);
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
        }
      }
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error("Razorpay failed to load:", error);
      toast.error("Failed to load payment gateway. Please check your internet connection.");
      setIsProcessing(false);
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
      <div className="text-center mb-20 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-xs font-black uppercase tracking-widest mb-8 shadow-sm">
          <Crown className="h-4 w-4" />
          PreCall Premium
        </div>
        <h1 className="text-5xl font-black text-violet-950 mb-8 tracking-tight sm:text-6xl lg:text-7xl text-balance">
          Revision that actually <span className="text-violet-600">sticks.</span>
        </h1>
        <p className="text-xl text-slate-500 font-medium max-w-3xl mx-auto leading-relaxed text-balance">
          Stop drowning in massive textbooks. Switch to high-yield, recall-focused revision designed for the modern UPSC aspirant.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-3 mb-24 items-start">
        <div className="lg:col-span-2 grid gap-6 sm:grid-cols-2">
          {benefits.map((benefit) => (
            <Card key={benefit.title} className="p-10 border-slate-100 shadow-xl shadow-slate-100/30 hover:shadow-2xl hover:shadow-violet-100/40 transition-all hover:border-violet-200">
              <div className="mb-6 inline-flex p-4 rounded-2xl bg-violet-50 text-violet-600 shadow-inner border border-violet-100">
                <benefit.icon className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-black text-violet-950 mb-3 tracking-tight">{benefit.title}</h3>
              <p className="text-slate-500 text-base font-medium leading-relaxed">{benefit.description}</p>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-24 p-10 border-violet-200 bg-violet-50/50 shadow-2xl shadow-violet-200/50 overflow-hidden rounded-[2.5rem]">
            <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-violet-200/30 blur-[80px]" />
            <div className="absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-orange-200/20 blur-[80px]" />
            
            <div className="relative z-10">
              <div className="mb-6 flex items-center justify-end">
                <div className="flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                  <ShieldCheck className="h-3 w-3" />
                  Verified
                </div>
              </div>
              
              <h3 className="text-3xl font-black text-violet-950 mb-3 tracking-tight">One Season Access</h3>
              <p className="text-slate-500 text-base font-medium mb-10 leading-relaxed">One-time payment. No subscriptions. All future updates included.</p>
              
              <div className="mb-10">
                <div className="flex items-baseline gap-3">
                  <span className="text-6xl font-black text-violet-950">₹{price}</span>
                  <span className="text-slate-400 line-through font-bold text-xl">₹{originalPrice}</span>
                </div>
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest">
                  Save 60% Today
                </div>
              </div>

              <ul className="space-y-5 mb-12">
                {['All Subjects Unlocked', 'Unlimited PDF Downloads', 'Ad-free Experience', 'Priority Content Updates'].map((item) => (
                  <li key={item} className="flex items-center gap-4 text-base font-bold text-violet-900">
                    <div className="rounded-full bg-emerald-100 p-1.5 text-emerald-600 shadow-sm">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>

              <Button 
                size="lg" 
                className="w-full h-16 text-lg shadow-2xl shadow-violet-300 group"
                onClick={handleUpgrade}
                loading={isProcessing}
                disabled={isPremium}
              >
                {isPremium ? 'Already Premium' : (isProcessing ? 'Processing...' : 'Get Premium Now')}
                {!isPremium && !isProcessing && <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />}
              </Button>
              
              <div className="mt-6 flex flex-col items-center gap-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Secure Payment via Razorpay
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* FAQ Section */}
      <section className="mb-24 max-w-3xl mx-auto">
        <h2 className="text-3xl font-black text-violet-950 mb-12 text-center tracking-tight">Common Questions</h2>
        <div className="space-y-6">
          {faqs.map((faq, i) => (
            <div key={i} className="p-8 rounded-3xl bg-slate-50 border border-slate-100 shadow-sm">
              <h4 className="text-lg font-black text-violet-950 mb-3 tracking-tight">{faq.q}</h4>
              <p className="text-slate-600 font-medium leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="rounded-[4rem] bg-slate-900 p-16 text-center text-white relative overflow-hidden shadow-2xl shadow-slate-300/50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(124,58,237,0.3),transparent)]" />
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        
        <div className="relative z-10 max-w-3xl mx-auto">
          <Sparkles className="h-12 w-12 text-amber-400 mx-auto mb-8" />
          <h2 className="text-4xl font-black mb-6 tracking-tight">Join the Revision Revolution</h2>
          <p className="text-xl text-slate-400 font-medium mb-12 leading-relaxed">
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
              className="bg-white rounded-[3rem] p-10 max-w-md w-full text-center shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-violet-600 via-amber-400 to-emerald-500" />
              
              <div className="mb-8 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600 shadow-inner">
                <PartyPopper className="h-10 w-10" />
              </div>
              
              <h2 className="text-3xl font-black text-violet-950 mb-4 tracking-tight">Welcome to Premium!</h2>
              <p className="text-slate-600 font-medium mb-10 leading-relaxed">
                Your payment was successful. You now have full access to all high-yield topics and premium downloads.
              </p>
              
              <Button 
                className="w-full h-14 text-lg rounded-2xl shadow-xl shadow-violet-200"
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
