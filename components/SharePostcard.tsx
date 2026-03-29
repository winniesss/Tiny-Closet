import React, { useRef, useCallback, useState } from 'react';
import { X, Share2, Download, CheckCircle2 } from 'lucide-react';
import { ClothingItem, WeatherData } from '../types';

interface SharePostcardProps {
  outfitItems: ClothingItem[];
  childName: string;
  weather: WeatherData;
  onClose: () => void;
}

const weatherEmoji: Record<string, string> = {
  Sunny: '\u2600\uFE0F',
  Cloudy: '\u2601\uFE0F',
  Rainy: '\uD83C\uDF27\uFE0F',
  Snowy: '\u2744\uFE0F',
  Windy: '\uD83C\uDF2C\uFE0F',
};

export const SharePostcard: React.FC<SharePostcardProps> = ({
  outfitItems,
  childName,
  weather,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shared, setShared] = useState(false);

  const generatePostcard = useCallback(async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const W = 1080;
    const H = 1350;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#fff7ed');
    grad.addColorStop(1, '#fef3c7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Decorative top bar
    ctx.fillStyle = '#fb923c';
    ctx.fillRect(0, 0, W, 8);

    // Date
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 32px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(dateStr.toUpperCase(), W / 2, 80);

    // Greeting
    ctx.fillStyle = '#1e293b';
    ctx.font = '700 56px "DM Serif Display", serif';
    ctx.fillText(`${childName}'s Outfit`, W / 2, 150);

    // Weather line
    const emoji = weatherEmoji[weather.condition] || '';
    ctx.font = '600 36px Nunito, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`${emoji} ${Math.round(weather.temp)}° & ${weather.description}`, W / 2, 210);

    // Draw outfit items in a collage
    const maxItems = Math.min(outfitItems.length, 4);
    const imgSize = maxItems <= 2 ? 380 : 320;
    const gap = 30;
    const totalWidth = maxItems <= 2 ? maxItems * imgSize + (maxItems - 1) * gap : 2 * imgSize + gap;
    const startX = (W - totalWidth) / 2;
    const startY = 280;

    const loadImage = (src: string): Promise<HTMLImageElement> =>
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(img);
        img.src = src;
      });

    for (let i = 0; i < maxItems; i++) {
      const item = outfitItems[i];
      const col = maxItems <= 2 ? i : i % 2;
      const row = maxItems <= 2 ? 0 : Math.floor(i / 2);
      const x = startX + col * (imgSize + gap);
      const y = startY + row * (imgSize + gap);

      // Card shadow
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      roundRect(ctx, x + 4, y + 4, imgSize, imgSize, 32);
      ctx.fill();

      // Card background
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, x, y, imgSize, imgSize, 32);
      ctx.fill();

      // Item image
      try {
        const img = await loadImage(item.image);
        ctx.save();
        roundRect(ctx, x + 12, y + 12, imgSize - 24, imgSize - 24, 24);
        ctx.clip();
        ctx.drawImage(img, x + 12, y + 12, imgSize - 24, imgSize - 24);
        ctx.restore();
      } catch { /* skip */ }
    }

    // Brand/description labels below collage
    const labelY = startY + (maxItems <= 2 ? imgSize + 50 : 2 * imgSize + gap + 50);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.font = '600 28px Nunito, sans-serif';
    const labels = outfitItems.slice(0, maxItems).map(i => i.brand || i.description || i.category).join('  \u00B7  ');
    ctx.fillText(labels, W / 2, labelY);

    // Footer branding
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '500 26px Nunito, sans-serif';
    ctx.fillText('Tiny Closet', W / 2, H - 50);

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }, [outfitItems, childName, weather]);

  const handleShare = async () => {
    const blob = await generatePostcard();
    if (!blob) return;

    const file = new File([blob], 'outfit-of-the-day.png', { type: 'image/png' });

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${childName}'s Outfit of the Day` });
        setShared(true);
        setTimeout(onClose, 1200);
      } catch { /* user cancelled share */ }
    } else {
      // Fallback: download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'outfit-of-the-day.png';
      a.click();
      URL.revokeObjectURL(url);
      setShared(true);
      setTimeout(onClose, 1200);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
          <button onClick={onClose} className="p-2 rounded-full" aria-label="Close">
            <X size={20} className="text-slate-400" />
          </button>
          <h3 className="text-headline font-bold">Share Outfit</h3>
          <div className="w-9" />
        </div>

        <div className="p-4">
          <canvas ref={canvasRef} className="w-full aspect-[4/5] rounded-2xl bg-orange-50 dark:bg-slate-900" />
        </div>

        <div className="px-4 pb-6">
          {shared ? (
            <div className="flex items-center justify-center gap-2 py-4 text-green-600 font-bold text-body">
              <CheckCircle2 size={20} />
              Shared!
            </div>
          ) : (
            <button
              onClick={handleShare}
              className="w-full py-4 bg-sky-600 text-white font-bold text-body rounded-full shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            >
              <Share2 size={18} />
              Share Postcard
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
