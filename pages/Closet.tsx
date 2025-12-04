
import React, { useState, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Category, Season, ClothingItem, OutfitLike } from '../types';
import { Search, Archive, CheckCircle2, RotateCcw, Trash2, Calendar, Shirt, Sparkles, Smile, Tag, Filter, X, ChevronLeft } from 'lucide-react';
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
  const [actionItem, setActionItem] = useState<ClothingItem | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const items = useLiveQuery(() => db.items.toArray());
  const outfits = useLiveQuery(() => db.outfitLikes.reverse().toArray()); // Newest first

  // --- Filter Logic ---
  const filteredItems = useMemo(() => {
    if (!items) return [];

    const filtered = items.filter(item => {
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
            const itemBrand = (item.brand || 'Unknown').trim();
            if (filterBrand === 'No Brand') {
                if (itemBrand.toLowerCase() !== 'unknown') return false;
            } else {
                // Case-insensitive match
                if (itemBrand.toLowerCase() !== filterBrand.toLowerCase()) return false;
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

    // Sorting
    if (activeTab === 'Archive') {
        // Sort by archived date (Newest first)
        return filtered.sort((a, b) => (b.dateArchived || 0) - (a.dateArchived || 0));
    } else {
        // Sort by date added (Newest first)
        return filtered.sort((a, b) => b.dateAdded - a.dateAdded);
    }
  }, [items, activeTab, filterCategory, filterBrand, filterSeason, search]);

  // --- Extract Available Brands for Filter (Smart Grouping) ---
  const availableBrands = useMemo(() => {
      if (!items) return [];
      
      const contextItems = items.filter(i => {
          if (activeTab === 'Archive') return i.isArchived;
          if (activeTab === 'Closet') return !i.isArchived;
          return false;
      });
      
      const counts = new Map<string, number>();
      const displayNames = new Map<string, string>();
      let hasUnknown = false;

      contextItems.forEach(i => {
          if (i.brand && i.brand.trim() !== '' && i.brand !== 'Unknown') {
              const norm = i.brand.trim().toLowerCase();
              counts.set(norm, (counts.get(norm) || 0) + 1);
              if (!displayNames.has(norm)) displayNames.set(norm, i.brand.trim());
          } else {
              hasUnknown = true;
          }
      });

      const sortedEntries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
      const topBrands = sortedEntries.slice(0, 10).map(([key]) => displayNames.get(key) || key);

      if (hasUnknown) {
          topBrands.push('No Brand');
      }
      return topBrands;
  }, [items, activeTab]);

  const showNotification = (msg: string) => {
      setNotification(msg);
      setTimeout(() => setNotification(null), 3000);
  };

  const handleToggleArchive = async (item: ClothingItem) => {
      if (item.id) {
          const newState = !item.isArchived;
          const updates: any = { isArchived: newState };
          
          if (newState) {
              updates.dateArchived = Date.now();
              showNotification("Moved to Archive");
          } else {
              updates.dateArchived = undefined;
              showNotification("Restored to Closet");
          }
          
          await db.items.update(item.id, updates);
          
          // Close modal if item disappears from current view
          if (selectedItem?.id === item.id) {
              setSelectedItem(null);
          }
      }
  };

  const handleDeleteItem = async (item: ClothingItem) => {
      if (item.id) {
          if (window.confirm("Permanently delete this item?")) {
              await db.items.delete(item.id);
              showNotification("Item deleted");
              setActionItem(null);
              if (selectedItem?.id === item.id) setSelectedItem(null);
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

  const getOutfitImages = (outfit: OutfitLike) => {
      if (!items) return [];
      return outfit.itemIds
        .map(id => items.find(i => i.id === id))
        .filter(i => i !== undefined) as ClothingItem[];
  };

  const ItemCard: React.FC<{ item: ClothingItem }> = ({ item }) => {
      const timerRef = useRef<number | null>(null);
      const isLongPress = useRef(false);
      const longPressDuration = 600;

      const startPress = () => {
          isLongPress.current = false;
          timerRef.current = window.setTimeout(() => {
              isLongPress.current = true;
              if (navigator.vibrate) navigator.vibrate(50);
              setActionItem(item);
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
                {item.isArchived && item.dateArchived ? (
                    <p className="text-[10px] text-orange-400 font-bold uppercase truncate">
                        {new Date(item.dateArchived).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                ) : (
                    <p className="text-xs text-slate-400 font-bold uppercase truncate">{item.brand}</p>
                )}
            </div>
        </div>
      );
  };

  if (!items) {
      return (
          <div className="p-6 pb-28 max-w-md mx-auto min-h-screen bg-orange-50 animate-pulse">
             <div className="flex bg-slate-200 p-1.5 rounded-2xl shadow-sm mb-6 h-14"></div>
             <div className="h-8 w-48 bg-slate-200 rounded-lg mb-8"></div>
             <div className="h-12 bg-slate-200 rounded-2xl mb-8"></div>
             <div className="grid grid-cols-2 gap-4">
                 <div className="aspect-[3/4] bg-slate-200 rounded-[2rem]"></div>
                 <div className="aspect-[3/4] bg-slate-200 rounded-[2rem]"></div>
                 <div className="aspect-[3/4] bg-slate-200 rounded-[2rem]"></div>
                 <div className="aspect-[3/4] bg-slate-200 rounded-[2rem]"></div>
             </div>
          </div>
      );
  }

  return (
    <div className="p-6 pb-28 max-w-md mx-auto min-h-screen bg-orange-50">
      
      {activeTab !== 'Archive' ? (
        <div className="flex items-center gap-3 mb-6 sticky top-2 z-40">
            <div className="flex-1 flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100">
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
            </div>

            <button 
                onClick={() => setActiveTab('Archive')}
                className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 text-slate-400 hover:text-slate-600 active:scale-95 transition-all"
                title="Open Archive"
            >
                <Archive size={20} />
            </button>
        </div>
      ) : (
         <div className="flex justify-between items-center mb-6 sticky top-2 z-40 bg-orange-50/95 backdrop-blur py-2">
              <div className="flex items-center gap-2">
                   <button 
                        onClick={() => setActiveTab('Closet')}
                        className="p-2 bg-white text-slate-800 rounded-full shadow-sm hover:bg-slate-50 transition-colors"
                   >
                       <ChevronLeft size={24} />
                   </button>
                   <h1 className="text-2xl text-slate-800 font-serif">The Archive</h1>
              </div>
              <span className="text-sm font-bold text-slate-400 bg-white px-3 py-1 rounded-full shadow-sm border border-slate-100">
                  {filteredItems?.length || 0} Items
              </span>
         </div>
      )}

      {activeTab === 'Lookbook' ? (
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
                             
                             <div className="flex gap-2 h-40">
                                 {outfitItems.map((item, idx) => (
                                     <div 
                                        key={item.id} 
                                        className={clsx(
                                            "rounded-2xl overflow-hidden bg-orange-50 border border-slate-100 relative",
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
        <div className="animate-in fade-in slide-in-from-bottom-2">
            
            {activeTab !== 'Archive' && (
                <div className="flex justify-between items-baseline mb-6">
                    <h1 className="text-3xl text-slate-800 font-serif">The Closet</h1>
                    <span className="text-sm font-bold text-slate-400 bg-white px-3 py-1 rounded-full shadow-sm">
                        {filteredItems?.length || 0} Items
                    </span>
                </div>
            )}

            <div className="space-y-4 mb-8">
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

                {items && items.length > 0 && availableBrands.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 px-1 text-slate-400 text-xs font-bold uppercase tracking-wider">
                            <Tag size={12} />
                            <span>Top Brands</span>
                        </div>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-6 px-6">
                            <button
                                onClick={() => setFilterBrand('All')}
                                className={clsx(
                                    "whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
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
                                        "whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
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

      {actionItem && (
        <div 
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" 
            onClick={() => setActionItem(null)}
        >
            <div 
                className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl scale-100 animate-in zoom-in-95" 
                onClick={e => e.stopPropagation()}
            >
                <div className="text-center mb-6">
                    <h3 className="text-xl font-serif text-slate-800 mb-2">Manage Item</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Choose Action</p>
                </div>

                <div className="flex gap-4 items-center mb-8 bg-slate-50 p-3 rounded-2xl">
                    <img src={actionItem.image} className="w-14 h-14 rounded-xl object-cover border border-slate-100 shadow-sm bg-white" />
                    <div className="overflow-hidden">
                        <p className="font-bold text-slate-700 truncate">{actionItem.description || actionItem.category}</p>
                        <p className="text-xs text-slate-400 font-bold uppercase">{actionItem.brand || 'No Brand'}</p>
                    </div>
                </div>
                
                <div className="space-y-3">
                    <button 
                        onClick={() => {
                            handleToggleArchive(actionItem);
                            setActionItem(null);
                        }}
                        className="w-full py-4 bg-sky-50 text-sky-600 font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-sky-100 transition-colors"
                    >
                        {actionItem.isArchived ? <RotateCcw size={20} /> : <Archive size={20} />}
                        {actionItem.isArchived ? "Restore to Closet" : "Archive Item"}
                    </button>

                    <button 
                        onClick={() => {
                            handleDeleteItem(actionItem);
                        }}
                        className="w-full py-4 bg-red-50 text-red-500 font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-red-100 transition-colors"
                    >
                        <Trash2 size={20} /> Delete Permanently
                    </button>
                </div>
                 <button 
                    onClick={() => setActionItem(null)}
                    className="mt-6 w-full py-3 text-slate-400 font-bold text-sm hover:text-slate-600"
                >
                    Cancel
                </button>
            </div>
        </div>
      )}

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
