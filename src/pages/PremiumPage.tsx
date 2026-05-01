import { Check, Crown, ShieldCheck, Zap, Sparkles, FileText, Smartphone, Users, ArrowRight, HelpCircle, MessageCircle, PartyPopper, CheckCircle2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Button, Card, Badge, Skeleton } from '../components/UI';
import { useSettings, useSubjects } from '../hooks/useData';
import { useAuth } from '../contexts/AuthContext';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Coupon } from '../types';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function PremiumPage() {
  const { settings } = useSettings();
  const { subjects, loading: subjectsLoading } = useSubjects();
  const { user, profile, isPremium, openAuthModal } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successType, setSuccessType] = useState<'premium' | 'pdf'>('premium');
  const [selectedPdfSlugs, setSelectedPdfSlugs] = useState<string[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const processingRef = useRef(false);
  
  const price = settings?.price || '999';
  const originalPrice = settings?.originalPrice || '2,499';

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      // Script is now in index.html, but we wait just in case it's still loading
      let attempts = 0;
      const check = setInterval(() => {
        if (window.Razorpay) {
          clearInterval(check);
          resolve(true);
        } else if (attempts > 50) {
          clearInterval(check);
          resolve(false);
        }
        attempts++;
      }, 200);
    });
  };

  // Sort subjects to show Live ones first
  const validPdfs = subjects.filter(s => s.status === 'live' && s.pdfVisible);

  const togglePdfSelection = (slug: string) => {
    if (profile?.ownedPdfs?.includes(slug)) return;
    
    setSelectedPdfSlugs(prev => 
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
    );
  };

  const selectAllPdfs = () => {
    if (validPdfs.length === 0) return;
    const slugs = validPdfs.map(s => s.slug).filter(slug => !profile?.ownedPdfs?.includes(slug));
    setSelectedPdfSlugs(slugs);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsValidatingCoupon(true);
    try {
      const res = await fetch('/api/validate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim(), productType: 'premium' })
      });
      const data = await res.json();
      if (res.ok) {
        setAppliedCoupon(data);
        toast.success(`Coupon applied: ${data.code}`);
      } else {
        setAppliedCoupon(null);
        toast.error(data.error || 'Invalid coupon');
      }
    } catch (err) {
      toast.error('Failed to validate coupon');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handlePayment = async (type: 'premium' | 'pdf', pdfSlug?: string) => {
    if (processingRef.current) return;
    
    if (!user) {
      openAuthModal();
      return;
    }

    if (type === 'premium' && isPremium) {
      toast.success("You already have Premium access!");
      return;
    }
    
    if (type === 'pdf' && pdfSlug && (isPremium || profile?.ownedPdfs?.includes(pdfSlug))) {
      toast.success("You already own this PDF!");
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);
    
    const isScriptLoaded = await loadRazorpayScript();
    if (!isScriptLoaded) {
      toast.error("Failed to load payment gateway.");
      setIsProcessing(false);
      processingRef.current = false;
      return;
    }

    let razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
    try {
      const configRes = await fetch('/api/config');
      if (configRes.ok) {
        const configData = await configRes.json();
        if (configData.razorpayKeyId) razorpayKey = configData.razorpayKeyId;
      }
    } catch (err) {}
    
    if (!razorpayKey) {
      toast.error("Payment configuration missing.");
      setIsProcessing(false);
      processingRef.current = false;
      return;
    }

    try {
      const amountValue = type === 'premium' ? parseInt(price.replace(/,/g, '')) : parseInt(settings?.pdfPrice || '199');
      const amountInPaise = amountValue * 100;
      
      const orderRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: amountInPaise,
          couponCode: appliedCoupon?.code,
          productType: type,
          productSlug: pdfSlug || null,
          userId: user?.uid
        })
      });
      
      if (!orderRes.ok) {
        let errorMsg = 'Failed to create order';
        try {
          const errData = await orderRes.json();
          errorMsg = errData.details || errData.error || errorMsg;
        } catch (e) {}
        throw new Error(errorMsg);
      }
      const orderData = await orderRes.json();

      const options = {
        key: razorpayKey,
        amount: orderData.amount,
        currency: orderData.currency,
        name: settings?.appName || "PreCall",
        description: type === 'premium' ? "Premium Season Access" : `High-Yield PDF: ${pdfSlug}`,
        image: "/icon.svg",
        order_id: orderData.id,
        handler: async function (response: any) {
          try {
            toast.loading("Verifying payment...", { id: 'payment-verify' });
            
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                userId: user.uid,
                couponCode: appliedCoupon?.code,
                productType: type,
                productSlug: pdfSlug || null
              })
            });

            if (!verifyRes.ok) throw new Error('Verification failed');
            
            toast.success("Payment verified!", { id: 'payment-verify' });
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });

            setSuccessType(type);
            setShowSuccessModal(true);
            setIsProcessing(false);
            processingRef.current = false;
          } catch (error: any) {
            toast.error("Payment verification failed.", { id: 'payment-verify' });
            setIsProcessing(false);
            processingRef.current = false;
          }
        },
        prefill: { name: user.displayName || "", email: user.email || "" },
        theme: { color: "#7c3aed" },
        modal: { ondismiss: () => { setIsProcessing(false); processingRef.current = false; } }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error: any) {
      toast.error(error.message || "Payment initialization failed.");
      setIsProcessing(false);
      processingRef.current = false;
    }
  };

  const handleUpgrade = () => handlePayment('premium');

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
                  <span className="text-5xl font-bold text-violet-950">
                    ₹{appliedCoupon ? Math.round((parseInt(price.toString().replace(/[^0-9]/g, '')) || 999) * 0.9) : price}
                  </span>
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

              {/* Coupon Section */}
              <div className="py-6 border-t border-violet-100/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="COUPON CODE"
                      className="w-full h-10 pl-4 pr-10 text-[10px] font-black uppercase tracking-widest bg-white border border-violet-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      disabled={!!appliedCoupon}
                    />
                    {appliedCoupon && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
                        <Check className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  {appliedCoupon ? (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-rose-500 hover:text-rose-600 font-bold text-[10px]"
                      onClick={() => { setAppliedCoupon(null); setCouponCode(''); }}
                    >
                      Remove
                    </Button>
                  ) : (
                    <Button 
                      size="sm" 
                      className="h-10 text-[10px] font-black px-4"
                      onClick={handleApplyCoupon}
                      loading={isValidatingCoupon}
                    >
                      Apply
                    </Button>
                  )}
                </div>
                {appliedCoupon && (
                  <p className="text-[10px] text-emerald-600 font-bold px-1">
                    Discount Applied: {appliedCoupon.type === 'percentage' ? `${appliedCoupon.discountPercentage}% Off` : `₹${appliedCoupon.discountAmount} Off`}
                  </p>
                )}
              </div>

              {appliedCoupon && (
                <div className="mb-4 space-y-2 text-sm font-bold px-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Base Price</span>
                    <span>₹{parseInt(price.replace(/,/g, ''))}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>Coupon Discount</span>
                    <span>-₹{
                      appliedCoupon.type === 'flat' 
                        ? appliedCoupon.discountAmount 
                        : Math.round(parseInt(price.replace(/,/g, '')) * (appliedCoupon.discountPercentage || 0) / 100)
                    }</span>
                  </div>
                </div>
              )}

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

      {/* PDF Store Section */}
      <section id="pdf-store" className="mb-24">
        <header className="text-center mb-16">
          <Badge variant="new" className="mb-6 h-7 px-4 shadow-sm bg-blue-100 text-blue-700 uppercase">PDF Store & Bundles</Badge>
          <h2 className="text-3xl font-bold text-violet-950 mb-4 tracking-tight">Revision PDF Store</h2>
          <p className="text-slate-500 font-medium max-w-xl mx-auto leading-relaxed">
            Already know what you need? Buy individual high-yield subject PDFs or bundle them for focused offline revision.
          </p>
        </header>

        {selectedPdfSlugs.length >= 2 && validPdfs.length > 0 && selectedPdfSlugs.length >= Math.ceil(validPdfs.length / 2) && !isPremium && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 p-6 rounded-3xl bg-amber-50 border-2 border-amber-200 flex flex-col md:flex-row items-center justify-between gap-6"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Crown className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-amber-950 font-bold">Bundle Recommended!</h4>
                <p className="text-sm text-amber-700 font-medium">You've selected multiple PDFs. It is more cost-effective to get <b>Season Premium Access for ₹{price}</b> for all current and future PDFs.</p>
              </div>
            </div>
            <Button onClick={handleUpgrade} className="bg-amber-600 hover:bg-amber-700 shadow-xl shadow-amber-200 whitespace-nowrap">
              Upgrade to Premium
            </Button>
          </motion.div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {subjectsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-6 h-48 border-slate-100 flex flex-col justify-between">
                <div>
                  <Skeleton className="h-10 w-10 mb-4 rounded-xl" />
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </Card>
            ))
          ) : validPdfs.length > 0 ? (
            validPdfs.map((subject) => {
              const isOwned = profile?.ownedPdfs?.includes(subject.slug) || isPremium;
              const isSelected = selectedPdfSlugs.includes(subject.slug);

              return (
                <Card 
                  key={subject.slug} 
                  onClick={() => !isOwned && togglePdfSelection(subject.slug)}
                  className={cn(
                    "p-6 cursor-pointer transition-all duration-300 border-slate-100 relative group",
                    isSelected && "border-violet-500 bg-violet-50/50 shadow-lg shadow-violet-100",
                    isOwned && "opacity-80 cursor-default bg-emerald-50/20"
                  )}
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center transition-colors",
                      isSelected ? "bg-violet-600 text-white" : "bg-slate-50 text-slate-400 group-hover:bg-violet-100 group-hover:text-violet-600"
                    )}>
                      <FileText className="h-5 w-5" />
                    </div>
                    {isOwned ? (
                      <Badge variant="free" className="h-6 px-2 bg-emerald-100 text-emerald-700">Owned</Badge>
                    ) : (
                      <div className={cn(
                        "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all",
                        isSelected ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200"
                      )}>
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                    )}
                  </div>
                  <h4 className="font-bold text-violet-950 mb-1">{subject.title}</h4>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">High-Yield PDF</p>
                  
                  {isSelected && (
                    <div className="mt-4 pt-4 border-t border-violet-100 flex items-center justify-between">
                      <span className="text-sm font-black text-violet-900">₹{settings?.pdfPrice || '199'}</span>
                      <Button 
                        size="sm" 
                        className="h-8 text-[10px] font-black"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePayment('pdf', subject.slug);
                        }}
                      >
                        Buy Now
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })
          ) : (
            <div className="col-span-full py-12 text-center">
              <p className="text-slate-400 font-bold uppercase tracking-widest">No subject PDFs available for purchase yet.</p>
            </div>
          )}
        </div>

        <div className="mt-12 text-center">
          <Button variant="ghost" className="text-slate-400 hover:text-violet-600 font-black text-[10px] uppercase tracking-widest" onClick={selectAllPdfs}>
            Select All Subjects
          </Button>
        </div>
      </section>

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
              href="mailto:precall.admin@gmail.com" 
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
              
              <h2 className="text-2xl font-bold text-violet-950 mb-3 tracking-tight">
                {successType === 'premium' ? 'Welcome to Premium!' : 'PDF Unlocked!'}
              </h2>
              <p className="text-slate-600 text-sm font-medium mb-8 leading-relaxed">
                {successType === 'premium' 
                  ? 'Your payment was successful. You now have full access to all high-yield topics and premium downloads.'
                  : 'Your payment was successful. You can now download the PDF from the subject page.'}
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
