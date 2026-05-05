import React from 'react';
import { BookOpen, Target, Zap, ShieldCheck, Star, Users } from 'lucide-react';
import { Card } from '../components/UI';

export default function AboutPage() {
  return (
    <div className="container-narrow py-16">
      <header className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-violet-50 text-violet-700 text-[10px] font-black uppercase tracking-widest mb-4">
          Our Mission
        </div>
        <h1 className="text-5xl font-black text-violet-950 tracking-tight mb-6">Built for the Cutoff.</h1>
        <p className="text-xl text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed">
          PreCall isn't just another study app. It's a precision tool designed for the final 60 days of UPSC Prelims preparation.
        </p>
      </header>

      <div className="space-y-12">
        <section className="prose prose-violet max-w-none">
          <h2 className="text-3xl font-black text-violet-900">The Problem</h2>
          <p className="text-lg text-slate-600 font-medium leading-relaxed">
            Most aspirants drown in bulky textbooks and 100-page monthly magazines. By the time the exam arrives, they have "read" everything but "recall" very little. UPSC Prelims is no longer a test of knowledge; it's a test of <strong>precision</strong> and <strong>elimination</strong>.
          </p>
        </section>

        <div className="grid gap-8 sm:grid-cols-2">
          <Card className="p-8 border-slate-100 shadow-xl shadow-slate-200/20">
            <div className="mb-6 inline-flex p-3 rounded-xl bg-violet-50 text-violet-600 border border-violet-100">
              <Target className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-black text-violet-950 mb-3">High-Yield Only</h3>
            <p className="text-slate-500 font-medium text-sm leading-relaxed">
              We filter out the fluff. Every card you read is mapped to a high-probability UPSC theme or a recurring PYQ pattern.
            </p>
          </Card>
          
          <Card className="p-8 border-slate-100 shadow-xl shadow-slate-200/20">
            <div className="mb-6 inline-flex p-3 rounded-xl bg-orange-50 text-orange-600 border border-orange-100">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-black text-violet-950 mb-3">Trap Zones</h3>
            <p className="text-slate-500 font-medium text-sm leading-relaxed">
              UPSC loves "only", "all", and "shall". We highlight these traps in every topic so you don't fall for them in the exam hall.
            </p>
          </Card>
        </div>

        <section className="bg-violet-950 rounded-[2.5rem] p-10 md:p-16 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-800/40 rounded-full blur-[80px] -mr-32 -mt-32" />
          <div className="relative z-10">
            <h2 className="text-3xl font-black mb-6">Our Philosophy</h2>
            <p className="text-violet-200 text-lg font-medium leading-relaxed mb-8">
              We believe that 50% of the Prelims paper is solved by knowledge, and the other 50% is solved by <strong>Logic, Elimination, and Nerve</strong>. PreCall is designed to build all three.
            </p>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-orange-400" />
                <span className="text-xs font-black uppercase tracking-widest">Rapid Recall</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-400" />
                <span className="text-xs font-black uppercase tracking-widest">PYQ Focused</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-400" />
                <span className="text-xs font-black uppercase tracking-widest">Aspirant Centric</span>
              </div>
            </div>
          </div>
        </section>

        <section className="p-10 md:p-12 rounded-[2.5rem] border-4 border-violet-100 bg-violet-50/50">
          <h2 className="text-2xl font-black text-violet-950 mb-6">A Visionary Note</h2>
          <p className="text-slate-600 font-medium leading-relaxed mb-6">
            PreCall is the realization of a shared dream to make UPSC preparation more accessible, precise, and less overwhelming. 
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-6 p-6 rounded-2xl bg-white border border-violet-100">
            <div className="h-16 w-16 rounded-full bg-violet-600 flex items-center justify-center text-white ring-4 ring-violet-100 shrink-0">
              <Star className="h-8 w-8" />
            </div>
            <div>
              <p className="text-slate-600 italic font-medium mb-2">
                "UPSC Prelims is no longer a test of how much you can read, but of how much you can accurately recall under pressure."
              </p>
              <p className="text-sm font-black text-violet-900">— Special thanks to <strong>@important4UPSC</strong> for the vision and mentorship that made this platform possible.</p>
            </div>
          </div>
        </section>

        <section className="text-center py-12">
          <h2 className="text-2xl font-black text-violet-950 mb-4">Join the Community</h2>
          <p className="text-slate-500 font-medium mb-8">
            Thousands of aspirants are already using PreCall to sharpen their revision. It's time to move from "reading" to "mastering".
          </p>
        </section>
      </div>
    </div>
  );
}
