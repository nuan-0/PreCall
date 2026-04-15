import { useEffect, useRef, useState } from 'react';
import { Download, Share2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { motion } from 'motion/react';

export default function QRCodePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrUrl, setQrUrl] = useState<string>('');
  const url = "https://precall.quantumnuan.com";

  useEffect(() => {
    const generateQR = async () => {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Generate the base QR code
      // We use a high error correction level (H) to allow for the logo in the center
      const qrDataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 1024,
        color: {
          dark: '#0F172A', // slate-900
          light: '#FFFFFF',
        },
      });

      const qrImg = new Image();
      qrImg.src = qrDataUrl;
      qrImg.onload = () => {
        // Clear and draw QR
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(qrImg, 0, 0, canvas.width, canvas.height);

        // 2. Draw the Lilac Logo Backdrop
        const logoSize = canvas.width * 0.28; // Increased size
        const x = (canvas.width - logoSize) / 2;
        const y = (canvas.height - logoSize) / 2;

        // Draw rounded lilac square
        ctx.fillStyle = '#8B5CF6'; // Slightly deeper violet for better contrast
        const radius = logoSize * 0.25;
        
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + logoSize - radius, y);
        ctx.quadraticCurveTo(x + logoSize, y, x + logoSize, y + radius);
        ctx.lineTo(x + logoSize, y + logoSize - radius);
        ctx.quadraticCurveTo(x + logoSize, y + logoSize, x + logoSize - radius, y + logoSize);
        ctx.lineTo(x + radius, y + logoSize);
        ctx.quadraticCurveTo(x, y + logoSize, x, y + logoSize - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();

        // Add a clean white border around the lilac square
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 20;
        ctx.stroke();

        // 3. Draw "PR" Text
        ctx.fillStyle = '#FFFFFF';
        // Use a standard weight like 900 for maximum thickness
        ctx.font = `900 ${logoSize * 0.55}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PR', canvas.width / 2, canvas.height / 2);

        setQrUrl(canvas.toDataURL('image/png'));
      };
    };

    generateQR();
  }, [url]);

  const downloadQR = () => {
    const link = document.createElement('a');
    link.download = 'precall-qr-code.png';
    link.href = qrUrl;
    link.click();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pt-24 pb-12 px-4 relative overflow-hidden">
      {/* Catchy background elements */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-violet-100/50 to-transparent -z-10" />
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-violet-200/20 rounded-full blur-3xl -z-10" />
      
      <div className="max-w-md mx-auto relative">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-slate-400 hover:text-violet-600 transition-all mb-8 font-bold group"
        >
          <div className="p-1.5 rounded-lg bg-white shadow-sm border border-slate-100 group-hover:border-violet-200 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </div>
          Back to Home
        </Link>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-[3rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 text-center relative"
        >
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-violet-600 text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow-lg shadow-violet-200">
            Official QR
          </div>

          <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-3 mt-4">
            Share the App
          </h1>
          <p className="text-slate-400 font-medium mb-10 text-sm">
            Scan to visit <span className="text-violet-600 font-bold">precall.quantumnuan.com</span>
          </p>

          <div className="relative aspect-square w-full max-w-[300px] mx-auto mb-10 p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 shadow-inner group">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent rounded-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity" />
            <canvas 
              ref={canvasRef} 
              width={1024} 
              height={1024} 
              className="w-full h-full rounded-2xl relative z-10"
              style={{ display: qrUrl ? 'block' : 'none' }}
            />
            {!qrUrl && (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <div className="animate-pulse font-black text-xs uppercase tracking-widest">Generating...</div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={downloadQR}
              className="flex items-center justify-center gap-3 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200"
            >
              <Download className="h-5 w-5" />
              Download Image
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: 'PreCall UPSC Revision',
                    url: url
                  });
                }
              }}
              className="flex items-center justify-center gap-3 py-4 bg-violet-50 text-violet-700 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-violet-100 transition-all active:scale-95"
            >
              <Share2 className="h-5 w-5" />
              Share Link
            </button>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 p-8 bg-gradient-to-br from-violet-600 to-indigo-700 rounded-[2.5rem] text-white shadow-2xl shadow-violet-200 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16" />
          <h3 className="font-black text-xl mb-3 flex items-center gap-2">
            Marketing Tip 💡
          </h3>
          <p className="text-violet-100 text-sm leading-relaxed font-medium">
            Print this QR code on your study materials or share it in UPSC telegram groups. 
            The branded logo builds trust and makes your app look professional!
          </p>
        </motion.div>
      </div>
    </div>
  );
}
