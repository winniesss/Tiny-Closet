
import React, { useState, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Category, Season, ClothingItem, OutfitLike } from '../types';
import { Search, Archive, CheckCircle2, RotateCcw, Trash2, Calendar, Shirt, Sparkles, Smile, Tag, Filter, X, ChevronLeft, CheckSquare, Square, ShoppingBag } from 'lucide-react';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { ShopInspo } from '../components/ShopInspo';
import { useActiveChild } from '../hooks/useActiveChild';
import clsx from 'clsx';

export const Closet: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'Closet' | 'Lookbook' | 'Inspo' | 'Archive'>('Closet');
  const [filterCategory, setFilterCategory] = useState<Category | 'All'>('All');
  const [filterSeason, setFilterSeason] = useState<Season | 'All'>('All');
  const [filterBrand, setFilterBrand] = useState<string | 'All'>('All');
  const [search, setSearch] = useState('');
  
  // Interaction State
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  const [actionItem, setActionItem] = useState<ClothingItem | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Batch Select State
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { activeChildId } = useActiveChild();
  const allDbItems = useLiveQuery(() => db.items.toArray());
  const allDbOutfits = useLiveQuery(() => db.outfitLikes.reverse().toArray()); // Newest first

  // Filter by active child
  const items = allDbItems?.filter(item => {
    if (!activeChildId) return true;
    return !item.profileId || item.profileId === activeChildId;
  });
  const outfits = allDbOutfits?.filter(o => {
    if (!activeChildId) return true;
    return !o.profileId || o.profileId === activeChildId;
  });

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

  const exitSelectMode = () => {
      setIsSelectMode(false);
      setSelectedIds(new Set());
  };

  const toggleSelectId = (id: number) => {
      setSelectedIds(prev => {
          const next = new Set(prev);
          if (next.has(id)) {
              next.delete(id);
          } else {
              next.add(id);
          }
          return next;
      });
  };

  const handleSelectAll = () => {
      if (!filteredItems) return;
      const allIds = filteredItems.map(i => i.id).filter((id): id is number => id !== undefined);
      if (selectedIds.size === allIds.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(allIds));
      }
  };

  const handleBatchArchive = async () => {
      if (selectedIds.size === 0) return;
      const isArchiveTab = activeTab === 'Archive';

      for (const id of selectedIds) {
          const item = items?.find(i => i.id === id);
          if (item) {
              const newState = !item.isArchived;
              const updates: any = { isArchived: newState };
              if (newState) {
                  updates.dateArchived = Date.now();
              } else {
                  updates.dateArchived = undefined;
              }
              await db.items.update(id, updates);
          }
      }

      const count = selectedIds.size;
      showNotification(`${count} item${count > 1 ? 's' : ''} ${isArchiveTab ? 'restored' : 'archived'}`);
      exitSelectMode();
  };

  const handleBatchDelete = async () => {
      if (selectedIds.size === 0) return;
      const count = selectedIds.size;
      if (!window.confirm(`Permanently delete ${count} item${count > 1 ? 's' : ''}?`)) return;

      for (const id of selectedIds) {
          await db.items.delete(id);
      }

      showNotification(`${count} item${count > 1 ? 's' : ''} deleted`);
      exitSelectMode();
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
      const isSelected = item.id !== undefined && selectedIds.has(item.id);

      const startPress = () => {
          if (isSelectMode) return;
          isLongPress.current = false;
          timerRef.current = window.setTimeout(() => {
              isLongPress.current = true;
              if (navigator.vibrate) navigator.vibrate(50);
              setActionItem(item);
          }, longPressDuration);
      };

      const endPress = (e: React.MouseEvent | React.TouchEvent) => {
          if (isSelectMode) return;
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
          if (isSelectMode) {
              if (item.id !== undefined) toggleSelectId(item.id);
              return;
          }
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
            className={clsx(
                "group relative bg-white rounded-[2rem] p-3 shadow-sm border transition-transform active:scale-95 cursor-pointer select-none",
                isSelectMode && isSelected ? "border-sky-400 ring-2 ring-sky-200" : "border-slate-50"
            )}
        >
            <div className="w-full aspect-[3/4] overflow-hidden rounded-[1.5rem] bg-orange-50 relative mb-3">
                <img src={item.image} alt={item.description} className="w-full h-full object-cover pointer-events-none" />

                {item.isArchived && !isSelectMode && (
                    <div className="absolute inset-0 bg-slate-900/10 flex items-center justify-center">
                         <div className="bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold shadow-sm text-slate-600 flex items-center gap-1">
                             <Archive size={12} /> Archived
                         </div>
                    </div>
                )}

                {isSelectMode && (
                    <div className="absolute top-2 right-2 z-10">
                        <div className={clsx(
                            "w-7 h-7 rounded-lg flex items-center justify-center shadow-md transition-colors",
                            isSelected ? "bg-sky-400 text-white" : "bg-white/90 backdrop-blur text-slate-300 border border-slate-200"
                        )}>
                            {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
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
          <div className="p-6 pb-4 max-w-md mx-auto min-h-screen bg-orange-50 animate-pulse">
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
    <div className={clsx("max-w-md mx-auto min-h-screen bg-orange-50", isSelectMode ? "pb-44" : "pb-4")}>

      {activeTab !== 'Archive' ? (
        <div className="flex items-center gap-3 mb-6 sticky top-0 z-40 bg-orange-50 pt-6 pb-3 px-6 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)]">
            <div className="flex-1 flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100">
                <button
                    onClick={() => { exitSelectMode(); setActiveTab('Closet'); }}
                    className={clsx(
                        "flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                        activeTab === 'Closet' ? "bg-orange-400 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                >
                    <Shirt size={16} /> Closet
                </button>
                <button
                    onClick={() => { exitSelectMode(); setActiveTab('Lookbook'); }}
                    className={clsx(
                        "flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                        activeTab === 'Lookbook' ? "bg-sky-400 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                >
                    <Sparkles size={16} /> Looks
                </button>
                <button
                    onClick={() => { exitSelectMode(); setActiveTab('Inspo'); }}
                    className={clsx(
                        "flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                        activeTab === 'Inspo' ? "bg-pink-400 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                >
                    <ShoppingBag size={16} /> Inspo
                </button>
            </div>

            <button
                onClick={() => { exitSelectMode(); setActiveTab('Archive'); }}
                className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 text-slate-400 hover:text-slate-600 active:scale-95 transition-all"
                title="Open Archive"
            >
                <Archive size={20} />
            </button>
        </div>
      ) : (
         <div className="flex justify-between items-center mb-6 sticky top-0 z-40 bg-orange-50 pt-6 pb-3 px-6">
              <div className="flex items-center gap-2">
                   <button
                        onClick={() => { exitSelectMode(); setActiveTab('Closet'); }}
                        className="p-2 bg-white text-slate-800 rounded-full shadow-sm hover:bg-slate-50 transition-colors"
                   >
                       <ChevronLeft size={24} />
                   </button>
                   <h1 className="text-2xl text-slate-800 font-serif">
                       {isSelectMode ? `${selectedIds.size} Selected` : 'The Archive'}
                   </h1>
              </div>
              <div className="flex items-center gap-2">
                  {!isSelectMode && (
                      <span className="text-sm font-bold text-slate-400 bg-white px-3 py-1 rounded-full shadow-sm border border-slate-100">
                          {filteredItems?.length || 0} Items
                      </span>
                  )}
                  {filteredItems && filteredItems.length > 0 && (
                      <button
                          onClick={() => isSelectMode ? exitSelectMode() : setIsSelectMode(true)}
                          className={clsx(
                              "px-3 py-1 rounded-full text-sm font-bold transition-all shadow-sm",
                              isSelectMode
                                  ? "bg-slate-800 text-white"
                                  : "bg-white text-sky-500 border border-slate-100 hover:bg-sky-50"
                          )}
                      >
                          {isSelectMode ? 'Cancel' : 'Select'}
                      </button>
                  )}
              </div>
         </div>
      )}

      {activeTab === 'Inspo' ? (
        <div className="animate-in fade-in slide-in-from-bottom-2 px-6">
          <ShopInspo />
        </div>
      ) : activeTab === 'Lookbook' ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 px-6">
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
        <div className="animate-in fade-in slide-in-from-bottom-2 px-6">
            
            {activeTab !== 'Archive' && (
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl text-slate-800 font-serif">
                        {isSelectMode ? `${selectedIds.size} Selected` : 'The Closet'}
                    </h1>
                    <div className="flex items-center gap-2">
                        {!isSelectMode && (
                            <span className="text-sm font-bold text-slate-400 bg-white px-3 py-1 rounded-full shadow-sm">
                                {filteredItems?.length || 0} Items
                            </span>
                        )}
                        {filteredItems && filteredItems.length > 0 && (
                            <button
                                onClick={() => isSelectMode ? exitSelectMode() : setIsSelectMode(true)}
                                className={clsx(
                                    "px-3 py-1 rounded-full text-sm font-bold transition-all shadow-sm",
                                    isSelectMode
                                        ? "bg-slate-800 text-white"
                                        : "bg-white text-sky-500 border border-slate-100 hover:bg-sky-50"
                                )}
                            >
                                {isSelectMode ? 'Cancel' : 'Select'}
                            </button>
                        )}
                    </div>
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

                <div className="relative">
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
                    <div className="absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-orange-50 to-transparent pointer-events-none"></div>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 px-1 text-slate-400 text-xs font-bold uppercase tracking-wider">
                        <Calendar size={12} />
                        <span>Season</span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-6 px-6">
                        <button
                            onClick={() => setFilterSeason('All')}
                            className={clsx(
                                "whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                                filterSeason === 'All'
                                    ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                            )}
                        >
                            All
                        </button>
                        {Object.values(Season).filter(s => s !== Season.All).map(season => (
                            <button
                                key={season}
                                onClick={() => setFilterSeason(season)}
                                className={clsx(
                                    "whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                                    filterSeason === season
                                        ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                                )}
                            >
                                {season}
                            </button>
                        ))}
                    </div>
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

      {isSelectMode && (
          <div className="fixed bottom-20 left-0 right-0 z-[60] px-4 animate-in slide-in-from-bottom-4 fade-in duration-200">
              <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-slate-100 p-3 flex items-center gap-2">
                  <button
                      onClick={handleSelectAll}
                      className={clsx(
                          "flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all",
                          filteredItems && selectedIds.size === filteredItems.length && filteredItems.length > 0
                              ? "bg-sky-50 text-sky-600"
                              : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                      )}
                  >
                      {filteredItems && selectedIds.size === filteredItems.length && filteredItems.length > 0
                          ? <CheckSquare size={16} />
                          : <Square size={16} />
                      }
                      All
                  </button>

                  <div className="flex-1" />

                  <button
                      onClick={handleBatchArchive}
                      disabled={selectedIds.size === 0}
                      className={clsx(
                          "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
                          selectedIds.size > 0
                              ? "bg-sky-400 text-white shadow-sm hover:bg-sky-500 active:scale-95"
                              : "bg-slate-100 text-slate-300 cursor-not-allowed"
                      )}
                  >
                      {activeTab === 'Archive' ? <RotateCcw size={16} /> : <Archive size={16} />}
                      {activeTab === 'Archive' ? 'Restore' : 'Archive'}
                  </button>

                  <button
                      onClick={handleBatchDelete}
                      disabled={selectedIds.size === 0}
                      className={clsx(
                          "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
                          selectedIds.size > 0
                              ? "bg-red-500 text-white shadow-sm hover:bg-red-600 active:scale-95"
                              : "bg-slate-100 text-slate-300 cursor-not-allowed"
                      )}
                  >
                      <Trash2 size={16} />
                      Delete
                  </button>
              </div>
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
