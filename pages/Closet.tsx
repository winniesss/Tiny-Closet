import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Category, Season, ClothingItem } from '../types';
import { Search, Archive, CheckCircle2 } from 'lucide-react';
import { ItemDetailModal } from '../components/ItemDetailModal';
import clsx from 'clsx';

export const Closet: React.FC = () => {
  const [filterCategory, setFilterCategory] = useState<Category | 'All' | 'Archived'>('All');
  const [filterSeason, setFilterSeason] = useState<Season | 'All'>('All');
  const [search, setSearch] = useState('');
  
  // Interaction State
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const items = useLiveQuery(() => {
    return db.items.toArray();
  });

  const filteredItems = items?.filter(item => {
    // Archive Logic
    if (filterCategory === 'Archived') {
        if (!item.isArchived) return false;
    } else {
        // Normal view: hide archived items
        if (item.isArchived) return false;
        
        // Category Filter
        if (filterCategory !== 'All' && item.category !== filterCategory) {
            return false;
        }
    }

    // Season Filter
    if (filterSeason !== 'All') {
        // Item matches if it has the specific season OR is marked for All Year
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

  const showNotification = (msg: string) => {
      setNotification(msg);
      setTimeout(() => setNotification(null), 3000);
  };

  const handleToggleArchive = async (item: ClothingItem) => {
      if (item.id) {
          const newState = !item.isArchived;
          await db.items.update(item.id, { isArchived: newState });
          showNotification(newState ? "Archived" : "Restored");
          
          // If we archived it while looking at the active list, close the modal
          if (newState && filterCategory !== 'Archived' && selectedItem?.id === item.id) {
              setSelectedItem(null);
          }
           // If we restored it while looking at the archive list, close the modal
          if (!newState && filterCategory === 'Archived' && selectedItem?.id === item.id) {
              setSelectedItem(null);
          }
      }
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
              // Haptic feedback if available
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
              // Prevent click event if it was a long press
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
            onContextMenu={(e) => e.preventDefault()} // Prevent right-click menu on long press
            className="group relative bg-white rounded-[2rem] p-3 shadow-sm border border-slate-50 transition-transform active:scale-95 cursor-pointer select-none"
        >
            <div className="w-full aspect-[3/4] overflow-hidden rounded-[1.5rem] bg-orange-50 relative mb-3">
                <img src={item.image} alt={item.description} className="w-full h-full object-cover pointer-events-none" />
                
                {filterCategory === 'Archived' && (
                    <div className="absolute inset-0 bg-slate-900/10 flex items-center justify-center">
                         <div className="bg-white/80 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold shadow-sm">Archived</div>
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
      <div className="flex justify-between items-baseline mb-6">
        <h1 className="text-3xl text-slate-800">The Closet</h1>
        <span className="text-sm font-bold text-slate-400 bg-white px-3 py-1 rounded-full shadow-sm">
            {filteredItems?.length || 0} Items
        </span>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Search items..." 
          className="w-full pl-12 pr-4 py-4 bg-slate-100 rounded-2xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-sky-200 transition-all border-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Category Filters */}
      <div className="mb-4">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-6 px-6 py-2">
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
             <button
                onClick={() => setFilterCategory('Archived')}
                className={clsx(
                    "whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-sm border border-transparent flex items-center gap-2",
                    filterCategory === 'Archived'
                        ? "bg-slate-600 text-white shadow-md" 
                        : "bg-slate-200 text-slate-500 hover:bg-slate-300"
                )}
            >
                <Archive size={14} /> Archived
            </button>
          </div>
      </div>

      {/* Season Filters */}
      <div className="mb-8">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-6 px-6 py-2">
            <button
                onClick={() => setFilterSeason('All')}
                className={clsx(
                    "whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm",
                    filterSeason === 'All'
                        ? "bg-orange-400 text-white shadow-md" 
                        : "bg-orange-100/50 text-orange-400 hover:bg-orange-100"
                )}
            >
                Any Season
            </button>
            {[Season.Spring, Season.Summer, Season.Fall, Season.Winter].map(season => (
                <button
                    key={season}
                    onClick={() => setFilterSeason(season)}
                    className={clsx(
                        "whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm",
                        filterSeason === season
                            ? "bg-orange-400 text-white shadow-md" 
                            : "bg-white text-slate-400 hover:bg-slate-50"
                    )}
                >
                    {season}
                </button>
            ))}
          </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4">
        {filteredItems && filteredItems.length > 0 ? (
            filteredItems.map((item) => (
                <ItemCard key={item.id} item={item} />
            ))
        ) : (
            <div className="col-span-2 py-12 text-center opacity-50">
                <p className="text-lg font-bold text-slate-400 mb-2">No Items Found</p>
                <button 
                    onClick={() => {
                        setFilterCategory('All');
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