import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { WeatherWidget } from '../components/WeatherWidget';
import { WeatherData, ClothingItem, Season, Category, ChildProfile } from '../types';
import { Shirt, AlertCircle, Cake, Archive, CheckCircle2, MapPin, RefreshCw, Sparkles, Heart, RotateCcw, Ruler, Weight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { getCoordinates, fetchWeather } from '../services/weatherService';
import clsx from 'clsx';

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

// Returns standard max dimensions for common clothing sizes
// Data roughly based on standard growth charts (CDC/WHO)
const getSizeLimits = (sizeLabel: string) => {
    const s = sizeLabel.toUpperCase().replace(/\s/g, '');
    
    // Format: { maxMonths, maxCm, maxKg }
    if (s === 'NB' || s === 'NEWBORN') return { m: 1, cm: 55, kg: 4.5 };
    if (s.includes('0-3M')) return { m: 3, cm: 61, kg: 6.0 };
    if (s.includes('3-6M')) return { m: 6, cm: 67, kg: 8.0 };
    if (s.includes('6-9M')) return { m: 9, cm: 72, kg: 9.5 };
    if (s.includes('9-12M')) return { m: 12, cm: 78, kg: 11.0 };
    if (s.includes('12-18M')) return { m: 18, cm: 83, kg: 12.5 };
    if (s.includes('18-24M')) return { m: 24, cm: 88, kg: 13.5 };
    
    // Single month markers usually imply "Up to X months"
    if (s === '3M') return { m: 3, cm: 61, kg: 6.0 };
    if (s === '6M') return { m: 6, cm: 67, kg: 8.0 };
    if (s === '9M') return { m: 9, cm: 72, kg: 9.5 };
    if (s === '12M') return { m: 12, cm: 78, kg: 11.0 };
    if (s === '18M') return { m: 18, cm: 83, kg: 12.5 };
    if (s === '24M') return { m: 24, cm: 88, kg: 13.5 };
    
    // Toddler Years
    if (s === '2T' || s === '2Y') return { m: 30, cm: 92, kg: 14.5 };
    if (s === '3T' || s === '3Y') return { m: 42, cm: 100, kg: 16.5 };
    if (s === '4T' || s === '4Y') return { m: 54, cm: 108, kg: 18.5 };
    if (s === '5T' || s === '5Y') return { m: 66, cm: 115, kg: 21.0 };
    if (s === '6' || s === '6Y' || s === 'XS') return { m: 78, cm: 120, kg: 24.0 };
    if (s === '7' || s === '7Y') return { m: 90, cm: 125, kg: 27.0 };
    
    // Fallback: Try to parse generic number as year or month
    const numbers = s.match(/\d+/g);
    if (numbers && numbers.length > 0) {
        const num = parseInt(numbers[numbers.length - 1], 10);
        // If small number, assume years
        if (num > 0 && num < 14) return { m: num * 12 + 6, cm: 80 + (num * 6), kg: 10 + (num * 2) }; // Rough estimate
    }

    return null;
};

// Check if item is outgrown based on available stats
const isItemOutgrown = (item: ClothingItem, kid: ChildProfile): boolean => {
    if (item.ignoreOutgrown || !item.sizeLabel) return false;
    
    const limits = getSizeLimits(item.sizeLabel);
    if (!limits) return false;

    // Check Height (if available) - allow 2cm buffer
    if (kid.height && kid.height > limits.cm + 2) return true;

    // Check Weight (if available) - allow 0.5kg buffer
    if (kid.weight && kid.weight > limits.kg + 0.5) return true;

    // Fallback to Age if stats missing
    if (!kid.height && !kid.weight && kid.birthDate) {
        const ageMonths = getAgeInMonths(kid.birthDate);
        if (ageMonths > limits.m + 1) return true;
    }

    return false;
};

const OutfitCollage: React.FC<{ items: ClothingItem[], onClickItem: (i: ClothingItem) => void }> = ({ items, onClickItem }) => {
    // Categorize items for layout
    const outer = items.find(i => i.category === Category.Outerwear);
    const top = items.find(i => [Category.Top, Category.Dress, Category.FullBody, Category.Pajamas, Category.Swimwear].includes(i.category));
    const bottom = items.find(i => [Category.Bottom, Category.Skirt, Category.Underwear].includes(i.category));
    const shoes = items.find(i => i.category === Category.Shoes);
    // Treat socks as accessories for display purposes in the collage to ensure they appear
    const acc = items.find(i => [Category.Accessory, Category.Sock].includes(i.category));

    // Determines if we have a "One Piece" outfit (Dress/Fullbody) or "Two Piece" (Top/Bottom)
    const isOnePiece = top && [Category.Dress, Category.FullBody, Category.Pajamas, Category.Swimwear].includes(top.category);

    const ItemBox = ({ item, className }: { item?: ClothingItem, className?: string }) => (
        item ? (
            <div 
                onClick={() => onClickItem(item)}
                className={clsx(
                    "relative overflow-hidden rounded-[1.5rem] bg-white border border-slate-100 shadow-sm cursor-pointer transition-transform active:scale-95 flex items-center justify-center p-2 group",
                    className
                )}
            >
                <img src={item.image} alt={item.category} className="max-w-full max-h-full object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute bottom-2 left-2 bg-white/80 backdrop-blur px-2 py-0.5 rounded-lg text-[10px] font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.brand}
                </div>
                {item.isFavorite && (
                    <div className="absolute top-2 right-2 bg-white/90 backdrop-blur p-1 rounded-full shadow-sm text-red-500">
                        <Heart size={10} fill="currentColor" />
                    </div>
                )}
            </div>
        ) : null
    );

    return (
        <div className="bg-white rounded-[2.5rem] p-4 shadow-xl shadow-slate-200/50 border border-slate-50">
            <div className="flex flex-col gap-3 min-h-[320px]">
                {/* Main Body Area */}
                <div className="flex gap-3 flex-1 min-h-0">
                    {/* Left Column: Outerwear (if exists) + Top */}
                    <div className="flex-1 flex flex-col gap-3">
                        {outer && <ItemBox item={outer} className="h-1/3 bg-slate-50" />}
                        <ItemBox item={top} className={clsx("bg-orange-50/50", outer ? "h-2/3" : "h-full")} />
                    </div>

                    {/* Right Column: Bottom + Shoes */}
                    <div className="flex-1 flex flex-col gap-3">
                         {isOnePiece ? (
                             // If dress, maybe show accessories or just empty/full height dress on left
                             // Let's put accessories here if one piece
                             <div className="flex-1 flex flex-col gap-3">
                                 {acc ? <ItemBox item={acc} className="h-1/3 bg-pink-50/50" /> : <div className="h-1/3 rounded-[1.5rem] bg-slate-50/50 border border-dashed border-slate-200 flex items-center justify-center text-slate-200 text-xs font-bold">No Acc</div>}
                                 {/* If it's a dress, the "Top" slot on left covers the main garment. Right side is mostly accessories/empty? 
                                     Actually, let's span the Dress across if no bottom.
                                     For now, let's keep the grid simple. If no bottom, the slot is empty or we use it for shoes.
                                 */}
                                 <ItemBox item={shoes} className="flex-1 bg-slate-50" />
                             </div>
                         ) : (
                             <>
                                <ItemBox item={bottom} className="flex-1 bg-blue-50/30" />
                                {shoes && <ItemBox item={shoes} className="h-1/3 bg-slate-50" />}
                             </>
                         )}
                    </div>
                </div>
                
                {/* Horizontal Accessory bar if not placed yet (e.g. if 2-piece outfit) */}
                {!isOnePiece && acc && (
                    <div className="h-20 flex gap-3">
                         <ItemBox item={acc} className="w-20 bg-pink-50/50" />
                         <div className="flex-1 rounded-[1.5rem] bg-slate-50/30 border border-dashed border-slate-200 flex items-center justify-center">
                             <span className="text-slate-300 text-xs font-bold font-serif italic">The Details</span>
                         </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export const Dashboard: React.FC = () => {
  const [suggestion1, setSuggestion1] = useState<ClothingItem[]>([]);
  const [suggestion2, setSuggestion2] = useState<ClothingItem[]>([]);
  const [activeOption, setActiveOption] = useState<1 | 2>(1);
  const [justArchivedIds, setJustArchivedIds] = useState<number[]>([]);
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  
  // Weather State
  const [weather, setWeather] = useState<WeatherData>({
    condition: 'Sunny',
    temp: 20,
    description: 'Fetching forecast...'
  });
  const [locationEnabled, setLocationEnabled] = useState(false);

  const profile = useLiveQuery(() => db.profile.toArray());
  const allItems = useLiveQuery(() => db.items.filter(i => !i.isArchived).toArray());
  const currentKid = profile?.[0];

  // Initialize Weather
  useEffect(() => {
    const initWeather = async () => {
        try {
            const coords = await getCoordinates();
            setLocationEnabled(true);
            const data = await fetchWeather(coords.lat, coords.lon);
            setWeather(data);
        } catch (e) {
            console.log("Using default weather", e);
            setLocationEnabled(false);
            setWeather({ condition: 'Sunny', temp: 22, description: 'Local weather unavailable' });
        }
    };
    initWeather();
  }, []);

  // OUTFIT ALGORITHM
  useEffect(() => {
    if (!allItems || allItems.length === 0) return;

    // Filter items pool to exclude anything outgrown (unless ignored)
    const fitItems = allItems.filter(item => !currentKid || !isItemOutgrown(item, currentKid));

    const generateSmartOutfit = (seed: number): ClothingItem[] => {
        const t = weather.temp;
        let suitableSeasons: Season[] = [Season.All];
        let needsOuterwear = false;
        let preferLayers = false;
        
        // Temperature Logic
        if (t >= 26) {
            suitableSeasons = [Season.Summer];
        } else if (t >= 20) {
            suitableSeasons = [Season.Summer, Season.Spring];
        } else if (t >= 15) {
            suitableSeasons = [Season.Spring, Season.Fall];
            if (t < 18) preferLayers = true;
        } else if (t >= 10) {
            suitableSeasons = [Season.Fall, Season.Winter];
            needsOuterwear = true;
        } else {
            suitableSeasons = [Season.Winter];
            needsOuterwear = true;
        }

        // Helpers
        const getPool = (cats: Category[], seasons: Season[]) => {
            return fitItems.filter(i => 
                cats.includes(i.category) && 
                (i.seasons.some(s => seasons.includes(s)) || i.seasons.includes(Season.All))
            );
        };

        const pick = (arr: ClothingItem[]) => {
            if (arr.length === 0) return null;
            
            // Prioritize Favorites: 40% chance to force pick a favorite if available
            const favs = arr.filter(i => i.isFavorite);
            if (favs.length > 0 && Math.random() < 0.4) {
                 const idx = Math.floor(Math.random() * favs.length);
                 return favs[idx];
            }

            // Standard weighted random using seed
            const idx = Math.floor((seed * 17 + Math.random() * 100)) % arr.length;
            return arr[idx];
        };

        const outfit: ClothingItem[] = [];

        // 1. Core Outfit (Dress vs Top+Bottom)
        // Prefer dress in summer/spring if available
        const dresses = getPool([Category.Dress, Category.FullBody, Category.Pajamas], suitableSeasons);
        const tops = getPool([Category.Top], suitableSeasons);
        const bottoms = getPool([Category.Bottom, Category.Skirt], suitableSeasons);

        // Decision: 30% chance for dress if warm, less if cold (unless fullbody winter suit)
        const canWearDress = dresses.length > 0;
        const canWearTwoPiece = tops.length > 0 && bottoms.length > 0;
        
        let chooseDress = false;
        if (canWearDress && canWearTwoPiece) {
             // If we have a favorite dress, increase chance to pick dress
             const hasFavDress = dresses.some(d => d.isFavorite);
             const hasFavTwoPiece = tops.some(t => t.isFavorite) || bottoms.some(b => b.isFavorite);
             
             let dressChance = 0.3;
             if (hasFavDress && !hasFavTwoPiece) dressChance = 0.6;
             
             chooseDress = Math.random() < dressChance; 
        } else if (canWearDress) {
             chooseDress = true;
        }

        if (chooseDress) {
            const dress = pick(dresses);
            if (dress) outfit.push(dress);
        } else {
            const top = pick(tops);
            const bottom = pick(bottoms);
            if (top) outfit.push(top);
            if (bottom) outfit.push(bottom);
        }

        // 2. Outerwear
        if (needsOuterwear || (preferLayers && Math.random() > 0.5)) {
            // Loosen season restriction for outerwear slightly if exact season missing
            let outers = getPool([Category.Outerwear], suitableSeasons);
            if (outers.length === 0 && needsOuterwear) {
                 // Fallback to any outerwear if strictly needed
                 outers = fitItems.filter(i => i.category === Category.Outerwear);
            }
            const outer = pick(outers);
            if (outer) outfit.push(outer);
        }

        // 3. Shoes
        const shoes = getPool([Category.Shoes], suitableSeasons);
        const shoe = pick(shoes);
        if (shoe) outfit.push(shoe);

        // 4. Accessories
        if (Math.random() > 0.6) {
             // Include Socks as potential accessories
             const accs = getPool([Category.Accessory, Category.Sock], suitableSeasons);
             const acc = pick(accs);
             if (acc) outfit.push(acc);
        }

        return outfit;
    };

    setSuggestion1(generateSmartOutfit(Math.random()));
    setTimeout(() => setSuggestion2(generateSmartOutfit(Math.random())), 50);
    
  }, [allItems, weather, currentKid]);

  const activeSuggestion = activeOption === 1 ? suggestion1 : suggestion2;

  // Identify outgrown items for the alert section
  const outgrownItems = allItems?.filter(item => {
    if (!currentKid) return false;
    return isItemOutgrown(item, currentKid);
  }) || [];

  const handleArchiveOutgrown = async () => {
      if (outgrownItems.length === 0) return;
      const ids = outgrownItems.map(i => i.id).filter(id => id !== undefined) as number[];
      if (ids.length > 0) {
          await db.items.bulkUpdate(ids.map(id => ({ key: id, changes: { isArchived: true } })));
          setJustArchivedIds(ids);
          setTimeout(() => setJustArchivedIds([]), 5000);
      }
  };
  
  const handleUndoArchive = async () => {
      if (justArchivedIds.length > 0) {
          await db.items.bulkUpdate(justArchivedIds.map(id => ({ key: id, changes: { isArchived: false } })));
          setJustArchivedIds([]);
      }
  };

  const handleToggleArchive = async (item: ClothingItem) => {
      if (item.id) {
          await db.items.update(item.id, { isArchived: !item.isArchived });
          setSelectedItem(null);
      }
  };

  const handleMarkAsFitting = async (item: ClothingItem) => {
      if (item.id) {
          await db.items.update(item.id, { ignoreOutgrown: true });
          setSelectedItem(null);
      }
  };

  const regenerate = () => {
      setActiveOption(prev => prev === 1 ? 2 : 1);
  };

  const formatStats = () => {
      if (!currentKid?.height && !currentKid?.weight) return null;
      
      const isImp = currentKid.unitSystem === 'imperial';
      const parts = [];
      
      if (currentKid.height) {
          if (isImp) {
              // Convert cm to inches, or feet/inches? Let's just do inches or X'Y"
              const inchesTotal = currentKid.height / 2.54;
              parts.push(`${inchesTotal.toFixed(0)} in`);
          } else {
              parts.push(`${currentKid.height} cm`);
          }
      }
      
      if (currentKid.weight) {
          if (isImp) {
              const lbs = currentKid.weight * 2.20462;
              parts.push(`${lbs.toFixed(1)} lb`);
          } else {
              parts.push(`${currentKid.weight} kg`);
          }
      }
      
      return parts.join(' • ');
  };

  return (
    <div className="p-6 pb-28 max-w-md mx-auto">
      <header className="mb-8 pt-4 flex justify-between items-end">
        <div>
            <Logo />
            <div className="flex flex-col mt-2 ml-1">
                <p className="text-slate-500 font-bold text-lg">
                  Hi, {currentKid?.name || 'Little One'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                    {currentKid?.birthDate && (
                        <div className="flex items-center gap-1 bg-pink-100 text-pink-500 px-2 py-0.5 rounded-full font-bold text-[10px]">
                            <Cake size={10} />
                            <span>{calculateAge(currentKid.birthDate)}</span>
                        </div>
                    )}
                    {formatStats() && (
                        <div className="flex items-center gap-1 bg-sky-100 text-sky-500 px-2 py-0.5 rounded-full font-bold text-[10px]">
                            <Ruler size={10} />
                            <span>{formatStats()}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
        <Link to="/settings" className="h-12 w-12 rounded-full bg-sky-200 text-sky-700 flex items-center justify-center font-bold text-xl font-serif border-2 border-white shadow-sm mb-2 overflow-hidden relative transition-transform active:scale-95">
            {currentKid?.avatar ? (
                <img src={currentKid.avatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
                (currentKid?.name || 'K')[0]
            )}
        </Link>
      </header>

      <div className="relative">
        {locationEnabled && (
            <div className="absolute top-4 right-4 z-10 text-slate-800/30">
                <MapPin size={16} />
            </div>
        )}
        <WeatherWidget data={weather} />
      </div>

      <section className="mb-10">
        <div className="flex justify-between items-center mb-4 px-1">
          <div className="flex items-center gap-2">
              <Sparkles className="text-orange-400" size={20} />
              <h2 className="text-xl text-slate-800 font-serif font-bold">Today's Look</h2>
          </div>
          
          <button 
            onClick={regenerate}
            className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full text-xs font-bold text-slate-500 shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors"
          >
              <RefreshCw size={12} className={clsx("transition-transform", activeOption === 1 ? "rotate-0" : "rotate-180")} />
              Shuffle
          </button>
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
           <div className="animate-in fade-in slide-in-from-bottom-4 duration-500" key={activeOption}>
               <OutfitCollage items={activeSuggestion} onClickItem={setSelectedItem} />
           </div>
        ) : (
          <div className="p-8 rounded-[2.5rem] bg-orange-50 border border-orange-100 text-orange-800 font-medium text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <AlertCircle size={24} />
            </div>
            <div>
                No items match this weather! <br/> 
                <span className="text-xs opacity-70">Add some {weather.temp > 20 ? 'Summer' : 'Winter'} clothes.</span>
            </div>
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
                        We found <span className="text-red-500">{outgrownItems.length} items</span> that might be too small for {currentKid?.name || 'your kid'}.
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

      {justArchivedIds.length > 0 && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-8 z-50 whitespace-nowrap">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-green-400" size={20} />
                <span className="font-bold">Archived {justArchivedIds.length} items</span>
              </div>
              <div className="w-px h-6 bg-slate-600"></div>
              <button 
                onClick={handleUndoArchive}
                className="font-bold text-orange-300 hover:text-white flex items-center gap-1 transition-colors"
              >
                  <RotateCcw size={16} /> Undo
              </button>
          </div>
      )}

      <ItemDetailModal 
        item={selectedItem} 
        onClose={() => setSelectedItem(null)} 
        onToggleArchive={handleToggleArchive}
        isOutgrown={outgrownItems.some(i => i.id === selectedItem?.id)}
        onMarkAsFitting={handleMarkAsFitting}
      />
    </div>
  );
};