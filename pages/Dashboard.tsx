import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { WeatherWidget } from '../components/WeatherWidget';
import { WeatherData, ClothingItem, Season, Category } from '../types';
import { Shirt, AlertCircle, Cake } from 'lucide-react';
import { Link } from 'react-router-dom';

// Mock weather for demo purposes
const MOCK_WEATHER: WeatherData = {
  condition: 'Cloudy',
  temp: 18,
  description: "Perfect for layers!"
};

const calculateAge = (birthDateString: string): string => {
    const today = new Date();
    const birthDate = new Date(birthDateString);
    let ageYears = today.getFullYear() - birthDate.getFullYear();
    let ageMonths = today.getMonth() - birthDate.getMonth();
    
    if (ageMonths < 0 || (ageMonths === 0 && today.getDate() < birthDate.getDate())) {
        ageYears--;
        ageMonths += 12;
    }

    if (ageYears === 0) {
        return `${ageMonths} Months`;
    }
    return `${ageYears}Y ${ageMonths}M`;
};

export const Dashboard: React.FC = () => {
  const [suggestion, setSuggestion] = useState<ClothingItem[]>([]);
  
  const profile = useLiveQuery(() => db.profile.toArray());
  const allItems = useLiveQuery(() => db.items.toArray());
  
  const currentKid = profile?.[0];

  useEffect(() => {
    if (!allItems || allItems.length === 0) return;

    let targetSeason: Season = Season.All;
    const temp = MOCK_WEATHER.temp;

    if (temp > 25) targetSeason = Season.Summer;
    else if (temp > 15) targetSeason = Season.Spring;
    else if (temp > 5) targetSeason = Season.Fall;
    else targetSeason = Season.Winter;

    const suitable = allItems.filter(item => 
      item.seasons.includes(targetSeason) || item.seasons.includes(Season.All)
    );

    const tops = suitable.filter(i => i.category === Category.Top);
    const bottoms = suitable.filter(i => i.category === Category.Bottom);
    const fullBody = suitable.filter(i => i.category === Category.FullBody);
    const outerwear = suitable.filter(i => i.category === Category.Outerwear);

    const outfit: ClothingItem[] = [];

    if (fullBody.length > 0) {
      outfit.push(fullBody[Math.floor(Math.random() * fullBody.length)]);
    } else if (tops.length > 0 && bottoms.length > 0) {
      outfit.push(tops[Math.floor(Math.random() * tops.length)]);
      outfit.push(bottoms[Math.floor(Math.random() * bottoms.length)]);
    }

    if (temp < 18 && outerwear.length > 0) {
      outfit.push(outerwear[Math.floor(Math.random() * outerwear.length)]);
    }

    setSuggestion(outfit);
  }, [allItems]);

  // Placeholder logic for outgrown items - could be improved with real size vs age data
  const outgrownItems = allItems?.filter(item => {
    if (!currentKid?.birthDate) return false;
    return false; 
  }) || [];

  return (
    <div className="p-6 pb-28 max-w-md mx-auto">
      <header className="mb-8 pt-4 flex justify-between items-center">
        <div>
            <p className="text-slate-500 text-sm font-bold tracking-wide mb-1 uppercase">Good Morning,</p>
            <h1 className="text-3xl text-slate-800">
              {currentKid?.name || 'Little One'}
            </h1>
            {currentKid?.birthDate && (
                <div className="flex items-center gap-1 mt-1 text-pink-400 font-bold text-sm">
                    <Cake size={14} />
                    <span>{calculateAge(currentKid.birthDate)} Old</span>
                </div>
            )}
        </div>
        <div className="h-12 w-12 rounded-full bg-sky-200 text-sky-700 flex items-center justify-center font-bold text-xl font-serif">
            {(currentKid?.name || 'K')[0]}
        </div>
      </header>

      <WeatherWidget data={MOCK_WEATHER} />

      <section className="mb-10">
        <div className="flex justify-between items-center mb-4 px-1">
          <h2 className="text-lg text-slate-800">Today's Outfit</h2>
          <span className="text-xs font-bold text-sky-500 bg-sky-100 px-3 py-1 rounded-full">AUTO</span>
        </div>
        
        {(!allItems || allItems.length === 0) ? (
          <div className="bg-white rounded-[2rem] p-10 text-center shadow-sm border border-slate-100">
            <div className="bg-orange-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-orange-300">
                <Shirt size={28} strokeWidth={2.5} />
            </div>
            <p className="text-slate-400 mb-6 font-medium">Closet is empty!</p>
            <Link to="/add" className="inline-block px-8 py-4 bg-sky-400 text-white text-sm font-bold rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all">
              Add Clothes
            </Link>
          </div>
        ) : suggestion.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {suggestion.map((item, i) => (
              <div key={item.id} className={`group relative bg-white rounded-[2rem] p-3 shadow-sm border border-slate-50 ${i % 2 !== 0 ? 'mt-8' : ''}`}>
                 <div className="w-full aspect-[3/4] overflow-hidden rounded-[1.5rem] bg-orange-50 relative mb-3">
                   <img src={item.image} alt={item.description} className="w-full h-full object-cover" />
                 </div>
                 <div className="px-1">
                    <h3 className="font-bold text-slate-800 leading-tight mb-1 font-serif">{item.category}</h3>
                    <p className="text-xs text-slate-500 font-bold uppercase">{item.brand}</p>
                 </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-[2rem] bg-orange-100 text-orange-800 font-medium text-center">
            No outfit matches found!
          </div>
        )}
      </section>

      {outgrownItems.length > 0 && (
        <section className="bg-red-50 rounded-[2rem] p-6 flex items-start gap-4 mb-8">
           <div className="bg-red-100 p-2 rounded-full text-red-500 shrink-0">
                <AlertCircle size={24} />
           </div>
           <div>
             <h3 className="font-bold text-red-900 mb-1">Size Check!</h3>
             <p className="text-sm text-red-700 leading-relaxed">
               {outgrownItems.length} items might be getting too small. Time to review?
             </p>
           </div>
        </section>
      )}

      <section>
        <div className="flex justify-between items-center mb-4 px-1">
          <h2 className="text-lg text-slate-800">New Arrivals</h2>
          <Link to="/closet" className="text-sm font-bold text-orange-500 hover:text-orange-600">
            See All
          </Link>
        </div>
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-6 px-6">
          {allItems?.slice().reverse().slice(0, 5).map(item => (
            <div key={item.id} className="w-24 shrink-0">
                 <div className="aspect-square rounded-[1.5rem] overflow-hidden bg-white border border-slate-100 shadow-sm mb-2">
                    <img src={item.image} alt={item.description} className="w-full h-full object-cover" />
                 </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};