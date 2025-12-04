
import React, { useEffect, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { WeatherWidget } from '../components/WeatherWidget';
import { WeatherData, ClothingItem, Season, Category } from '../types';
import { Shirt, AlertCircle, Cake, Archive, CheckCircle2, Sparkles, Smile, Heart, RotateCcw, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { getCoordinates, fetchWeather } from '../services/weatherService';

// --- STYLING INTELLIGENCE UTILS ---

const PALETTES = {
    neutrals: ['white', 'black', 'grey', 'gray', 'beige', 'cream', 'ivory', 'oat', 'stone', 'charcoal'],
    earthy: ['sage', 'olive', 'clay', 'terracotta', 'rust', 'mustard', 'brown', 'tan', 'cocoa', 'sand', 'khaki'],
    pastels: ['mint', 'blush', 'pale', 'baby blue', 'lilac', 'butter', 'peach', 'rose'],
    vibrant: ['red', 'royal', 'yellow', 'green', 'pink', 'orange']
};

// Helper to clean color strings for comparison
const cleanColor = (c: string) => c.toLowerCase().trim();

const isNeutral = (color?: string) => {
    if (!color) return true;
    const c = cleanColor(color);
    return PALETTES.neutrals.some(n => c.includes(n));
};

const isEarthy = (color?: string) => {
    if (!color) return false;
    const c = cleanColor(color);
    return PALETTES.earthy.some(n => c.includes(n));
};

// Check if colors are in the same family (Monochrome)
const isTonal = (c1?: string, c2?: string) => {
    if (!c1 || !c2) return false;
    const a = cleanColor(c1);
    const b = cleanColor(c2);
    // Direct match or substring match (e.g. "Light Blue" & "Blue")
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
  const [notification, setNotification] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  
  // Like State
  const [isLiked, setIsLiked] = useState(false);
  const [showHeartAnim, setShowHeartAnim] = useState(false);

  // Weather Cache Logic
  const getCachedWeather = () => {
      try {
          const cached = localStorage.getItem('tinyCloset_weather_cache');
          if (cached) {
              const { timestamp, data } = JSON.parse(cached);
              // Cache valid for 30 minutes
              if (Date.now() - timestamp < 30 * 60 * 1000) {
                  return data;
              }
          }
      } catch (e) {
          console.error("Weather cache error", e);
      }
      return null;
  };

  const cachedWeather = getCachedWeather();

  // Weather State
  const [weather, setWeather] = useState<WeatherData>(cachedWeather || {
    condition: 'Sunny',
    temp: 20,
    description: 'Fetching forecast...'
  });
  
  const [locationEnabled, setLocationEnabled] = useState(!!cachedWeather);

  const profile = useLiveQuery(() => db.profile.toArray());
  const allItems = useLiveQuery(() => db.items.filter(i => !i.isArchived).toArray());
  
  const arraysEqual = (a: number[], b: number[]) => {
      if (a.length !== b.length) return false;
      const sortedA = [...a].sort();
      const sortedB = [...b].sort();
      return sortedA.every((val, index) => val === sortedB[index]);
  };
  
  const likedOutfits = useLiveQuery(() => db.outfitLikes.toArray());
  
  const currentKid = profile?.[0];

  // Initialize Weather
  useEffect(() => {
    const initWeather = async () => {
        // If we have valid cache (checked on mount), skip fetch
        if (getCachedWeather()) return;

        try {
            const coords = await getCoordinates();
            setLocationEnabled(true);
            const data = await fetchWeather(coords.lat, coords.lon);
            setWeather(data);
            
            localStorage.setItem('tinyCloset_weather_cache', JSON.stringify({
                timestamp: Date.now(),
                data
            }));
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

  // --- ADVANCED STYLING ENGINE ---
  const generateOutfits = useCallback((forceShuffle = false) => {
    if (!allItems || allItems.length === 0) return;

    const todayKey = `tinyCloset_suggestions_${new Date().toLocaleDateString()}`;

    // 0. Try loading from storage first (Persistence Layer)
    if (!forceShuffle) {
        try {
            const saved = localStorage.getItem(todayKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.playful && parsed.chic) {
                    const recover = (ids: number[]) => ids.map(id => allItems.find(i => i.id === id)).filter(Boolean) as ClothingItem[];
                    const s1 = recover(parsed.playful);
                    const s2 = recover(parsed.chic);
                    
                    if (s1.length > 0 || s2.length > 0) {
                        setSuggestion1(s1);
                        setSuggestion2(s2);
                        return; // Successfully loaded, skip generation
                    }
                }
            }
        } catch (e) {
            console.error("Storage load failed", e);
        }
    }

    // Reset like state if we are regenerating
    setIsLiked(false);

    // 1. Determine Season Context
    let targetSeason: Season = Season.All;
    const temp = weather.temp;
    if (temp > 25) targetSeason = Season.Summer;
    else if (temp > 15) targetSeason = Season.Spring;
    else if (temp > 5) targetSeason = Season.Fall;
    else targetSeason = Season.Winter;

    // 2. Filter Pool
    const suitable = allItems.filter(item => 
      item.seasons.includes(targetSeason) || item.seasons.includes(Season.All)
    );

    const tops = suitable.filter(i => i.category === Category.Top);
    const bottoms = suitable.filter(i => i.category === Category.Bottom);
    const fullBody = suitable.filter(i => i.category === Category.FullBody);
    const outerwear = suitable.filter(i => i.category === Category.Outerwear);
    const shoes = suitable.filter(i => i.category === Category.Shoes);
    const accessories = suitable.filter(i => i.category === Category.Accessory);

    // 3. User Behavior Weighting
    // Calculate Brand Affinity: How many items of each brand does the user own?
    const brandCounts: Record<string, number> = {};
    allItems.forEach(i => {
        if(i.brand && i.brand !== 'Unknown') {
            brandCounts[i.brand] = (brandCounts[i.brand] || 0) + 1;
        }
    });

    // Determine Top Brands (e.g. top 3 by count)
    const topBrands = Object.entries(brandCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);

    // Weighted Random Picker
    // Items from brands you own a lot of have a significantly higher chance of being the "Anchor".
    const pickWeightedAnchor = (items: ClothingItem[]): ClothingItem | null => {
        if (items.length === 0) return null;
        
        const weightedPool: ClothingItem[] = [];
        items.forEach(item => {
            const brand = item.brand;
            let weight = (brandCounts[brand] || 0) + 1;
            
            // HEAVY BOOST: If this is a top brand, double down on it.
            // This ensures "inspiration from brands user likes most".
            if (topBrands.includes(brand)) {
                weight += 8; 
            }

            // Cap to prevent total domination, but allow popular brands to shine
            const cap = Math.min(weight, 15); 
            for(let k=0; k<cap; k++) weightedPool.push(item);
        });
        
        return weightedPool[Math.floor(Math.random() * weightedPool.length)];
    };

    // --- SCORING SYSTEM ---
    const scoreMatch = (anchor: ClothingItem, candidate: ClothingItem, style: 'chic' | 'playful'): number => {
        let score = 0;
        const c1 = anchor.color;
        const c2 = candidate.color;

        // --- RULE 1: Brand Matching (The "Set" Look) ---
        // Organic Zoo / Loungewear vibe: If brands match, it might be a set.
        if (anchor.brand !== 'Unknown' && anchor.brand === candidate.brand) {
            score += 10; // Huge bonus for potential matching sets
            if (isTonal(c1, c2)) score += 5; // Same brand + same color = Definite Set
        }

        // --- RULE 1.5: Brand Affinity Bonus ---
        // If the candidate is from a Top Brand (even if different from anchor),
        // we assume it fits the user's general aesthetic preference.
        if (candidate.brand && topBrands.includes(candidate.brand)) {
            score += 3;
        }
        // Cross-Favorite Pairing: Anchor Top Brand + Candidate Top Brand = High Taste Match
        if (anchor.brand && topBrands.includes(anchor.brand) && candidate.brand && topBrands.includes(candidate.brand)) {
            score += 4;
        }

        // --- RULE 2: Color Theory ---
        if (style === 'chic') {
            // Chic = Organic Zoo / Minimalist
            // Favors: Neutrals, Earth Tones, Monochrome
            if (isTonal(c1, c2)) score += 8;
            if (isNeutral(c1) && isNeutral(c2)) score += 5;
            if (isEarthy(c1) && isEarthy(c2)) score += 6;
            
            // Penalty for clashing vibrant colors in Chic mode
            if (!isNeutral(c1) && !isNeutral(c2) && !isEarthy(c1) && !isEarthy(c2)) score -= 5;

        } else {
            // Playful = Misha & Puff / Bobo Choses
            // Favors: Color blocking, Pattern mixing
            if (isTonal(c1, c2)) score += 2; // Boring for playful, but acceptable
            
            // Contrast is good
            if (!isNeutral(c1) && isNeutral(c2)) score += 5; // Balance
            
            // "Misha & Puff" Logic: Earthy + Pastel usually works (e.g. Rust + Pale Pink)
            if ((isEarthy(c1) && !isEarthy(c2) && !isNeutral(c2)) || (!isEarthy(c1) && isEarthy(c2) && !isNeutral(c1))) {
                score += 6;
            }
        }

        return score;
    };

    const buildOutfit = (style: 'chic' | 'playful'): ClothingItem[] => {
        const outfit: ClothingItem[] = [];
        
        // 1. Pick Anchor
        // Chic favors full body (rompers) or sets. Playful favors separates.
        let useFullBody = false;
        if (style === 'chic' && fullBody.length > 0 && Math.random() > 0.4) useFullBody = true;
        
        // Fallback if no separates available
        if (tops.length === 0 || bottoms.length === 0) {
            if (fullBody.length > 0) useFullBody = true;
            else return [];
        }

        if (useFullBody) {
            const anchor = pickWeightedAnchor(fullBody);
            if (anchor) outfit.push(anchor);
        } else {
            const top = pickWeightedAnchor(tops);
            if (!top) return [];
            outfit.push(top);

            // 2. Find Best Matching Bottom
            // Calculate score for every available bottom against the top
            const scoredBottoms = bottoms.map(b => ({
                item: b,
                score: scoreMatch(top, b, style) + (Math.random() * 4) // Add slight fuzz factor
            }));
            
            // Sort by score descending
            scoredBottoms.sort((a, b) => b.score - a.score);
            
            // Pick the winner (or null if list empty)
            if (scoredBottoms.length > 0) {
                outfit.push(scoredBottoms[0].item);
            }
        }

        // 3. Add Layers (Outerwear)
        if (temp < 18 && outerwear.length > 0 && outfit.length > 0) {
            const base = outfit[0];
            const scoredOuter = outerwear.map(o => ({
                item: o,
                score: scoreMatch(base, o, style)
            }));
            scoredOuter.sort((a, b) => b.score - a.score);
            outfit.push(scoredOuter[0].item);
        }

        // 4. Add Shoes
        if (shoes.length > 0 && outfit.length > 0) {
            const base = outfit[0]; // Match shoes to top/body usually
            const scoredShoes = shoes.map(s => ({
                item: s,
                score: scoreMatch(base, s, style)
            }));
            scoredShoes.sort((a, b) => b.score - a.score);
            outfit.push(scoredShoes[0].item);
        }

        // 5. Add Accessory (Hat/Bow)
        // Chic: Only add if neutral/matching. Playful: Add for fun.
        if (accessories.length > 0 && outfit.length > 0) {
             const base = outfit[0];
             const scoredAcc = accessories.map(a => ({
                 item: a,
                 score: scoreMatch(base, a, style)
             }));
             scoredAcc.sort((a, b) => b.score - a.score);
             
             // Threshold: Don't add accessory if it clashes too hard in Chic mode
             if (style === 'playful' || scoredAcc[0].score > 0) {
                 if (Math.random() > 0.5) outfit.push(scoredAcc[0].item);
             }
        }

        return outfit;
    };

    const s1 = buildOutfit('playful');
    const s2 = buildOutfit('chic');

    setSuggestion1(s1);
    setSuggestion2(s2);

    // Save to persistence
    localStorage.setItem(todayKey, JSON.stringify({
        playful: s1.map(i => i.id),
        chic: s2.map(i => i.id)
    }));

  }, [allItems, weather]);

  // --- OOTD AUTO-INIT ---
  useEffect(() => {
    if (allItems && allItems.length > 0) {
        generateOutfits();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems, weather]);

  const activeSuggestion = activeTab === 'playful' ? suggestion1 : suggestion2;

  // Check if current outfit is liked (Restoring Heart UI on remount)
  useEffect(() => {
      if (!likedOutfits || activeSuggestion.length === 0) {
          setIsLiked(false);
          return;
      }
      
      const currentIds = activeSuggestion.map(i => i.id).filter(Boolean) as number[];
      if (currentIds.length === 0) return;

      const found = likedOutfits.find(outfit => arraysEqual(outfit.itemIds, currentIds));
      setIsLiked(!!found);
  }, [activeSuggestion, likedOutfits]);


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
          setNotification("Saved to Lookbook!");
          setTimeout(() => {
              setShowHeartAnim(false);
              setNotification(null);
          }, 2000);
      }
  };

  // Identify outgrown items
  const outgrownItems = allItems?.filter(item => {
    if (!currentKid?.birthDate) return false;
    if (!item.sizeLabel) return false;
    if (item.ignoreOutgrown) return false;
    
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
          setNotification(`Archived ${ids.length} items`);
          setTimeout(() => setNotification(null), 3000);
      }
  };

  const handleToggleArchive = async (item: ClothingItem) => {
      if (item.id) {
          await db.items.update(item.id, { isArchived: !item.isArchived });
          setSelectedItem(null);
      }
  };

  const handleIgnoreOutgrown = async (item: ClothingItem) => {
      if (item.id) {
          await db.items.update(item.id, { ignoreOutgrown: true });
          setSelectedItem(null);
          setNotification("Marked as fitting");
          setTimeout(() => setNotification(null), 2000);
      }
  };

  // Prevent flicker by showing skeleton if data is still loading (undefined)
  if (!allItems) {
    return (
      <div className="p-6 pb-28 max-w-md mx-auto animate-pulse">
        <header className="mb-8 pt-4 flex justify-between items-end">
            <div>
                <div className="h-8 w-32 bg-slate-200 rounded-lg mb-2"></div>
                <div className="h-4 w-24 bg-slate-200 rounded-lg"></div>
            </div>
            <div className="h-12 w-12 rounded-full bg-slate-200"></div>
        </header>
        <div className="h-32 bg-slate-200 rounded-[2rem] mb-10"></div>
        <div className="h-8 w-40 bg-slate-200 rounded-lg mb-4"></div>
        <div className="grid grid-cols-2 gap-4">
            <div className="aspect-[3/4] bg-slate-200 rounded-[2rem]"></div>
            <div className="aspect-[3/4] bg-slate-200 rounded-[2rem]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 pb-28 max-w-md mx-auto">
      <header className="mb-4 pt-6 flex justify-between items-end">
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

      <WeatherWidget data={weather} locationEnabled={locationEnabled} />

      <section className="mb-10 relative">
        <div className="flex justify-between items-center mb-5 px-1 pt-2">
          {/* Left: Title & Toggle */}
          <div className="flex flex-col gap-3">
              <h2 className="text-xl text-slate-800 font-serif font-bold leading-none">Today's Outfit</h2>
              <div className="flex bg-white rounded-full p-1 shadow-sm border border-slate-100 self-start">
                  <button 
                    onClick={() => { setActiveTab('playful'); setIsLiked(false); }}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${activeTab === 'playful' ? 'bg-orange-400 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                      <Smile size={12} /> Playful
                  </button>
                  <button 
                    onClick={() => { setActiveTab('chic'); setIsLiked(false); }}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${activeTab === 'chic' ? 'bg-sky-400 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                      <Sparkles size={12} /> Chic
                  </button>
              </div>
          </div>
          
          {/* Right: Actions */}
          <div className="flex items-center gap-2 self-end mb-1">
            {/* Shuffle Button */}
             <button 
                onClick={() => generateOutfits(true)}
                className="w-11 h-11 rounded-full flex items-center justify-center shadow-sm bg-white border border-slate-100 text-slate-400 hover:text-sky-500 hover:border-sky-200 active:scale-95 transition-all"
                title="Shuffle Outfit"
             >
                 <RotateCcw size={18} />
             </button>

            {/* Like Button */}
            {activeSuggestion.length > 0 && (
                <button 
                    onClick={handleLikeOutfit}
                    disabled={isLiked}
                    className={`w-11 h-11 rounded-full flex items-center justify-center shadow-sm transition-all border ${isLiked ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100 active:scale-95 hover:border-red-200'}`}
                >
                    <Heart 
                        size={20} 
                        className={`transition-all duration-300 ${isLiked ? 'fill-red-500 text-red-500 scale-110' : 'text-slate-300 hover:text-red-400'}`} 
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
          <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300" key={activeTab + (isLiked ? '-liked' : '')}>
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

      {/* Global Notification */}
      {notification && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-8 z-50">
              <CheckCircle2 className="text-green-400" size={20} />
              <span className="font-bold">{notification}</span>
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
        isOutgrown={outgrownItems.some(i => i.id === selectedItem?.id)}
        onIgnoreOutgrown={handleIgnoreOutgrown}
      />
    </div>
  );
};
