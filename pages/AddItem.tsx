
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Loader2, X, ChevronLeft, ChevronRight, Trash2, Sparkles, AlertTriangle, Search, FileText, Crop as CropIcon, ZoomIn, RotateCw } from 'lucide-react';
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
  
  // Crop States
  const [cropScale, setCropScale] = useState(1);
  const [cropPos, setCropPos] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const [imgAspectRatio, setImgAspectRatio] = useState(3/4); // Default to portrait
  
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
      
      // Calculate aspect ratio
      const img = new Image();
      img.onload = () => {
          setImgAspectRatio(img.width / img.height);
      };
      img.src = base64;

      setCropScale(1);
      setCropPos({ x: 0, y: 0 });
      setRotation(0);
      setStep('preview');
      setRecropIndex(null);
      
      // Reset input so same file can be selected again if needed
      if (e.target) e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  // --- Crop Logic ---
  
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - cropPos.x, y: e.clientY - cropPos.y };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setCropPos({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const confirmCrop = () => {
    if (!imgRef.current || !cropContainerRef.current) return;

    const canvas = document.createElement('canvas');
    // Set output resolution (e.g., 2x the display size for sharpness)
    const scaleFactor = 2;
    const containerRect = cropContainerRef.current.getBoundingClientRect();
    
    canvas.width = containerRect.width * scaleFactor;
    canvas.height = containerRect.height * scaleFactor;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = imgRef.current;
    
    const aspect = img.naturalWidth / img.naturalHeight;
    const containerAspect = containerRect.width / containerRect.height;
    
    let renderW, renderH;
    
    if (aspect > containerAspect) {
        // Image is wider than container
        renderW = containerRect.width;
        renderH = containerRect.width / aspect;
    } else {
        // Image is taller than container
        renderH = containerRect.height;
        renderW = containerRect.height * aspect;
    }
    
    ctx.save();
    ctx.scale(scaleFactor, scaleFactor);
    
    // Move to center of canvas
    ctx.translate(containerRect.width / 2, containerRect.height / 2);
    
    ctx.translate(cropPos.x, cropPos.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(cropScale, cropScale);
    
    ctx.drawImage(
        img, 
        -renderW / 2, 
        -renderH / 2, 
        renderW, 
        renderH
    );
    
    ctx.restore();

    const croppedBase64 = canvas.toDataURL('image/jpeg', 0.9);
    
    if (recropIndex !== null) {
        // Update specific item and return to review
        const updatedItems = [...reviewItems];
        updatedItems[recropIndex] = { ...updatedItems[recropIndex], image: croppedBase64 };
        setReviewItems(updatedItems);
        setRecropIndex(null);
        setStep('review');
    } else {
        // Proceed to analysis
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

  // --- End Crop Logic ---

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
          <div className="h-screen flex flex-col bg-slate-900 relative">
               {/* Header */}
               <div className="absolute top-0 left-0 right-0 p-4 z-10 flex justify-between items-center text-white">
                  <button onClick={() => setStep('upload')} className="p-2 bg-black/20 backdrop-blur rounded-full hover:bg-black/30 transition-colors">
                      <X size={24} />
                  </button>
               </div>
               
               {/* Image Viewer */}
               <div className="flex-1 flex items-center justify-center p-6 bg-slate-900/50">
                  {originalImage && (
                    <img src={originalImage} alt="Preview" className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" />
                  )}
               </div>
  
               {/* Footer Actions */}
               <div className="p-6 pb-28 bg-slate-900 flex gap-6 justify-center items-center">
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
                      onClick={() => {
                        setCropScale(1);
                        setStep('crop');
                      }}
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
          <div className="fixed inset-0 z-50 flex flex-col bg-black touch-none">
              {/* Main Crop Area */}
              <div className="flex-1 relative flex items-center justify-center overflow-hidden w-full h-full p-8">
                  {/* Crop Container - DYNAMIC ASPECT RATIO */}
                  <div 
                    ref={cropContainerRef}
                    className="relative w-full max-w-sm bg-transparent touch-none z-10"
                    style={{ aspectRatio: `${imgAspectRatio}` }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                  >
                      {/* Masking/Border Overlay */}
                      <div className="absolute inset-0 border border-white/50 pointer-events-none z-20 shadow-[0_0_0_9999px_rgba(0,0,0,0.8)]">
                           {/* Corner Handles */}
                           <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white -mt-0.5 -ml-0.5"></div>
                           <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white -mt-0.5 -mr-0.5"></div>
                           <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white -mb-0.5 -ml-0.5"></div>
                           <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white -mb-0.5 -mr-0.5"></div>
                           
                           {/* Grid Lines */}
                           <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-30">
                              <div className="border-r border-b border-white"></div>
                              <div className="border-r border-b border-white"></div>
                              <div className="border-b border-white"></div>
                              <div className="border-r border-b border-white"></div>
                              <div className="border-r border-b border-white"></div>
                              <div className="border-b border-white"></div>
                              <div className="border-r border-white"></div>
                              <div className="border-r border-white"></div>
                           </div>
                      </div>

                      {originalImage && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible">
                            <img 
                                ref={imgRef}
                                src={originalImage} 
                                alt="Crop Target" 
                                className="max-w-none max-h-none pointer-events-none select-none origin-center"
                                style={{ 
                                    transform: `translate(${cropPos.x}px, ${cropPos.y}px) rotate(${rotation}deg) scale(${cropScale})`,
                                    // Scale image to COVER the container if scale=1, but we want it to be manipulatable.
                                    // Since our container matches aspect ratio now, width 100% and height 100% fits perfectly.
                                    width: '100%',
                                    height: '100%'
                                }}
                            />
                          </div>
                      )}
                  </div>
              </div>

              {/* Bottom Control Bar */}
              <div className="flex-none bg-zinc-900 pb-safe pt-6 px-6 pb-8">
                  <div className="max-w-md mx-auto">
                      <div className="flex items-center gap-6 mb-8 px-2">
                          <button 
                            onClick={() => setRotation(r => r + 90)}
                            className="p-2 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10"
                            title="Rotate"
                          >
                              <RotateCw size={22} />
                          </button>
                          
                          <div className="flex-1 flex items-center gap-3">
                              <ZoomIn size={16} className="text-white/50" />
                              <input 
                                type="range" 
                                min="1" 
                                max="3" 
                                step="0.05"
                                value={cropScale}
                                onChange={(e) => setCropScale(parseFloat(e.target.value))}
                                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
                              />
                          </div>
                      </div>

                      <div className="flex justify-between items-center">
                          <button 
                            onClick={cancelCrop}
                            className="text-white font-medium px-4 py-2 hover:bg-white/10 rounded-lg transition-colors"
                          >
                              Cancel
                          </button>
                          <button 
                            onClick={confirmCrop}
                            className="bg-[#07C160] text-white px-6 py-2 rounded-lg font-bold shadow-md active:scale-95 transition-transform hover:bg-[#06ad56]"
                          >
                              Done
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  if (step === 'analyzing') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-orange-50 p-6">
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
                        setCropScale(1);
                        setRotation(0);
                        setCropPos({x: 0, y: 0});
                        setStep('crop');
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
