
import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { ClothingItem, Category, WeeklyPlan } from '../types';
import { useActiveChild } from '../hooks/useActiveChild';
import { ChevronLeft, ChevronRight, X, Check, Trash2, Plus, Calendar } from 'lucide-react';
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
    return `${m1} ${monday.getDate()} – ${sunday.getDate()}`;
  }
  return `${m1} ${monday.getDate()} – ${m2} ${sunday.getDate()}`;
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

// --- Flat-lay layout positions by category ---
type LayoutSlot = { top: string; left: string; width: string; rotate: string; zIndex: number };

function getFlatLayPositions(items: ClothingItem[]): Map<number, LayoutSlot> {
  const positions = new Map<number, LayoutSlot>();

  const tops: ClothingItem[] = [];
  const bottoms: ClothingItem[] = [];
  const fullBody: ClothingItem[] = [];
  const shoes: ClothingItem[] = [];
  const accessories: ClothingItem[] = [];
  const layers: ClothingItem[] = [];

  items.forEach(item => {
    switch (item.category) {
      case Category.Top:
        tops.push(item); break;
      case Category.Bottom:
      case Category.Tights:
        bottoms.push(item); break;
      case Category.FullBody:
      case Category.Romper:
      case Category.Overall:
      case Category.Pajamas:
      case Category.Swimwear:
        fullBody.push(item); break;
      case Category.Shoes:
      case Category.Socks:
        shoes.push(item); break;
      case Category.Outerwear:
      case Category.Vest:
        layers.push(item); break;
      case Category.Accessory:
        accessories.push(item); break;
    }
  });

  const hasFullBody = fullBody.length > 0;

  // Full-body items: center, large
  fullBody.forEach((item, i) => {
    positions.set(item.id!, {
      top: '5%', left: i === 0 ? '10%' : '35%',
      width: '55%', rotate: `${-2 + i * 3}deg`, zIndex: 10 + i
    });
  });

  // Tops: upper area
  if (!hasFullBody) {
    tops.forEach((item, i) => {
      positions.set(item.id!, {
        top: '2%', left: i === 0 ? '15%' : '45%',
        width: i === 0 ? '50%' : '40%', rotate: `${-3 + i * 5}deg`, zIndex: 10 + i
      });
    });
  } else {
    tops.forEach((item, i) => {
      positions.set(item.id!, {
        top: '0%', left: '50%',
        width: '38%', rotate: `${4 + i * 2}deg`, zIndex: 20 + i
      });
    });
  }

  // Bottoms: lower center
  if (!hasFullBody) {
    bottoms.forEach((item, i) => {
      positions.set(item.id!, {
        top: '38%', left: i === 0 ? '20%' : '48%',
        width: i === 0 ? '50%' : '38%', rotate: `${3 - i * 4}deg`, zIndex: 15 + i
      });
    });
  } else {
    bottoms.forEach((item, i) => {
      positions.set(item.id!, {
        top: '50%', left: '55%',
        width: '35%', rotate: `${-3 + i * 3}deg`, zIndex: 15 + i
      });
    });
  }

  // Shoes: bottom area
  shoes.forEach((item, i) => {
    positions.set(item.id!, {
      top: '68%', left: i === 0 ? '5%' : '55%',
      width: '28%', rotate: `${-8 + i * 15}deg`, zIndex: 20 + i
    });
  });

  // Layers: offset to the side
  layers.forEach((item, i) => {
    positions.set(item.id!, {
      top: '10%', left: i === 0 ? '55%' : '60%',
      width: '40%', rotate: `${5 + i * 3}deg`, zIndex: 5 + i
    });
  });

  // Accessories: scattered
  const accSlots: LayoutSlot[] = [
    { top: '5%', left: '65%', width: '28%', rotate: '6deg', zIndex: 25 },
    { top: '55%', left: '60%', width: '25%', rotate: '-4deg', zIndex: 25 },
    { top: '72%', left: '40%', width: '22%', rotate: '8deg', zIndex: 26 },
  ];
  accessories.forEach((item, i) => {
    const slot = accSlots[i % accSlots.length];
    positions.set(item.id!, slot);
  });

  return positions;
}

// --- Flat-lay Outfit Card ---
const FlatLayCard: React.FC<{ itemIds: number[]; itemMap: Map<number, ClothingItem> }> = ({ itemIds, itemMap }) => {
  const outfitItems = itemIds.map(id => itemMap.get(id)).filter(Boolean) as ClothingItem[];
  const positions = getFlatLayPositions(outfitItems);

  return (
    <div className="relative w-full aspect-[4/5] bg-white rounded-2xl overflow-hidden">
      {outfitItems.map(item => {
        const pos = positions.get(item.id!);
        if (!pos) return null;
        return (
          <div
            key={item.id}
            className="absolute transition-transform duration-300"
            style={{
              top: pos.top,
              left: pos.left,
              width: pos.width,
              transform: `rotate(${pos.rotate})`,
              zIndex: pos.zIndex,
            }}
          >
            <img
              src={item.image}
              alt={item.category}
              className="w-full h-auto object-contain drop-shadow-md"
            />
          </div>
        );
      })}
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

  // --- Handlers ---
  const openBuilder = useCallback((dateKey: string) => {
    const existing = planMap.get(dateKey);
    setPendingItemIds(existing?.itemIds || []);
    setSelectedDate(dateKey);
  }, [planMap]);

  const closeBuilder = useCallback(() => {
    setSelectedDate(null);
    setPendingItemIds([]);
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

      {/* Day Cards — Flat-lay style */}
      <div className="px-6 pb-8 space-y-4">
        {weekDays.map((day) => {
          const dateKey = formatDateKey(day);
          const isToday = dateKey === todayKey;
          const plan = planMap.get(dateKey);
          const hasOutfit = plan && plan.itemIds.length > 0;

          return (
            <div
              key={dateKey}
              onClick={() => openBuilder(dateKey)}
              className={clsx(
                "rounded-[1.5rem] overflow-hidden shadow-sm border cursor-pointer active:scale-[0.98] transition-all duration-200",
                isToday ? "border-orange-300 ring-2 ring-orange-200" : "border-slate-100"
              )}
            >
              {/* Day label bar */}
              <div className={clsx(
                "flex items-center justify-between px-4 py-3",
                hasOutfit ? "bg-white" : "bg-white"
              )}>
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

              {/* Outfit flat-lay or empty state */}
              {hasOutfit ? (
                <FlatLayCard itemIds={plan.itemIds} itemMap={itemMap} />
              ) : (
                <div className="bg-white px-4 pb-4">
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

            {/* Item Grid by Category */}
            <div className="overflow-y-auto flex-1 px-6 pb-8">
              {allItems.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-400 font-bold">No items in closet yet.</p>
                  <p className="text-sm text-slate-300 mt-1">Add some clothes first!</p>
                </div>
              ) : (
                grouped.map(({ category, items }) => (
                  <div key={category} className="mb-5">
                    <h3 className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wide">
                      {category}
                    </h3>
                    <div className="grid grid-cols-4 gap-2">
                      {items.map(item => {
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
                      })}
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
