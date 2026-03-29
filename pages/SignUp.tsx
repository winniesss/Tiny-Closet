
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { syncProfilesToCloud, getFamilyId, embedFamilyIdInUrl, linkAppleUserId, restoreProfilesFromCloud } from '../services/profileSync';
import { Logo } from '../components/Logo';
import { Camera, ChevronRight, Sparkles, X, Check, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { signInWithApple, isAppleSignInAvailable } from '../services/appleAuth';

export const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleLinked, setAppleLinked] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [parentConsent, setParentConsent] = useState(false);

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

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

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    try {
      const result = await signInWithApple();
      await linkAppleUserId(result.user);

      // Check if this Apple user already has data in the cloud
      const cloudProfiles = await restoreProfilesFromCloud();
      if (cloudProfiles && cloudProfiles.length > 0) {
        await db.profile.clear();
        for (const p of cloudProfiles) {
          await db.profile.add(p);
        }
        localStorage.setItem('tiny_closet_onboarded', 'true');
        const maxAge = 10 * 365 * 24 * 60 * 60;
        document.cookie = `tiny_closet_onboarded=true; path=/; max-age=${maxAge}; SameSite=Strict`;
        embedFamilyIdInUrl(getFamilyId());
        navigator.storage?.persist?.().catch(() => {});
        navigate('/');
        return;
      }

      // New Apple user — pre-fill name if available, continue to form
      setAppleLinked(true);
      if (result.givenName) {
        setName(result.givenName);
      }
    } catch (err: any) {
      if (err?.message !== 'USER_CANCELED') {
        console.error('Apple Sign In failed:', err);
      }
    } finally {
      setAppleLoading(false);
    }
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
        // Cookie survives iOS storage purges better than localStorage
        const maxAge = 10 * 365 * 24 * 60 * 60;
        document.cookie = `tiny_closet_onboarded=true; path=/; max-age=${maxAge}; SameSite=Strict`;
        // Embed family_id in URL — survives even complete iOS storage wipe
        embedFamilyIdInUrl(getFamilyId());
        // Request persistent storage so iOS doesn't evict our data
        navigator.storage?.persist?.().catch(() => {});

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
    <div className="h-full w-full bg-orange-50 dark:bg-slate-900 overflow-y-auto overflow-x-hidden relative scrollbar-hide">
       {/* Fixed Background decorations */}
       <div className="fixed top-[-10%] right-[-10%] w-64 h-64 bg-pink-200 rounded-full blur-3xl opacity-30 pointer-events-none"></div>
       <div className="fixed bottom-[-10%] left-[-10%] w-64 h-64 bg-sky-200 rounded-full blur-3xl opacity-30 pointer-events-none"></div>

       <div className="min-h-full flex flex-col items-center justify-center p-6 relative z-10 py-12">
           <div className="w-full max-w-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl border border-white/50 dark:border-slate-700/50 animate-in fade-in zoom-in-95 duration-500">
               <div className="text-center mb-8">
                   <div className="transform scale-90 origin-center mb-4 inline-block">
                       <Logo size="lg" />
                   </div>
                   <h1 className="text-title font-bold text-slate-800 dark:text-slate-50 mb-2">Welcome!</h1>
                   <p className="text-slate-500 dark:text-slate-400 text-body leading-relaxed">
                       {appleLinked
                         ? "Great! Now tell us about your child."
                         : "Let's set up your child's digital closet to get started."
                       }
                   </p>
               </div>

               {/* Sign In with Apple — only on native iOS */}
               {appleAvailable && !appleLinked && (
                 <>
                   <button
                     type="button"
                     onClick={handleAppleSignIn}
                     disabled={appleLoading}
                     className="w-full bg-black text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-3 shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-70"
                   >
                     {appleLoading ? (
                       <Sparkles className="animate-spin" size={20} />
                     ) : (
                       <>
                         <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                           <path d="M13.71 5.04c-.08.06-1.55.89-1.55 2.73 0 2.13 1.87 2.89 1.93 2.91-.01.06-.3 1.03-1 2.04-.6.87-1.23 1.74-2.18 1.74s-1.2-.55-2.3-.55c-1.07 0-1.45.57-2.32.57s-1.47-.81-2.18-1.8C3.26 11.43 2.7 9.59 2.7 7.84c0-2.79 1.81-4.27 3.6-4.27.95 0 1.74.62 2.33.62.57 0 1.45-.66 2.53-.66.41 0 1.87.04 2.55 1.51zM11.04 2.35c.44-.52.75-1.24.75-1.96 0-.1-.01-.2-.03-.29-.71.03-1.56.48-2.07 1.06-.4.45-.77 1.17-.77 1.9 0 .11.02.22.03.26.05.01.14.02.22.02.64 0 1.44-.43 1.87-.99z"/>
                         </svg>
                         Sign in with Apple
                       </>
                     )}
                   </button>
                   <div className="flex items-center gap-3 my-2">
                     <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
                     <span className="text-footnote text-slate-400 dark:text-slate-500 font-medium">or</span>
                     <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
                   </div>
                 </>
               )}

               <form onSubmit={handleSignUp} className="space-y-6">
                   <div className="flex flex-col items-center">
                       <div
                            onClick={() => fileInputRef.current?.click()}
                            className="w-24 h-24 rounded-full bg-slate-50 dark:bg-slate-800 border-4 border-white dark:border-slate-700 shadow-md flex items-center justify-center cursor-pointer active:scale-95 transition-transform relative group overflow-hidden"
                       >
                           {avatar ? (
                               <img src={avatar} className="w-full h-full object-cover" alt="Avatar" />
                           ) : (
                               <Camera className="text-slate-300 group-hover:text-sky-400 transition-colors" size={32} />
                           )}
                       </div>
                       <button type="button" onClick={() => fileInputRef.current?.click()} className="text-footnote font-bold text-sky-500 mt-2">
                           {avatar ? 'Change Photo' : 'Add Photo'}
                       </button>
                       <input type="file" ref={fileInputRef} onChange={handleAvatarChange} accept="image/*" className="hidden" />
                   </div>

                   <div className="space-y-4">
                       <div className="group">
                           <label className="block text-footnote font-bold text-slate-400 dark:text-slate-500 mb-1 ml-1 uppercase tracking-wider">Child's Name</label>
                           <input
                               type="text"
                               value={name}
                               onChange={(e) => setName(e.target.value)}
                               className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-800 dark:text-slate-50 font-bold focus:outline-none focus:ring-2 focus:ring-sky-200 transition-all placeholder:text-slate-300"
                               placeholder="e.g. Noah"
                               required
                           />
                       </div>

                       <div className="group">
                           <label className="block text-footnote font-bold text-slate-400 dark:text-slate-500 mb-1 ml-1 uppercase tracking-wider">Birthday</label>
                           <input
                               type="date"
                               value={birthDate}
                               onChange={(e) => setBirthDate(e.target.value)}
                               className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-800 dark:text-slate-50 font-bold focus:outline-none focus:ring-2 focus:ring-sky-200 transition-all text-left appearance-none"
                               required
                           />
                       </div>
                   </div>

                   {/* COPPA Parental Consent — whole row is clickable */}
                   <label
                     htmlFor="parentConsent"
                     className="flex items-start gap-3 bg-sky-50 dark:bg-slate-800 p-4 rounded-2xl border border-sky-100 dark:border-slate-700 cursor-pointer active:scale-[0.98] transition-transform"
                   >
                       <div className="mt-0.5 shrink-0">
                           <input
                               type="checkbox"
                               id="parentConsent"
                               checked={parentConsent}
                               onChange={e => setParentConsent(e.target.checked)}
                               className="w-5 h-5 rounded border-slate-300 text-sky-500 focus:ring-sky-200 accent-sky-500"
                           />
                       </div>
                       <span className="text-footnote text-slate-500 dark:text-slate-400 leading-relaxed">
                           <Shield size={12} className="inline text-sky-400 mr-1" />
                           I am the parent or legal guardian of this child and I consent to the collection of their name, date of birth, and photo as described in our{' '}
                           <Link to="/privacy" className="text-sky-500 underline font-bold">Privacy Policy</Link>.
                       </span>
                   </label>

                   <button
                       type="submit"
                       disabled={loading || !parentConsent}
                       className="w-full bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 font-bold py-5 rounded-full shadow-lg active:shadow-md active:scale-[0.98] active:scale-95 transition-all text-headline flex items-center justify-center gap-3 mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
                   >
                       {loading ? (
                           <Sparkles className="animate-spin" size={20} />
                       ) : (
                           <>Get Started <ChevronRight size={20} /></>
                       )}
                   </button>
               </form>
           </div>
       </div>

       {/* Crop Overlay */}
       {cropSource && (
         <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
           <div className="flex justify-between items-center p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
             <button onClick={() => setCropSource(null)} aria-label="Cancel crop" className="w-11 h-11 text-white/70 hover:text-white flex items-center justify-center">
               <X size={24} />
             </button>
             <span className="text-white font-bold text-body">Move & Pinch to Adjust</span>
             <button onClick={confirmCrop} aria-label="Confirm crop" className="w-11 h-11 text-sky-400 hover:text-sky-300 flex items-center justify-center">
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
               className="bg-sky-600 text-white font-bold py-4 px-12 rounded-full shadow-lg text-headline"
             >
               Use Photo
             </button>
           </div>
         </div>
       )}
    </div>
  );
};
