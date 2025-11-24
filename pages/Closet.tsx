import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Category, Season, ClothingItem } from '../types';
import { Search, Archive, RotateCcw } from 'lucide-react';
import clsx from 'clsx';

export const Closet: React.FC = () => {
  const [filterCategory, setFilterCategory] = useState<Category | 'All' | 'Archived'>('All');
  const [filterSeason, setFilterSeason] = useState<Season | 'All'>('All');
  const [search, setSearch] = useState('');

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

  const handleUnarchive = async (e: React.MouseEvent, id?: number) => {
    e.stopPropagation();
    if (id) {
        await db.items.update(id, { isArchived: false });
    }
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

      {/* Category Filters - Horizontal Scroll with fix for cut-off edges */}
      <div className="mb-4">
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

      {/* Season Filters - Horizontal Scroll with fix for cut-off edges */}
      <div className="mb-8">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-6 px-6">
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
            <div key={item.id} className="group relative bg-white rounded-[2rem] p-3 shadow-sm border border-slate-50 transition-transform hover:scale-[1.02]">
                <div className="w-full aspect-[3/4] overflow-hidden rounded-[1.5rem] bg-orange-50 relative mb-3">
                    <img src={item.image} alt={item.description} className="w-full h-full object-cover" />
                    
                    {filterCategory === 'Archived' && (
                        <div className="absolute inset-0 bg-slate-900/10 flex items-center justify-center">
                            <button 
                                onClick={(e) => handleUnarchive(e, item.id)}
                                className="bg-white text-slate-800 px-3 py-2 rounded-full font-bold text-xs shadow-lg flex items-center gap-1 hover:bg-sky-50"
                            >
                                <RotateCcw size={12} /> Restore
                            </button>
                        </div>
                    )}
                </div>
                <div className="px-1">
                    <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-slate-800 leading-tight text-sm line-clamp-1">{item.category}</h3>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">{item.sizeLabel}</span>
                    </div>
                    <p className="text-xs text-slate-400 font-bold uppercase truncate">{item.brand}</p>
                </div>
            </div>
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
    </div>
  );
};