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
        const logoSize = canvas.width * 0.22;
        const x = (canvas.width - logoSize) / 2;
        const y = (canvas.height - logoSize) / 2;

        // Draw rounded lilac square
        ctx.fillStyle = '#A78BFA'; // Lilac (violet-400)
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

        // Add a small white border around the lilac square to make it pop
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 15;
        ctx.stroke();

        // 3. Draw "PR" Text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `black ${logoSize * 0.5}px Inter, system-ui, sans-serif`;
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
    <div className="min-h-screen bg-slate-50 pt-24 pb-12 px-4">
      <div className="max-w-md mx-auto">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-8 font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/60 border border-slate-100 text-center"
        >
          <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-2">
            Your QR Code
          </h1>
          <p className="text-slate-500 font-medium mb-8">
            Scan to visit precall.quantumnuan.com
          </p>

          <div className="relative aspect-square w-full max-w-[280px] mx-auto mb-8 p-4 bg-slate-50 rounded-3xl border border-slate-100">
            <canvas 
              ref={canvasRef} 
              width={1024} 
              height={1024} 
              className="w-full h-full rounded-xl"
              style={{ display: qrUrl ? 'block' : 'none' }}
            />
            {!qrUrl && (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                Generating...
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={downloadQR}
              className="flex items-center justify-center gap-2 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-95"
            >
              <Download className="h-5 w-5" />
              Download
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
              className="flex items-center justify-center gap-2 py-4 bg-violet-100 text-violet-700 rounded-2xl font-bold hover:bg-violet-200 transition-all active:scale-95"
            >
              <Share2 className="h-5 w-5" />
              Share
            </button>
          </div>
        </motion.div>

        <div className="mt-8 p-6 bg-violet-600 rounded-[2rem] text-white shadow-lg shadow-violet-200">
          <h3 className="font-bold text-lg mb-2">Marketing Tip 💡</h3>
          <p className="text-violet-100 text-sm leading-relaxed">
            Print this QR code on your study materials or share it in UPSC telegram groups. 
            It includes your brand logo for better recognition!
          </p>
        </div>
      </div>
    </div>
  );
}
