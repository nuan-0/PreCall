import React from 'react';
import { Shield, Lock, Eye, Database } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="container-narrow py-16">
      <header className="mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest mb-4">
          Privacy
        </div>
        <h1 className="text-5xl font-black text-violet-950 tracking-tight mb-6">Privacy Policy</h1>
        <p className="text-lg text-slate-500 font-medium">Last Updated: April 14, 2026</p>
      </header>

      <div className="prose prose-violet max-w-none space-y-12">
        <section>
          <h2 className="text-2xl font-black text-violet-900 flex items-center gap-3">
            <Eye className="h-6 w-6 text-violet-600" />
            1. Information We Collect
          </h2>
          <p className="text-slate-600 font-medium leading-relaxed">
            We collect information you provide directly to us when you sign in via Google. This includes your name, email address, and profile picture. We also track your progress on the platform, such as completed topics and bookmarks, to provide a personalized revision experience.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-black text-violet-900 flex items-center gap-3">
            <Database className="h-6 w-6 text-violet-600" />
            2. How We Use Your Data
          </h2>
          <p className="text-slate-600 font-medium leading-relaxed">
            Your data is used solely to:
          </p>
          <ul className="list-disc pl-6 text-slate-600 font-medium space-y-2">
            <li>Authenticate your account and secure your access.</li>
            <li>Save and sync your study progress across devices.</li>
            <li>Process premium subscriptions and verify access.</li>
            <li>Send important service updates and notifications.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-black text-violet-900 flex items-center gap-3">
            <Lock className="h-6 w-6 text-violet-600" />
            3. Data Security
          </h2>
          <p className="text-slate-600 font-medium leading-relaxed">
            We use industry-standard security measures provided by Firebase (Google Cloud) to protect your data. We do not sell your personal information to third parties. Your payment information is processed securely by Razorpay and is never stored on our servers.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-black text-violet-900 flex items-center gap-3">
            <Shield className="h-6 w-6 text-violet-600" />
            4. Your Rights
          </h2>
          <p className="text-slate-600 font-medium leading-relaxed">
            You have the right to access, update, or delete your personal information at any time. You can manage your profile settings within the app or contact us directly if you wish to permanently delete your account and associated data.
          </p>
        </section>

        <section className="pt-12 border-t border-slate-100">
          <p className="text-sm text-slate-400 font-medium">
            If you have any questions about this Privacy Policy, please reach out to us at <a href="mailto:precall.admin@gmail.com" className="text-violet-600 font-bold hover:underline">precall.admin@gmail.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
