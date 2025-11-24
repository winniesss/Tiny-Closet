import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Category } from '../types';

export const Stats: React.FC = () => {
  const items = useLiveQuery(() => db.items.toArray());

  if (!items) return <div className="p-8 text-center font-bold text-slate-400">Loading...</div>;

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
    </div>
  );
};