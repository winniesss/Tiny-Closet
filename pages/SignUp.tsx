
import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { syncProfilesToCloud } from '../services/profileSync';
import { Logo } from '../components/Logo';
import { Camera, ChevronRight, Sparkles, X, Check } from 'lucide-react';

export const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Crop state
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropPos, setCropPos] = useState({ x: 0, y: 0, scale: 1 });
  const cropImgRef = useRef<HTMLImageElement>(null);
  const gestureRef = useRef<{
    type: 'pan' | 'pinch';
    startPos: { x: number; y: number; scale: number };
    startTouch: { x: number; y: number };
    startDist?: number;
  } | null>(null);

  const CROP_SIZE = Math.min(window.innerWidth - 64, 280);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const src = reader.result as string;
        const img = new Image();
        img.onload = () => {
          // Fit image so its shorter side fills the crop circle
          const scale = CROP_SIZE / Math.min(img.naturalWidth, img.naturalHeight);
          setCropPos({ x: 0, y: 0, scale });
          setCropSource(src);
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = '';
  };

  const handleCropTouchStart = useCallback((e: React.TouchEvent) => {
    const touches = Array.from(e.touches);
    if (touches.length === 2) {
      const dist = Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
      gestureRef.current = { type: 'pinch', startPos: { ...cropPos }, startTouch: { x: 0, y: 0 }, startDist: dist };
    } else if (touches.length === 1) {
      gestureRef.current = { type: 'pan', startPos: { ...cropPos }, startTouch: { x: touches[0].clientX, y: touches[0].clientY } };
    }
  }, [cropPos]);

  const handleCropTouchMove = useCallback((e: React.TouchEvent) => {
    if (!gestureRef.current) return;
    if (e.cancelable) e.preventDefault();
    const g = gestureRef.current;
    const touches = Array.from(e.touches);

    if (g.type === 'pinch' && touches.length === 2) {
      const dist = Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
      const newScale = Math.min(5, Math.max(0.2, g.startPos.scale * (dist / g.startDist!)));
      setCropPos(prev => ({ ...prev, scale: newScale }));
    } else if (g.type === 'pan' && touches.length === 1) {
      setCropPos({
        ...g.startPos,
        x: g.startPos.x + (touches[0].clientX - g.startTouch.x),
        y: g.startPos.y + (touches[0].clientY - g.startTouch.y),
      });
    }
  }, []);

  const handleCropTouchEnd = useCallback(() => { gestureRef.current = null; }, []);

  const confirmCrop = () => {
    if (!cropImgRef.current) return;
    const img = cropImgRef.current;
    const canvas = document.createElement('canvas');
    const outputSize = 512;
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, outputSize, outputSize);

    const drawScale = outputSize / CROP_SIZE;
    ctx.save();
    ctx.scale(drawScale, drawScale);
    ctx.translate(CROP_SIZE / 2, CROP_SIZE / 2);
    ctx.translate(cropPos.x, cropPos.y);
    ctx.scale(cropPos.scale, cropPos.scale);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();

    setAvatar(canvas.toDataURL('image/jpeg', 0.9));
    setCropSource(null);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !birthDate) return;

    setLoading(true);
    
    try {
        const profiles = await db.profile.toArray();
        if (profiles.length > 0) {
            await db.profile.update(profiles[0].id!, {
                name,
                birthDate,
                avatar: avatar || undefined
            });
        } else {
            await db.profile.add({
                name,
                birthDate,
                avatar: avatar || undefined
            });
        }
        
        localStorage.setItem('tiny_closet_onboarded', 'true');

        // Sync to cloud so profile survives iOS storage purges
        const allProfiles = await db.profile.toArray();
        syncProfilesToCloud(allProfiles);

        setTimeout(() => {
            navigate('/');
        }, 800);
    } catch (error) {
        console.error("Signup error", error);
        setLoading(false);
    }
  };

  return (
    <div className="h-full w-full bg-orange-50 overflow-y-auto overflow-x-hidden relative scrollbar-hide">
       {/* Fixed Background decorations */}
       <div className="fixed top-[-10%] right-[-10%] w-64 h-64 bg-pink-200 rounded-full blur-3xl opacity-30 pointer-events-none"></div>
       <div className="fixed bottom-[-10%] left-[-10%] w-64 h-64 bg-sky-200 rounded-full blur-3xl opacity-30 pointer-events-none"></div>

       <div className="min-h-full flex flex-col items-center justify-center p-6 relative z-10 py-12">
           <div className="w-full max-w-sm bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl border border-white/50 animate-in fade-in zoom-in-95 duration-500">
               <div className="text-center mb-8">
                   <div className="transform scale-90 origin-center mb-4 inline-block">
                       <Logo size="lg" />
                   </div>
                   <h1 className="text-2xl font-bold text-slate-800 mb-2">Welcome!</h1>
                   <p className="text-slate-500 text-sm leading-relaxed">
                       Let's set up your child's digital closet to get started.
                   </p>
               </div>

               <form onSubmit={handleSignUp} className="space-y-6">
                   <div className="flex flex-col items-center">
                       <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-24 h-24 rounded-full bg-slate-50 border-4 border-white shadow-md flex items-center justify-center cursor-pointer hover:scale-105 transition-transform relative group overflow-hidden"
                       >
                           {avatar ? (
                               <img src={avatar} className="w-full h-full object-cover" alt="Avatar" />
                           ) : (
                               <Camera className="text-slate-300 group-hover:text-sky-400 transition-colors" size={32} />
                           )}
                       </div>
                       <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-sky-500 mt-2">
                           {avatar ? 'Change Photo' : 'Add Photo'}
                       </button>
                       <input type="file" ref={fileInputRef} onChange={handleAvatarChange} accept="image/*" className="hidden" />
                   </div>

                   <div className="space-y-4">
                       <div className="group">
                           <label className="block text-xs font-bold text-slate-400 mb-1 ml-1 uppercase tracking-wider">Child's Name</label>
                           <input 
                               type="text" 
                               value={name}
                               onChange={(e) => setName(e.target.value)}
                               className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-sky-200 transition-all placeholder:text-slate-300"
                               placeholder="e.g. Noah"
                               required
                           />
                       </div>
                       
                       <div className="group">
                           <label className="block text-xs font-bold text-slate-400 mb-1 ml-1 uppercase tracking-wider">Birthday</label>
                           <input 
                               type="date" 
                               value={birthDate}
                               onChange={(e) => setBirthDate(e.target.value)}
                               className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-sky-200 transition-all text-left appearance-none"
                               required
                           />
                       </div>
                   </div>

                   <button 
                       type="submit"
                       disabled={loading}
                       className="w-full bg-slate-900 text-white font-bold py-5 rounded-full shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all text-lg flex items-center justify-center gap-3 mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
                   >
                       {loading ? (
                           <Sparkles className="animate-spin" size={20} />
                       ) : (
                           <>Create Account <ChevronRight size={20} /></>
                       )}
                   </button>
               </form>
           </div>
       </div>

       {/* Crop Overlay */}
       {cropSource && (
         <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
           <div className="flex justify-between items-center p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
             <button onClick={() => setCropSource(null)} className="p-2 text-white/70 hover:text-white">
               <X size={24} />
             </button>
             <span className="text-white font-bold text-sm">Move & Pinch to Adjust</span>
             <button onClick={confirmCrop} className="p-2 text-sky-400 hover:text-sky-300">
               <Check size={24} />
             </button>
           </div>

           <div
             className="flex-1 flex items-center justify-center relative overflow-hidden touch-none"
             onTouchStart={handleCropTouchStart}
             onTouchMove={handleCropTouchMove}
             onTouchEnd={handleCropTouchEnd}
           >
             {/* Image layer */}
             <img
               ref={cropImgRef}
               src={cropSource}
               alt="Crop source"
               className="absolute pointer-events-none"
               draggable={false}
               style={{
                 transform: `translate(${cropPos.x}px, ${cropPos.y}px) scale(${cropPos.scale})`,
                 transformOrigin: 'center center',
               }}
             />

             {/* Dark overlay with circular cutout */}
             <div className="absolute inset-0 pointer-events-none" style={{
               background: `radial-gradient(circle ${CROP_SIZE / 2}px at 50% 50%, transparent ${CROP_SIZE / 2 - 1}px, rgba(15,23,42,0.75) ${CROP_SIZE / 2}px)`
             }} />

             {/* Circle border */}
             <div
               className="absolute rounded-full border-2 border-white/40 pointer-events-none"
               style={{ width: CROP_SIZE, height: CROP_SIZE }}
             />
           </div>

           <div className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] flex justify-center">
             <button
               onClick={confirmCrop}
               className="bg-sky-400 text-white font-bold py-4 px-12 rounded-full shadow-lg text-lg"
             >
               Use Photo
             </button>
           </div>
         </div>
       )}
    </div>
  );
};
