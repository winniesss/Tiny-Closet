import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Category, Season } from '../types';
import { Search } from 'lucide-react';
import clsx from 'clsx';

export const Closet: React.FC = () => {
  const [filterCategory, setFilterCategory] = useState<Category | 'All'>('All');
  const [filterSeason, setFilterSeason] = useState<Season | 'All'>('All');
  const [search, setSearch] = useState('');

  const items = useLiveQuery(() => {
    return db.items.toArray();
  });

  const filteredItems = items?.filter(item => {
    const matchesCategory = filterCategory === 'All' || item.category === filterCategory;
    
    // An item matches the season filter if:
    // 1. The filter is 'All' (show everything)
    // 2. The item's seasons array includes the selected season
    // 3. The item is marked as suitable for 'All' seasons (Season.All)
    const matchesSeason = filterSeason === 'All' || 
                          (item.seasons && (item.seasons.includes(filterSeason as Season) || item.seasons.includes(Season.All)));

    const matchesSearch = item.description?.toLowerCase().includes(search.toLowerCase()) || 
                          item.brand.toLowerCase().includes(search.toLowerCase());
                          
    return matchesCategory && matchesSearch && matchesSeason;
  });

  const categories = ['All', ...Object.values(Category)];
  const seasons = ['All', Season.Spring, Season.Summer, Season.Fall, Season.Winter];

  return (
    <div className="min-h-screen bg-orange-50 pb-28">
      <div className="sticky top-0 bg-orange-50/95 backdrop-blur-sm z-20 pt-6 pb-2 border-b border-orange-100/50">
        <div className="px-6 max-w-md mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl text-slate-800">The Closet</h1>
            <div className="bg-white px-3 py-1 rounded-full shadow-sm">
                <span className="text-xs font-bold text-slate-400">{filteredItems?.length || 0} Items</span>
            </div>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Search items..." 
              className="w-full bg-white border-none pl-12 pr-4 py-4 rounded-full text-slate-700 font-bold placeholder:text-slate-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-3 pb-2">
            {/* Category Filter Row */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat as Category | 'All')}
                  className={clsx(
                    "px-5 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap shadow-sm border border-transparent",
                    filterCategory === cat 
                      ? "bg-sky-400 text-white shadow-md transform scale-105" 
                      : "bg-white text-slate-500 hover:bg-slate-100 border-slate-50"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Season Filter Row */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {seasons.map(s => (
                    <button
                    key={s}
                    onClick={() => setFilterSeason(s as Season | 'All')}
                    className={clsx(
                        "px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap shadow-sm border border-transparent",
                        filterSeason === s
                        ? "bg-orange-400 text-white shadow-md transform scale-105" 
                        : "bg-white text-slate-400 hover:bg-slate-100 border-slate-50"
                    )}
                    >
                    {s === 'All' ? 'Any Season' : s}
                    </button>
                ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 max-w-md mx-auto mt-4">
        <div className="grid grid-cols-2 gap-4">
          {filteredItems?.map(item => (
            <div key={item.id} className="group bg-white p-3 rounded-[2rem] shadow-sm animate-in fade-in duration-500">
              <div className="relative aspect-[4/5] bg-orange-50 rounded-[1.5rem] mb-3 overflow-hidden">
                 <img src={item.image} alt={item.description} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                 <div className="absolute top-2 left-2 bg-white/90 backdrop-blur px-2 py-1 rounded-lg shadow-sm">
                    <span className="text-xs font-bold text-slate-800 block">{item.sizeLabel}</span>
                 </div>
              </div>
              <div className="px-1 mb-1">
                <h3 className="font-bold text-slate-800 font-serif text-lg leading-none mb-1 truncate">{item.brand}</h3>
                <p className="text-xs text-slate-400 truncate">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        {filteredItems?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300">
            <p className="font-bold text-lg">No Items Found</p>
            <button 
                onClick={() => {setSearch(''); setFilterCategory('All'); setFilterSeason('All');}}
                className="mt-4 text-sm text-sky-400 font-bold hover:underline"
            >
                Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};