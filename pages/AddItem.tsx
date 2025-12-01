import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Loader2, X, ChevronLeft, ChevronRight, Trash2, Sparkles, ExternalLink, AlertTriangle, Search, FileText, ImageOff, Link as LinkIcon, Check, Crop as CropIcon, ZoomIn, Move, ArrowLeft } from 'lucide-react';
import { analyzeClothingImage, findBetterItemImage } from '../services/geminiService';
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
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);

  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<Partial<ClothingItem>[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Search/Better Image States
  const [isSearchingImage, setIsSearchingImage] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchSuggestion, setSearchSuggestion] = useState<string | null>(null);
  const [betterImageCandidate, setBetterImageCandidate] = useState<{imageUrl: string, sourceUrl: string} | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPasteUrl, setShowPasteUrl] = useState(false);
  const [manualUrl, setManualUrl] = useState('');

  // Update default search term when item changes
  useEffect(() => {
    setBetterImageCandidate(null);
    setSearchError(null);
    setSearchSuggestion(null);
    setImageLoadError(false);
    setShowPasteUrl(false);
    setManualUrl('');
    
    if (reviewItems[currentIndex]) {
        const item = reviewItems[currentIndex];
        const parts = [
            item.brand && item.brand !== 'Unknown' ? item.brand : '',
            item.color || '',
            item.category || '', 
            item.description || '',
            'kids'
        ];
        const term = parts.filter(p => p).join(' ').trim();
        setSearchTerm(term);
    }
  }, [currentIndex, reviewItems]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setOriginalImage(base64);
      setCropScale(1);
      setCropPos({ x: 0, y: 0 });
      setStep('preview');
      
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
    
    // Apply user transforms
    ctx.translate(cropPos.x, cropPos.y);
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
    startAnalysis(croppedBase64);
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

  const handleFindBetterImage = async () => {
    if (!searchTerm.trim()) {
        setSearchError("Please enter keywords to search.");
        setSearchSuggestion("Type a brand and item type, e.g. 'Zara Kids Blue Shirt'");
        return;
    }

    setIsSearchingImage(true);
    setBetterImageCandidate(null);
    setSearchError(null);
    setSearchSuggestion(null);
    setImageLoadError(false);

    const currentItem = reviewItems[currentIndex];

    try {
      const result = await findBetterItemImage(searchTerm, currentItem.image);
      
      if (result.success && result.data) {
        setBetterImageCandidate({
            imageUrl: result.data.imageUrl,
            sourceUrl: result.data.sourceUrl || ''
        });
      } else {
        setSearchError(result.error || "Search failed.");
        setSearchSuggestion(result.suggestion || "Try different keywords.");
      }
    } catch (error) {
        setSearchError("Search service unavailable.");
        setSearchSuggestion("Please check your internet connection.");
    } finally {
        setIsSearchingImage(false);
    }
  };

  const applyBetterImage = () => {
    if (betterImageCandidate && !imageLoadError && betterImageCandidate.imageUrl) {
      handleUpdateCurrentItem('image', betterImageCandidate.imageUrl);
      setBetterImageCandidate(null);
      setSearchError(null);
      setSearchSuggestion(null);
    }
  };

  const applyManualUrl = () => {
      if (!manualUrl.trim()) return;
      if (betterImageCandidate) {
          setBetterImageCandidate({
              ...betterImageCandidate,
              imageUrl: manualUrl
          });
          setImageLoadError(false);
      } else {
          handleUpdateCurrentItem('image', manualUrl);
      }
      setShowPasteUrl(false);
      setManualUrl('');
  };
  
  const openGoogleSearch = () => {
      const q = encodeURIComponent(searchTerm);
      window.open(`https://www.google.com/search?tbm=isch&q=${q}`, '_blank');
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
      <div className="h-screen flex flex-col bg-orange-50 relative">
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
                <FileText size={24} /> Upload Order / File
            </button>
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
               <div className="p-6 pb-12 bg-slate-900 flex gap-4 justify-center items-center">
                   <button 
                      onClick={() => setStep('crop')}
                      className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition-colors p-4"
                   >
                      <CropIcon size={24} />
                      <span className="text-xs font-bold">Crop</span>
                   </button>
  
                   <button 
                      onClick={() => startAnalysis(originalImage!)}
                      className="flex-1 bg-sky-400 text-white font-bold py-4 rounded-full shadow-lg hover:bg-sky-500 transition-all flex items-center justify-center gap-2"
                   >
                      <Sparkles size={20} /> Analyze
                   </button>
               </div>
          </div>
      );
  }

  if (step === 'crop') {
      return (
          <div className="h-screen flex flex-col bg-slate-900 overflow-hidden touch-none">
              <div className="flex-none p-4 flex justify-between items-center bg-slate-900 z-10">
                  <button 
                    onClick={() => setStep('preview')}
                    className="p-2 text-white/70 hover:text-white"
                  >
                      <ArrowLeft size={24} />
                  </button>
                  <h1 className="text-white font-bold">Adjust Photo</h1>
                  <button 
                    onClick={confirmCrop}
                    className="p-2 text-sky-400 font-bold hover:text-sky-300"
                  >
                      Next
                  </button>
              </div>

              <div className="flex-1 relative flex items-center justify-center p-6">
                  {/* Crop Container - 3:4 Aspect Ratio */}
                  <div 
                    ref={cropContainerRef}
                    className="relative w-full max-w-sm aspect-[3/4] bg-slate-800 overflow-hidden rounded-2xl shadow-2xl border-2 border-white/20 touch-none"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                  >
                      {originalImage && (
                          <div className="w-full h-full flex items-center justify-center pointer-events-none">
                            <img 
                                ref={imgRef}
                                src={originalImage} 
                                alt="Crop Target" 
                                className="max-w-full max-h-full object-contain pointer-events-none select-none transition-transform duration-75 ease-out"
                                style={{ 
                                    transform: `translate(${cropPos.x}px, ${cropPos.y}px) scale(${cropScale})` 
                                }}
                            />
                          </div>
                      )}
                      
                      {/* Guide Overlay */}
                      <div className="absolute inset-0 pointer-events-none border border-white/30 grid grid-cols-3 grid-rows-3">
                          <div className="border-r border-b border-white/10"></div>
                          <div className="border-r border-b border-white/10"></div>
                          <div className="border-b border-white/10"></div>
                          <div className="border-r border-b border-white/10"></div>
                          <div className="border-r border-b border-white/10"></div>
                          <div className="border-b border-white/10"></div>
                          <div className="border-r border-white/10"></div>
                          <div className="border-r border-white/10"></div>
                          <div></div>
                      </div>
                  </div>
              </div>

              <div className="flex-none bg-slate-900 p-6 pb-12">
                  <div className="max-w-xs mx-auto space-y-4">
                      <div className="flex items-center gap-4 text-white/50">
                          <ZoomIn size={16} />
                          <input 
                            type="range" 
                            min="1" 
                            max="3" 
                            step="0.05"
                            value={cropScale}
                            onChange={(e) => setCropScale(parseFloat(e.target.value))}
                            className="w-full accent-sky-400 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                          />
                      </div>
                      <div className="flex justify-center">
                          <p className="text-xs text-white/40 flex items-center gap-2">
                              <Move size={12} /> Drag to position
                          </p>
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
           <div className="w-full aspect-square rounded-[2rem] overflow-hidden">
                {currentItem.image ? (
                    <img src={currentItem.image} alt="Preview" className="w-full h-full object-contain" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold">No Image</div>
                )}
           </div>
           
           <button 
             onClick={handleDeleteCurrent}
             className="absolute top-6 right-6 p-3 bg-white/90 backdrop-blur rounded-xl text-slate-400 hover:text-red-500 shadow-sm transition-colors"
           >
             <Trash2 size={20} />
           </button>
        </div>

        <div>
            <div className="mb-2">
                <label className="block text-xs font-bold text-slate-400 mb-2 ml-1">Search Keywords</label>
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input 
                        type="text" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white rounded-xl text-sm font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-200 shadow-sm border border-slate-50"
                        placeholder="e.g. Zara Blue Dino Shirt"
                    />
                </div>
            </div>
            
            <div className="flex gap-2">
                <button 
                    onClick={handleFindBetterImage}
                    disabled={isSearchingImage}
                    className="flex-1 flex items-center justify-center gap-2 py-4 bg-sky-50 hover:bg-sky-100 text-sky-500 text-sm font-bold rounded-2xl transition-all disabled:opacity-50 border border-sky-100"
                >
                    {isSearchingImage ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                    {isSearchingImage ? 'Searching...' : 'Find Online'}
                </button>
                <button 
                    onClick={() => setShowPasteUrl(!showPasteUrl)}
                    className={clsx(
                        "flex-none px-4 flex items-center justify-center rounded-2xl border transition-all",
                        showPasteUrl 
                            ? "bg-sky-100 border-sky-200 text-sky-500" 
                            : "bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-600 border-slate-100"
                    )}
                    title="Paste URL"
                >
                    <LinkIcon size={18} />
                </button>
                <button 
                    onClick={openGoogleSearch}
                    className="flex-none px-4 flex items-center justify-center bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-2xl border border-slate-100 transition-all"
                    title="Open Google Search"
                >
                    <ExternalLink size={18} />
                </button>
            </div>

            {showPasteUrl && (
                <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex gap-2">
                        <input 
                            type="text"
                            value={manualUrl}
                            onChange={(e) => setManualUrl(e.target.value)}
                            placeholder="Paste exact image address here..."
                            className="flex-1 px-4 py-3 bg-white rounded-xl text-sm font-medium border border-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-200"
                        />
                        <button 
                            onClick={applyManualUrl}
                            className="px-4 py-2 bg-slate-800 text-white font-bold text-sm rounded-xl hover:bg-slate-700"
                        >
                            Use
                        </button>
                    </div>
                </div>
            )}
            
            {searchError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-2xl animate-in fade-in slide-in-from-top-2">
                <div className="flex items-start gap-3">
                    <div className="bg-white p-2 rounded-full text-red-400 shrink-0 shadow-sm">
                        <AlertTriangle size={18} />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-bold text-red-600 mb-1">{searchError}</p>
                        {searchSuggestion && (
                            <p className="text-xs text-red-500 font-medium">
                                💡 {searchSuggestion}
                            </p>
                        )}
                    </div>
                </div>
              </div>
            )}

            {betterImageCandidate && (
                <div className="mt-4 p-4 bg-white rounded-2xl shadow-lg border border-sky-100 animate-in fade-in slide-in-from-top-4">
                    <p className="text-xs font-bold text-pink-400 uppercase tracking-wider mb-3">
                        {imageLoadError || !betterImageCandidate.imageUrl 
                            ? "Found source, but image blocked" 
                            : "Better match found"}
                    </p>
                    <div className="flex gap-4 items-start">
                        <div className="w-20 h-20 shrink-0 bg-slate-50 rounded-xl p-2 flex items-center justify-center overflow-hidden border border-slate-100">
                            {betterImageCandidate.imageUrl && !imageLoadError ? (
                                <img 
                                    src={betterImageCandidate.imageUrl} 
                                    alt="Found online" 
                                    className="w-full h-full object-contain" 
                                    onError={() => setImageLoadError(true)}
                                />
                            ) : (
                                <ImageOff className="text-slate-300" size={24} />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            {(!imageLoadError && betterImageCandidate.imageUrl) ? (
                                <button 
                                    onClick={applyBetterImage} 
                                    className="w-full mb-2 bg-sky-400 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md hover:scale-105 transition flex items-center justify-center gap-2"
                                >
                                    <Check size={16} /> Use This
                                </button>
                            ) : (
                                <div className="space-y-2">
                                    <button 
                                        onClick={openGoogleSearch}
                                        className="w-full bg-white text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm hover:bg-slate-50 transition flex items-center justify-center gap-2"
                                    >
                                        <Search size={14} /> Search Google
                                    </button>
                                    
                                    {/* Inline Paste Fallback - Only shown when image is blocked/missing */}
                                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 mb-1 ml-1 uppercase">Paste Image Address:</p>
                                        <div className="flex gap-1">
                                            <input 
                                                type="text"
                                                value={manualUrl}
                                                onChange={(e) => setManualUrl(e.target.value)}
                                                placeholder="https://..."
                                                className="flex-1 px-2 py-1.5 bg-white rounded-lg text-xs font-medium border border-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-200"
                                            />
                                            <button 
                                                onClick={applyManualUrl}
                                                className="px-3 py-1.5 bg-slate-800 text-white font-bold text-xs rounded-lg hover:bg-slate-700"
                                            >
                                                Apply
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {betterImageCandidate.sourceUrl && !imageLoadError && (
                                <a 
                                    href={betterImageCandidate.sourceUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="block mt-2 text-center text-[10px] text-slate-400 hover:text-slate-600"
                                >
                                    Visit Source Page <ExternalLink size={10} className="inline"/>
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}
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