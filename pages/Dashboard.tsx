import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { WeatherWidget } from '../components/WeatherWidget';
import { WeatherData, ClothingItem, Season, Category } from '../types';
import { Shirt, AlertCircle, Cake, Archive, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { ItemDetailModal } from '../components/ItemDetailModal';

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

const getAgeInMonths = (birthDateString: string): number => {
    const today = new Date();
    const birthDate = new Date(birthDateString);
    const years = today.getFullYear() - birthDate.getFullYear();
    const months = today.getMonth() - birthDate.getMonth();
    return (years * 12) + months;
};

// Heuristic to convert size label to max age in months
const parseSizeToMaxMonths = (size: string | undefined): number | null => {
    if (!size) return null;
    const s = size.toUpperCase().replace(/\s/g, '');
    
    // Handle "Months" (e.g. "6-9M", "3M")
    if (s.includes('M')) {
        // Find all numbers
        const numbers = s.match(/\d+/g);
        if (numbers && numbers.length > 0) {
            // Take the largest number (e.g. 6-9M -> 9)
            return parseInt(numbers[numbers.length - 1], 10);
        }
    }
    
    // Handle "Years" / "Toddler" (e.g. "2T", "3Y", "4", "1-2Y")
    if (s.includes('T') || s.includes('Y')) {
        const numbers = s.match(/\d+/g);
        if (numbers && numbers.length > 0) {
            // Take the last number to handle ranges (e.g. "1-2Y" -> take 2).
            // Multiply by 12 for months.
            return parseInt(numbers[numbers.length - 1], 10) * 12;
        }
    }

    // Handle plain numbers usually as Years if small < 16, but could be tricky. 
    // Let's assume plain numbers < 14 are years for kids clothes (e.g. Size 4, Size 6)
    const plainNum = parseInt(s, 10);
    if (!isNaN(plainNum) && plainNum < 14) {
        return plainNum * 12;
    }

    // Newborn
    if (s === 'NB' || s === 'NEWBORN') return 1; // 0-1 month

    return null;
};

export const Dashboard: React.FC = () => {
  const [suggestion1, setSuggestion1] = useState<ClothingItem[]>([]);
  const [suggestion2, setSuggestion2] = useState<ClothingItem[]>([]);
  const [activeOption, setActiveOption] = useState<1 | 2>(1);
  const [justArchivedCount, setJustArchivedCount] = useState(0);
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  
  const profile = useLiveQuery(() => db.profile.toArray());
  // Only fetch active items for suggestions
  const allItems = useLiveQuery(() => db.items.filter(i => !i.isArchived).toArray());
  
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

    const generateOutfit = (attempt: number) => {
        // Simple shuffle for variety
        const shuffled = [...suitable].sort(() => Math.random() - 0.5);

        const tops = shuffled.filter(i => i.category === Category.Top);
        const bottoms = shuffled.filter(i => i.category === Category.Bottom);
        const fullBody = shuffled.filter(i => i.category === Category.FullBody);
        const outerwear = shuffled.filter(i => i.category === Category.Outerwear);
        const shoes = shuffled.filter(i => i.category === Category.Shoes);

        const outfit: ClothingItem[] = [];

        // 50/50 chance to prefer full body if available, or force variety based on attempt
        const useFullBody = fullBody.length > 0 && (Math.random() > 0.5 || (attempt === 2 && tops.length === 0));

        if (useFullBody) {
             outfit.push(fullBody[0]);
        } else if (tops.length > 0 && bottoms.length > 0) {
             outfit.push(tops[0]);
             outfit.push(bottoms[0]);
        } else if (fullBody.length > 0) {
             outfit.push(fullBody[0]);
        }

        // Add outerwear if cold
        if (temp < 18 && outerwear.length > 0) {
             outfit.push(outerwear[0]);
        }
        
        // Add shoes occasionally or logic
        if (shoes.length > 0) {
            outfit.push(shoes[0]);
        }

        return outfit;
    };

    setSuggestion1(generateOutfit(1));
    // Generate a second one, hopefully different due to random shuffle
    setSuggestion2(generateOutfit(2));
    
  }, [allItems]);

  const activeSuggestion = activeOption === 1 ? suggestion1 : suggestion2;

  // Identify outgrown items
  const outgrownItems = allItems?.filter(item => {
    if (!currentKid?.birthDate) return false;
    // Skip if sizeLabel is missing
    if (!item.sizeLabel) return false;
    
    const currentAgeMonths = getAgeInMonths(currentKid.birthDate);
    const maxMonths = parseSizeToMaxMonths(item.sizeLabel);
    
    // If we successfully parsed a size, and current age is > size + buffer (e.g. 1 month grace)
    if (maxMonths !== null && currentAgeMonths > maxMonths + 1) {
        return true;
    }
    return false;
  }) || [];

  const handleArchiveOutgrown = async () => {
      if (outgrownItems.length === 0) return;
      
      const ids = outgrownItems.map(i => i.id).filter(id => id !== undefined) as number[];
      if (ids.length > 0) {
          await db.items.bulkUpdate(ids.map(id => ({ key: id, changes: { isArchived: true } })));
          setJustArchivedCount(ids.length);
          setTimeout(() => setJustArchivedCount(0), 3000);
      }
  };

  const handleToggleArchive = async (item: ClothingItem) => {
      if (item.id) {
          await db.items.update(item.id, { isArchived: !item.isArchived });
          setSelectedItem(null); // Close modal after archive action
      }
  };

  return (
    <div className="p-6 pb-28 max-w-md mx-auto">
      <header className="mb-8 pt-4 flex justify-between items-end">
        <div>
            <Logo />
            <div className="flex items-center gap-2 mt-2 ml-1">
                <p className="text-slate-500 font-bold text-lg">
                  Hi, {currentKid?.name || 'Little One'}
                </p>
                {currentKid?.birthDate && (
                    <div className="flex items-center gap-1 bg-pink-100 text-pink-500 px-2 py-0.5 rounded-full font-bold text-xs">
                        <Cake size={12} />
                        <span>{calculateAge(currentKid.birthDate)}</span>
                    </div>
                )}
            </div>
        </div>
        <div className="h-12 w-12 rounded-full bg-sky-200 text-sky-700 flex items-center justify-center font-bold text-xl font-serif border-2 border-white shadow-sm mb-2 overflow-hidden relative">
            {currentKid?.avatar ? (
                <img src={currentKid.avatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
                (currentKid?.name || 'K')[0]
            )}
        </div>
      </header>

      <WeatherWidget data={MOCK_WEATHER} />

      <section className="mb-10">
        <div className="flex justify-between items-center mb-4 px-1">
          <div className="flex items-center gap-4">
              <h2 className="text-lg text-slate-800 font-serif font-bold">Today's Outfit</h2>
              <div className="flex bg-white rounded-full p-1 shadow-sm border border-slate-100">
                  <button 
                    onClick={() => setActiveOption(1)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${activeOption === 1 ? 'bg-sky-400 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                      Option 1
                  </button>
                  <button 
                    onClick={() => setActiveOption(2)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${activeOption === 2 ? 'bg-sky-400 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                      Option 2
                  </button>
              </div>
          </div>
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
        ) : activeSuggestion.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300" key={activeOption}>
            {activeSuggestion.map((item, i) => (
              <div 
                key={`${item.id}-${i}`} 
                onClick={() => setSelectedItem(item)}
                className="group relative bg-white rounded-[2rem] p-3 shadow-sm border border-slate-50 cursor-pointer transition-transform active:scale-95 h-full flex flex-col"
              >
                 <div className="w-full aspect-[3/4] overflow-hidden rounded-[1.5rem] bg-orange-50 relative mb-3">
                   <img src={item.image} alt={item.description} className="w-full h-full object-cover" />
                 </div>
                 <div className="px-1 flex-1">
                    <h3 className="font-bold text-slate-800 leading-tight mb-1 font-serif">{item.category}</h3>
                    <p className="text-xs text-slate-500 font-bold uppercase">{item.brand}</p>
                 </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-[2rem] bg-orange-100 text-orange-800 font-medium text-center">
            No matching items for this weather!
          </div>
        )}
      </section>

      {/* Outgrown Alert Section */}
      {outgrownItems.length > 0 && (
        <section className="bg-white border-2 border-red-50 rounded-[2rem] p-6 mb-8 relative overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4">
           <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-full -mr-8 -mt-8 z-0"></div>
           <div className="relative z-10">
               <div className="flex items-start gap-4 mb-4">
                    <div className="bg-red-100 p-3 rounded-2xl text-red-500 shrink-0">
                        <AlertCircle size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg mb-1 font-serif">Growing Up!</h3>
                        <p className="text-sm text-slate-500 leading-relaxed font-bold">
                        We found <span className="text-red-500">{outgrownItems.length} items</span> that might be too small for {calculateAge(currentKid?.birthDate || '')}.
                        </p>
                    </div>
               </div>
               
               <div className="flex gap-2 overflow-x-auto no-scrollbar pb-4 mb-2">
                   {outgrownItems.map(item => (
                       <div 
                         key={item.id} 
                         onClick={() => setSelectedItem(item)}
                         className="shrink-0 w-16 h-16 rounded-xl bg-slate-50 overflow-hidden relative border border-slate-100 cursor-pointer"
                        >
                           <img src={item.image} className="w-full h-full object-cover opacity-80" />
                           <div className="absolute bottom-0 inset-x-0 bg-red-500/80 text-white text-[10px] text-center font-bold">
                               {item.sizeLabel}
                           </div>
                       </div>
                   ))}
               </div>

               <button 
                onClick={handleArchiveOutgrown}
                className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 text-red-500 font-bold rounded-xl hover:bg-red-100 transition-colors"
               >
                   <Archive size={18} /> Archive All
               </button>
           </div>
        </section>
      )}

      {justArchivedCount > 0 && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-8 z-50">
              <CheckCircle2 className="text-green-400" size={20} />
              <span className="font-bold">Archived {justArchivedCount} items</span>
          </div>
      )}

      <section>
        <div className="flex justify-between items-center mb-4 px-1">
          <h2 className="text-lg text-slate-800 font-serif font-bold">Recent Upload</h2>
          <Link to="/closet" className="text-sm font-bold text-orange-500 hover:text-orange-600">
            See All
          </Link>
        </div>
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-6 px-6">
          {allItems?.slice().reverse().slice(0, 5).map(item => (
            <div key={item.id} className="w-24 shrink-0 cursor-pointer transition-transform active:scale-95" onClick={() => setSelectedItem(item)}>
                 <div className="aspect-square rounded-[1.5rem] overflow-hidden bg-white border border-slate-100 shadow-sm mb-2">
                    <img src={item.image} alt={item.description} className="w-full h-full object-cover" />
                 </div>
            </div>
          ))}
        </div>
      </section>

      <ItemDetailModal 
        item={selectedItem} 
        onClose={() => setSelectedItem(null)} 
        onToggleArchive={handleToggleArchive}
      />
    </div>
  );
};