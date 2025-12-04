import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Category, Season, ClothingItem } from '../types';
import { Search, Archive, CheckCircle2, Trash2, RotateCcw, Heart } from 'lucide-react';
import { ItemDetailModal } from '../components/ItemDetailModal';
import clsx from 'clsx';

export const Closet: React.FC = () => {
  const [filterCategory, setFilterCategory] = useState<Category | 'All' | 'Archived' | 'Favorites'>('All');
  const [filterSeason, setFilterSeason] = useState<Season | 'All'>('All');
  const [search, setSearch] = useState('');
  
  // Interaction State
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  const [actionItem, setActionItem] = useState<ClothingItem | null>(null);
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
        if (filterCategory === 'Favorites') {
            if (!item.isFavorite) return false;
        } else if (filterCategory !== 'All' && item.category !== filterCategory) {
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
          
          if (actionItem?.id === item.id) setActionItem(null);

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

  const handleToggleFavorite = async (item: ClothingItem) => {
    if (item.id) {
        const newState = !item.isFavorite;
        await db.items.update(item.id, { isFavorite: newState });
        // showNotification(newState ? "Added to Favorites" : "Removed from Favorites");
        if (actionItem?.id === item.id) setActionItem(null);
    }
  };

  const handleDelete = async (item: ClothingItem) => {
      if (item.id && window.confirm("Are you sure you want to delete this item permanently?")) {
          await db.items.delete(item.id);
          showNotification("Item deleted");
          setActionItem(null);
          if (selectedItem?.id === item.id) setSelectedItem(null);
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
              setActionItem(item);
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
                {item.isFavorite && filterCategory !== 'Archived' && (
                    <div className="absolute top-2 right-2 bg-white/80 backdrop-blur p-1.5 rounded-full shadow-sm text-red-500">
                        <Heart size={12} fill="currentColor" />
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
            <button
                onClick={() => setFilterCategory('Favorites')}
                className={clsx(
                    "whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-sm border border-transparent flex items-center gap-2",
                    filterCategory === 'Favorites'
                        ? "bg-red-400 text-white shadow-md" 
                        : "bg-white text-slate-500 hover:bg-slate-50"
                )}
            >
                <Heart size={14} fill={filterCategory === 'Favorites' ? "currentColor" : "none"} /> Favorites
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

      {/* Action Menu Modal */}
      {actionItem && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setActionItem(null)}>
            <div className="bg-white w-full max-w-xs rounded-[2rem] p-5 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto bg-slate-50 rounded-2xl mb-3 overflow-hidden">
                        <img src={actionItem.image} className="w-full h-full object-cover" alt="Selected" />
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg">Manage Item</h3>
                    <p className="text-xs text-slate-400">{actionItem.brand} - {actionItem.category}</p>
                </div>
                
                <div className="space-y-3">
                    <button 
                    onClick={() => handleToggleFavorite(actionItem)}
                    className={clsx(
                        "w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors",
                        actionItem.isFavorite ? "bg-red-50 text-red-500 hover:bg-red-100" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    )}
                    >
                        <Heart size={20} fill={actionItem.isFavorite ? "currentColor" : "none"} /> 
                        {actionItem.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                    </button>
                    <button 
                    onClick={() => handleToggleArchive(actionItem)}
                    className="w-full py-4 rounded-xl bg-sky-50 text-sky-600 font-bold flex items-center justify-center gap-2 hover:bg-sky-100 transition-colors"
                    >
                        {actionItem.isArchived ? <><RotateCcw size={20} /> Restore Item</> : <><Archive size={20} /> Archive Item</>}
                    </button>
                    <button 
                    onClick={() => handleDelete(actionItem)}
                    className="w-full py-4 rounded-xl bg-red-50 text-red-500 font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
                    >
                        <Trash2 size={20} /> Delete Permanently
                    </button>
                </div>
                
                <button 
                onClick={() => setActionItem(null)}
                className="w-full mt-4 py-3 rounded-xl text-slate-400 font-bold text-sm"
                >
                    Cancel
                </button>
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