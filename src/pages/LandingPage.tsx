import { ArrowRight, BookOpen, CheckCircle2, FileText, Lock, ShieldCheck, Target, Zap, ChevronRight, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card } from '../components/UI';
import { useSubjects, useSettings } from '../hooks/useData';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

export function LandingPage() {
  const { subjects } = useSubjects();
  const { settings } = useSettings();
  const { user, openAuthModal } = useAuth();

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative section-padding overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
          <div className="absolute top-[-15%] right-[-15%] w-[50%] h-[50%] bg-violet-100/40 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-15%] left-[-15%] w-[50%] h-[50%] bg-orange-50/40 rounded-full blur-[120px] animate-pulse" />
        </div>
        
        <div className="relative container-wide">
          <div className="flex flex-col items-center text-center max-w-5xl mx-auto">
            <h1 className="text-5xl font-black tracking-tight text-violet-950 sm:text-7xl lg:text-8xl leading-[1.05] mb-10 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100 text-balance">
              {settings?.heroTagline || "High-yield UPSC Prelims revision especially for You."}
            </h1>
            
            <p className="text-xl sm:text-2xl text-slate-600 leading-relaxed mb-14 max-w-3xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 font-medium text-balance">
              Stop drowning in bulky textbooks. PreCall delivers high-yield topics, trap zones, and elimination logic designed for rapid recall.
            </p>
            
            <div className="flex flex-col items-center gap-8 w-full animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-5 w-full sm:w-auto">
                <Link to="/dashboard" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:px-12 h-16 text-xl shadow-2xl shadow-violet-300/50 rounded-2xl group">
                    Start Free Revision
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
                <Link to="/premium" className="w-full sm:w-auto">
                  <Button variant="outline" size="lg" className="w-full sm:px-12 h-16 text-xl bg-white border-slate-200 hover:border-violet-300 hover:bg-violet-50/50 rounded-2xl">
                    Unlock Premium
                  </Button>
                </Link>
              </div>

              {!user && (
                <button 
                  onClick={openAuthModal}
                  className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-600 hover:bg-white hover:border-violet-200 hover:text-violet-600 transition-all shadow-sm"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
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
                  Continue with Google
                </button>
              )}
            </div>
            
            <div className="mt-20 flex flex-wrap items-center justify-center gap-x-10 gap-y-6 opacity-60 animate-in fade-in duration-1000 delay-500">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">One Stop Revision</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Traps and Tricks</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="section-padding bg-slate-50/50 border-y border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        
        <div className="relative container-wide z-10">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black text-violet-950 mb-4 tracking-tight">Built for the Modern Aspirant</h2>
            <p className="text-lg text-slate-500 font-medium max-w-2xl mx-auto text-balance">Everything you need to clear the Prelims cutoff, minus the fluff.</p>
          </div>
          
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: 'Trap Zones', desc: 'Identify common UPSC pitfalls before they catch you in the exam hall.', icon: ShieldCheck, color: 'bg-orange-50 text-orange-600 border-orange-100' },
              { title: 'Elimination Logic', desc: 'Master the art of smart guessing and option elimination for 50-50 questions.', icon: Target, color: 'bg-blue-50 text-blue-600 border-blue-100' },
              { title: 'Rapid Recall', desc: 'Concise cards designed for quick information retrieval during high-pressure moments.', icon: Zap, color: 'bg-violet-50 text-violet-600 border-violet-100' },
              { title: 'PYQ Patterns', desc: 'Revision logic built around actual UPSC question trends from the last 10 years.', icon: Star, color: 'bg-amber-50 text-amber-600 border-amber-100' },
              { title: 'Premium PDFs', desc: 'High-quality, print-friendly summaries ready for offline study and quick flips.', icon: FileText, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
              { title: 'Topics', desc: 'Syllabus broken down into manageable, high-yield bits that you can finish in minutes.', icon: BookOpen, color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
            ].map((feature) => (
              <Card key={feature.title} className="p-10 border-slate-100 shadow-xl shadow-slate-200/20 hover:shadow-2xl hover:shadow-violet-200/30 transition-all hover:-translate-y-1 bg-white">
                <div className={cn("mb-8 inline-flex p-4 rounded-2xl border shadow-inner", feature.color)}>
                  <feature.icon className="h-7 w-7" />
                </div>
                <h3 className="text-2xl font-black text-violet-950 mb-4 tracking-tight">{feature.title}</h3>
                <p className="text-slate-600 text-base font-medium leading-relaxed">{feature.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="py-20 bg-white border-b border-slate-100">
        <div className="container-wide">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 border border-violet-100">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-black text-violet-950 mb-2">Verified Content</h3>
              <p className="text-slate-500 font-medium text-sm leading-relaxed">
                Every topic is cross-checked with official UPSC sources and standard textbooks.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 border border-orange-100">
                <Zap className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-black text-violet-950 mb-2">Elimination First</h3>
              <p className="text-slate-500 font-medium text-sm leading-relaxed">
                We teach you how to eliminate options, the most critical skill for Prelims.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
                <Target className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-black text-violet-950 mb-2">PYQ Oriented</h3>
              <p className="text-slate-500 font-medium text-sm leading-relaxed">
                Content is mapped to previous year question patterns for maximum relevance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Subject Preview */}
      <section className="section-padding">
        <div className="container-wide">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-20">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest mb-4">
                Content Roadmap
              </div>
              <h2 className="text-5xl font-black text-violet-950 mb-6 tracking-tight">Curated Topics</h2>
              <p className="text-xl text-slate-600 leading-relaxed font-medium text-balance">
                We don't cover everything. We cover what matters. Our topics are rolling out progressively, starting with high-yield Polity.
              </p>
            </div>
            <Link to="/dashboard">
              <Button variant="link" size="lg" className="group text-violet-600 font-black text-lg">
                View All Subjects <ArrowRight className="ml-2 h-6 w-6 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
          
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.length > 0 ? (
              subjects.map((subject: any) => (
                <Link key={subject.slug} to={subject.status === 'live' ? `/subject/${subject.slug}` : '#'}>
                  <Card className={cn(
                    "group h-full p-10 transition-all duration-500 border-slate-100 shadow-xl shadow-slate-200/30 rounded-[2.5rem]",
                    subject.status === 'coming_soon' ? "opacity-60 grayscale cursor-not-allowed bg-slate-50/50" : "hover:shadow-2xl hover:shadow-violet-200/40 hover:-translate-y-2 bg-white hover:border-violet-200"
                  )}>
                    <div className="flex justify-between items-start mb-10">
                      <div className="p-4 rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-violet-600 group-hover:text-white transition-all duration-500 shadow-inner group-hover:shadow-violet-300/50 group-hover:scale-110">
                        <BookOpen className="h-7 w-7" />
                      </div>
                      <Badge variant={subject.status === 'live' ? 'live' : 'coming_soon'} className="px-4 py-1.5 text-[10px]">
                        {subject.status === 'live' ? 'Live' : 'Coming Soon'}
                      </Badge>
                    </div>
                    <h3 className="text-3xl font-black text-violet-950 mb-3 tracking-tight">{subject.title}</h3>
                    <p className="text-slate-500 text-base font-bold mb-10">{subject.description || 'High-yield revision topics.'}</p>
                    
                    {subject.status === 'live' ? (
                      <div className="flex items-center text-base font-black text-violet-600 group-hover:gap-2 transition-all">
                        Start Learning <ChevronRight className="ml-1 h-5 w-5 transition-transform group-hover:translate-x-1" />
                      </div>
                    ) : (
                      <div className="flex items-center text-base font-black text-slate-400">
                        Coming Soon
                      </div>
                    )}
                  </Card>
                </Link>
              ))
            ) : (
              <div className="col-span-full py-20 text-center">
                <p className="text-slate-400 font-bold uppercase tracking-widest">No subjects available yet.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding px-4">
        <div className="mx-auto max-w-6xl rounded-[4rem] bg-violet-950 p-16 md:p-28 text-center relative overflow-hidden shadow-[0_40px_100px_-20px_rgba(46,16,101,0.4)]">
          <div className="absolute top-0 right-0 w-96 h-96 bg-violet-800/40 rounded-full blur-[120px] -mr-48 -mt-48 animate-pulse" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-500/20 rounded-full blur-[120px] -ml-48 -mb-48 animate-pulse" />
          
          <div className="relative z-10">
            <Badge variant="live" className="mb-10 bg-violet-800 border-violet-700 text-violet-200 px-6 py-2 text-xs">Limited Time Offer</Badge>
            <h2 className="text-4xl md:text-7xl font-black text-white mb-10 leading-[1.1] tracking-tight text-balance">
              {settings?.pricingText || "Unlock the full PreCall experience for ₹999."}
            </h2>
            <p className="text-violet-200 text-xl md:text-2xl mb-16 max-w-3xl mx-auto font-medium leading-relaxed text-balance">
              Get one season access (valid till 25th May 2026) to all current and future topics, premium PDFs, and advanced elimination logic.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Link to="/premium" className="w-full sm:w-auto">
                <Button variant="secondary" size="lg" className="w-full sm:px-16 h-20 text-2xl rounded-2xl shadow-2xl shadow-black/20 hover:scale-105 transition-transform">
                  Upgrade to Premium
                </Button>
              </Link>
              <Link to="/dashboard" className="w-full sm:w-auto">
                <Button variant="ghost" size="lg" className="w-full sm:px-16 h-20 text-2xl text-white hover:bg-white/10 rounded-2xl">
                  Try Free Topic
                </Button>
              </Link>
            </div>
            <p className="mt-12 text-violet-400 text-sm font-bold uppercase tracking-[0.2em]">
              One-time payment • One season access (Till 25th May 2026) • No subscriptions
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
