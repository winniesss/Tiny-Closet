import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Upload, Loader2, X, ChevronLeft, ChevronRight, Trash2, Sparkles, ExternalLink, AlertTriangle, Search } from 'lucide-react';
import { analyzeClothingImage, findBetterItemImage } from '../services/geminiService';
import { db } from '../db';
import { ClothingItem, Category, Season } from '../types';
import clsx from 'clsx';

export const AddItem: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<'upload' | 'analyzing' | 'review'>('upload');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  const [reviewItems, setReviewItems] = useState<Partial<ClothingItem>[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [isSearchingImage, setIsSearchingImage] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [betterImageCandidate, setBetterImageCandidate] = useState<{imageUrl: string, sourceUrl: string} | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Update default search term when item changes
  useEffect(() => {
    setBetterImageCandidate(null);
    setSearchError(null);
    if (reviewItems[currentIndex]) {
        const item = reviewItems[currentIndex];
        // Clean up the search term to remove duplicates if description contains brand
        const parts = [
            item.brand && item.brand !== 'Unknown' ? item.brand : '',
            item.color || '',
            item.category || '', // Added category for better search (e.g. "Top", "Shoes")
            item.description || '',
            'kids'
        ];
        // Filter empty and join
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
    reader.readAsDataURL(file);
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
        return;
    }

    setIsSearchingImage(true);
    setBetterImageCandidate(null);
    setSearchError(null);

    const currentItem = reviewItems[currentIndex];

    try {
      // Pass both the search term and the current image (cropped or original) 
      // to help the AI find the exact visual match.
      const result = await findBetterItemImage(searchTerm, currentItem.image);
      
      if (result && result.imageUrl) {
        setBetterImageCandidate({
            imageUrl: result.imageUrl,
            sourceUrl: result.sourceUrl || ''
        });
      } else {
        setSearchError("Could not find a better image. Try adding more specific keywords.");
      }
    } catch (error) {
        setSearchError("Connection failed.");
    } finally {
        setIsSearchingImage(false);
    }
  };

  const applyBetterImage = () => {
    if (betterImageCandidate) {
      handleUpdateCurrentItem('image', betterImageCandidate.imageUrl);
      setBetterImageCandidate(null);
      setSearchError(null);
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
      <div className="h-screen flex flex-col bg-orange-50">
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-8">
          <div className="w-28 h-28 bg-white rounded-[2rem] shadow-lg flex items-center justify-center text-sky-500 mb-2 transform rotate-3">
            <Camera size={56} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-4xl text-slate-900 mb-3">Add Clothes</h1>
            <p className="text-slate-500 max-w-[250px] mx-auto text-lg leading-relaxed font-medium">
                Snap a photo or upload a screenshot.
            </p>
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
          
          <div className="w-full max-w-xs space-y-4">
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-sky-400 text-white font-bold py-5 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all text-lg"
            >
                Take Photo
            </button>
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-white text-slate-700 font-bold py-5 rounded-full shadow-sm hover:shadow-md transition-all text-lg"
            >
                Upload File
            </button>
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
        <p className="text-slate-500 font-bold">Working magic!</p>
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

            <button 
                onClick={handleFindBetterImage}
                disabled={isSearchingImage}
                className="w-full flex items-center justify-center gap-2 py-4 bg-sky-50 hover:bg-sky-100 text-sky-500 text-sm font-bold rounded-2xl transition-all disabled:opacity-50 border border-sky-100"
            >
                {isSearchingImage ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                {isSearchingImage ? 'Searching...' : 'Find Online Image'}
            </button>
            
            {searchError && (
              <div className="mt-3 p-3 bg-red-50 text-red-500 rounded-xl text-xs font-bold text-center">
                {searchError}
              </div>
            )}

            {betterImageCandidate && (
                <div className="mt-4 p-4 bg-white rounded-2xl shadow-lg border border-sky-100 animate-in fade-in slide-in-from-top-4">
                    <p className="text-xs font-bold text-pink-400 uppercase tracking-wider mb-3">Better match found</p>
                    <div className="flex gap-4 items-center">
                        <div className="w-20 h-20 shrink-0 bg-slate-50 rounded-xl p-2">
                            <img src={betterImageCandidate.imageUrl} alt="Found online" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <button 
                                onClick={applyBetterImage} 
                                className="w-full mb-2 bg-sky-400 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md hover:scale-105 transition"
                            >
                                Use This
                            </button>
                            {betterImageCandidate.sourceUrl && (
                                <a 
                                    href={betterImageCandidate.sourceUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 justify-center"
                                >
                                    Source <ExternalLink size={10}/>
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