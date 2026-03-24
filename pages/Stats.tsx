import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../db';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Category } from '../types';
import { Shirt } from 'lucide-react';
import { useActiveChild } from '../hooks/useActiveChild';

export const Stats: React.FC = () => {
  const { activeChildId } = useActiveChild();
  const allDbItems = useLiveQuery(() => db.items.toArray());

  // Filter by active child
  const items = allDbItems?.filter(item => {
    if (!activeChildId) return true;
    return !item.profileId || item.profileId === activeChildId;
  });

  if (!items) return <div className="p-8 text-center font-bold text-slate-400">Loading...</div>;

  if (items.length === 0) {
    return (
      <div className="p-6 pb-28 max-w-md mx-auto min-h-screen bg-orange-50">
        <h1 className="text-3xl text-slate-800 mb-8">Closet Stats</h1>

        <div className="mb-8 bg-pink-200 p-8 rounded-[2.5rem] relative overflow-hidden shadow-sm">
          <h3 className="text-pink-900 text-sm font-bold uppercase tracking-wider mb-1">Total Clothes</h3>
          <p className="text-6xl font-bold text-pink-950 font-sans">0</p>
          <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/20 rounded-full"></div>
          <div className="absolute top-4 right-8 w-8 h-8 bg-white/30 rounded-full"></div>
        </div>

        <div className="flex flex-col items-center justify-center bg-white rounded-[2rem] p-12 shadow-sm text-center">
          <Shirt className="w-16 h-16 text-slate-300 mb-4" />
          <p className="text-slate-500 text-lg font-medium mb-6">Add some clothes to see your stats!</p>
          <Link
            to="/add"
            className="bg-sky-400 text-white font-bold px-6 py-3 rounded-full hover:bg-sky-500 transition-colors"
          >
            Add Clothes
          </Link>
        </div>
      </div>
    );
  }

  const categoryData = Object.values(Category).map(cat => ({
    name: cat,
    value: items.filter(i => i.category === cat).length
  })).filter(d => d.value > 0);

  const brandCounts: Record<string, number> = {};
  items.forEach(item => {
    const brand = item.brand || 'Unknown';
    brandCounts[brand] = (brandCounts[brand] || 0) + 1;
  });
  const brandData = Object.entries(brandCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Slipps Palette: Orange, Sky, Pink, Yellow, Teal, Violet
  const COLORS = ['#fb923c', '#38bdf8', '#f472b6', '#fcd34d', '#2dd4bf', '#a78bfa'];

  return (
    <div className="p-6 pb-28 max-w-md mx-auto min-h-screen bg-orange-50">
      <h1 className="text-3xl text-slate-800 mb-8">Closet Stats</h1>

      <div className="mb-8 bg-pink-200 p-8 rounded-[2.5rem] relative overflow-hidden shadow-sm">
        <h3 className="text-pink-900 text-sm font-bold uppercase tracking-wider mb-1">Total Clothes</h3>
        <p className="text-6xl font-bold text-pink-950 font-sans">{items.length}</p>
        <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/20 rounded-full"></div>
        <div className="absolute top-4 right-8 w-8 h-8 bg-white/30 rounded-full"></div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg text-slate-800 mb-4 px-2">Category Split</h2>
        <div className="h-64 bg-white rounded-[2rem] p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
                cornerRadius={10}
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: 'none', color: '#333'}}
                itemStyle={{color: '#333', fontWeight: 'bold'}}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mt-6">
            {categoryData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white px-3 py-1.5 rounded-full shadow-sm">
                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
                    {entry.name}
                </div>
            ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg text-slate-800 mb-4 px-2">Top Brands</h2>
        <div className="h-64 bg-white rounded-[2rem] p-6 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
             <BarChart data={brandData} layout="vertical" margin={{ left: 0, right: 30 }}>
                <XAxis type="number" hide />
                <YAxis
                    type="category"
                    dataKey="name"
                    width={80}
                    tick={{fontSize: 12, fill: '#64748b', fontWeight: '600'}}
                    axisLine={false}
                    tickLine={false}
                />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: 'none'}} />
                <Bar dataKey="value" fill="#38bdf8" radius={[0, 10, 10, 0]} barSize={20} />
             </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Most Worn Items */}
      {(() => {
        const mostWorn = items
          .filter(i => (i.wearCount || 0) > 0)
          .sort((a, b) => (b.wearCount || 0) - (a.wearCount || 0))
          .slice(0, 5);
        if (mostWorn.length === 0) return null;
        return (
          <div className="mt-8">
            <h2 className="text-lg text-slate-800 mb-4 px-2">Most Worn</h2>
            <div className="bg-white rounded-[2rem] p-6 shadow-sm space-y-3">
              {mostWorn.map(item => (
                <div key={item.id} className="flex items-center gap-3">
                  <img src={item.image} alt={item.description || item.category} className="w-12 h-12 rounded-xl object-cover bg-orange-50" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-700 truncate">{item.description || item.category}</p>
                    <p className="text-xs text-slate-400">{item.brand}</p>
                  </div>
                  <span className="text-sm font-bold text-orange-400">{item.wearCount}x</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Rarely Worn Items */}
      {(() => {
        const rarelyWorn = items.filter(i => !i.wearCount || i.wearCount === 0);
        if (rarelyWorn.length === 0) return null;
        return (
          <div className="mt-8">
            <h2 className="text-lg text-slate-800 mb-4 px-2">Rarely Worn</h2>
            <div className="bg-white rounded-[2rem] p-6 shadow-sm">
              <p className="text-2xl font-bold text-slate-700 mb-1">{rarelyWorn.length} item{rarelyWorn.length !== 1 ? 's' : ''}</p>
              <p className="text-sm text-slate-400">These items haven't appeared in any outfits yet</p>
            </div>
          </div>
        );
      })()}
    </div>
  );
};