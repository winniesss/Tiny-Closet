import React, { useEffect, useState, useRef } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChildProfile } from '../types';
import { Camera, User } from 'lucide-react';

export const Settings: React.FC = () => {
  const profiles = useLiveQuery(() => db.profile.toArray());
  const [editing, setEditing] = useState<Partial<ChildProfile>>({});
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profiles && profiles.length > 0) {
      setEditing(profiles[0]);
    }
  }, [profiles]);

  const handleSave = async () => {
    if (editing.id && editing.name && editing.birthDate) {
      await db.profile.update(editing.id, {
        name: editing.name,
        birthDate: editing.birthDate,
        avatar: editing.avatar
      });
      setMessage('Settings Saved!');
      setTimeout(() => setMessage(''), 3000);
    } else {
        setMessage('Please fill in all fields');
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditing({ ...editing, avatar: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteAll = async () => {
      if(window.confirm("Are you sure? This will delete all clothes and data.")) {
          await db.items.clear();
          alert("Closet reset complete.");
      }
  };

  return (
    <div className="p-6 max-w-md mx-auto min-h-screen bg-orange-50 pb-28">
      <h1 className="text-3xl text-slate-800 mb-8">Settings</h1>

      <div className="mb-10 bg-white p-6 rounded-[2.5rem] shadow-sm">
        <h2 className="text-lg text-slate-800 mb-6 font-serif">Child Profile</h2>
        
        <div className="space-y-6">
          <div className="flex flex-col items-center mb-6">
            <div 
              className="relative w-24 h-24 rounded-full bg-slate-100 border-4 border-white shadow-md overflow-hidden cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              {editing.avatar ? (
                <img src={editing.avatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <User size={40} />
                </div>
              )}
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="text-white" size={24} />
              </div>
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 text-xs font-bold text-sky-500 hover:text-sky-600"
            >
              Change Photo
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleAvatarChange} 
            />
          </div>

          <div className="group">
            <label className="block text-xs font-bold text-slate-400 mb-2 ml-1">Name</label>
            <input 
              type="text" 
              className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-slate-800 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-sky-200 transition-all"
              value={editing.name || ''}
              onChange={e => setEditing({...editing, name: e.target.value})}
            />
          </div>
          <div className="group">
            <label className="block text-xs font-bold text-slate-400 mb-2 ml-1">Date of Birth</label>
            <input 
              type="date" 
              className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-slate-800 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-sky-200 transition-all"
              value={editing.birthDate || ''}
              onChange={e => setEditing({...editing, birthDate: e.target.value})}
            />
          </div>
          
          <button 
            onClick={handleSave}
            className="w-full bg-sky-400 text-white font-bold py-5 rounded-full shadow-lg hover:scale-[1.02] transition-transform text-lg mt-4"
          >
            {message || 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="pt-6 px-2">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">Danger Zone</h2>
        <button 
            onClick={handleDeleteAll}
            className="w-full text-red-500 text-sm font-bold bg-white border border-red-100 hover:bg-red-50 py-4 rounded-2xl transition-colors"
        >
            Reset Everything
        </button>
      </div>
    </div>
  );
};