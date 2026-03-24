
import React, { useEffect, useState, useRef } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChildProfile } from '../types';
import { Camera, User, Download, UploadCloud, CheckCircle2, AlertCircle, HelpCircle, RefreshCw, Settings as SettingsIcon, Info, Plus, Trash2, Users } from 'lucide-react';
import { useActiveChild } from '../hooks/useActiveChild';
import clsx from 'clsx';

const CURRENT_VERSION = '2.0';

export const Settings: React.FC = () => {
  const { profiles, activeChild, activeChildId, setActiveChildId } = useActiveChild();
  const [editing, setEditing] = useState<Partial<ChildProfile>>({});
  const [message, setMessage] = useState('');
  const [importError, setImportError] = useState('');
  const [activeTab, setActiveTab] = useState<'config' | 'faq'>('config');
  const [hasNewVersion, setHasNewVersion] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const releaseNotes = [
      {
          version: "2.0",
          changes: [
              "New: Shop Inspo — save outfit inspiration and match to your closet.",
              "New: Weekly Planner with drag-to-arrange canvas.",
              "New: Smart filters (Recent, Season) when picking outfits.",
              "New: 'Planned' tab on Dashboard shows today's planned outfit.",
              "Merged Playful/Chic into unified 'For You' recommendation.",
          ]
      },
      {
          version: "1.8",
          changes: [
              "Improved crop tool: Now supports long screenshots better.",
              "Removed 'Find Online' feature to focus on local privacy and speed.",
              "Dashboard visual polish.",
          ]
      },
      {
          version: "1.7",
          changes: [
              "Added Archive functionality.",
              "Brand filter in Closet view.",
              "Performance improvements."
          ]
      }
  ];

  useEffect(() => {
    if (activeChild) {
      setEditing(activeChild);
    }
  }, [activeChild]);

  // Check for new version hint
  useEffect(() => {
      const lastSeen = localStorage.getItem('tiny_closet_last_seen_version');
      if (lastSeen !== CURRENT_VERSION) {
          setHasNewVersion(true);
      }
  }, []);

  const handleTabChange = (tab: 'config' | 'faq') => {
      setActiveTab(tab);
      if (tab === 'faq' && hasNewVersion) {
          setHasNewVersion(false);
          localStorage.setItem('tiny_closet_last_seen_version', CURRENT_VERSION);
      }
  };

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

  // Check if user is in "First Time" mode (default name)
  const isSetupMode = !editing.name || editing.name === 'My Kid';

  return (
    <div className="p-6 max-w-md mx-auto min-h-screen bg-orange-50 pb-28">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl text-slate-800">Settings</h1>
        
        <div className="flex bg-white rounded-full p-1 shadow-sm border border-slate-100">
            <button 
                onClick={() => handleTabChange('config')}
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
                onClick={() => handleTabChange('faq')}
                className={clsx(
                    "px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 relative",
                    activeTab === 'faq' 
                        ? "bg-orange-400 text-white shadow-sm" 
                        : "text-slate-400 hover:text-slate-600"
                )}
            >
                {hasNewVersion && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
                )}
                <Info size={14} /> FAQ
            </button>
        </div>
      </div>

      {activeTab === 'config' ? (
        <div className="animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="mb-6 bg-white p-6 rounded-[2.5rem] shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg text-slate-800 font-serif">Child Profile</h2>
                    <button
                        onClick={async () => {
                            const newId = await db.profile.add({
                                name: 'New Child',
                                birthDate: new Date().toISOString().split('T')[0]
                            });
                            setActiveChildId(newId as number);
                            setMessage('New child added!');
                            setTimeout(() => setMessage(''), 3000);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 text-sky-500 rounded-full text-xs font-bold hover:bg-sky-100 transition-colors"
                    >
                        <Plus size={14} /> Add Child
                    </button>
                </div>

                {/* Child Switcher Tabs */}
                {profiles.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-4 mb-4 -mx-2 px-2">
                        {profiles.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setActiveChildId(p.id!)}
                                className={clsx(
                                    "flex items-center gap-2 shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all border",
                                    activeChildId === p.id
                                        ? "bg-sky-400 text-white border-sky-400 shadow-sm"
                                        : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                                )}
                            >
                                <div className="w-6 h-6 rounded-full bg-sky-200 text-sky-700 flex items-center justify-center text-[10px] font-bold overflow-hidden">
                                    {p.avatar ? (
                                        <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        p.name[0]
                                    )}
                                </div>
                                {p.name}
                            </button>
                        ))}
                    </div>
                )}
                
                <div className={clsx("flex transition-all duration-300", isSetupMode ? "flex-col items-center gap-6" : "flex-row items-start gap-4")}>
                    <div className="flex flex-col items-center shrink-0">
                        <div 
                        className={clsx(
                            "relative rounded-full bg-slate-100 border-4 border-white shadow-md overflow-hidden cursor-pointer group transition-all duration-300",
                            isSetupMode ? "w-32 h-32" : "w-16 h-16"
                        )}
                        onClick={() => fileInputRef.current?.click()}
                        >
                        {editing.avatar ? (
                            <img src={editing.avatar} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <User size={isSetupMode ? 48 : 24} />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="text-white" size={isSetupMode ? 32 : 16} />
                        </div>
                        </div>
                        <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-2 text-xs font-bold text-sky-500 hover:text-sky-600"
                        >
                        Change
                        </button>
                        <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleAvatarChange} 
                        />
                    </div>

                    <div className={clsx("w-full space-y-3", isSetupMode ? "" : "pt-1")}>
                        <div className="group">
                            <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">Name</label>
                            <input 
                            type="text" 
                            className={clsx(
                                "w-full bg-slate-50 rounded-2xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-sky-200 transition-all placeholder:text-slate-300",
                                isSetupMode ? "px-5 py-4 text-lg" : "px-4 py-2 text-sm"
                            )}
                            value={editing.name || ''}
                            onChange={e => setEditing({...editing, name: e.target.value})}
                            placeholder="Child's Name"
                            />
                        </div>
                        <div className="group">
                            <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">Date of Birth</label>
                            <input 
                            type="date" 
                            className={clsx(
                                "w-full bg-slate-50 rounded-2xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-sky-200 transition-all appearance-none text-left",
                                isSetupMode ? "px-5 py-4 text-lg min-h-[60px]" : "px-4 py-2 text-sm min-h-[40px]"
                            )}
                            value={editing.birthDate || ''}
                            onChange={e => setEditing({...editing, birthDate: e.target.value})}
                            />
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    className="w-full bg-sky-400 text-white font-bold py-5 rounded-full shadow-lg hover:scale-[1.02] transition-transform text-lg mt-6 flex justify-center items-center gap-2"
                >
                    {message === 'Settings Saved!' ? <CheckCircle2 size={20} /> : null}
                    {message || 'Save Changes'}
                </button>

                {/* Delete Child Button */}
                {profiles.length > 1 && (
                    <button
                        onClick={async () => {
                            if (!editing.id) return;
                            if (window.confirm(`Delete ${editing.name}'s profile and all their clothing items? This cannot be undone.`)) {
                                // Delete items belonging to this child
                                await db.items.where('profileId').equals(editing.id).delete();
                                await db.outfitLikes.where('profileId').equals(editing.id).delete();
                                await db.profile.delete(editing.id);
                                // Switch to another child
                                const remaining = profiles.filter(p => p.id !== editing.id);
                                if (remaining.length > 0) {
                                    setActiveChildId(remaining[0].id!);
                                }
                                setMessage('Profile deleted');
                                setTimeout(() => setMessage(''), 3000);
                            }
                        }}
                        className="w-full mt-3 py-3 text-red-400 text-sm font-bold flex items-center justify-center gap-2 hover:text-red-500 transition-colors"
                    >
                        <Trash2 size={16} /> Delete This Child's Profile
                    </button>
                )}
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
                <div className="flex items-center gap-2 mb-1 ml-1">
                    <AlertCircle size={16} className="text-red-500" />
                    <h2 className="text-sm font-bold text-red-500 uppercase tracking-widest">Danger Zone</h2>
                </div>
                <p className="text-xs text-red-400 mb-4 ml-1">This action cannot be undone.</p>
                <button
                    onClick={handleDeleteAll}
                    className="w-full text-red-600 text-sm font-bold bg-red-50 border-2 border-red-200 hover:bg-red-100 py-4 rounded-2xl transition-colors"
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
                </div>
            </div>

            <div className="mb-8 bg-white p-6 rounded-[2.5rem] shadow-sm">
                <div className="flex items-center gap-2 mb-6 text-orange-500">
                    <RefreshCw size={20} />
                    <span className="text-xs font-bold uppercase tracking-widest">What's New</span>
                </div>
                <div className="space-y-6">
                    {releaseNotes.map((note, idx) => (
                        <div key={idx} className="relative pl-4 border-l-2 border-slate-100">
                            <h3 className="font-bold text-slate-800 text-sm mb-2">v{note.version}</h3>
                            <ul className="space-y-2">
                                {note.changes.map((change, cIdx) => (
                                    <li key={cIdx} className="text-xs text-slate-500 font-medium leading-relaxed">
                                        • {change}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-12 text-center pb-4">
                <p className="text-slate-300 text-xs font-bold mb-3">Tiny Closet v{CURRENT_VERSION}</p>
                <button 
                onClick={handleReload}
                className="inline-flex items-center gap-2 text-sky-400 text-xs font-bold bg-white px-4 py-2 rounded-full shadow-sm hover:bg-sky-50 transition-colors"
                >
                <RefreshCw size={12} /> Update App
                </button>
            </div>
        </div>
      )}
    </div>
  );
};
