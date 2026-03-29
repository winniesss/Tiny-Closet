
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { ClothingItem, Category, WeeklyPlan, Season, DayType, WeatherData } from '../types';
import { useActiveChild } from '../hooks/useActiveChild';
import { buildOutfitForDayType, buildOutfit } from '../services/outfitService';
import { getCoordinates, fetchWeather, fetchWeekForecast } from '../services/weatherService';
import { ChevronLeft, ChevronRight, X, Check, Trash2, Plus, Calendar, Clock, Sun, Leaf, Snowflake, CloudSun, Pencil, Sparkles, RotateCcw, ArrowLeft, GraduationCap, Palette, PartyPopper, Trophy, Home, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

// --- Date Helpers ---
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const m1 = SHORT_MONTHS[monday.getMonth()];
  const m2 = SHORT_MONTHS[sunday.getMonth()];
  if (m1 === m2) {
    return `${m1} ${monday.getDate()} \u2013 ${sunday.getDate()}`;
  }
  return `${m1} ${monday.getDate()} \u2013 ${m2} ${sunday.getDate()}`;
}

// --- Day Type Config ---
const DAY_TYPE_CONFIG: Record<DayType, { icon: typeof GraduationCap; label: string; color: string; activeBg: string; cardBg: string; iconColor: string }> = {
  school:   { icon: GraduationCap, label: 'School',   color: 'bg-blue-50 text-blue-600 border-blue-200',       activeBg: 'bg-blue-500 text-white border-blue-500',     cardBg: 'bg-blue-100',   iconColor: 'text-blue-500' },
  playdate: { icon: Palette,       label: 'Playdate', color: 'bg-pink-50 text-pink-600 border-pink-200',       activeBg: 'bg-pink-500 text-white border-pink-500',     cardBg: 'bg-pink-100',   iconColor: 'text-pink-500' },
  party:    { icon: PartyPopper,   label: 'Party',    color: 'bg-purple-50 text-purple-600 border-purple-200', activeBg: 'bg-purple-500 text-white border-purple-500', cardBg: 'bg-purple-100', iconColor: 'text-purple-500' },
  sports:   { icon: Trophy,        label: 'Sports',   color: 'bg-green-50 text-green-600 border-green-200',    activeBg: 'bg-green-500 text-white border-green-500',   cardBg: 'bg-lime-100',   iconColor: 'text-green-500' },
  stayhome: { icon: Home,          label: 'Home',     color: 'bg-amber-50 text-amber-600 border-amber-200',    activeBg: 'bg-amber-500 text-white border-amber-500',   cardBg: 'bg-amber-100',  iconColor: 'text-amber-500' },
};

const ALL_DAY_TYPES: DayType[] = ['school', 'playdate', 'party', 'sports', 'stayhome'];

function getDefaultDayTypes(weekDays: Date[]): Map<string, DayType> {
  const map = new Map<string, DayType>();
  weekDays.forEach(d => {
    const key = formatDateKey(d);
    const dow = d.getDay(); // 0=Sun, 6=Sat
    if (dow === 0) map.set(key, 'stayhome');
    else if (dow === 6) map.set(key, 'playdate');
    else map.set(key, 'school');
  });
  return map;
}

// --- Category Grouping ---
const CATEGORY_ORDER: Category[] = [
  Category.Top, Category.Bottom, Category.FullBody, Category.Romper, Category.Overall,
  Category.Outerwear, Category.Vest, Category.Shoes, Category.Tights, Category.Socks,
  Category.Accessory, Category.Pajamas, Category.Swimwear
];

function groupByCategory(items: ClothingItem[]): { category: Category; items: ClothingItem[] }[] {
  const map = new Map<Category, ClothingItem[]>();
  items.forEach(item => {
    const list = map.get(item.category) || [];
    list.push(item);
    map.set(item.category, list);
  });
  return CATEGORY_ORDER
    .filter(cat => map.has(cat))
    .map(cat => ({ category: cat, items: map.get(cat)! }));
}

// --- Quick Filter Types ---
type FilterKey = 'All' | 'Recent' | 'Spring' | 'Summer' | 'Fall' | 'Winter';

const FILTER_OPTIONS: { key: FilterKey; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
  { key: 'All', label: 'All', icon: ({ size, className }) => <Calendar size={size} className={className} /> },
  { key: 'Recent', label: 'Recent', icon: ({ size, className }) => <Clock size={size} className={className} /> },
  { key: 'Spring', label: 'Spring', icon: ({ size, className }) => <CloudSun size={size} className={className} /> },
  { key: 'Summer', label: 'Summer', icon: ({ size, className }) => <Sun size={size} className={className} /> },
  { key: 'Fall', label: 'Fall', icon: ({ size, className }) => <Leaf size={size} className={className} /> },
  { key: 'Winter', label: 'Winter', icon: ({ size, className }) => <Snowflake size={size} className={className} /> },
];

const SEASON_MAP: Record<string, Season> = {
  Spring: Season.Spring,
  Summer: Season.Summer,
  Fall: Season.Fall,
  Winter: Season.Winter,
};

// --- Position helpers ---
type ItemPosition = { x: number; y: number };

function loadPositions(dateKey: string): Map<number, ItemPosition> {
  try {
    const raw = localStorage.getItem(`plan_positions_${dateKey}`);
    if (!raw) return new Map();
    const parsed: Record<string, ItemPosition> = JSON.parse(raw);
    const map = new Map<number, ItemPosition>();
    for (const [k, v] of Object.entries(parsed)) {
      map.set(Number(k), v);
    }
    return map;
  } catch {
    return new Map();
  }
}

function savePositions(dateKey: string, positions: Map<number, ItemPosition>) {
  const obj: Record<string, ItemPosition> = {};
  positions.forEach((v, k) => { obj[String(k)] = v; });
  localStorage.setItem(`plan_positions_${dateKey}`, JSON.stringify(obj));
}

function getDefaultPositions(itemIds: number[]): Map<number, ItemPosition> {
  const map = new Map<number, ItemPosition>();
  const cols = 3;
  itemIds.forEach((id, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    map.set(id, {
      x: 5 + col * 33,
      y: 5 + row * 30,
    });
  });
  return map;
}

// --- Draggable Canvas Card ---
const DraggableCanvasCard: React.FC<{
  itemIds: number[];
  itemMap: Map<number, ClothingItem>;
  dateKey: string;
}> = ({ itemIds, itemMap, dateKey }) => {
  const [editing, setEditing] = useState(false);
  const [positions, setPositions] = useState<Map<number, ItemPosition>>(() => {
    const saved = loadPositions(dateKey);
    if (saved.size > 0) return saved;
    return getDefaultPositions(itemIds);
  });
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ id: number; startX: number; startY: number; origPos: ItemPosition } | null>(null);

  useEffect(() => {
    const saved = loadPositions(dateKey);
    if (saved.size > 0) {
      const merged = new Map(saved);
      const existingCount = merged.size;
      itemIds.forEach((id, i) => {
        if (!merged.has(id)) {
          const cols = 3;
          const idx = existingCount + i;
          const row = Math.floor(idx / cols);
          const col = idx % cols;
          merged.set(id, { x: 5 + col * 33, y: 5 + row * 30 });
        }
      });
      setPositions(merged);
    } else {
      setPositions(getDefaultPositions(itemIds));
    }
  }, [dateKey, itemIds]);

  const handlePointerDown = useCallback((e: React.PointerEvent, id: number) => {
    if (!editing) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = positions.get(id) || { x: 0, y: 0 };
    dragState.current = { id, startX: e.clientX, startY: e.clientY, origPos: { ...pos } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [editing, positions]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current || !canvasRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragState.current.startX) / rect.width) * 100;
    const dy = ((e.clientY - dragState.current.startY) / rect.height) * 100;
    const newX = Math.max(0, Math.min(70, dragState.current.origPos.x + dx));
    const newY = Math.max(0, Math.min(70, dragState.current.origPos.y + dy));
    setPositions(prev => {
      const next = new Map(prev);
      next.set(dragState.current!.id, { x: newX, y: newY });
      return next;
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    if (dragState.current) {
      dragState.current = null;
      setPositions(prev => {
        savePositions(dateKey, prev);
        return prev;
      });
    }
  }, [dateKey]);

  const toggleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (editing) savePositions(dateKey, positions);
    setEditing(prev => !prev);
  }, [editing, dateKey, positions]);

  const outfitItems = itemIds.map(id => itemMap.get(id)).filter(Boolean) as ClothingItem[];

  return (
    <div className="relative">
      <button
        onClick={toggleEdit}
        aria-label={editing ? "Done editing layout" : "Edit outfit layout"}
        className={clsx(
          "absolute top-2 right-2 z-20 w-11 h-11 rounded-full flex items-center justify-center shadow-sm transition-colors",
          editing ? "bg-orange-600 text-white" : "bg-white/80 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700"
        )}
      >
        <Pencil size={14} />
      </button>

      <div
        ref={canvasRef}
        className={clsx(
          "relative w-full aspect-[4/5] bg-white dark:bg-slate-800 rounded-2xl overflow-hidden",
          editing && "ring-2 ring-orange-300"
        )}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {outfitItems.map(item => {
          const pos = positions.get(item.id!) || { x: 0, y: 0 };
          return (
            <div
              key={item.id}
              className={clsx("absolute w-[30%] touch-none", editing && "cursor-grab active:cursor-grabbing")}
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, zIndex: editing ? 10 : 1 }}
              onPointerDown={(e) => handlePointerDown(e, item.id!)}
            >
              <img
                src={item.image}
                alt={item.category}
                className={clsx("w-full h-auto object-contain drop-shadow-md pointer-events-none", editing && "ring-2 ring-orange-200 rounded-lg")}
                draggable={false}
              />
            </div>
          );
        })}

        {editing && (
          <div className="absolute bottom-2 left-0 right-0 text-center">
            <span className="text-caption font-medium text-slate-300 bg-white/70 dark:bg-slate-800/70 px-2 py-0.5 rounded-full">
              Drag items to reposition
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Day Type Badge ---
const DayTypeBadge: React.FC<{ dayType: DayType; small?: boolean }> = ({ dayType, small }) => {
  const cfg = DAY_TYPE_CONFIG[dayType];
  const Icon = cfg.icon;
  return (
    <span className={clsx(
      "inline-flex items-center gap-1 rounded-full border font-bold",
      cfg.color,
      small ? "text-caption px-1.5 py-0.5" : "text-footnote px-2 py-0.5"
    )}>
      <Icon size={small ? 10 : 12} />
      {!small && <span>{cfg.label}</span>}
    </span>
  );
};

// --- Planner Phase ---
type PlannerPhase = 'view' | 'setup' | 'generating' | 'review';

// --- Component ---
export const WeeklyPlanner: React.FC = () => {
  const navigate = useNavigate();
  const { activeChild, activeChildId } = useActiveChild();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pendingItemIds, setPendingItemIds] = useState<number[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('All');

  // Three-phase flow state
  const [phase, setPhase] = useState<PlannerPhase>('view');
  const [dayTypes, setDayTypes] = useState<Map<string, DayType>>(new Map());
  const [generatedPlans, setGeneratedPlans] = useState<Map<string, number[]>>(new Map());
  const [generatedDayTypes, setGeneratedDayTypes] = useState<Map<string, DayType>>(new Map());
  const [weatherMap, setWeatherMap] = useState<Map<string, WeatherData>>(new Map());
  const weatherMapRef = useRef<Map<string, WeatherData>>(new Map());

  // Phase 5: Error state for generation
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [dayErrors, setDayErrors] = useState<Map<string, string>>(new Map());

  // Compute current week
  const monday = useMemo(() => {
    const m = getMonday(new Date());
    m.setDate(m.getDate() + weekOffset * 7);
    return m;
  }, [weekOffset]);

  const weekDays = useMemo(() => getWeekDays(monday), [monday]);
  const todayKey = formatDateKey(new Date());
  const weekDateKeys = useMemo(() => weekDays.map(formatDateKey), [weekDays]);

  // Reset phase when changing weeks
  useEffect(() => {
    setPhase('view');
    setGeneratedPlans(new Map());
    setGenerateError(null);
    setDayErrors(new Map());
  }, [weekOffset]);

  // Fetch all plans for this week
  const plans = useLiveQuery(
    () => {
      if (!activeChildId) return [];
      return db.weeklyPlans
        .where('profileId').equals(activeChildId)
        .filter(p => weekDateKeys.includes(p.date))
        .toArray();
    },
    [activeChildId, weekDateKeys]
  );

  const planMap = useMemo(() => {
    const m = new Map<string, WeeklyPlan>();
    plans?.forEach(p => m.set(p.date, p));
    return m;
  }, [plans]);

  const hasAnyPlans = useMemo(() => {
    return plans ? plans.some(p => p.itemIds.length > 0) : false;
  }, [plans]);

  // Fetch closet items
  const allItemsRaw = useLiveQuery(() => db.items.filter(i => !i.isArchived).toArray());
  const allItems = useMemo(() => {
    if (!allItemsRaw) return [];
    return allItemsRaw.filter(item => {
      if (!activeChildId) return true;
      return !item.profileId || item.profileId === activeChildId;
    });
  }, [allItemsRaw, activeChildId]);

  const grouped = useMemo(() => groupByCategory(allItems), [allItems]);

  const itemMap = useMemo(() => {
    const m = new Map<number, ClothingItem>();
    allItems.forEach(i => { if (i.id != null) m.set(i.id, i); });
    return m;
  }, [allItems]);

  // Filtered items for builder modal
  const filteredItems = useMemo(() => {
    if (activeFilter === 'All') return null;
    if (activeFilter === 'Recent') {
      const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      return [...allItems]
        .filter(item => item.dateAdded >= fourteenDaysAgo)
        .sort((a, b) => b.dateAdded - a.dateAdded);
    }
    const season = SEASON_MAP[activeFilter];
    if (season) {
      return allItems.filter(item =>
        item.seasons?.includes(season) || item.seasons?.includes(Season.All)
      );
    }
    return null;
  }, [activeFilter, allItems]);

  // --- Phase handlers ---
  const startSetup = useCallback(() => {
    // Initialize day types from existing plans or defaults
    const initial = getDefaultDayTypes(weekDays);
    // Restore saved day types from existing plans
    plans?.forEach(p => {
      if (p.dayType) initial.set(p.date, p.dayType);
    });
    setDayTypes(initial);
    setPhase('setup');
  }, [weekDays, plans]);

  const setDayType = useCallback((dateKey: string, type: DayType) => {
    setDayTypes(prev => {
      const next = new Map(prev);
      next.set(dateKey, type);
      return next;
    });
  }, []);

  const generateOutfits = useCallback(async () => {
    setPhase('generating');
    setGenerateError(null);
    setDayErrors(new Map());

    try {
      // Get 7-day forecast
      const defaultWeather: WeatherData = { condition: 'Sunny', temp: 20, description: '' };
      let forecast = new Map<string, WeatherData>();
      try {
        const coords = await getCoordinates();
        forecast = await fetchWeekForecast(coords.lat, coords.lon);
      } catch {
        // Geolocation blocked — try with a fallback (SF)
        try {
          forecast = await fetchWeekForecast(37.77, -122.42);
        } catch {}
      }
      weatherMapRef.current = forecast;
      setWeatherMap(forecast);

      // Generate outfits for each day, with cross-day deduplication
      const results = new Map<string, number[]>();
      const usedItemIds: number[] = [];

      for (const day of weekDays) {
        const dateKey = formatDateKey(day);
        if (dateKey < todayKey && weekOffset === 0) {
          results.set(dateKey, []);
          continue;
        }
        const dayType = dayTypes.get(dateKey) || 'school';
        const weather = forecast.get(dateKey) || defaultWeather;

        // Try with dedup -> without dedup -> generic outfit as fallback
        let outfit = buildOutfitForDayType(
          { allItems, weather, excludeItemIds: usedItemIds },
          dayType
        );
        if (outfit.length === 0) {
          outfit = buildOutfitForDayType({ allItems, weather }, dayType);
        }
        if (outfit.length === 0) {
          outfit = buildOutfit({ allItems, weather }, 'chic');
        }

        const ids = outfit.map(i => i.id!).filter(Boolean);
        results.set(dateKey, ids);
        usedItemIds.push(...ids);
      }

      setGeneratedPlans(results);
      setGeneratedDayTypes(new Map(dayTypes));
      setPhase('review');
    } catch (err) {
      console.error('Outfit generation failed:', err);
      setGenerateError('Failed to generate outfits. Please try again.');
      setPhase('setup');
    }
  }, [weekDays, dayTypes, allItems]);

  const regenerateDay = useCallback((dateKey: string) => {
    try {
      const weather = weatherMap.get(dateKey) || weatherMapRef.current.get(dateKey) || { condition: 'Sunny' as const, temp: 20, description: '' };
      const dayType = generatedDayTypes.get(dateKey) || 'school';
      const otherUsedIds: number[] = [];
      generatedPlans.forEach((ids, key) => {
        if (key !== dateKey) otherUsedIds.push(...ids);
      });

      let outfit = buildOutfitForDayType(
        { allItems, weather, excludeItemIds: otherUsedIds },
        dayType
      );
      if (outfit.length === 0) {
        outfit = buildOutfitForDayType({ allItems, weather }, dayType);
      }

      setGeneratedPlans(prev => {
        const next = new Map(prev);
        next.set(dateKey, outfit.map(i => i.id!).filter(Boolean));
        return next;
      });
      // Clear saved positions for this day so new outfit gets fresh layout
      localStorage.removeItem(`plan_positions_${dateKey}`);
      // Clear any error for this day
      setDayErrors(prev => {
        const next = new Map(prev);
        next.delete(dateKey);
        return next;
      });
    } catch (err) {
      console.error(`Regenerate failed for ${dateKey}:`, err);
      setDayErrors(prev => {
        const next = new Map(prev);
        next.set(dateKey, 'Failed to regenerate. Try again.');
        return next;
      });
    }
  }, [allItems, generatedPlans, generatedDayTypes, weatherMap]);

  const saveAllPlans = useCallback(async () => {
    if (!activeChildId) return;
    for (const [dateKey, itemIds] of generatedPlans) {
      const existing = planMap.get(dateKey);
      const dayType = generatedDayTypes.get(dateKey);
      if (itemIds.length === 0) {
        if (existing?.id) {
          await db.weeklyPlans.delete(existing.id);
          localStorage.removeItem(`plan_positions_${dateKey}`);
        }
      } else if (existing?.id) {
        await db.weeklyPlans.update(existing.id, { itemIds, dayType });
      } else {
        await db.weeklyPlans.add({
          profileId: activeChildId,
          date: dateKey,
          itemIds,
          dayType,
        });
      }
    }
    setPhase('view');
    setGeneratedPlans(new Map());
  }, [activeChildId, generatedPlans, generatedDayTypes, planMap]);

  // --- Builder modal handlers (for editing individual days) ---
  const openBuilder = useCallback((dateKey: string) => {
    // In review mode, use generated plan; in view mode use saved plan
    if (phase === 'review') {
      setPendingItemIds(generatedPlans.get(dateKey) || []);
    } else {
      const existing = planMap.get(dateKey);
      setPendingItemIds(existing?.itemIds || []);
    }
    setSelectedDate(dateKey);
    setActiveFilter('All');
  }, [planMap, phase, generatedPlans]);

  const closeBuilder = useCallback(() => {
    setSelectedDate(null);
    setPendingItemIds([]);
    setActiveFilter('All');
  }, []);

  const toggleItem = useCallback((id: number) => {
    setPendingItemIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const savePlan = useCallback(async () => {
    if (!selectedDate || !activeChildId) return;

    if (phase === 'review') {
      // Update generated plan in memory
      setGeneratedPlans(prev => {
        const next = new Map(prev);
        next.set(selectedDate, [...pendingItemIds]);
        return next;
      });
      localStorage.removeItem(`plan_positions_${selectedDate}`);
      closeBuilder();
      return;
    }

    // Normal save to DB (view mode)
    const existing = planMap.get(selectedDate);
    if (pendingItemIds.length === 0) {
      if (existing?.id) {
        await db.weeklyPlans.delete(existing.id);
        localStorage.removeItem(`plan_positions_${selectedDate}`);
      }
    } else if (existing?.id) {
      await db.weeklyPlans.update(existing.id, { itemIds: pendingItemIds });
    } else {
      await db.weeklyPlans.add({
        profileId: activeChildId,
        date: selectedDate,
        itemIds: pendingItemIds,
      });
    }
    closeBuilder();
  }, [selectedDate, activeChildId, pendingItemIds, planMap, closeBuilder, phase]);

  const clearPlan = useCallback(() => {
    setPendingItemIds([]);
  }, []);

  // --- Render item grid cell ---
  const renderItemCell = useCallback((item: ClothingItem) => {
    const isSelected = pendingItemIds.includes(item.id!);
    return (
      <div
        key={item.id}
        onClick={() => toggleItem(item.id!)}
        className={clsx(
          "relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all active:scale-95",
          isSelected
            ? "border-orange-400 ring-2 ring-orange-200 shadow-md"
            : "border-slate-100 dark:border-slate-700 hover:border-slate-200"
        )}
      >
        <img src={item.image} alt={item.category} className="w-full h-full object-cover" />
        {isSelected && (
          <div className="absolute top-1 right-1 w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center shadow-sm">
            <Check size={14} className="text-white" strokeWidth={3} />
          </div>
        )}
      </div>
    );
  }, [pendingItemIds, toggleItem]);

  // --- Render ---
  return (
    <div className="min-h-full bg-orange-50 dark:bg-slate-900">
      {/* Header */}
      <div className="sticky z-30 bg-orange-50/95 dark:bg-slate-900/95 backdrop-blur-sm px-6 pt-2 pb-4" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => {
              if (phase === 'setup') { setPhase('view'); return; }
              if (phase === 'review') { setPhase('setup'); return; }
              navigate(-1);
            }}
            aria-label={phase === 'view' ? 'Close' : 'Go back'}
            className="w-11 h-11 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 active:scale-95 transition-transform"
          >
            {phase === 'view' ? <X size={20} /> : <ArrowLeft size={20} />}
          </button>
          <h1 className="text-title font-serif font-bold text-slate-800 dark:text-slate-50">
            {phase === 'setup' ? 'Set Day Types' : phase === 'review' ? 'Review Outfits' : 'Weekly Plan'}
          </h1>
          <div className="w-11" />
        </div>

        {activeChild && (
          <p className="text-center text-body text-slate-400 dark:text-slate-500 font-medium -mt-1 mb-3">
            {activeChild.name}
          </p>
        )}

        {/* Week Navigator (only in view mode) */}
        {phase === 'view' && (
          <div className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-2xl px-4 py-3 shadow-sm border border-slate-100 dark:border-slate-700">
            <button
              onClick={() => setWeekOffset(w => w - 1)}
              aria-label="Previous week"
              className="w-11 h-11 rounded-full hover:bg-orange-50 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 active:scale-90 transition-transform"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-orange-400" />
              <span className="font-bold text-slate-700 dark:text-slate-200 text-body">{formatWeekRange(monday)}</span>
            </div>
            <button
              onClick={() => setWeekOffset(w => w + 1)}
              aria-label="Next week"
              className="w-11 h-11 rounded-full hover:bg-orange-50 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 active:scale-90 transition-transform"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}

        {/* Week range in setup/review */}
        {(phase === 'setup' || phase === 'review') && (
          <div className="text-center">
            <span className="text-body font-bold text-slate-500 dark:text-slate-400">{formatWeekRange(monday)}</span>
          </div>
        )}
      </div>

      {/* ===== PHASE: VIEW ===== */}
      {phase === 'view' && (
        <div className="px-6 pb-8">
          {/* Plan This Week button */}
          {allItems.length > 0 && (
            <button
              onClick={startSetup}
              className="w-full mb-4 bg-gradient-to-r from-orange-600 to-pink-400 text-white font-bold py-4 rounded-2xl shadow-lg active:shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-body"
            >
              <Sparkles size={20} />
              {hasAnyPlans ? 'Replan This Week' : 'Plan This Week'}
            </button>
          )}

          {/* Day Cards */}
          <div className="space-y-3">
            {weekDays.map((day) => {
              const dateKey = formatDateKey(day);
              const isToday = dateKey === todayKey;
              const isPast = dateKey < todayKey && weekOffset === 0;
              const plan = planMap.get(dateKey);
              const hasOutfit = plan && plan.itemIds.length > 0;
              const dayType = plan?.dayType;
              const cfg = dayType ? DAY_TYPE_CONFIG[dayType] : null;

              if (isPast) return (
                <div
                  key={dateKey}
                  className="rounded-[1.5rem] px-4 py-3 bg-slate-100/60 dark:bg-slate-800/60 flex items-center gap-3 opacity-50"
                >
                  <span className="font-bold text-slate-400 dark:text-slate-500 text-body">{SHORT_DAY[day.getDay()]}</span>
                  <span className="text-slate-400 dark:text-slate-500 text-footnote">{SHORT_MONTHS[day.getMonth()]} {day.getDate()}</span>
                  {cfg && <cfg.icon size={14} className={cfg.iconColor} />}
                </div>
              );

              return (
                <div
                  key={dateKey}
                  onClick={() => openBuilder(dateKey)}
                  className={clsx(
                    "rounded-[1.5rem] p-4 cursor-pointer active:scale-[0.98] transition-all duration-200",
                    cfg ? cfg.cardBg : "bg-white dark:bg-slate-800",
                    isToday && "ring-2 ring-orange-300"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {cfg && <cfg.icon size={18} className={cfg.iconColor} />}
                      <span className="font-bold text-slate-800 dark:text-slate-50 text-body">
                        {DAY_NAMES[day.getDay()]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isToday && (
                        <span className="bg-orange-600 text-white text-caption font-bold px-2 py-0.5 rounded-full">TODAY</span>
                      )}
                      <ChevronRight size={16} className="text-slate-400 dark:text-slate-500" />
                    </div>
                  </div>

                  <p className="text-footnote text-slate-500 dark:text-slate-400 font-medium mb-3">
                    {SHORT_MONTHS[day.getMonth()]} {day.getDate()}
                    {cfg && <span> · {cfg.label}</span>}
                    {hasOutfit && <span> · {plan.itemIds.length} items</span>}
                  </p>

                  {hasOutfit ? (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                      {plan.itemIds.map(id => {
                        const item = itemMap.get(id);
                        if (!item) return null;
                        return (
                          <div key={id} className="w-16 h-16 shrink-0 rounded-xl overflow-hidden shadow-sm border-2 border-white dark:border-slate-700">
                            <img src={item.image} alt={item.category} className="w-full h-full object-cover" />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 py-1">
                      <div className="w-12 h-12 rounded-xl border-2 border-dashed border-slate-300/50 flex items-center justify-center">
                        <Plus size={16} className="text-slate-400 dark:text-slate-500" />
                      </div>
                      <span className="text-footnote font-medium text-slate-400 dark:text-slate-500">Plan outfit</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== PHASE: SETUP ===== */}
      {phase === 'setup' && (
        <div className="px-6 pb-8">
          <p className="text-center text-body text-slate-400 dark:text-slate-500 mb-6">
            Tap to set each day's activity
          </p>

          {/* Phase 5: Show generation error if any */}
          {generateError && (
            <div className="bg-orange-100 dark:bg-slate-800 p-4 rounded-2xl text-orange-800 dark:text-orange-300 text-body mb-4 font-medium flex gap-2 items-center justify-between">
              <div className="flex gap-2 items-center">
                <AlertTriangle size={18} /> {generateError}
              </div>
              <button
                onClick={generateOutfits}
                className="shrink-0 px-3 py-1.5 bg-orange-600 text-white font-bold rounded-full text-footnote"
              >
                Try Again
              </button>
            </div>
          )}

          <div className="space-y-3">
            {weekDays.map((day) => {
              const dateKey = formatDateKey(day);
              const isToday = dateKey === todayKey;
              const isPast = dateKey < todayKey && weekOffset === 0;
              const currentType = dayTypes.get(dateKey) || 'school';
              const currentCfg = DAY_TYPE_CONFIG[currentType];

              if (isPast) return (
                <div key={dateKey} className="rounded-[1.5rem] px-4 py-3 bg-slate-100/60 dark:bg-slate-800/60 flex items-center gap-3 opacity-50">
                  <span className="font-bold text-slate-400 dark:text-slate-500 text-body">{SHORT_DAY[day.getDay()]}</span>
                  <span className="text-slate-400 dark:text-slate-500 text-footnote">{SHORT_MONTHS[day.getMonth()]} {day.getDate()}</span>
                </div>
              );

              return (
                <div
                  key={dateKey}
                  className={clsx(
                    "rounded-[1.5rem] p-4 transition-all duration-300",
                    currentCfg.cardBg,
                    isToday && "ring-2 ring-orange-300"
                  )}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <currentCfg.icon size={18} className={currentCfg.iconColor} />
                    <span className="font-bold text-slate-800 dark:text-slate-50">{DAY_NAMES[day.getDay()]}</span>
                    <span className="text-slate-500 dark:text-slate-400 text-footnote font-medium">{SHORT_MONTHS[day.getMonth()]} {day.getDate()}</span>
                    {isToday && (
                      <span className="bg-orange-600 text-white text-caption font-bold px-2 py-0.5 rounded-full">TODAY</span>
                    )}
                  </div>

                  <div className="flex gap-1.5 flex-wrap">
                    {ALL_DAY_TYPES.map((type) => {
                      const cfg = DAY_TYPE_CONFIG[type];
                      const isActive = currentType === type;
                      return (
                        <button
                          key={type}
                          onClick={() => setDayType(dateKey, type)}
                          className={clsx(
                            "flex items-center gap-1 px-2.5 py-1.5 rounded-full text-footnote font-bold border transition-all active:scale-95",
                            isActive ? cfg.activeBg : "bg-white/60 text-slate-600 border-white/80"
                          )}
                        >
                          <cfg.icon size={12} className={isActive ? "text-white" : cfg.iconColor} />
                          <span>{cfg.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Generate button */}
          <button
            onClick={generateOutfits}
            className="w-full mt-6 bg-gradient-to-r from-orange-600 to-pink-400 text-white font-bold py-4 rounded-2xl shadow-lg active:shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-body"
          >
            <Sparkles size={20} />
            Generate Outfits
          </button>
        </div>
      )}

      {/* ===== PHASE: GENERATING ===== */}
      {phase === 'generating' && (
        <div className="px-6 pb-8 flex flex-col items-center justify-center" style={{ minHeight: '50vh' }}>
          <div className="animate-bounce mb-6">
            <Sparkles size={48} className="text-orange-400" />
          </div>
          <h2 className="text-headline font-serif font-bold text-slate-800 dark:text-slate-50 mb-2">Creating outfits...</h2>
          <p className="text-body text-slate-400 dark:text-slate-500">Matching styles to your closet</p>
        </div>
      )}

      {/* ===== PHASE: REVIEW ===== */}
      {phase === 'review' && (
        <div className="px-6 pb-8">
          <div className="space-y-3">
            {weekDays.map((day) => {
              const dateKey = formatDateKey(day);
              const isToday = dateKey === todayKey;
              const isPast = dateKey < todayKey && weekOffset === 0;
              const itemIds = generatedPlans.get(dateKey) || [];
              const dayType = generatedDayTypes.get(dateKey);
              const cfg = dayType ? DAY_TYPE_CONFIG[dayType] : null;
              const hasOutfit = itemIds.length > 0;
              const dayError = dayErrors.get(dateKey);

              if (isPast) return (
                <div key={dateKey} className="rounded-[1.5rem] px-4 py-3 bg-slate-100/60 dark:bg-slate-800/60 flex items-center gap-3 opacity-50">
                  <span className="font-bold text-slate-400 dark:text-slate-500 text-body">{SHORT_DAY[day.getDay()]}</span>
                  <span className="text-slate-400 dark:text-slate-500 text-footnote">{SHORT_MONTHS[day.getMonth()]} {day.getDate()}</span>
                  {cfg && <cfg.icon size={14} className={cfg.iconColor} />}
                </div>
              );

              return (
                <div
                  key={dateKey}
                  className={clsx(
                    "rounded-[1.5rem] p-4 transition-all duration-200",
                    cfg ? cfg.cardBg : "bg-white dark:bg-slate-800",
                    isToday && "ring-2 ring-orange-300"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {cfg && <cfg.icon size={18} className={cfg.iconColor} />}
                      <span className="font-bold text-slate-800 dark:text-slate-50 text-body">
                        {DAY_NAMES[day.getDay()]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isToday && (
                        <span className="bg-orange-600 text-white text-caption font-bold px-2 py-0.5 rounded-full">TODAY</span>
                      )}
                      <button
                        onClick={() => regenerateDay(dateKey)}
                        aria-label="Regenerate outfit"
                        className="w-11 h-11 rounded-full bg-white/60 dark:bg-slate-800/60 flex items-center justify-center text-slate-500 dark:text-slate-400 active:scale-90 transition-transform"
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button
                        onClick={() => openBuilder(dateKey)}
                        aria-label="Edit outfit"
                        className="w-11 h-11 rounded-full bg-white/60 dark:bg-slate-800/60 flex items-center justify-center text-slate-500 dark:text-slate-400 active:scale-90 transition-transform"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const w = weatherMap.get(dateKey) || weatherMapRef.current.get(dateKey);
                    return (
                      <div className="flex items-center gap-2 text-footnote text-slate-500 dark:text-slate-400 font-medium mb-3 flex-wrap">
                        <span>{SHORT_MONTHS[day.getMonth()]} {day.getDate()}</span>
                        {cfg && <><span>·</span><span>{cfg.label}</span></>}
                        {hasOutfit && <><span>·</span><span>{itemIds.length} items</span></>}
                        {w && (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                              {w.condition === 'Sunny' && <Sun size={12} className="text-amber-400" />}
                              {w.condition === 'Cloudy' && <CloudSun size={12} className="text-slate-400" />}
                              {w.condition === 'Rainy' && <CloudSun size={12} className="text-blue-400" />}
                              {w.condition === 'Snowy' && <Snowflake size={12} className="text-sky-400" />}
                              {w.condition === 'Windy' && <Leaf size={12} className="text-teal-400" />}
                              {w.description}
                            </span>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* Phase 5: Inline error per day */}
                  {dayError && (
                    <div className="bg-orange-100 dark:bg-slate-700 p-2 rounded-xl text-orange-800 dark:text-orange-300 text-footnote mb-2 font-medium flex gap-2 items-center justify-between">
                      <div className="flex gap-1 items-center">
                        <AlertTriangle size={14} /> {dayError}
                      </div>
                      <button
                        onClick={() => regenerateDay(dateKey)}
                        className="shrink-0 px-2 py-1 bg-orange-600 text-white font-bold rounded-full text-caption"
                      >
                        Try Again
                      </button>
                    </div>
                  )}

                  {hasOutfit ? (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                      {itemIds.map(id => {
                        const item = itemMap.get(id);
                        if (!item) return null;
                        return (
                          <div key={id} className="w-16 h-16 shrink-0 rounded-xl overflow-hidden shadow-sm border-2 border-white dark:border-slate-700">
                            <img src={item.image} alt={item.category} className="w-full h-full object-cover" />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-footnote font-medium text-slate-400 dark:text-slate-500 py-2">No outfit generated</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Save All button */}
          <button
            onClick={saveAllPlans}
            className="w-full mt-6 bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 font-bold py-4 rounded-2xl shadow-lg active:shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-body"
          >
            <Check size={20} />
            Save Week
          </button>
        </div>
      )}

      {/* ===== Outfit Builder Modal ===== */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeBuilder} />

          <div className="relative mt-auto bg-orange-50 dark:bg-slate-900 rounded-t-[2rem] max-h-[85dvh] flex flex-col">
            <div className="sticky top-0 bg-orange-50 dark:bg-slate-900 rounded-t-[2rem] px-6 pt-5 pb-3 z-10">
              <div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-serif font-bold text-headline text-slate-800 dark:text-slate-50">
                    {(() => {
                      const d = new Date(selectedDate + 'T00:00:00');
                      return `${DAY_NAMES[d.getDay()]}, ${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
                    })()}
                  </h2>
                  <p className="text-body text-slate-400 dark:text-slate-500 font-medium">
                    {pendingItemIds.length} item{pendingItemIds.length !== 1 ? 's' : ''} selected
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={clearPlan}
                    aria-label="Clear outfit selection"
                    className="px-4 py-2 rounded-full text-body font-bold text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 transition-colors flex items-center gap-1"
                  >
                    <Trash2 size={14} /> Clear
                  </button>
                  <button
                    onClick={savePlan}
                    className="px-5 py-2 rounded-full text-body font-bold text-white bg-orange-600 hover:bg-orange-700 transition-colors shadow-md flex items-center gap-1"
                  >
                    <Check size={14} /> Save
                  </button>
                </div>
              </div>
            </div>

            {pendingItemIds.length > 0 && (
              <div className="px-6 pb-3">
                <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                  {pendingItemIds.map(id => {
                    const item = itemMap.get(id);
                    if (!item) return null;
                    return (
                      <div
                        key={id}
                        onClick={(e) => { e.stopPropagation(); toggleItem(id); }}
                        className="relative w-14 h-14 shrink-0 rounded-xl overflow-hidden border-2 border-orange-400 cursor-pointer"
                      >
                        <img src={item.image} alt={item.category} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                          <X size={14} className="text-white drop-shadow-md" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="px-6 pb-3">
              <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                {FILTER_OPTIONS.map(({ key, label, icon: Icon }) => {
                  const isActive = activeFilter === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveFilter(key)}
                      className={clsx(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-footnote font-bold whitespace-nowrap shrink-0 transition-colors",
                        isActive ? "bg-orange-600 text-white" : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                      )}
                    >
                      <Icon size={14} className={isActive ? "text-white" : "text-slate-400 dark:text-slate-500"} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-6 pb-8">
              {allItems.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-400 dark:text-slate-500 font-medium">No items in closet yet.</p>
                  <p className="text-body text-slate-300 dark:text-slate-600 mt-1">Add some clothes first!</p>
                </div>
              ) : filteredItems !== null ? (
                filteredItems.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-slate-400 dark:text-slate-500 font-medium">No items match this filter.</p>
                    <p className="text-body text-slate-300 dark:text-slate-600 mt-1">Try a different filter.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {filteredItems.map(item => renderItemCell(item))}
                  </div>
                )
              ) : (
                grouped.map(({ category, items }) => (
                  <div key={category} className="mb-5">
                    <h3 className="text-body font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">{category}</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {items.map(item => renderItemCell(item))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
