import React from 'react';
import { Shield, Lock, FileText, AlertCircle } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="container-narrow py-16">
      <header className="mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-widest mb-4">
          Legal
        </div>
        <h1 className="text-5xl font-black text-violet-950 tracking-tight mb-6">Terms of Service</h1>
        <p className="text-lg text-slate-500 font-medium">Last Updated: April 12, 2026</p>
      </header>

      <div className="prose prose-violet max-w-none space-y-12">
        <section>
          <h2 className="text-2xl font-black text-violet-900 flex items-center gap-3">
            <Shield className="h-6 w-6 text-violet-600" />
            1. Acceptance of Terms
          </h2>
          <p className="text-slate-600 font-medium leading-relaxed">
            By accessing and using PreCall, you agree to be bound by these Terms of Service. If you do not agree, please do not use the service. PreCall provides educational content specifically curated for UPSC Prelims preparation.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-black text-violet-900 flex items-center gap-3">
            <Lock className="h-6 w-6 text-violet-600" />
            2. Premium Access & Payments
          </h2>
          <p className="text-slate-600 font-medium leading-relaxed">
            Premium access is granted upon successful payment of the specified fee. This access is valid for the current "season" (typically until the date of the next UPSC Prelims exam).
          </p>
          <div className="mt-6 p-6 rounded-2xl bg-violet-50 border border-violet-100 flex gap-4">
            <AlertCircle className="h-6 w-6 text-violet-600 shrink-0" />
            <p className="text-violet-900 font-bold leading-relaxed">
              Refund Policy: <u>No refunds unless two verifiable payments</u> have been made for the same account due to a technical error.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-black text-violet-900 flex items-center gap-3">
            <FileText className="h-6 w-6 text-violet-600" />
            3. Intellectual Property
          </h2>
          <p className="text-slate-600 font-medium leading-relaxed">
            All content, including high-yield cards, trap zone logic, and elimination strategies, is the intellectual property of PreCall. Unauthorized reproduction, distribution, or resale of this content is strictly prohibited and may lead to legal action.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-black text-violet-900 flex items-center gap-3">
            <Shield className="h-6 w-6 text-violet-600" />
            4. Disclaimer
          </h2>
          <p className="text-slate-600 font-medium leading-relaxed">
            While we strive for 100% accuracy, UPSC preparation is dynamic. PreCall is a revision tool and should be used in conjunction with standard textbooks and official sources. We do not guarantee success in the examination.
          </p>
        </section>

        <section className="pt-12 border-t border-slate-100">
          <p className="text-sm text-slate-400 font-medium">
            For any legal inquiries, please contact us at <a href="mailto:precall.admin@gmail.com" className="text-violet-600 font-bold hover:underline">precall.admin@gmail.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
