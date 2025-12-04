
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Loader2, X, ChevronLeft, ChevronRight, Trash2, Sparkles, AlertTriangle, FileText, Crop as CropIcon, RotateCw, Check } from 'lucide-react';
import { analyzeClothingImage } from '../services/geminiService';
import { db } from '../db';
import { ClothingItem, Category, Season } from '../types';
import clsx from 'clsx';

export const AddItem: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  // Steps: upload -> preview -> crop -> analyzing -> review
  const [step, setStep] = useState<'upload' | 'preview' | 'crop' | 'analyzing' | 'review'>('upload');
  
  // Image States
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // --- NEW CROP STATE ---
  const [maskDims, setMaskDims] = useState({ w: 0, h: 0 }); // The size of the crop window
  const [imgState, setImgState] = useState({ x: 0, y: 0, scale: 1, rotate: 0 }); // Image transform relative to center
  
  // Refs for gesture handling
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeGesture = useRef<{
    type: 'pan' | 'pinch' | 'resize';
    startMask?: { w: number, h: number };
    startImg?: { x: number, y: number, scale: number };
    startTouches?: { x: number, y: number }[];
    startDist?: number;
    activeHandle?: string; // 'tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r'
  } | null>(null);
  
  // Recrop State
  const [recropIndex, setRecropIndex] = useState<number | null>(null);

  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<Partial<ClothingItem>[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setOriginalImage(base64);
      setStep('preview');
      setRecropIndex(null);
      if (e.target) e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  // Initialize Crop State when entering Crop Mode
  const initCrop = (base64: string) => {
      const img = new Image();
      img.onload = () => {
          // Viewport calc (approximate visible height available)
          const vw = window.innerWidth;
          const vh = window.innerHeight - 200; 
          
          const imgW = img.naturalWidth;
          const imgH = img.naturalHeight;
          const imgAspect = imgW / imgH;
          
          // Initial Mask: Fit image aspect ratio within 85% of viewport
          let mw = vw * 0.85;
          let mh = mw / imgAspect;
          
          if (mh > vh * 0.85) {
              mh = vh * 0.85;
              mw = mh * imgAspect;
          }
          
          // Determine initial scale to fit image into mask exactly
          // We display the image at this scale initially
          const scale = mw / imgW;

          setMaskDims({ w: mw, h: mh });
          setImgState({ x: 0, y: 0, scale: scale, rotate: 0 });
          setStep('crop');
      };
      img.src = base64;
  };

  // --- TOUCH GESTURE LOGIC ---

  const getDistance = (t1: React.Touch, t2: React.Touch) => {
    return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touches = Array.from(e.touches) as React.Touch[];
    const target = e.target as HTMLElement;
    const handle = target.dataset.handle; // Check if touching a resize handle

    if (touches.length === 2) {
        // PINCH/ZOOM MODE - Prioritize this even if on a handle
        const dist = getDistance(touches[0], touches[1]);
        activeGesture.current = {
            type: 'pinch',
            startDist: dist,
            startImg: { ...imgState }
        };
    } else if (touches.length === 1 && handle) {
        // RESIZE MODE
        activeGesture.current = {
            type: 'resize',
            activeHandle: handle,
            startMask: { ...maskDims },
            startTouches: [{ x: touches[0].clientX, y: touches[0].clientY }]
        };
    } else if (touches.length === 1) {
        // PAN MODE
        activeGesture.current = {
            type: 'pan',
            startImg: { ...imgState },
            startTouches: [{ x: touches[0].clientX, y: touches[0].clientY }]
        };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!activeGesture.current) return;
    const g = activeGesture.current;
    const touches = Array.from(e.touches) as React.Touch[];
    
    // Prevent scrolling while cropping
    if(e.cancelable) e.preventDefault(); 

    if (g.type === 'resize' && touches.length === 1) {
        const dx = touches[0].clientX - g.startTouches![0].x;
        const dy = touches[0].clientY - g.startTouches![0].y;
        
        let newW = g.startMask!.w;
        let newH = g.startMask!.h;

        // Symmetric resizing logic based on handle
        // Using "includes" allows 'tl', 'tr' to respond to both side and top pulls
        // Also supports explicit edge handles 't', 'b', 'l', 'r'
        if (g.activeHandle === 'l' || g.activeHandle?.includes('l')) newW -= dx * 2; 
        if (g.activeHandle === 'r' || g.activeHandle?.includes('r')) newW += dx * 2;
        if (g.activeHandle === 't' || g.activeHandle?.includes('t')) newH -= dy * 2;
        if (g.activeHandle === 'b' || g.activeHandle?.includes('b')) newH += dy * 2;

        // Min dimensions
        newW = Math.max(80, newW);
        newH = Math.max(80, newH);
        
        // Constrain to screen width/height slightly
        if (newW > window.innerWidth - 32) newW = window.innerWidth - 32;
        if (newH > window.innerHeight - 200) newH = window.innerHeight - 200;

        setMaskDims({ w: newW, h: newH });
    }

    if (g.type === 'pan' && touches.length === 1) {
        const dx = touches[0].clientX - g.startTouches![0].x;
        const dy = touches[0].clientY - g.startTouches![0].y;
        
        setImgState(prev => ({
            ...prev,
            x: g.startImg!.x + dx,
            y: g.startImg!.y + dy
        }));
    }

    if (g.type === 'pinch' && touches.length === 2) {
        const dist = getDistance(touches[0], touches[1]);
        const scaleFactor = dist / g.startDist!;
        
        setImgState(prev => ({
            ...prev,
            scale: Math.max(0.1, g.startImg!.scale * scaleFactor)
        }));
    }
  };

  const handleTouchEnd = () => {
    activeGesture.current = null;
  };

  const confirmCrop = () => {
    if (!imgRef.current) return;

    const canvas = document.createElement('canvas');
    // Output at high resolution (2x visual size)
    const scaleFactor = 2;
    canvas.width = maskDims.w * scaleFactor;
    canvas.height = maskDims.h * scaleFactor;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = imgRef.current;
    
    ctx.save();
    ctx.scale(scaleFactor, scaleFactor);
    
    // Move origin to center of canvas
    ctx.translate(maskDims.w / 2, maskDims.h / 2);
    
    // Apply image transformations
    ctx.translate(imgState.x, imgState.y);
    ctx.rotate((imgState.rotate * Math.PI) / 180);
    ctx.scale(imgState.scale, imgState.scale);
    
    // Draw image centered at origin
    ctx.drawImage(
        img, 
        -img.naturalWidth / 2, 
        -img.naturalHeight / 2
    );
    
    ctx.restore();

    const croppedBase64 = canvas.toDataURL('image/jpeg', 0.9);
    
    if (recropIndex !== null) {
        const updatedItems = [...reviewItems];
        updatedItems[recropIndex] = { ...updatedItems[recropIndex], image: croppedBase64 };
        setReviewItems(updatedItems);
        setRecropIndex(null);
        setStep('review');
    } else {
        startAnalysis(croppedBase64);
    }
  };
  
  const cancelCrop = () => {
      if (recropIndex !== null) {
          setRecropIndex(null);
          setStep('review');
      } else {
          setStep('preview');
      }
  };

  // --- ANALYSIS LOGIC ---

  const startAnalysis = async (base64: string) => {
      setImagePreview(base64);
      setStep('analyzing');
      setAnalysisError(null);

      try {
        const foundItems = await analyzeClothingImage(base64);
        
        let initialItems: Partial<ClothingItem>[] = [];

        if (foundItems && foundItems.length > 0) {
          initialItems = foundItems.map((item: any) => ({
            ...item,
            image: item.image || base64,
            dateAdded: Date.now()
          }));
        } else {
          initialItems = [{
            image: base64,
            dateAdded: Date.now(),
            seasons: []
          }];
        }

        setReviewItems(initialItems);
        setCurrentIndex(0);
        setStep('review');
      } catch (err) {
        setAnalysisError("Could not identify clothing automatically.");
        setReviewItems([{ image: base64, dateAdded: Date.now(), seasons: [] }]);
        setCurrentIndex(0);
        setStep('review');
      }
  };

  const handleUpdateCurrentItem = (field: keyof ClothingItem, value: any) => {
    const updatedItems = [...reviewItems];
    updatedItems[currentIndex] = { ...updatedItems[currentIndex], [field]: value };
    setReviewItems(updatedItems);
  };

  const toggleSeason = (s: Season) => {
    const currentSeasons = reviewItems[currentIndex].seasons || [];
    const newSeasons = currentSeasons.includes(s)
      ? currentSeasons.filter(x => x !== s)
      : [...currentSeasons, s];
    handleUpdateCurrentItem('seasons', newSeasons);
  };

  const handleDeleteCurrent = () => {
    const updatedItems = reviewItems.filter((_, idx) => idx !== currentIndex);
    if (updatedItems.length === 0) {
      setStep('upload');
      setImagePreview(null);
    } else {
      setReviewItems(updatedItems);
      if (currentIndex >= updatedItems.length) {
        setCurrentIndex(updatedItems.length - 1);
      }
    }
  };

  const handleSaveAll = async () => {
    const validItems = reviewItems.filter(i => i.category && i.image) as ClothingItem[];
    if (validItems.length > 0) {
      await db.items.bulkAdd(validItems);
      navigate('/closet');
    } else {
      alert("Please ensure items have a category.");
    }
  };

  if (step === 'upload') {
    return (
      <div className="h-screen flex flex-col bg-orange-50 relative pb-20">
        <button 
            onClick={() => navigate('/')}
            className="absolute top-6 right-6 p-3 bg-white rounded-full text-slate-400 hover:text-slate-600 shadow-sm z-10"
        >
            <X size={24} />
        </button>

        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-8">
          <div className="w-28 h-28 bg-white rounded-[2rem] shadow-lg flex items-center justify-center text-sky-500 mb-2 transform rotate-3">
            <Camera size={56} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-4xl text-slate-900 mb-3">Add Clothes</h1>
            <p className="text-slate-500 max-w-[280px] mx-auto text-lg leading-relaxed font-medium">
                Snap a photo or upload an <strong>order screenshot</strong> to auto-import items.
            </p>
          </div>
          
          <input 
            type="file" 
            ref={cameraInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            capture="environment"
            className="hidden" 
          />
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
          
          <div className="w-full max-w-xs space-y-4">
            <button 
                onClick={() => cameraInputRef.current?.click()}
                className="w-full bg-sky-400 text-white font-bold py-5 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all text-lg flex items-center justify-center gap-3"
            >
                <Camera size={24} /> Take Photo
            </button>
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-white text-slate-700 font-bold py-5 rounded-full shadow-sm hover:shadow-md transition-all text-lg flex items-center justify-center gap-3"
            >
                <FileText size={24} /> Import Order Screenshot
            </button>
            <p className="text-center text-xs text-slate-400 font-bold -mt-2">
                Works with Shop App, Amazon, & Email receipts
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'preview') {
      return (
          <div className="h-[100dvh] flex flex-col bg-slate-900 relative">
               <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-center text-white">
                  <button onClick={() => setStep('upload')} className="p-2 bg-black/20 backdrop-blur rounded-full hover:bg-black/30 transition-colors">
                      <X size={24} />
                  </button>
               </div>
               
               <div className="flex-1 min-h-0 flex items-center justify-center p-6 bg-slate-900/50 relative z-10">
                  {originalImage && (
                    <img src={originalImage} alt="Preview" className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" />
                  )}
               </div>
  
               <div className="p-6 pb-8 bg-slate-900 flex gap-6 justify-center items-center z-20 relative">
                   <button 
                      onClick={() => {
                        setStep('upload');
                        setOriginalImage(null);
                      }}
                      className="flex flex-col items-center gap-1 text-slate-400 hover:text-red-400 transition-colors p-2"
                   >
                      <Trash2 size={24} />
                      <span className="text-xs font-bold">Delete</span>
                   </button>

                   <button 
                      onClick={() => initCrop(originalImage!)}
                      className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition-colors p-2"
                   >
                      <CropIcon size={24} />
                      <span className="text-xs font-bold">Crop</span>
                   </button>
  
                   <button 
                      onClick={() => startAnalysis(originalImage!)}
                      className="flex-1 bg-gradient-to-r from-sky-400 to-blue-500 text-white font-bold py-4 rounded-full shadow-lg hover:shadow-sky-500/30 hover:scale-105 transition-all flex items-center justify-center gap-2"
                   >
                      <Sparkles size={20} fill="currentColor" className="text-white/20" /> 
                      <span>Analyze</span>
                   </button>
               </div>
          </div>
      );
  }

  if (step === 'crop') {
      return (
          <div className="fixed inset-0 z-[60] flex flex-col bg-black overflow-hidden touch-none select-none">
              {/* Main Crop Area */}
              <div 
                ref={containerRef}
                className="flex-1 relative w-full h-full flex items-center justify-center"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                  {/* The Image (Background Layer) - Z-0 */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                      {originalImage && (
                        <img 
                            ref={imgRef}
                            src={originalImage} 
                            alt="Crop Target" 
                            className="max-w-none max-h-none origin-center"
                            style={{ 
                                transform: `translate(${imgState.x}px, ${imgState.y}px) scale(${imgState.scale}) rotate(${imgState.rotate}deg)`,
                            }}
                        />
                      )}
                  </div>

                  {/* Visible Crop Window (Cutout) - Z-10 */}
                  {/* Shadow creates the dark overlay outside the box */}
                  <div 
                    className="absolute z-10 pointer-events-none border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.8)]"
                    style={{ 
                        width: maskDims.w, 
                        height: maskDims.h,
                    }}
                  >
                       {/* Grid Lines */}
                       <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-30 pointer-events-none">
                          <div className="border-r border-b border-white"></div>
                          <div className="border-r border-b border-white"></div>
                          <div className="border-b border-white"></div>
                          <div className="border-r border-b border-white"></div>
                          <div className="border-r border-b border-white"></div>
                          <div className="border-b border-white"></div>
                          <div className="border-r border-white"></div>
                          <div className="border-r border-white"></div>
                       </div>

                       {/* Interactive Corners (Z-20) */}
                       <div data-handle="tl" className="absolute -top-4 -left-4 w-10 h-10 bg-transparent z-20 flex items-end justify-end pointer-events-auto">
                            <div className="w-5 h-5 border-t-4 border-l-4 border-white pointer-events-none"></div>
                       </div>
                       <div data-handle="tr" className="absolute -top-4 -right-4 w-10 h-10 bg-transparent z-20 flex items-end justify-start pointer-events-auto">
                            <div className="w-5 h-5 border-t-4 border-r-4 border-white pointer-events-none"></div>
                       </div>
                       <div data-handle="bl" className="absolute -bottom-4 -left-4 w-10 h-10 bg-transparent z-20 flex items-start justify-end pointer-events-auto">
                            <div className="w-5 h-5 border-b-4 border-l-4 border-white pointer-events-none"></div>
                       </div>
                       <div data-handle="br" className="absolute -bottom-4 -right-4 w-10 h-10 bg-transparent z-20 flex items-start justify-start pointer-events-auto">
                            <div className="w-5 h-5 border-b-4 border-r-4 border-white pointer-events-none"></div>
                       </div>

                       {/* Interactive Edges (Z-20) - Invisible but draggable */}
                       <div data-handle="t" className="absolute -top-3 left-6 right-6 h-6 z-20 pointer-events-auto"></div>
                       <div data-handle="b" className="absolute -bottom-3 left-6 right-6 h-6 z-20 pointer-events-auto"></div>
                       <div data-handle="l" className="absolute top-6 -left-3 bottom-6 w-6 z-20 pointer-events-auto"></div>
                       <div data-handle="r" className="absolute top-6 -right-3 bottom-6 w-6 z-20 pointer-events-auto"></div>
                  </div>
              </div>

              {/* Bottom Control Bar - Z-50 */}
              <div className="flex-none bg-zinc-900 pb-safe pt-6 px-6 pb-8 z-50 shadow-2xl">
                  <div className="max-w-md mx-auto">
                      <div className="flex items-center justify-center gap-6 mb-6">
                           <span className="text-white/60 text-xs font-bold uppercase tracking-wider bg-white/10 px-3 py-1 rounded-full">
                               Pan, Zoom & Crop
                           </span>
                      </div>

                      <div className="flex justify-between items-center gap-4">
                          <button 
                            onClick={() => setImgState(s => ({...s, rotate: s.rotate - 90}))}
                            className="p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
                            title="Rotate"
                          >
                             <RotateCw size={20} className="-scale-x-100" />
                          </button>
                          
                          <div className="flex gap-4 flex-1 justify-end">
                            <button 
                                onClick={cancelCrop}
                                className="text-white font-bold px-4 py-3 rounded-full hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmCrop}
                                className="bg-white text-black px-6 py-3 rounded-full font-bold shadow-lg active:scale-95 transition-transform flex items-center gap-2"
                            >
                                <Check size={18} strokeWidth={3} /> Done
                            </button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  if (step === 'analyzing') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-orange-50 p-6 z-[60] relative">
        <div className="relative w-48 h-48 mb-8 bg-white p-2 rounded-[2.5rem] shadow-lg rotate-3 overflow-hidden">
          {imagePreview && <img src={imagePreview} alt="Analyzing" className="w-full h-full object-cover rounded-[2rem] opacity-50" />}
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={48} className="text-pink-400 animate-spin" />
          </div>
        </div>
        <h2 className="text-3xl text-slate-800 mb-2">Analyzing...</h2>
        <p className="text-slate-500 font-bold">Scanning for clothes...</p>
      </div>
    );
  }

  const currentItem = reviewItems[currentIndex];

  return (
    <div className="min-h-screen bg-orange-50 p-6 pb-28 max-w-md mx-auto">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl text-slate-800">Review</h1>
        <button onClick={() => setStep('upload')} className="bg-white p-2 rounded-full text-slate-400 hover:text-slate-600 shadow-sm">
            <X size={24} />
        </button>
      </header>

      {analysisError && (
        <div className="bg-orange-100 p-4 rounded-2xl text-orange-800 text-sm mb-6 font-bold flex gap-2 items-center">
          <AlertTriangle size={18} /> {analysisError}
        </div>
      )}

      {reviewItems.length > 1 && (
        <div className="flex items-center justify-between mb-6 bg-white p-2 rounded-full shadow-sm">
          <button 
            onClick={() => setCurrentIndex(c => Math.max(0, c - 1))}
            disabled={currentIndex === 0}
            className="p-3 text-slate-600 disabled:opacity-20 hover:bg-slate-50 rounded-full transition"
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="text-sm font-bold text-slate-500">
            {currentIndex + 1} of {reviewItems.length}
          </div>
          
          <button 
            onClick={() => setCurrentIndex(c => Math.min(reviewItems.length - 1, c + 1))}
            disabled={currentIndex === reviewItems.length - 1}
            className="p-3 text-slate-600 disabled:opacity-20 hover:bg-slate-50 rounded-full transition"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      <div className="space-y-6">
        <div className="relative w-full bg-white p-4 rounded-[2.5rem] shadow-sm">
           <div className="w-full aspect-square rounded-[2rem] overflow-hidden bg-slate-50 relative group">
                {currentItem.image ? (
                    <img src={currentItem.image} alt="Preview" className="w-full h-full object-contain" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold">No Image</div>
                )}
                
                <button 
                     onClick={() => {
                        setRecropIndex(currentIndex);
                        initCrop(originalImage || currentItem.image!);
                     }}
                     className="absolute top-6 left-6 p-3 bg-white/90 backdrop-blur rounded-xl text-slate-400 hover:text-sky-500 shadow-sm transition-colors"
                     title="Re-crop Item"
                >
                     <CropIcon size={20} />
                </button>

                <button 
                     onClick={handleDeleteCurrent}
                     className="absolute top-6 right-6 p-3 bg-white/90 backdrop-blur rounded-xl text-slate-400 hover:text-red-500 shadow-sm transition-colors"
                     title="Remove Item"
                >
                     <Trash2 size={20} />
                </button>
           </div>
        </div>

        <div className="grid gap-4 bg-white p-6 rounded-[2.5rem] shadow-sm">
            <div className="group">
                <label className="block text-xs font-bold text-slate-400 mb-2 ml-1">Brand</label>
                <input 
                    type="text" 
                    value={currentItem.brand || ''} 
                    onChange={e => handleUpdateCurrentItem('brand', e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-sky-200 transition-all placeholder:text-slate-300"
                    placeholder="e.g. Zara"
                />
            </div>

            <div className="group">
                <label className="block text-xs font-bold text-slate-400 mb-2 ml-1">Description</label>
                <input 
                type="text" 
                value={currentItem.description || ''} 
                onChange={e => handleUpdateCurrentItem('description', e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-sky-200 transition-all placeholder:text-slate-300"
                placeholder="Blue T-Shirt"
                />
            </div>

            <div className="flex gap-4">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-400 mb-2 ml-1">Size</label>
                    <input 
                    type="text" 
                    value={currentItem.sizeLabel || ''} 
                    onChange={e => handleUpdateCurrentItem('sizeLabel', e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-sky-200 transition-all placeholder:text-slate-300"
                    placeholder="4T"
                    />
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-400 mb-2 ml-1">Color</label>
                    <input 
                    type="text" 
                    value={currentItem.color || ''} 
                    onChange={e => handleUpdateCurrentItem('color', e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-sky-200 transition-all placeholder:text-slate-300"
                    placeholder="Blue"
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-400 mb-2 ml-1">Category</label>
                <div className="relative">
                    <select 
                    value={currentItem.category || ''} 
                    onChange={e => handleUpdateCurrentItem('category', e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-sky-200 transition-all appearance-none"
                    >
                    <option value="">Select...</option>
                    {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            <div>
            <label className="block text-xs font-bold text-slate-400 mb-2 ml-1">Seasons</label>
            <div className="flex flex-wrap gap-2">
                {[Season.Spring, Season.Summer, Season.Fall, Season.Winter, Season.All].map(s => (
                <button
                    key={s}
                    onClick={() => toggleSeason(s)}
                    className={clsx(
                    "px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm",
                    currentItem.seasons?.includes(s) 
                        ? "bg-orange-400 text-white shadow-md scale-105"
                        : "bg-white text-slate-400 hover:bg-slate-100"
                    )}
                >
                    {s}
                </button>
                ))}
            </div>
            </div>
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        {currentIndex < reviewItems.length - 1 ? (
             <button 
                onClick={() => setCurrentIndex(c => c + 1)}
                className="flex-1 bg-white text-slate-800 font-bold py-5 rounded-full shadow-sm hover:shadow-md transition-all text-lg"
             >
                Next
             </button>
        ) : (
            <button 
                onClick={handleSaveAll}
                className="flex-1 bg-sky-400 text-white font-bold py-5 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all text-lg"
            >
                Save to Closet
            </button>
        )}
      </div>
    </div>
  );
};
