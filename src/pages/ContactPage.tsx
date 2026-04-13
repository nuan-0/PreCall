import React from 'react';
import { Mail, MessageSquare, Clock, MapPin } from 'lucide-react';
import { Card, Button } from '../components/UI';

export default function ContactPage() {
  return (
    <div className="container-narrow py-16">
      <header className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest mb-4">
          Get in Touch
        </div>
        <h1 className="text-5xl font-black text-violet-950 tracking-tight mb-6">We're here to help.</h1>
        <p className="text-xl text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed">
          Have questions about your subscription, content, or technical issues? Reach out to us.
        </p>
      </header>

      <div className="grid gap-8 md:grid-cols-2">
        <Card className="p-10 border-slate-100 shadow-xl shadow-slate-200/20">
          <div className="mb-8 inline-flex p-4 rounded-2xl bg-violet-50 text-violet-600 border border-violet-100">
            <Mail className="h-7 w-7" />
          </div>
          <h3 className="text-2xl font-black text-violet-950 mb-4">Email Support</h3>
          <p className="text-slate-500 font-medium mb-8 leading-relaxed">
            For all inquiries, including premium access issues and content feedback.
          </p>
          <a href="mailto:precall.admin@gmail.com" className="block">
            <Button className="w-full h-14 text-base shadow-lg shadow-violet-200">
              precall.admin@gmail.com
            </Button>
          </a>
        </Card>

        <Card className="p-10 border-slate-100 shadow-xl shadow-slate-200/20">
          <div className="mb-8 inline-flex p-4 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
            <Clock className="h-7 w-7" />
          </div>
          <h3 className="text-2xl font-black text-violet-950 mb-4">Response Time</h3>
          <p className="text-slate-500 font-medium mb-8 leading-relaxed">
            We typically respond within 24-48 hours. Our team is working hard to support your preparation.
          </p>
          <div className="flex items-center gap-3 text-sm font-bold text-slate-400 uppercase tracking-widest">
            <MessageSquare className="h-4 w-4" />
            <span>Active Support</span>
          </div>
        </Card>
      </div>

      <div className="mt-16 p-10 rounded-[2.5rem] bg-slate-50 border border-slate-100 text-center">
        <p className="text-slate-500 font-medium">
          PreCall is a digital-first platform built for aspirants across India. 
          <br />
          Follow us for updates on new high-yield topics.
        </p>
      </div>
    </div>
  );
}
