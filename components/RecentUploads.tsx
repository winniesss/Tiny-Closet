import React from 'react';
import { ClothingItem } from '../types';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface RecentUploadsProps {
  items: ClothingItem[];
  onItemClick: (item: ClothingItem) => void;
}

export const RecentUploads: React.FC<RecentUploadsProps> = ({ items, onItemClick }) => {
  if (items.length === 0) return null;

  const recent = items.slice().reverse().slice(0, 5);

  return (
    <section className="mb-8">
      <div className="flex justify-between items-center mb-3 px-1">
        <h2 className="text-headline text-slate-800 dark:text-slate-50 font-serif font-bold">From Your Closet</h2>
        <Link
          to="/closet"
          className="text-footnote font-bold text-orange-500 flex items-center gap-1 px-2 py-1"
          aria-label="See all closet items"
        >
          See All <ArrowRight size={12} />
        </Link>
      </div>
      <div className="relative scroll-fade-right">
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-4 -mx-6 px-6">
          {recent.map(item => (
            <div
              key={item.id}
              className="w-20 shrink-0 cursor-pointer transition-transform active:scale-95"
              onClick={() => onItemClick(item)}
              role="button"
              aria-label={`View ${item.brand || item.category}`}
            >
              <div className="aspect-square rounded-2xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm">
                <img src={item.image} alt={item.description || item.category} className="w-full h-full object-cover" />
              </div>
              <p className="text-caption text-slate-400 font-medium mt-1.5 text-center truncate">
                {item.brand || item.category}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
