import React from 'react';
import { ClothingItem } from '../types';
import { TrendingUp, Archive } from 'lucide-react';

interface OutgrownAlertProps {
  outgrownItems: ClothingItem[];
  childAge: string;
  onArchiveAll: () => void;
  onItemClick: (item: ClothingItem) => void;
}

export const OutgrownAlert: React.FC<OutgrownAlertProps> = ({
  outgrownItems,
  childAge,
  onArchiveAll,
  onItemClick,
}) => {
  if (outgrownItems.length === 0) return null;

  return (
    <section className="bg-white dark:bg-slate-800 border border-orange-100 dark:border-orange-800/30 rounded-[2rem] p-5 mb-8 shadow-sm animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-start gap-3 mb-4">
        <div className="bg-orange-100 dark:bg-orange-900/30 p-2.5 rounded-xl text-orange-500 shrink-0">
          <TrendingUp size={20} />
        </div>
        <div>
          <h3 className="font-bold text-headline text-slate-800 dark:text-slate-50 font-serif">Growing Up!</h3>
          <p className="text-footnote text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            {outgrownItems.length} {outgrownItems.length === 1 ? 'item' : 'items'} might be too small{childAge ? ` for ${childAge}` : ''}.
          </p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-3 scroll-fade-right">
        {outgrownItems.map(item => (
          <div
            key={item.id}
            onClick={() => onItemClick(item)}
            className="shrink-0 w-14 h-14 rounded-xl bg-slate-50 dark:bg-slate-700 overflow-hidden relative border border-slate-100 dark:border-slate-600 cursor-pointer active:scale-95 transition-transform"
            role="button"
            aria-label={`View ${item.category} size ${item.sizeLabel}`}
          >
            <img src={item.image} className="w-full h-full object-cover opacity-80" alt={item.category} />
            <div className="absolute bottom-0 inset-x-0 bg-orange-500/80 text-white text-caption text-center font-bold">
              {item.sizeLabel}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onArchiveAll}
        className="w-full flex items-center justify-center gap-2 py-3 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-bold rounded-xl active:bg-orange-100 dark:active:bg-orange-900/40 transition-colors text-body"
        aria-label={`Archive all ${outgrownItems.length} outgrown items`}
      >
        <Archive size={18} /> Archive All
      </button>
    </section>
  );
};
