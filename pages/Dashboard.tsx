import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { WeatherWidget } from '../components/WeatherWidget';
import { WeatherData, ClothingItem, Season, Category, OutfitLike } from '../types';
import { Shirt, AlertCircle, Cake, Archive, CheckCircle2, MapPin, Sparkles, Smile, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { getCoordinates, fetchWeather } from '../services/weatherService';

// --- STYLING UTILS ---
const NEUTRALS = ['white', 'black', 'grey', 'gray', 'beige', 'cream', 'denim', 'navy', 'brown', 'tan', 'khaki', 'ivory', 'oat', 'stone'];

const isNeutral = (color?: string) => {
    if (!color) return true;
    const c = color.toLowerCase().trim();
    // Check strict neutrals
    return NEUTRALS.some(n => c.includes(n));
};

const isMonochrome = (c1?: string, c2?: string) => {
    if (!c1 || !c2) return false;
    const a = c1.toLowerCase();
    const b = c2.toLowerCase();
    // Check if one contains the other (e.g. "Light Blue" and "Blue") or precise match
    return a.includes(b) || b.includes(a);
};

// --- AGE UTILS ---
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
    
    if (s.includes('M')) {
        const numbers = s.match(/\d+/g);
        if (numbers && numbers.length > 0) return parseInt(numbers[numbers.length - 1], 10);
    }
    
    if (s.includes('T') || s.includes('Y')) {
        const numbers = s.match(/\d+/g);
        if (numbers && numbers.length > 0) return parseInt(numbers[numbers.length - 1], 10) * 12;
    }

    const plainNum = parseInt(s, 10);
    if (!isNaN(plainNum) && plainNum < 14) return plainNum * 12;
    if (s === 'NB' || s === 'NEWBORN') return 1;

    return null;
};

export const Dashboard: React.FC = () => {
  const [suggestion1, setSuggestion1] = useState<ClothingItem[]>([]);
  const [suggestion2, setSuggestion2] = useState<ClothingItem[]>([]);
  const [activeTab, setActiveTab] = useState<'playful' | 'chic'>('playful');
  const [justArchivedCount, setJustArchivedCount] = useState(0);
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  
  // Like State
  const [isLiked, setIsLiked] = useState(false);
  const [showHeartAnim, setShowHeartAnim] = useState(false);

  // Weather State
  const [weather, setWeather] = useState<WeatherData>({
    condition: 'Sunny',
    temp: 20,
    description: 'Fetching forecast...'
  });
  const [locationEnabled, setLocationEnabled] = useState(false);

  const profile = useLiveQuery(() => db.profile.toArray());
  const allItems = useLiveQuery(() => db.items.filter(i => !i.isArchived).toArray());
  const likedOutfits = useLiveQuery(() => db.outfitLikes.toArray());
  
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
            setWeather({
                condition: 'Sunny',
                temp: 22,
                description: 'Local weather unavailable'
            });
        }
    };
    initWeather();
  }, []);

  // --- OOTD GENERATION ---
  useEffect(() => {
    if (!allItems || allItems.length === 0) return;

    // Reset like state when regenerating
    setIsLiked(false);

    let targetSeason: Season = Season.All;
    const temp = weather.temp;

    if (temp > 25) targetSeason = Season.Summer;
    else if (temp > 15) targetSeason = Season.Spring;
    else if (temp > 5) targetSeason = Season.Fall;
    else targetSeason = Season.Winter;

    // Filter suitable items for current weather
    const suitable = allItems.filter(item => 
      item.seasons.includes(targetSeason) || item.seasons.includes(Season.All)
    );

    const tops = suitable.filter(i => i.category === Category.Top);
    const bottoms = suitable.filter(i => i.category === Category.Bottom);
    const fullBody = suitable.filter(i => i.category === Category.FullBody);
    const outerwear = suitable.filter(i => i.category === Category.Outerwear);
    const shoes = suitable.filter(i => i.category === Category.Shoes);
    const accessories = suitable.filter(i => i.category === Category.Accessory);

    // --- SMART STYLING ENGINE ---
    const generateStyledOutfit = (style: 'playful' | 'chic') => {
        const outfit: ClothingItem[] = [];
        const shuffle = (arr: ClothingItem[]) => [...arr].sort(() => Math.random() - 0.5);

        // --- Helper: Check History ---
        // Returns a score if these items have been liked together before
        const getPairAffinity = (itemA: ClothingItem, listB: ClothingItem[]): ClothingItem[] => {
            if (!likedOutfits || !itemA.id) return listB;

            // Find all outfits that contained itemA
            const relatedOutfits = likedOutfits.filter(o => o.itemIds.includes(itemA.id!));
            
            // Extract IDs of paired items from history
            const pairedIds = new Set<number>();
            relatedOutfits.forEach(o => o.itemIds.forEach(id => pairedIds.add(id)));

            // Sort listB: Items that were paired with itemA come first
            return [...listB].sort((a, b) => {
                const aLoved = a.id && pairedIds.has(a.id) ? 1 : 0;
                const bLoved = b.id && pairedIds.has(b.id) ? 1 : 0;
                return bLoved - aLoved;
            });
        };

        // -- Step 1: Base Layer --
        let useFullBody = false;
        const shuffledFull = shuffle(fullBody);
        const shuffledTops = shuffle(tops);
        const shuffledBottoms = shuffle(bottoms);

        if (style === 'chic') {
            // Chic prefers dresses/one-pieces (70%)
             if (shuffledFull.length > 0 && Math.random() > 0.3) useFullBody = true;
        } else {
            // Playful prefers separates (70%)
             if (shuffledFull.length > 0 && (shuffledTops.length === 0 || Math.random() > 0.7)) useFullBody = true;
        }
        
        // Fallback checks
        if (shuffledTops.length === 0 || shuffledBottoms.length === 0) {
            if (shuffledFull.length > 0) useFullBody = true;
            else return []; // No valid outfit possible
        }

        if (useFullBody) {
            outfit.push(shuffledFull[0]);
        } else {
            // Pick Top
            const top = shuffledTops[0];
            outfit.push(top);

            // Smart Bottom Matching
            // 1. Get bottoms sorted by previous likes (Affinity)
            let candidateBottoms = getPairAffinity(top, shuffledBottoms);
            
            // 2. Filter by Style Rules
            let validBottoms: ClothingItem[] = [];
            
            if (style === 'chic') {
                // Chic Rule: Neutral + Neutral OR Monochrome. 
                if (!isNeutral(top.color)) {
                     validBottoms = candidateBottoms.filter(b => isNeutral(b.color) || isMonochrome(top.color, b.color));
                } else {
                     validBottoms = candidateBottoms;
                }
            } else {
                // Playful Rule: Color Blocking OK, but prefer affinity.
                if (!isNeutral(top.color)) {
                    // Try to find neutral bottoms first to avoid clashes
                    const neutralBottoms = candidateBottoms.filter(b => isNeutral(b.color));
                    // 50% chance to force neutral if top is bright, unless we have a specific history match
                    if (neutralBottoms.length > 0 && Math.random() > 0.5) {
                        validBottoms = neutralBottoms;
                    } else {
                        validBottoms = candidateBottoms;
                    }
                } else {
                    validBottoms = candidateBottoms;
                }
            }

            // Fallback
            const bottom = validBottoms.length > 0 ? validBottoms[0] : candidateBottoms[0];
            outfit.push(bottom);
        }

        // -- Step 2: Layers --
        if (temp < 19 && outerwear.length > 0) {
            const baseItem = outfit[0];
            // Coordinate outer with base
            const matchingOuter = outerwear.filter(o => isNeutral(o.color) || isMonochrome(baseItem.color, o.color));
            
            const outer = matchingOuter.length > 0 
                ? matchingOuter[Math.floor(Math.random() * matchingOuter.length)] 
                : outerwear[Math.floor(Math.random() * outerwear.length)];
            
            outfit.push(outer);
        }

        // -- Step 3: Shoes --
        if (shoes.length > 0) {
            const baseItem = outfit[0];
            // Match shoes to base or go neutral
            const matchingShoes = shoes.filter(s => isNeutral(s.color) || isMonochrome(baseItem.color, s.color));
            
            const shoe = matchingShoes.length > 0 
                ? matchingShoes[Math.floor(Math.random() * matchingShoes.length)] 
                : shoes[Math.floor(Math.random() * shoes.length)];
            
            outfit.push(shoe);
        }
        
        // -- Step 4: Accessories --
        // Add if Chic or Cold (< 10C)
        if (accessories.length > 0 && (style === 'chic' || temp < 10)) {
             const acc = accessories[Math.floor(Math.random() * accessories.length)];
             outfit.push(acc);
        }

        return outfit;
    };

    // Only regenerate when items change or weather changes drastically
    // This prevents flicker, but we need to ensure we run this initially
    setSuggestion1(generateStyledOutfit('playful'));
    setSuggestion2(generateStyledOutfit('chic'));
    
  }, [allItems, weather, likedOutfits]); // Add likedOutfits to dep array so it gets smarter as you like things

  const activeSuggestion = activeTab === 'playful' ? suggestion1 : suggestion2;

  const handleLikeOutfit = async () => {
      if (isLiked || activeSuggestion.length === 0) return;

      const itemIds = activeSuggestion.map(i => i.id).filter(id => id !== undefined) as number[];
      
      if (itemIds.length > 0) {
          await db.outfitLikes.add({
              itemIds,
              style: activeTab,
              date: Date.now()
          });
          
          setIsLiked(true);
          setShowHeartAnim(true);
          setTimeout(() => setShowHeartAnim(false), 1000);
      }
  };

  // Identify outgrown items
  const outgrownItems = allItems?.filter(item => {
    if (!currentKid?.birthDate) return false;
    if (!item.sizeLabel) return false;
    
    const currentAgeMonths = getAgeInMonths(currentKid.birthDate);
    const maxMonths = parseSizeToMaxMonths(item.sizeLabel);
    
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
          setSelectedItem(null);
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

      <div className="relative">
        {locationEnabled && (
            <div className="absolute top-4 right-4 z-10 text-slate-800/30">
                <MapPin size={16} />
            </div>
        )}
        <WeatherWidget data={weather} />
      </div>

      <section className="mb-10 relative">
        <div className="flex justify-between items-center mb-4 px-1">
          <div className="flex items-center gap-4">
              <h2 className="text-lg text-slate-800 font-serif font-bold">Today's Outfit</h2>
              <div className="flex bg-white rounded-full p-1 shadow-sm border border-slate-100">
                  <button 
                    onClick={() => { setActiveTab('playful'); setIsLiked(false); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${activeTab === 'playful' ? 'bg-orange-400 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                      <Smile size={12} /> Playful
                  </button>
                  <button 
                    onClick={() => { setActiveTab('chic'); setIsLiked(false); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${activeTab === 'chic' ? 'bg-sky-400 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                      <Sparkles size={12} /> Chic
                  </button>
              </div>
          </div>
          
          {/* Like Button */}
          {activeSuggestion.length > 0 && (
             <button 
                onClick={handleLikeOutfit}
                disabled={isLiked}
                className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-all border ${isLiked ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100 active:scale-95'}`}
             >
                 <Heart 
                    size={20} 
                    className={`transition-all duration-300 ${isLiked ? 'fill-red-500 text-red-500 scale-110' : 'text-slate-300 hover:text-slate-400'}`} 
                 />
                 {/* Floating Heart Animation */}
                 {showHeartAnim && (
                     <div className="absolute pointer-events-none animate-out fade-out slide-out-to-top-10 duration-1000 z-50">
                         <Heart size={40} className="fill-red-500 text-red-500" />
                     </div>
                 )}
             </button>
          )}
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
          <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300" key={activeTab}>
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
                    <p className="text-xs text-slate-500 font-bold uppercase truncate">{item.brand}</p>
                 </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-[2rem] bg-orange-50 border border-orange-100 text-center">
            <p className="text-orange-900 font-bold mb-1">Wardrobe Gap!</p>
            <p className="text-sm text-orange-700/70">
                No items match the <span className="font-bold">{weather.temp > 20 ? 'Summer' : 'Cold'}</span> weather in this style.
            </p>
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