
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { WeatherWidget } from '../components/WeatherWidget';
import { WeatherData, ClothingItem, Season, Category, ShopPost, ShopAccount, AnalyzedShopItem } from '../types';
import { Shirt, AlertCircle, Cake, Archive, CheckCircle2, Sparkles, Smile, Heart, RotateCcw, TrendingUp, ArrowRight, Star, Calendar, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { matchItemsToCloset } from '../services/geminiService';
import { Logo } from '../components/Logo';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { getCoordinates, fetchWeather } from '../services/weatherService';
import { buildOutfit, isNeutral, isEarthy } from '../services/outfitService';
import { useActiveChild } from '../hooks/useActiveChild';
import clsx from 'clsx';

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
  const [activeTab, setActiveTab] = useState<'foryou' | 'inspo' | 'planned'>('foryou');
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

  const { activeChild: currentKid, profiles, activeChildId, cycleToNextChild } = useActiveChild();
  const allItemsRaw = useLiveQuery(() => db.items.filter(i => !i.isArchived).toArray());

  // Filter items by active child
  const allItems = allItemsRaw?.filter(item => {
    if (!activeChildId) return true;
    return !item.profileId || item.profileId === activeChildId;
  });

  // Shop Inspo Data
  const shopPosts = useLiveQuery(() => db.shopPosts.filter(p => p.isProcessed && !!p.analyzedItems?.length).toArray());
  const shopAccounts = useLiveQuery(() => db.shopAccounts.toArray());

  const inspoData = useMemo(() => {
    if (!shopPosts || shopPosts.length === 0 || !allItems || allItems.length === 0 || !shopAccounts) return null;
    // Pick a random analyzed post each day
    const daySeed = new Date().toLocaleDateString().split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const post = shopPosts[daySeed % shopPosts.length];
    const account = shopAccounts.find(a => a.id === post.shopAccountId);
    if (!post.analyzedItems) return null;
    const matches = matchItemsToCloset(post.analyzedItems, allItems);
    // Build outfit from best matches
    const outfitItems: ClothingItem[] = [];
    const usedIds = new Set<number>();
    matches.forEach(m => {
      if (m.matchedClosetItemIds.length > 0) {
        const bestId = m.matchedClosetItemIds.find(id => !usedIds.has(id));
        if (bestId != null) {
          const item = allItems.find(i => i.id === bestId);
          if (item) { outfitItems.push(item); usedIds.add(bestId); }
        }
      }
    });
    if (outfitItems.length === 0) return null;
    return { post, account, outfitItems, matches, totalItems: post.analyzedItems.length, matchedCount: matches.filter(m => m.matchedClosetItemIds.length > 0).length };
  }, [shopPosts, shopAccounts, allItems]);

  const arraysEqual = (a: number[], b: number[]) => {
      if (a.length !== b.length) return false;
      const sortedA = [...a].sort();
      const sortedB = [...b].sort();
      return sortedA.every((val, index) => val === sortedB[index]);
  };

  // Today's Plan
  const todayDateKey = new Date().toISOString().split('T')[0];
  const todayPlan = useLiveQuery(
    () => {
      if (!activeChildId) return undefined;
      return db.weeklyPlans
        .where('[profileId+date]')
        .equals([activeChildId, todayDateKey])
        .first();
    },
    [activeChildId, todayDateKey]
  );

  // Resolve plan item images
  const todayPlanItems = useLiveQuery(
    () => {
      if (!todayPlan?.itemIds || todayPlan.itemIds.length === 0) return [];
      return db.items.where('id').anyOf(todayPlan.itemIds).toArray();
    },
    [todayPlan]
  );

  const likedOutfitsRaw = useLiveQuery(() => db.outfitLikes.toArray());
  const likedOutfits = likedOutfitsRaw?.filter(o => {
    if (!activeChildId) return true;
    return !o.profileId || o.profileId === activeChildId;
  });

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

    // Build outfits using shared service
    const context = { allItems, weather };
    const hasEarthyItems = allItems.some(i => isEarthy(i.color));
    const hasPastelItems = allItems.some(i => !isNeutral(i.color) && !isEarthy(i.color));
    const style = (hasEarthyItems && hasPastelItems) ? 'playful' as const : hasPastelItems ? 'playful' as const : 'chic' as const;

    const s1 = buildOutfit(context, style);
    const s2 = buildOutfit(context, style === 'playful' ? 'chic' : 'playful');

    setSuggestion1(s1.length > 0 ? s1 : s2);
    setSuggestion2(s2);

    // Save to persistence
    localStorage.setItem(todayKey, JSON.stringify({
        playful: (s1.length > 0 ? s1 : s2).map(i => i.id),
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

  const activeSuggestion = suggestion1;

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
              style: activeTab === 'foryou' ? 'playful' : 'chic',
              date: Date.now(),
              profileId: activeChildId ?? undefined
          });

          // Update wear frequency for each item in the outfit
          const now = Date.now();
          await Promise.all(itemIds.map(id =>
              db.items.update(id, {
                  wearCount: (activeSuggestion.find(i => i.id === id)?.wearCount || 0) + 1,
                  lastWorn: now
              })
          ));

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
      <div className="p-6 pb-4 max-w-md mx-auto animate-pulse">
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
    <div className="p-6 pb-4 max-w-md mx-auto">
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
        <div
            className={clsx(
                "h-12 w-12 rounded-full bg-sky-200 text-sky-700 flex items-center justify-center font-bold text-xl font-serif border-2 border-white shadow-sm mb-2 overflow-hidden relative",
                profiles.length > 1 && "cursor-pointer ring-2 ring-offset-2 ring-sky-300 active:scale-95 transition-transform"
            )}
            onClick={profiles.length > 1 ? cycleToNextChild : undefined}
            title={profiles.length > 1 ? "Switch child" : undefined}
        >
            {currentKid?.avatar ? (
                <img src={currentKid.avatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
                (currentKid?.name || 'K')[0]
            )}
            {profiles.length > 1 && (
                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-sky-400 text-white rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white">
                    {profiles.length}
                </div>
            )}
        </div>
      </header>

      <WeatherWidget data={weather} locationEnabled={locationEnabled} />

      <section className="mb-10 relative">
         <div className="flex items-center justify-between mb-4">
              <div className="flex gap-4">
                  <button
                    onClick={() => { setActiveTab('foryou'); setIsLiked(false); }}
                    className={`text-lg font-serif font-bold transition-colors ${activeTab === 'foryou' ? 'text-slate-800 underline decoration-orange-400 decoration-4 underline-offset-4' : 'text-slate-300 hover:text-slate-500'}`}
                  >
                      For You
                  </button>
                  {todayPlan && todayPlanItems && todayPlanItems.length > 0 && (
                    <button
                      onClick={() => { setActiveTab('planned'); setIsLiked(false); }}
                      className={`text-lg font-serif font-bold transition-colors ${activeTab === 'planned' ? 'text-slate-800 underline decoration-sky-400 decoration-4 underline-offset-4' : 'text-slate-300 hover:text-slate-500'}`}
                    >
                        Planned
                    </button>
                  )}
                  {inspoData && (
                    <button
                      onClick={() => { setActiveTab('inspo'); setIsLiked(false); }}
                      className={`text-lg font-serif font-bold transition-colors ${activeTab === 'inspo' ? 'text-slate-800 underline decoration-pink-400 decoration-4 underline-offset-4' : 'text-slate-300 hover:text-slate-500'}`}
                    >
                        Inspo
                    </button>
                  )}
              </div>
         </div>
        
        {activeTab === 'planned' && todayPlan && todayPlanItems && todayPlanItems.length > 0 ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="relative bg-white rounded-xl shadow-lg border border-slate-100 p-4 pb-8 overflow-hidden min-h-[320px]">
              <div className="relative">
                {todayPlanItems.map((item, idx) => {
                  let posClass = "";
                  let rotateClass = "";
                  let zIndex = 10;
                  let badgePos = "";
                  if (idx === 0) {
                    posClass = "w-3/5 ml-auto mr-6";
                    rotateClass = "rotate-[-2deg]";
                    zIndex = 20;
                    badgePos = "-top-3 -left-3";
                  } else if (idx === 1) {
                    posClass = "w-3/5 -mt-12 ml-6";
                    rotateClass = "rotate-[3deg]";
                    zIndex = 30;
                    badgePos = "-top-2 -right-2";
                  } else if (idx === 2) {
                    posClass = "w-2/5 ml-auto -mt-8 mr-4";
                    rotateClass = "rotate-[-4deg]";
                    zIndex = 40;
                    badgePos = "-bottom-2 -left-2";
                  } else {
                    posClass = "w-1/3 absolute bottom-4 left-8";
                    rotateClass = "rotate-[6deg]";
                    zIndex = 50;
                    badgePos = "-top-2 left-1/2";
                  }
                  return (
                    <div
                      key={`${item.id}-${idx}`}
                      onClick={() => setSelectedItem(item)}
                      className={`relative group cursor-pointer ${posClass} ${rotateClass}`}
                      style={{ zIndex }}
                    >
                      <div className="bg-white p-1 shadow-md border border-slate-100 rounded-lg">
                        <img src={item.image} alt={item.category} className="w-full h-auto object-cover rounded-md" />
                      </div>
                      <div className={`absolute ${badgePos} w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center font-serif font-bold text-xs shadow-md border-2 border-white`}>
                        {idx + 1}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="absolute bottom-3 left-4 flex items-center gap-1.5">
                <Calendar size={14} className="text-sky-400" />
                <span className="text-xs font-bold text-slate-400">Today's Plan</span>
              </div>
              <Link to="/plan" className="absolute bottom-3 right-4 text-xs font-bold text-sky-500 flex items-center gap-1">
                Edit <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        ) : activeTab === 'inspo' && inspoData ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
              {/* Shop reference + matching items side by side */}
              <div className="flex gap-2 p-4">
                <div className="w-[38%] shrink-0">
                  <div className="aspect-[3/4] rounded-xl overflow-hidden border border-slate-100 relative">
                    <img src={inspoData.post.image} alt="Inspo" className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6">
                      <p className="text-[10px] text-white/70 font-bold">@{inspoData.account?.handle}</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                  {inspoData.outfitItems.slice(0, 4).map(item => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="flex-1 rounded-xl overflow-hidden border border-slate-100 cursor-pointer relative min-h-0"
                    >
                      <img src={item.image} alt={item.category} className="w-full h-full object-cover" />
                      <div className="absolute bottom-1 left-1">
                        <span className="bg-white/90 backdrop-blur text-[8px] font-bold text-slate-600 px-1.5 py-0.5 rounded-full">
                          {item.category}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Match summary */}
              <div className="px-4 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      "text-xs font-bold px-2.5 py-1 rounded-full",
                      inspoData.matchedCount === inspoData.totalItems ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"
                    )}>
                      {inspoData.matchedCount}/{inspoData.totalItems} matched
                    </span>
                    {inspoData.matchedCount < inspoData.totalItems && (
                      <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                        <ShoppingBag size={12} /> {inspoData.totalItems - inspoData.matchedCount} missing
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (!allItems || allItems.length === 0) ? (
          <div className="bg-white rounded-[2rem] p-10 text-center shadow-sm border border-slate-100">
            <div className="bg-orange-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 text-orange-300">
                <Shirt size={36} strokeWidth={2} />
            </div>
            <h3 className="text-lg font-serif text-slate-800 mb-2">Your closet is waiting!</h3>
            <p className="text-slate-400 mb-6 text-sm font-medium leading-relaxed">Snap a photo or upload a screenshot to start building {currentKid?.name ? `${currentKid.name}'s` : 'the'} wardrobe.</p>
            <Link to="/add" className="inline-block px-8 py-4 bg-sky-400 text-white text-sm font-bold rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all">
              Add First Clothes
            </Link>
          </div>
        ) : activeSuggestion.length > 0 ? (
          <div key={activeTab + (isLiked ? '-liked' : '')} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            
            {/* --- MAGAZINE STYLE LAYOUT CONTAINER --- */}
            <div className="relative bg-white rounded-xl shadow-lg border border-slate-100 p-4 pb-8 overflow-hidden min-h-[320px]">
                
                {/* Main Collage Area */}
                <div className="relative">
                     {activeSuggestion.map((item, idx) => {
                         // Dynamic Styling for Collage Effect
                         let posClass = "";
                         let rotateClass = "";
                         let zIndex = 10;
                         let badgePos = "";

                         if (idx === 0) {
                             // Main Top Piece
                             posClass = "w-3/5 ml-auto mr-6";
                             rotateClass = "rotate-[-2deg]";
                             zIndex = 20;
                             badgePos = "-top-3 -left-3";
                         } else if (idx === 1) {
                             // Bottom Piece - Overlapping slightly
                             posClass = "w-3/5 -mt-12 ml-6";
                             rotateClass = "rotate-[3deg]";
                             zIndex = 30;
                             badgePos = "-top-2 -right-2";
                         } else if (idx === 2) {
                             // Shoes/Accessory
                             posClass = "w-2/5 ml-auto -mt-8 mr-4";
                             rotateClass = "rotate-[-4deg]";
                             zIndex = 40;
                             badgePos = "-bottom-2 -left-2";
                         } else {
                             posClass = "w-1/3 absolute bottom-4 left-8";
                             rotateClass = "rotate-[6deg]";
                             zIndex = 50;
                             badgePos = "-top-2 left-1/2";
                         }

                         return (
                            <div 
                                key={`${item.id}-${idx}`}
                                onClick={() => setSelectedItem(item)}
                                className={`relative group transition-transform duration-300 hover:scale-105 hover:z-[60] cursor-pointer ${posClass} ${rotateClass}`}
                                style={{ zIndex }}
                            >
                                <div className="bg-white p-1 shadow-md border border-slate-100 rounded-lg">
                                    <img src={item.image} alt={item.category} className="w-full h-auto object-cover rounded-md" />
                                </div>
                                
                                {/* Number Badge */}
                                <div className={`absolute ${badgePos} w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-serif font-bold text-xs shadow-md border-2 border-white`}>
                                    {idx + 1}
                                </div>
                            </div>
                         );
                     })}
                </div>

                {/* Floating "Sticker" Actions */}
                <div className="absolute bottom-4 right-4 flex gap-3 z-[60]">
                     <button 
                        onClick={() => generateOutfits(true)}
                        className="w-12 h-12 rounded-full bg-white border-2 border-slate-100 shadow-lg flex items-center justify-center text-slate-400 hover:text-sky-500 hover:border-sky-200 active:scale-95 transition-all"
                     >
                         <RotateCcw size={20} />
                     </button>
                     
                     <button 
                        onClick={handleLikeOutfit}
                        className={clsx(
                            "w-12 h-12 rounded-full border-2 shadow-lg flex items-center justify-center transition-all active:scale-95",
                            isLiked ? "bg-red-500 border-red-500 text-white" : "bg-white border-slate-100 text-slate-300 hover:text-red-400"
                        )}
                     >
                         <Heart size={20} className={clsx(isLiked && "fill-current")} />
                     </button>
                </div>

                {/* Decor Elements */}
                {/* Star removed as requested */}
            </div>

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

      {/* Plan Your Week Link */}
      <section className="mb-8">
        <Link to="/plan" className="block">
          <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-dashed border-orange-200 hover:border-orange-300 hover:shadow-md transition-all">
            <div className="flex items-center gap-4">
              <div className="bg-orange-100 p-3 rounded-2xl text-orange-400 shrink-0">
                <Calendar size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-serif font-bold text-slate-800 mb-0.5">Plan Your Week</h3>
                <p className="text-sm text-slate-400 font-bold">Pick outfits for the days ahead</p>
              </div>
              <ArrowRight size={18} className="text-orange-300" />
            </div>
          </div>
        </Link>
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

      {allItems && allItems.length > 0 && (
        <section>
          <div className="flex justify-between items-center mb-4 px-1">
            <h2 className="text-lg text-slate-800 font-serif font-bold">Recent Upload</h2>
            <Link to="/closet" className="text-sm font-bold text-orange-500 hover:text-orange-600 flex items-center gap-1">
              See All <ArrowRight size={14} />
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-6 px-6">
            {allItems.slice().reverse().slice(0, 5).map(item => (
              <div key={item.id} className="w-24 shrink-0 cursor-pointer transition-transform active:scale-95" onClick={() => setSelectedItem(item)}>
                   <div className="aspect-square rounded-[1.5rem] overflow-hidden bg-white border border-slate-100 shadow-sm mb-2">
                      <img src={item.image} alt={item.description} className="w-full h-full object-cover" />
                   </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
