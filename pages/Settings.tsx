import React, { useEffect, useState, useRef } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChildProfile } from '../types';
import { Camera, User, Download, UploadCloud, CheckCircle2, AlertCircle, HelpCircle, Power, Settings as SettingsIcon, Info } from 'lucide-react';
import clsx from 'clsx';

export const Settings: React.FC = () => {
  const profiles = useLiveQuery(() => db.profile.toArray());
  const [editing, setEditing] = useState<Partial<ChildProfile>>({});
  const [message, setMessage] = useState('');
  const [importError, setImportError] = useState('');
  const [activeTab, setActiveTab] = useState<'config' | 'faq'>('config');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

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

  const handleExportBackup = async () => {
    try {
      const profileData = await db.profile.toArray();
      const itemsData = await db.items.toArray();
      
      const backup = {
        version: 1,
        timestamp: Date.now(),
        profile: profileData,
        items: itemsData
      };

      const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tiny-closet-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setMessage("Backup downloaded successfully!");
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error("Export failed", error);
      setMessage("Export failed. See console.");
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = event.target?.result as string;
        const data = JSON.parse(json);

        if (!data.profile || !data.items) {
          throw new Error("Invalid backup file format");
        }

        if (window.confirm(`Found ${data.items.length} items. This will REPLACE your current data. Continue?`)) {
            // Fix: Cast db to any to avoid TS error: Property 'transaction' does not exist on type 'ClosetDatabase'
            await (db as any).transaction('rw', db.items, db.profile, async () => {
                await db.items.clear();
                await db.profile.clear();
                
                await db.profile.bulkAdd(data.profile);
                await db.items.bulkAdd(data.items);
            });
            
            setMessage("Data restored successfully! Reloading...");
            setTimeout(() => {
                window.location.href = window.location.origin + window.location.pathname;
            }, 1500);
        }
      } catch (err) {
        console.error(err);
        setImportError("Failed to import file. It might be corrupted.");
        setTimeout(() => setImportError(''), 4000);
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = ''; 
  };

  const handleReload = () => {
      const url = new URL(window.location.href);
      if (url.pathname !== '/' && !url.pathname.endsWith('/index.html')) {
          url.pathname = '/';
      }
      url.hash = '';
      url.search = '';
      window.location.href = url.toString();
  };

  return (
    <div className="p-6 max-w-md mx-auto min-h-screen bg-orange-50 pb-28">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl text-slate-800">Settings</h1>
        
        <div className="flex bg-white rounded-full p-1 shadow-sm border border-slate-100">
            <button 
                onClick={() => setActiveTab('config')}
                className={clsx(
                    "px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2",
                    activeTab === 'config' 
                        ? "bg-sky-400 text-white shadow-sm" 
                        : "text-slate-400 hover:text-slate-600"
                )}
            >
                <SettingsIcon size={14} /> Config
            </button>
            <button 
                onClick={() => setActiveTab('faq')}
                className={clsx(
                    "px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2",
                    activeTab === 'faq' 
                        ? "bg-orange-400 text-white shadow-sm" 
                        : "text-slate-400 hover:text-slate-600"
                )}
            >
                <Info size={14} /> FAQ
            </button>
        </div>
      </div>

      {activeTab === 'config' ? (
        <div className="animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="mb-6 bg-white p-6 rounded-[2.5rem] shadow-sm">
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
                    className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-slate-800 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-sky-200 transition-all placeholder:text-slate-300"
                    value={editing.name || ''}
                    onChange={e => setEditing({...editing, name: e.target.value})}
                    placeholder="Child's Name"
                    />
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-400 mb-2 ml-1">Date of Birth</label>
                    <input 
                    type="date" 
                    className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-slate-800 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-sky-200 transition-all appearance-none text-left min-h-[60px]"
                    value={editing.birthDate || ''}
                    onChange={e => setEditing({...editing, birthDate: e.target.value})}
                    />
                </div>
                
                <button 
                    onClick={handleSave}
                    className="w-full bg-sky-400 text-white font-bold py-5 rounded-full shadow-lg hover:scale-[1.02] transition-transform text-lg mt-4 flex justify-center items-center gap-2"
                >
                    {message === 'Settings Saved!' ? <CheckCircle2 size={20} /> : null}
                    {message || 'Save Changes'}
                </button>
                </div>
            </div>

            <div className="mb-8 bg-white p-6 rounded-[2.5rem] shadow-sm">
                <h2 className="text-lg text-slate-800 mb-4 font-serif">Data Sync</h2>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Your data is stored locally on this device. To move your closet to another phone, Export here and Import on the new device.
                </p>

                <div className="space-y-3">
                <button 
                    onClick={handleExportBackup}
                    className="w-full bg-sky-50 text-sky-600 border border-sky-100 font-bold py-4 rounded-2xl hover:bg-sky-100 transition-colors flex items-center justify-center gap-3"
                >
                    <Download size={20} /> Export Backup
                </button>

                <button 
                    onClick={() => importInputRef.current?.click()}
                    className="w-full bg-orange-50 text-orange-600 border border-orange-100 font-bold py-4 rounded-2xl hover:bg-orange-100 transition-colors flex items-center justify-center gap-3"
                >
                    <UploadCloud size={20} /> Import Backup
                </button>
                <input 
                    type="file" 
                    ref={importInputRef}
                    onChange={handleImportBackup}
                    accept=".json"
                    className="hidden"
                />
                </div>
                {importError && (
                    <div className="mt-4 flex items-center gap-2 text-red-500 text-xs font-bold bg-red-50 p-3 rounded-xl">
                        <AlertCircle size={16} /> {importError}
                    </div>
                )}
            </div>

            <div className="pt-2 px-2">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">Danger Zone</h2>
                <button 
                    onClick={handleDeleteAll}
                    className="w-full text-red-500 text-sm font-bold bg-white border border-red-100 hover:bg-red-50 py-4 rounded-2xl transition-colors"
                >
                    Reset Everything
                </button>
            </div>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="mb-8 bg-white p-6 rounded-[2.5rem] shadow-sm">
                <div className="flex items-center gap-2 mb-6 text-sky-500">
                    <HelpCircle size={20} />
                    <span className="text-xs font-bold uppercase tracking-widest">FAQ</span>
                </div>
                
                <div className="space-y-6">
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm mb-1">Q: How does the AI know what season a shirt is for?</h3>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">
                            A: The AI analyzes the sleeve length, fabric weight (visually), and item type. For example, it tags shorts for Summer and heavy coats for Winter. You can always manually adjust these tags.
                        </p>
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm mb-1">Q: Is my child's data safe?</h3>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">
                            A: Yes. Tiny Closet is "Local First." All photos and database entries live strictly on your phone's storage. We do not have a cloud server that stores your personal photos.
                        </p>
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm mb-1">Q: What happens when I get a new phone?</h3>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">
                            A: Because data is local, you must use the "Export Backup" feature in Settings to save a file, then "Import Backup" on your new device.
                        </p>
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm mb-1">Q: Can it detect sizes automatically?</h3>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">
                            A: Yes! If you take a photo where the size tag is visible, or upload a screenshot of an order confirmation, the AI attempts to read the text (e.g., "2T", "6-9M") and save it to the item profile.
                        </p>
                    </div>
                </div>
            </div>

            <div className="mt-12 text-center pb-4">
                <p className="text-slate-300 text-xs font-bold mb-3">Tiny Closet v1.7</p>
                <button 
                onClick={handleReload}
                className="inline-flex items-center gap-2 text-sky-400 text-xs font-bold bg-white px-4 py-2 rounded-full shadow-sm hover:bg-sky-50 transition-colors"
                >
                <Power size={12} /> Update
                </button>
            </div>
        </div>
      )}
    </div>
  );
};