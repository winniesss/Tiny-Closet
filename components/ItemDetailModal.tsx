
import React, { useState, useEffect, useRef } from 'react';
import { X, Archive, RotateCcw, Pencil, Trash2, Save, Camera as CameraIcon, Ruler, Check } from 'lucide-react';
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

  // Crop tool state
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropPos, setCropPos] = useState({ x: 0, y: 0, scale: 1 });
  const gestureRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number; startScale: number; startDist: number; isPinching: boolean } | null>(null);
  const cropImgRef = useRef<HTMLImageElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const CROP_SIZE = 288;

  useEffect(() => {
    if (item) {
        setFormData(item);
        setIsEditing(false);
    }
  }, [item]);

  // Center image in crop frame when cropSource changes
  useEffect(() => {
    if (!cropSource) return;
    const img = new Image();
    img.onload = () => {
      requestAnimationFrame(() => {
        const container = cropContainerRef.current;
        if (!container) return;
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        let scale: number;
        if (img.width / img.height > 1) {
          // Landscape: fit height to crop size
          scale = CROP_SIZE / img.height;
        } else {
          // Portrait or square: fit width to crop size
          scale = CROP_SIZE / img.width;
        }
        const x = (cw - img.width * scale) / 2;
        const y = (ch - img.height * scale) / 2;
        setCropPos({ x, y, scale });
      });
    };
    img.src = cropSource;
  }, [cropSource]);

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

  const handleChangePhoto = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCropSource(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = '';
  };

  // Crop touch handlers
  const handleCropTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      gestureRef.current = {
        startX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        startY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        startPosX: cropPos.x,
        startPosY: cropPos.y,
        startScale: cropPos.scale,
        startDist: Math.sqrt(dx * dx + dy * dy),
        isPinching: true,
      };
    } else if (e.touches.length === 1) {
      gestureRef.current = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        startPosX: cropPos.x,
        startPosY: cropPos.y,
        startScale: cropPos.scale,
        startDist: 0,
        isPinching: false,
      };
    }
  };

  const handleCropTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const g = gestureRef.current;
    if (!g) return;
    if (g.isPinching && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const newScale = Math.max(0.1, g.startScale * (dist / g.startDist));
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      setCropPos({
        x: g.startPosX + (cx - g.startX),
        y: g.startPosY + (cy - g.startY),
        scale: newScale,
      });
    } else if (!g.isPinching && e.touches.length === 1) {
      setCropPos(prev => ({
        ...prev,
        x: g.startPosX + (e.touches[0].clientX - g.startX),
        y: g.startPosY + (e.touches[0].clientY - g.startY),
      }));
    }
  };

  const handleCropTouchEnd = () => {
    gestureRef.current = null;
  };

  const handleCropWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setCropPos(prev => ({
      ...prev,
      scale: Math.max(0.1, prev.scale * (1 - e.deltaY * 0.001)),
    }));
  };

  const confirmCrop = () => {
    const container = cropContainerRef.current;
    if (!container || !cropSource) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const frameLeft = (cw - CROP_SIZE) / 2;
    const frameTop = (ch - CROP_SIZE) / 2;

    const srcX = (frameLeft - cropPos.x) / cropPos.scale;
    const srcY = (frameTop - cropPos.y) / cropPos.scale;
    const srcW = CROP_SIZE / cropPos.scale;
    const srcH = CROP_SIZE / cropPos.scale;

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const srcImg = new Image();
    srcImg.onload = () => {
      ctx.drawImage(srcImg, srcX, srcY, srcW, srcH, 0, 0, 800, 800);
      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setFormData(prev => ({ ...prev, image: croppedDataUrl }));
      setCropSource(null);
    };
    srcImg.src = cropSource;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <>
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl relative flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">

        {/* Image Header */}
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
                        onClick={handleChangePhoto}
                        className="bg-white text-slate-800 px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-2 hover:scale-105 transition-transform"
                    >
                        <CameraIcon size={20} /> Change Photo
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
    </div>

    {/* Crop overlay - rendered as sibling to avoid nested fixed stacking context issues on iOS */}
    {cropSource && (
      <div className="fixed inset-0 z-[70] bg-slate-900 flex flex-col">
        <div
          className="flex-1 relative overflow-hidden touch-none"
          ref={cropContainerRef}
          onTouchStart={handleCropTouchStart}
          onTouchMove={handleCropTouchMove}
          onTouchEnd={handleCropTouchEnd}
          onWheel={handleCropWheel}
        >
          <img
            ref={cropImgRef}
            src={cropSource}
            className="absolute select-none"
            style={{
              transform: `translate(${cropPos.x}px, ${cropPos.y}px) scale(${cropPos.scale})`,
              transformOrigin: '0 0',
            }}
            draggable={false}
          />
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div
              className="border-2 border-white rounded-lg"
              style={{
                width: CROP_SIZE,
                height: CROP_SIZE,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
              }}
            />
          </div>
        </div>
        <div className="flex gap-4 p-6 bg-slate-900" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          <button
            onClick={() => setCropSource(null)}
            className="flex-1 py-4 bg-slate-700 text-white font-bold rounded-full hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={confirmCrop}
            className="flex-1 py-4 bg-sky-400 text-white font-bold rounded-full hover:bg-sky-500 transition-all flex items-center justify-center gap-2"
          >
            <Check size={20} /> Crop
          </button>
        </div>
      </div>
    )}
    </>
  );
};
