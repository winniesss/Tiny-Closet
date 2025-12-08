
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { Logo } from '../components/Logo';
import { Camera, ChevronRight, Sparkles } from 'lucide-react';

export const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
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
        
        setTimeout(() => {
            navigate('/');
        }, 800);
    } catch (error) {
        console.error("Signup error", error);
        setLoading(false);
    }
  };

  return (
    <div className="h-full w-full bg-orange-50 overflow-y-auto overflow-x-hidden relative">
       {/* Fixed Background decorations */}
       <div className="fixed top-[-10%] right-[-10%] w-64 h-64 bg-pink-200 rounded-full blur-3xl opacity-30 pointer-events-none"></div>
       <div className="fixed bottom-[-10%] left-[-10%] w-64 h-64 bg-sky-200 rounded-full blur-3xl opacity-30 pointer-events-none"></div>

       <div className="min-h-full flex flex-col items-center justify-center p-6 relative z-10 py-12">
           <div className="w-full max-w-sm bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl border border-white/50 animate-in fade-in zoom-in-95 duration-500">
               <div className="text-center mb-8">
                   <div className="transform scale-90 origin-center mb-4 inline-block">
                       <Logo size="lg" />
                   </div>
                   <h1 className="text-2xl font-serif text-slate-800 mb-2">Welcome!</h1>
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
                               className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-sky-200 transition-all text-left"
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
    </div>
  );
};
