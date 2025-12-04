import React, { useState, useEffect, useRef } from 'react';
import { X, Archive, RotateCcw, Pencil, Trash2, Check, Save, Camera, Heart } from 'lucide-react';
import { ClothingItem, Category, Season } from '../types';
import { db } from '../db';
import clsx from 'clsx';

interface Props {
  item: ClothingItem | null;
  onClose: () => void;
  onToggleArchive: (item: ClothingItem) => void;
}

export const ItemDetailModal: React.FC<Props> = ({ item, onClose, onToggleArchive }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<ClothingItem>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (item) {
        setFormData(item);
        setIsEditing(false);
    }
  }, [item]);

  if (!item) return null;

  const handleSave = async () => {
      if (item.id) {
          await db.items.update(item.id, formData);
          setIsEditing(false);
      }
  };

  const toggleFavorite = async () => {
      if (item.id) {
          const newStatus = !formData.isFavorite;
          // Update local state immediately for UI response
          setFormData(prev => ({ ...prev, isFavorite: newStatus }));
          // Update DB
          await db.items.update(item.id, { isFavorite: newStatus });
      }
  };

  const handleDelete = async () => {
      if (item.id && window.confirm("Are you sure you want to delete this item?")) {
          await db.items.delete(item.id);
          onClose();
      }
  };

  const toggleSeason = (s: Season) => {
    const currentSeasons = formData.seasons || [];
    const newSeasons = currentSeasons.includes(s)
      ? currentSeasons.filter(x => x !== s)
      : [...currentSeasons, s];
    setFormData({ ...formData, seasons: newSeasons });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl relative flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
        
        {/* Image Header */}
        <div className="relative w-full h-72 bg-orange-50 shrink-0 group">
            <img src={formData.image || item.image} className="w-full h-full object-contain p-4" alt="Detail" />
            
            <button 
                onClick={onClose}
                className="absolute top-4 right-4 p-3 bg-white/50 backdrop-blur-md rounded-full text-slate-800 hover:bg-white transition-colors shadow-sm z-10"
            >
                <X size={24} />
            </button>

            {!isEditing && (
                <>
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="absolute top-4 left-4 p-3 bg-white/50 backdrop-blur-md rounded-full text-slate-800 hover:bg-white transition-colors shadow-sm z-10"
                    >
                        <Pencil size={20} />
                    </button>
                    
                    <button 
                        onClick={toggleFavorite}
                        className={clsx(
                            "absolute bottom-4 right-4 p-3 rounded-full shadow-sm z-10 transition-all active:scale-95",
                            formData.isFavorite 
                                ? "bg-red-500 text-white" 
                                : "bg-white/50 backdrop-blur-md text-slate-400 hover:text-red-500 hover:bg-white"
                        )}
                    >
                        <Heart size={24} fill={formData.isFavorite ? "currentColor" : "none"} />
                    </button>
                </>
            )}

            {isEditing && (
                <div className="absolute inset-0 bg-black/10 flex items-center justify-center z-20">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-white text-slate-800 px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-2 hover:scale-105 transition-transform"
                    >
                        <Camera size={20} /> Change Photo
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleImageChange}
                    />
                </div>
            )}

            {item.isArchived && !isEditing && (
                <div className="absolute bottom-4 left-4 bg-slate-800/80 backdrop-blur text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                    <Archive size={12} /> Archived
                </div>
            )}
        </div>
        
        <div className="p-8 pt-6 bg-white flex-1 overflow-y-auto">
            {isEditing ? (
                // EDIT MODE
                <div className="space-y-4">
                     <div className="flex justify-between items-center mb-2">
                        <h2 className="text-xl font-bold text-slate-800">Edit Item</h2>
                     </div>

                     <div className="space-y-3">
                        <div>
                            <label className="text-xs font-bold text-slate-400 ml-1">Brand</label>
                            <input 
                                className="w-full px-4 py-3 bg-slate-50 rounded-xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200"
                                value={formData.brand || ''}
                                onChange={e => setFormData({...formData, brand: e.target.value})}
                                placeholder="Brand"
                            />
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-slate-400 ml-1">Description</label>
                            <input 
                                className="w-full px-4 py-3 bg-slate-50 rounded-xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200"
                                value={formData.description || ''}
                                onChange={e => setFormData({...formData, description: e.target.value})}
                                placeholder="Description"
                            />
                        </div>

                        <div className="flex gap-3">
                             <div className="flex-1">
                                <label className="text-xs font-bold text-slate-400 ml-1">Size</label>
                                <input 
                                    className="w-full px-4 py-3 bg-slate-50 rounded-xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200"
                                    value={formData.sizeLabel || ''}
                                    onChange={e => setFormData({...formData, sizeLabel: e.target.value})}
                                    placeholder="Size"
                                />
                             </div>
                             <div className="flex-1">
                                <label className="text-xs font-bold text-slate-400 ml-1">Category</label>
                                <select 
                                    className="w-full px-4 py-3 bg-slate-50 rounded-xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200 appearance-none"
                                    value={formData.category || ''}
                                    onChange={e => setFormData({...formData, category: e.target.value as Category})}
                                >
                                    {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                             </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-400 ml-1">Seasons</label>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {[Season.Spring, Season.Summer, Season.Fall, Season.Winter, Season.All].map(s => (
                                    <button
                                        key={s}
                                        onClick={() => toggleSeason(s)}
                                        className={clsx(
                                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                            formData.seasons?.includes(s) 
                                                ? "bg-orange-400 text-white shadow-sm"
                                                : "bg-slate-100 text-slate-400"
                                        )}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                     </div>

                     <div className="flex gap-3 mt-6 pt-4 border-t border-slate-50 flex-wrap">
                        <button 
                            onClick={handleDelete}
                            className="p-4 bg-red-50 text-red-500 rounded-full hover:bg-red-100 transition-colors"
                            title="Delete"
                        >
                            <Trash2 size={20} />
                        </button>

                        <button 
                            onClick={() => {
                                onToggleArchive(item);
                                setIsEditing(false);
                            }}
                            className={`p-4 rounded-full transition-colors ${item.isArchived ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                            title={item.isArchived ? "Restore" : "Archive"}
                        >
                             {item.isArchived ? <RotateCcw size={20} /> : <Archive size={20} />}
                        </button>

                        <button 
                            onClick={() => setIsEditing(false)}
                            className="flex-1 py-4 bg-slate-100 text-slate-500 font-bold rounded-full hover:bg-slate-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSave}
                            className="flex-1 py-4 bg-sky-400 text-white font-bold rounded-full hover:bg-sky-500 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                            <Save size={20} /> Save
                        </button>
                     </div>
                </div>
            ) : (
                // VIEW MODE
                <>
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{item.category}</span>
                            <h2 className="text-3xl font-serif text-slate-900 leading-tight">{item.description || item.category}</h2>
                        </div>
                        <div className="bg-slate-100 px-3 py-1.5 rounded-xl text-slate-600 font-bold text-lg min-w-[3rem] text-center">
                            {item.sizeLabel}
                        </div>
                    </div>
                    
                    <div className="mb-6">
                        <p className="text-lg font-bold text-slate-500">{item.brand}</p>
                        <p className="text-xs font-medium text-slate-400 mt-1">Added on {formatDate(item.dateAdded)}</p>
                    </div>
                    
                    <div className="flex gap-2 mb-8 flex-wrap">
                        {item.seasons.map(s => (
                            <span key={s} className="px-3 py-1 bg-orange-50 text-orange-400 rounded-lg text-xs font-bold">
                                {s}
                            </span>
                        ))}
                    </div>

                    <div className="space-y-3">
                        <button 
                            onClick={() => onToggleArchive(item)}
                            className={`w-full py-4 rounded-full font-bold flex items-center justify-center gap-2 transition-colors ${
                                item.isArchived 
                                ? 'bg-sky-100 text-sky-600 hover:bg-sky-200' 
                                : 'bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500'
                            }`}
                        >
                            {item.isArchived ? (
                                <><RotateCcw size={20} /> Restore to Closet</>
                            ) : (
                                <><Archive size={20} /> Archive Item</>
                            )}
                        </button>
                    </div>
                </>
            )}
        </div>
      </div>
    </div>
  );
};