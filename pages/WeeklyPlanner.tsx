
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { ClothingItem, Category, WeeklyPlan, Season } from '../types';
import { useActiveChild } from '../hooks/useActiveChild';
import { ChevronLeft, ChevronRight, X, Check, Trash2, Plus, Calendar, Clock, Sun, Leaf, Snowflake, CloudSun, Pencil } from 'lucide-react';
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

  // Sync positions when itemIds change
  useEffect(() => {
    const saved = loadPositions(dateKey);
    if (saved.size > 0) {
      // Add default positions for any new items not in saved
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
      // Save positions on drop
      setPositions(prev => {
        savePositions(dateKey, prev);
        return prev;
      });
    }
  }, [dateKey]);

  const toggleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (editing) {
      // Exiting edit mode - save
      savePositions(dateKey, positions);
    }
    setEditing(prev => !prev);
  }, [editing, dateKey, positions]);

  const outfitItems = itemIds.map(id => itemMap.get(id)).filter(Boolean) as ClothingItem[];

  return (
    <div className="relative">
      {/* Edit toggle button */}
      <button
        onClick={toggleEdit}
        className={clsx(
          "absolute top-2 right-2 z-20 w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-colors",
          editing
            ? "bg-orange-400 text-white"
            : "bg-white/80 text-slate-400 border border-slate-200"
        )}
      >
        <Pencil size={14} />
      </button>

      <div
        ref={canvasRef}
        className={clsx(
          "relative w-full aspect-[4/5] bg-white rounded-2xl overflow-hidden",
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
              className={clsx(
                "absolute w-[30%] touch-none",
                editing && "cursor-grab active:cursor-grabbing"
              )}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                zIndex: editing ? 10 : 1,
              }}
              onPointerDown={(e) => handlePointerDown(e, item.id!)}
            >
              <img
                src={item.image}
                alt={item.category}
                className={clsx(
                  "w-full h-auto object-contain drop-shadow-md pointer-events-none",
                  editing && "ring-2 ring-orange-200 rounded-lg"
                )}
                draggable={false}
              />
            </div>
          );
        })}

        {editing && (
          <div className="absolute bottom-2 left-0 right-0 text-center">
            <span className="text-[10px] font-bold text-slate-300 bg-white/70 px-2 py-0.5 rounded-full">
              Drag items to reposition
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Component ---
export const WeeklyPlanner: React.FC = () => {
  const navigate = useNavigate();
  const { activeChild, activeChildId } = useActiveChild();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pendingItemIds, setPendingItemIds] = useState<number[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('All');

  // Compute current week
  const monday = useMemo(() => {
    const m = getMonday(new Date());
    m.setDate(m.getDate() + weekOffset * 7);
    return m;
  }, [weekOffset]);

  const weekDays = useMemo(() => getWeekDays(monday), [monday]);
  const todayKey = formatDateKey(new Date());

  // Fetch all plans for this week
  const weekDateKeys = useMemo(() => weekDays.map(formatDateKey), [weekDays]);

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

  // Item lookup map
  const itemMap = useMemo(() => {
    const m = new Map<number, ClothingItem>();
    allItems.forEach(i => { if (i.id != null) m.set(i.id, i); });
    return m;
  }, [allItems]);

  // --- Filtered items for builder modal ---
  const filteredItems = useMemo(() => {
    if (activeFilter === 'All') return null; // null means use grouped view
    if (activeFilter === 'Recent') {
      const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      return [...allItems]
        .filter(item => item.dateAdded >= fourteenDaysAgo)
        .sort((a, b) => b.dateAdded - a.dateAdded);
    }
    // Season filters
    const season = SEASON_MAP[activeFilter];
    if (season) {
      return allItems.filter(item =>
        item.seasons?.includes(season) || item.seasons?.includes(Season.All)
      );
    }
    return null;
  }, [activeFilter, allItems]);

  // --- Handlers ---
  const openBuilder = useCallback((dateKey: string) => {
    const existing = planMap.get(dateKey);
    setPendingItemIds(existing?.itemIds || []);
    setSelectedDate(dateKey);
    setActiveFilter('All');
  }, [planMap]);

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
  }, [selectedDate, activeChildId, pendingItemIds, planMap, closeBuilder]);

  const clearPlan = useCallback(() => {
    setPendingItemIds([]);
  }, []);

  // --- Render item grid cell (shared between grouped and flat views) ---
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
            : "border-slate-100 hover:border-slate-200"
        )}
      >
        <img
          src={item.image}
          alt={item.category}
          className="w-full h-full object-cover"
        />
        {isSelected && (
          <div className="absolute top-1 right-1 w-6 h-6 bg-orange-400 rounded-full flex items-center justify-center shadow-sm">
            <Check size={14} className="text-white" strokeWidth={3} />
          </div>
        )}
      </div>
    );
  }, [pendingItemIds, toggleItem]);

  return (
    <div className="min-h-full bg-orange-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-orange-50/95 backdrop-blur-sm px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-500 active:scale-95 transition-transform"
          >
            <X size={20} />
          </button>
          <h1 className="text-xl font-serif font-bold text-slate-800">Weekly Plan</h1>
          <div className="w-10" />
        </div>

        {activeChild && (
          <p className="text-center text-sm text-slate-400 font-bold -mt-1 mb-3">
            {activeChild.name}
          </p>
        )}

        {/* Week Navigator */}
        <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm border border-slate-100">
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            className="w-8 h-8 rounded-full hover:bg-orange-50 flex items-center justify-center text-slate-400 active:scale-90 transition-transform"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-orange-400" />
            <span className="font-bold text-slate-700 text-sm">{formatWeekRange(monday)}</span>
          </div>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            className="w-8 h-8 rounded-full hover:bg-orange-50 flex items-center justify-center text-slate-400 active:scale-90 transition-transform"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Day Cards */}
      <div className="px-6 pb-8 space-y-4">
        {weekDays.map((day) => {
          const dateKey = formatDateKey(day);
          const isToday = dateKey === todayKey;
          const plan = planMap.get(dateKey);
          const hasOutfit = plan && plan.itemIds.length > 0;

          return (
            <div
              key={dateKey}
              className={clsx(
                "rounded-[1.5rem] overflow-hidden shadow-sm border transition-all duration-200",
                isToday ? "border-orange-300 ring-2 ring-orange-200" : "border-slate-100"
              )}
            >
              {/* Day label bar */}
              <div
                onClick={() => openBuilder(dateKey)}
                className="flex items-center justify-between px-4 py-3 bg-white cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-2">
                  <span className="font-serif font-bold text-slate-800">
                    {SHORT_DAY[day.getDay()]}
                  </span>
                  <span className="text-slate-400 text-sm font-bold">
                    {day.getDate()}
                  </span>
                  {isToday && (
                    <span className="bg-orange-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      TODAY
                    </span>
                  )}
                </div>
                <ChevronRight size={16} className="text-slate-300" />
              </div>

              {/* Outfit canvas or empty state */}
              {hasOutfit ? (
                <div className="px-2 pb-2">
                  <DraggableCanvasCard
                    itemIds={plan.itemIds}
                    itemMap={itemMap}
                    dateKey={dateKey}
                  />
                </div>
              ) : (
                <div
                  className="bg-white px-4 pb-4 cursor-pointer active:scale-[0.98] transition-transform"
                  onClick={() => openBuilder(dateKey)}
                >
                  <div className="flex items-center gap-3 py-4 border-t border-dashed border-slate-100">
                    <div className="w-12 h-12 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center">
                      <Plus size={18} className="text-slate-300" />
                    </div>
                    <span className="text-sm font-bold text-slate-300">Plan outfit</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Outfit Builder Modal */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeBuilder}
          />

          <div className="relative mt-auto bg-orange-50 rounded-t-[2rem] max-h-[85dvh] flex flex-col">
            {/* Sheet Header */}
            <div className="sticky top-0 bg-orange-50 rounded-t-[2rem] px-6 pt-5 pb-3 z-10">
              <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-serif font-bold text-lg text-slate-800">
                    {(() => {
                      const d = new Date(selectedDate + 'T00:00:00');
                      return `${DAY_NAMES[d.getDay()]}, ${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
                    })()}
                  </h2>
                  <p className="text-sm text-slate-400 font-bold">
                    {pendingItemIds.length} item{pendingItemIds.length !== 1 ? 's' : ''} selected
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={clearPlan}
                    className="px-4 py-2 rounded-full text-sm font-bold text-red-400 bg-red-50 hover:bg-red-100 transition-colors flex items-center gap-1"
                  >
                    <Trash2 size={14} /> Clear
                  </button>
                  <button
                    onClick={savePlan}
                    className="px-5 py-2 rounded-full text-sm font-bold text-white bg-orange-400 hover:bg-orange-500 transition-colors shadow-md flex items-center gap-1"
                  >
                    <Check size={14} /> Save
                  </button>
                </div>
              </div>
            </div>

            {/* Selected items strip */}
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

            {/* Quick Filter Bar */}
            <div className="px-6 pb-3">
              <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                {FILTER_OPTIONS.map(({ key, label, icon: Icon }) => {
                  const isActive = activeFilter === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveFilter(key)}
                      className={clsx(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-colors",
                        isActive
                          ? "bg-orange-400 text-white"
                          : "bg-white text-slate-500 border border-slate-200"
                      )}
                    >
                      <Icon size={14} className={isActive ? "text-white" : "text-slate-400"} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Item Grid */}
            <div className="overflow-y-auto flex-1 px-6 pb-8">
              {allItems.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-400 font-bold">No items in closet yet.</p>
                  <p className="text-sm text-slate-300 mt-1">Add some clothes first!</p>
                </div>
              ) : filteredItems !== null ? (
                /* Flat grid for filtered view */
                filteredItems.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-slate-400 font-bold">No items match this filter.</p>
                    <p className="text-sm text-slate-300 mt-1">Try a different filter.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {filteredItems.map(item => renderItemCell(item))}
                  </div>
                )
              ) : (
                /* Category-grouped view (default / "All") */
                grouped.map(({ category, items }) => (
                  <div key={category} className="mb-5">
                    <h3 className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wide">
                      {category}
                    </h3>
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
