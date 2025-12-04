
import React, { useState, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Category, Season, ClothingItem, OutfitLike } from '../types';
import { Search, Archive, CheckCircle2, RotateCcw, Trash2, Calendar, Shirt, Sparkles, Smile, Tag, Filter } from 'lucide-react';
import { ItemDetailModal } from '../components/ItemDetailModal';
import clsx from 'clsx';

export const Closet: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'Closet' | 'Lookbook' | 'Archive'>('Closet');
  const [filterCategory, setFilterCategory] = useState<Category | 'All'>('All');
  const [filterSeason, setFilterSeason] = useState<Season | 'All'>('All');
  const [filterBrand, setFilterBrand] = useState<string | 'All'>('All');
  const [search, setSearch] = useState('');
  
  // Interaction State
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const items = useLiveQuery(() => db.items.toArray());
  const outfits = useLiveQuery(() => db.outfitLikes.reverse().toArray()); // Newest first

  // --- Filter Logic ---
  const filteredItems = useMemo(() => {
    if (!items) return [];

    return items.filter(item => {
        // Tab Filter: Closet vs Archive
        if (activeTab === 'Archive') {
            if (!item.isArchived) return false;
        } else if (activeTab === 'Closet') {
            if (item.isArchived) return false;
        } else {
            return false; // Lookbook handles its own data
        }

        // Category Filter
        if (filterCategory !== 'All' && item.category !== filterCategory) {
            return false;
        }

        // Brand Filter
        if (filterBrand !== 'All') {
            const itemBrand = item.brand || 'Unknown';
            if (filterBrand === 'No Brand') {
                if (itemBrand !== 'Unknown') return false;
            } else {
                if (itemBrand !== filterBrand) return false;
            }
        }

        // Season Filter
        if (filterSeason !== 'All') {
            const matchesSeason = item.seasons.includes(filterSeason) || item.seasons.includes(Season.All);
            if (!matchesSeason) return false;
        }

        // Search Filter
        if (search.trim()) {
            const q = search.toLowerCase();
            const matchesSearch = 
                (item.brand || '').toLowerCase().includes(q) ||
                (item.description || '').toLowerCase().includes(q) ||
                (item.color || '').toLowerCase().includes(q);
            if (!matchesSearch) return false;
        }

        return true;
    });
  }, [items, activeTab, filterCategory, filterBrand, filterSeason, search]);

  // --- Extract Available Brands for Filter ---
  const availableBrands = useMemo(() => {
      if (!items) return [];
      // Get items relevant to the current tab (Closet or Archive)
      const contextItems = items.filter(i => {
          if (activeTab === 'Archive') return i.isArchived;
          if (activeTab === 'Closet') return !i.isArchived;
          return false;
      });
      
      const brands = new Set<string>();
      let hasUnknown = false;

      contextItems.forEach(i => {
          if (i.brand && i.brand !== 'Unknown') {
              brands.add(i.brand);
          } else {
              hasUnknown = true;
          }
      });

      const sortedBrands = Array.from(brands).sort();
      if (hasUnknown && sortedBrands.length > 0) {
          sortedBrands.push('No Brand');
      }
      return sortedBrands;
  }, [items, activeTab]);

  const showNotification = (msg: string) => {
      setNotification(msg);
      setTimeout(() => setNotification(null), 3000);
  };

  const handleToggleArchive = async (item: ClothingItem) => {
      if (item.id) {
          const newState = !item.isArchived;
          await db.items.update(item.id, { isArchived: newState });
          
          if (newState) {
              showNotification("Moved to Archive");
          } else {
              showNotification("Restored to Closet");
          }
          
          // Close modal if item disappears from current view
          if (selectedItem?.id === item.id) {
              setSelectedItem(null);
          }
      }
  };

  const handleDeleteOutfit = async (id?: number) => {
      if (id) {
          if (window.confirm("Delete this look?")) {
              await db.outfitLikes.delete(id);
              showNotification("Look deleted");
          }
      }
  };

  // --- Helper to get images for an outfit ---
  const getOutfitImages = (outfit: OutfitLike) => {
      if (!items) return [];
      // Map IDs to items, filter out if item was deleted
      return outfit.itemIds
        .map(id => items.find(i => i.id === id))
        .filter(i => i !== undefined) as ClothingItem[];
  };

  // --- Long Press Logic ---
  const ItemCard: React.FC<{ item: ClothingItem }> = ({ item }) => {
      const timerRef = useRef<number | null>(null);
      const isLongPress = useRef(false);
      const longPressDuration = 600;

      const startPress = () => {
          isLongPress.current = false;
          timerRef.current = window.setTimeout(() => {
              isLongPress.current = true;
              if (navigator.vibrate) navigator.vibrate(50);
              handleToggleArchive(item);
          }, longPressDuration);
      };

      const endPress = (e: React.MouseEvent | React.TouchEvent) => {
          if (timerRef.current !== null) {
              window.clearTimeout(timerRef.current);
              timerRef.current = null;
          }
          
          if (isLongPress.current) {
              e.preventDefault();
              e.stopPropagation();
          }
      };

      const handleClick = () => {
          if (!isLongPress.current) {
              setSelectedItem(item);
          }
      };

      return (
        <div 
            onMouseDown={startPress}
            onMouseUp={endPress}
            onMouseLeave={endPress}
            onTouchStart={startPress}
            onTouchEnd={endPress}
            onClick={handleClick}
            onContextMenu={(e) => e.preventDefault()}
            className="group relative bg-white rounded-[2rem] p-3 shadow-sm border border-slate-50 transition-transform active:scale-95 cursor-pointer select-none"
        >
            <div className="w-full aspect-[3/4] overflow-hidden rounded-[1.5rem] bg-orange-50 relative mb-3">
                <img src={item.image} alt={item.description} className="w-full h-full object-cover pointer-events-none" />
                
                {item.isArchived && (
                    <div className="absolute inset-0 bg-slate-900/10 flex items-center justify-center">
                         <div className="bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold shadow-sm text-slate-600 flex items-center gap-1">
                             <Archive size={12} /> Archived
                         </div>
                    </div>
                )}
            </div>
            <div className="px-1 pointer-events-none">
                <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-slate-800 leading-tight text-sm line-clamp-1">{item.category}</h3>
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">{item.sizeLabel}</span>
                </div>
                <p className="text-xs text-slate-400 font-bold uppercase truncate">{item.brand}</p>
            </div>
        </div>
      );
  };

  return (
    <div className="p-6 pb-28 max-w-md mx-auto min-h-screen bg-orange-50">
      
      {/* Top Navigation Tabs */}
      <div className="flex bg-white p-1.5 rounded-2xl shadow-sm mb-6 sticky top-2 z-40 border border-slate-100">
        <button 
            onClick={() => setActiveTab('Closet')}
            className={clsx(
                "flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                activeTab === 'Closet' ? "bg-orange-400 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
        >
            <Shirt size={16} /> Closet
        </button>
        <button 
            onClick={() => setActiveTab('Lookbook')}
            className={clsx(
                "flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                activeTab === 'Lookbook' ? "bg-sky-400 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
        >
            <Sparkles size={16} /> Lookbook
        </button>
        <button 
            onClick={() => setActiveTab('Archive')}
            className={clsx(
                "flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                activeTab === 'Archive' ? "bg-slate-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
        >
            <Archive size={16} /> Archive
        </button>
      </div>

      {activeTab === 'Lookbook' ? (
        // --- LOOKBOOK VIEW ---
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
             <div className="flex justify-between items-baseline mb-2">
                <h1 className="text-3xl text-slate-800 font-serif">Saved Looks</h1>
                <span className="text-sm font-bold text-slate-400">{outfits?.length || 0} Outfits</span>
             </div>

             {!outfits || outfits.length === 0 ? (
                 <div className="text-center py-12 opacity-50">
                     <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                         <Sparkles size={24} />
                     </div>
                     <p className="font-bold text-slate-500">No saved outfits yet.</p>
                     <p className="text-xs">Create looks in the Dashboard!</p>
                 </div>
             ) : (
                 outfits.map(outfit => {
                     const outfitItems = getOutfitImages(outfit);
                     if (outfitItems.length === 0) return null;

                     return (
                         <div key={outfit.id} className="bg-white rounded-[2.5rem] p-5 shadow-sm border border-slate-50 relative group">
                             <div className="flex justify-between items-center mb-4">
                                 <div className="flex items-center gap-2">
                                     <span className={clsx(
                                         "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1",
                                         outfit.style === 'playful' ? "bg-orange-100 text-orange-600" : "bg-sky-100 text-sky-600"
                                     )}>
                                         {outfit.style === 'playful' ? <Smile size={12}/> : <Sparkles size={12}/>}
                                         {outfit.style}
                                     </span>
                                     <span className="text-xs text-slate-300 font-bold flex items-center gap-1">
                                         <Calendar size={12} />
                                         {new Date(outfit.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                     </span>
                                 </div>
                                 <button 
                                    onClick={() => handleDeleteOutfit(outfit.id)}
                                    className="p-2 text-slate-300 hover:text-red-400 transition-colors"
                                 >
                                     <Trash2 size={16} />
                                 </button>
                             </div>
                             
                             {/* Outfit Collage Grid */}
                             <div className="flex gap-2 h-40">
                                 {outfitItems.map((item, idx) => (
                                     <div 
                                        key={item.id} 
                                        className={clsx(
                                            "rounded-2xl overflow-hidden bg-orange-50 border border-slate-100 relative",
                                            // Dynamic sizing based on item count
                                            outfitItems.length === 1 ? "w-full" : 
                                            outfitItems.length === 2 ? "w-1/2" :
                                            idx === 0 ? "w-1/2" : "w-1/4"
                                        )}
                                        onClick={() => setSelectedItem(item)}
                                     >
                                         <img src={item.image} className="w-full h-full object-cover" />
                                     </div>
                                 ))}
                             </div>
                         </div>
                     );
                 })
             )}
        </div>
      ) : (
        // --- INVENTORY / ARCHIVE VIEW ---
        <div className="animate-in fade-in slide-in-from-bottom-2">
            <div className="flex justify-between items-baseline mb-6">
                <h1 className="text-3xl text-slate-800 font-serif">
                    {activeTab === 'Archive' ? 'The Archive' : 'The Closet'}
                </h1>
                <span className="text-sm font-bold text-slate-400 bg-white px-3 py-1 rounded-full shadow-sm">
                    {filteredItems?.length || 0} Items
                </span>
            </div>

            {/* Controls */}
            <div className="space-y-4 mb-8">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                    type="text" 
                    placeholder={activeTab === 'Archive' ? "Search archived..." : "Search items, brands..."} 
                    className="w-full pl-12 pr-4 py-4 bg-slate-100 rounded-2xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-sky-200 transition-all border-none"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* Categories */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-6 px-6">
                    <button
                        onClick={() => setFilterCategory('All')}
                        className={clsx(
                            "whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-sm border border-transparent",
                            filterCategory === 'All' 
                                ? "bg-sky-400 text-white shadow-md" 
                                : "bg-white text-slate-500 hover:bg-slate-50"
                        )}
                    >
                        All
                    </button>
                    {Object.values(Category).map(cat => (
                        <button
                            key={cat}
                            onClick={() => setFilterCategory(cat)}
                            className={clsx(
                                "whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-sm border border-transparent",
                                filterCategory === cat
                                    ? "bg-sky-400 text-white shadow-md" 
                                    : "bg-white text-slate-500 hover:bg-slate-50"
                            )}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Brands Filter - Improved Visibility */}
                {items && items.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 px-1 text-slate-400 text-xs font-bold uppercase tracking-wider">
                            <Tag size={12} />
                            <span>Filter by Brand</span>
                        </div>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-6 px-6">
                            <button
                                onClick={() => setFilterBrand('All')}
                                className={clsx(
                                    "whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                                    filterBrand === 'All'
                                        ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                                )}
                            >
                                All
                            </button>
                            {availableBrands.map(brand => (
                                <button
                                    key={brand}
                                    onClick={() => setFilterBrand(brand)}
                                    className={clsx(
                                        "whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                                        filterBrand === brand
                                            ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                                            : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                                    )}
                                >
                                    {brand}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 gap-4">
                {filteredItems && filteredItems.length > 0 ? (
                    filteredItems.map((item) => (
                        <ItemCard key={item.id} item={item} />
                    ))
                ) : (
                    <div className="col-span-2 py-16 text-center opacity-50">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                            {activeTab === 'Archive' ? <Archive size={24} /> : <Shirt size={24} />}
                        </div>
                        <p className="text-lg font-bold text-slate-400 mb-2">
                            {activeTab === 'Archive' ? 'Archive is empty' : 'No items found'}
                        </p>
                        <button 
                            onClick={() => {
                                setFilterCategory('All');
                                setFilterBrand('All');
                                setFilterSeason('All');
                                setSearch('');
                            }}
                            className="text-sky-400 text-sm font-bold hover:underline"
                        >
                            Clear Filters
                        </button>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-800/90 backdrop-blur text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-8 z-[70]">
              <CheckCircle2 className="text-green-400" size={20} />
              <span className="font-bold text-sm">{notification}</span>
          </div>
      )}

      <ItemDetailModal 
        item={selectedItem} 
        onClose={() => setSelectedItem(null)} 
        onToggleArchive={handleToggleArchive}
      />
    </div>
  );
};
