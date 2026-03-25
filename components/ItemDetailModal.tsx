
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Archive, RotateCcw, Pencil, Trash2, Check, Save, Camera, Ruler, Crop, ZoomIn, ZoomOut } from 'lucide-react';
import { ClothingItem, Category, Season } from '../types';
import { db } from '../db';
import clsx from 'clsx';

interface Props {
  item: ClothingItem | null;
  onClose: () => void;
  onToggleArchive: (item: ClothingItem) => void;
  isOutgrown?: boolean;
  onIgnoreOutgrown?: (item: ClothingItem) => void;
}

export const ItemDetailModal: React.FC<Props> = ({ item, onClose, onToggleArchive, isOutgrown, onIgnoreOutgrown }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<ClothingItem>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Crop state
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropPos, setCropPos] = useState({ x: 0, y: 0, scale: 1 });
  const cropImgRef = useRef<HTMLImageElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<{
    type: 'pan' | 'pinch';
    startPos: { x: number; y: number; scale: number };
    startTouch: { x: number; y: number };
    startDist?: number;
  } | null>(null);

  useEffect(() => {
    if (item) {
        setFormData(item);
        setIsEditing(false);
        setCropSource(null);
    }
  }, [item]);

  if (!item) return null;

  const handleSave = async () => {
      if (item.id) {
          await db.items.update(item.id, formData);
          setIsEditing(false);
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
        const src = reader.result as string;
        // Open crop tool instead of directly setting image
        const img = new Image();
        img.onload = () => {
          const containerW = Math.min(window.innerWidth, 400);
          const containerH = containerW * 1.2;
          const fitScale = Math.min(containerW / img.naturalWidth, containerH / img.naturalHeight) * 0.85;
          setCropPos({ x: 0, y: 0, scale: fitScale });
          setCropSource(src);
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = '';
  };

  // Crop gesture handlers
  const handleCropTouchStart = (e: React.TouchEvent) => {
    const touches = Array.from(e.touches);
    if (touches.length === 2) {
      const dist = Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
      gestureRef.current = { type: 'pinch', startPos: { ...cropPos }, startTouch: { x: 0, y: 0 }, startDist: dist };
    } else if (touches.length === 1) {
      gestureRef.current = { type: 'pan', startPos: { ...cropPos }, startTouch: { x: touches[0].clientX, y: touches[0].clientY } };
    }
  };

  const handleCropTouchMove = (e: React.TouchEvent) => {
    if (!gestureRef.current) return;
    if (e.cancelable) e.preventDefault();
    const g = gestureRef.current;
    const touches = Array.from(e.touches);
    if (g.type === 'pinch' && touches.length === 2) {
      const dist = Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
      const newScale = Math.min(8, Math.max(0.1, g.startPos.scale * (dist / g.startDist!)));
      setCropPos(prev => ({ ...prev, scale: newScale }));
    } else if (g.type === 'pan' && touches.length === 1) {
      setCropPos({
        ...g.startPos,
        x: g.startPos.x + (touches[0].clientX - g.startTouch.x),
        y: g.startPos.y + (touches[0].clientY - g.startTouch.y),
      });
    }
  };

  const handleCropTouchEnd = () => { gestureRef.current = null; };

  // Mouse drag for desktop
  const handleCropMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    gestureRef.current = { type: 'pan', startPos: { ...cropPos }, startTouch: { x: e.clientX, y: e.clientY } };
    const handleMouseMove = (ev: MouseEvent) => {
      if (!gestureRef.current) return;
      const g = gestureRef.current;
      setCropPos({
        ...g.startPos,
        x: g.startPos.x + (ev.clientX - g.startTouch.x),
        y: g.startPos.y + (ev.clientY - g.startTouch.y),
      });
    };
    const handleMouseUp = () => {
      gestureRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleCropWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setCropPos(prev => ({ ...prev, scale: Math.min(8, Math.max(0.1, prev.scale * delta)) }));
  };

  const confirmCrop = () => {
    if (!cropImgRef.current || !cropContainerRef.current) return;
    const img = cropImgRef.current;
    const rect = cropContainerRef.current.getBoundingClientRect();
    const outputW = rect.width * 2; // 2x for retina
    const outputH = rect.height * 2;
    const canvas = document.createElement('canvas');
    canvas.width = outputW;
    canvas.height = outputH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, outputW, outputH);

    const drawScale = outputW / rect.width;
    ctx.save();
    ctx.scale(drawScale, drawScale);
    ctx.translate(rect.width / 2, rect.height / 2);
    ctx.translate(cropPos.x, cropPos.y);
    ctx.scale(cropPos.scale, cropPos.scale);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();

    setFormData(prev => ({ ...prev, image: canvas.toDataURL('image/jpeg', 0.9) }));
    setCropSource(null);
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
        
        {/* Image Header - Reduced height and used object-contain */}
        <div className="relative w-full h-72 bg-orange-50 shrink-0 group">
            <img src={formData.image || item.image} className="w-full h-full object-contain p-4" alt="Detail" />
            
            <button 
                onClick={onClose}
                className="absolute top-4 right-4 p-3 bg-white/50 backdrop-blur-md rounded-full text-slate-800 hover:bg-white transition-colors shadow-sm z-30"
            >
                <X size={24} />
            </button>

            {!isEditing && (
                 <button 
                    onClick={() => setIsEditing(true)}
                    className="absolute top-4 left-4 p-3 bg-white/50 backdrop-blur-md rounded-full text-slate-800 hover:bg-white transition-colors shadow-sm z-10"
                >
                    <Pencil size={20} />
                </button>
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
                        {(item.wearCount ?? 0) > 0 && (
                            <p className="text-xs font-bold text-orange-400 mt-1">Worn {item.wearCount} time{item.wearCount !== 1 ? 's' : ''}</p>
                        )}
                    </div>
                    
                    <div className="flex gap-2 mb-8 flex-wrap">
                        {item.seasons.map(s => (
                            <span key={s} className="px-3 py-1 bg-orange-50 text-orange-400 rounded-lg text-xs font-bold">
                                {s}
                            </span>
                        ))}
                    </div>

                    <div className="space-y-3">
                        {isOutgrown && onIgnoreOutgrown && (
                            <button
                                onClick={() => onIgnoreOutgrown(item)}
                                className="w-full py-4 rounded-full font-bold flex items-center justify-center gap-2 transition-colors bg-green-50 text-green-600 hover:bg-green-100 mb-2"
                            >
                                <Ruler size={20} /> It Still Fits
                            </button>
                        )}
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

      {/* Crop Overlay */}
      {cropSource && (
        <div className="fixed inset-0 z-[70] bg-slate-900 flex flex-col">
          {/* Top bar */}
          <div className="flex justify-between items-center p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
            <button onClick={() => setCropSource(null)} className="p-2 text-white/70 hover:text-white">
              <X size={24} />
            </button>
            <span className="text-white font-bold text-sm">Move & Pinch to Crop</span>
            <button onClick={confirmCrop} className="p-2 text-sky-400 hover:text-sky-300">
              <Check size={24} />
            </button>
          </div>

          {/* Crop area */}
          <div
            ref={cropContainerRef}
            className="flex-1 relative overflow-hidden touch-none cursor-grab active:cursor-grabbing"
            onTouchStart={handleCropTouchStart}
            onTouchMove={handleCropTouchMove}
            onTouchEnd={handleCropTouchEnd}
            onMouseDown={handleCropMouseDown}
            onWheel={handleCropWheel}
          >
            <img
              ref={cropImgRef}
              src={cropSource}
              alt="Crop"
              className="absolute top-1/2 left-1/2 pointer-events-none"
              draggable={false}
              style={{
                transform: `translate(-50%, -50%) translate(${cropPos.x}px, ${cropPos.y}px) scale(${cropPos.scale})`,
                transformOrigin: 'center center',
              }}
            />
            {/* Grid overlay */}
            <div className="absolute inset-8 border border-white/30 pointer-events-none">
              <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/20" />
              <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/20" />
              <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20" />
              <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20" />
            </div>
            {/* Dark edges */}
            <div className="absolute inset-0 pointer-events-none border-[2rem] border-black/40" />
          </div>

          {/* Zoom controls */}
          <div className="flex items-center justify-center gap-6 py-3">
            <button
              onClick={() => setCropPos(prev => ({ ...prev, scale: Math.max(0.1, prev.scale * 0.8) }))}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
            >
              <ZoomOut size={20} />
            </button>
            <span className="text-white/50 text-xs font-bold w-12 text-center">
              {Math.round(cropPos.scale * 100)}%
            </span>
            <button
              onClick={() => setCropPos(prev => ({ ...prev, scale: Math.min(8, prev.scale * 1.25) }))}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
            >
              <ZoomIn size={20} />
            </button>
          </div>

          {/* Confirm button */}
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
