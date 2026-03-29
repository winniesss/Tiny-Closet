import React from 'react';
import { ClothingItem, WeatherData } from '../types';
import { RotateCcw, Heart, Share2, AlertCircle, Calendar, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

interface TodayStoryProps {
  childName: string;
  weather: WeatherData;
  locationEnabled: boolean;
  outfitItems: ClothingItem[];
  isLiked: boolean;
  onShuffle: () => void;
  onLike: () => void;
  onShare: () => void;
  onItemClick: (item: ClothingItem) => void;
  todayPlanItems?: ClothingItem[];
  hasPlan?: boolean;
  outfitError?: string | null;
  emptyCloset?: boolean;
}

const weatherEmoji: Record<string, string> = {
  Sunny: '\u2600\uFE0F',
  Cloudy: '\u2601\uFE0F',
  Rainy: '\uD83C\uDF27\uFE0F',
  Snowy: '\u2744\uFE0F',
  Windy: '\uD83C\uDF2C\uFE0F',
};

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

export const TodayStory: React.FC<TodayStoryProps> = ({
  childName,
  weather,
  locationEnabled,
  outfitItems,
  isLiked,
  onShuffle,
  onLike,
  onShare,
  onItemClick,
  todayPlanItems,
  hasPlan,
  outfitError,
  emptyCloset,
}) => {
  const emoji = weatherEmoji[weather.condition] || '\u2601\uFE0F';
  const greeting = getGreeting();

  return (
    <section className="mb-6">
      {/* Editorial Greeting + Weather */}
      <div className="mb-5 px-1">
        <h2 className="text-title font-serif text-slate-800 dark:text-slate-50 mb-1">
          {greeting}, {childName}.
        </h2>
        <p className="text-body text-slate-400 dark:text-slate-500 font-medium">
          {locationEnabled
            ? `${emoji} ${Math.round(weather.temp)}° and ${weather.description.toLowerCase()}`
            : `${emoji} Here's today's look`
          }
        </p>
      </div>

      {/* Error State */}
      {outfitError && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-[2rem] p-6 text-center border border-red-100 dark:border-red-800/30 mb-6">
          <AlertCircle className="mx-auto mb-3 text-red-400" size={32} />
          <p className="text-body font-bold text-slate-700 dark:text-slate-200 mb-1">Couldn't pick an outfit</p>
          <p className="text-footnote text-slate-400 mb-4">Something went wrong. Let's try again.</p>
          <button
            onClick={onShuffle}
            className="px-6 py-3 bg-sky-600 text-white font-bold rounded-full text-body active:scale-[0.98] transition-transform"
            aria-label="Try generating outfit again"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty Closet */}
      {emptyCloset && !outfitError && (
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-10 text-center shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="bg-orange-50 dark:bg-orange-900/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 text-orange-300">
            <AlertCircle size={36} strokeWidth={2} />
          </div>
          <h3 className="text-headline font-serif text-slate-800 dark:text-slate-50 mb-2">Your closet is waiting!</h3>
          <p className="text-slate-400 mb-6 text-body font-medium leading-relaxed">
            Snap a photo or upload a screenshot to start building {childName ? `${childName}'s` : 'the'} wardrobe.
          </p>
          <Link
            to="/add"
            className="inline-block px-8 py-4 bg-sky-600 text-white text-body font-bold rounded-full shadow-lg active:shadow-md active:scale-95 transition-all"
          >
            Add First Clothes
          </Link>
        </div>
      )}

      {/* Hero Outfit Collage */}
      {!emptyCloset && !outfitError && outfitItems.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="relative bg-white dark:bg-slate-800 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-700 p-4 pb-8 overflow-hidden min-h-[320px]">
            {/* Planned indicator */}
            {hasPlan && todayPlanItems && todayPlanItems.length > 0 && (
              <div className="flex items-center gap-1.5 mb-3 px-1">
                <Calendar size={14} className="text-sky-500" />
                <span className="text-caption font-bold text-slate-400 uppercase tracking-wider">Today's Plan</span>
                <Link to="/plan" className="ml-auto text-caption font-bold text-sky-500 flex items-center gap-0.5">
                  Edit <ArrowRight size={10} />
                </Link>
              </div>
            )}

            {/* Collage */}
            <div className="relative">
              {outfitItems.map((item, idx) => {
                let posClass = '';
                let rotateClass = '';
                let zIndex = 10;

                if (idx === 0) {
                  posClass = 'w-3/5 ml-auto mr-6';
                  rotateClass = 'rotate-[-2deg]';
                  zIndex = 20;
                } else if (idx === 1) {
                  posClass = 'w-3/5 -mt-12 ml-6';
                  rotateClass = 'rotate-[3deg]';
                  zIndex = 30;
                } else if (idx === 2) {
                  posClass = 'w-2/5 ml-auto -mt-8 mr-4';
                  rotateClass = 'rotate-[-4deg]';
                  zIndex = 40;
                } else {
                  posClass = 'w-1/3 absolute bottom-4 left-8';
                  rotateClass = 'rotate-[6deg]';
                  zIndex = 50;
                }

                return (
                  <div
                    key={`${item.id}-${idx}`}
                    onClick={() => onItemClick(item)}
                    className={`relative group transition-transform duration-300 active:scale-95 active:z-[60] cursor-pointer ${posClass} ${rotateClass}`}
                    style={{ zIndex }}
                    role="button"
                    aria-label={`View ${item.category} - ${item.brand || item.description || ''}`}
                  >
                    <div className="bg-white dark:bg-slate-700 p-1 shadow-md border border-slate-100 dark:border-slate-600 rounded-lg">
                      <img src={item.image} alt={item.category} className="w-full h-auto object-cover rounded-md" />
                    </div>
                    <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-slate-800 dark:bg-slate-600 text-white flex items-center justify-center font-bold text-caption shadow-md border-2 border-white dark:border-slate-800">
                      {idx + 1}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action Bar */}
            <div className="absolute bottom-4 right-4 flex gap-3 z-[60]">
              <button
                onClick={onShuffle}
                className="w-12 h-12 rounded-full bg-white dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 shadow-lg flex items-center justify-center text-slate-400 active:scale-95 transition-all"
                aria-label="Shuffle outfit"
              >
                <RotateCcw size={20} />
              </button>
              <button
                onClick={onLike}
                className={clsx(
                  'w-12 h-12 rounded-full border-2 shadow-lg flex items-center justify-center transition-all active:scale-95',
                  isLiked
                    ? 'bg-red-500 border-red-500 text-white'
                    : 'bg-white dark:bg-slate-700 border-slate-100 dark:border-slate-600 text-slate-300'
                )}
                aria-label={isLiked ? 'Outfit saved' : 'Save outfit'}
              >
                <Heart size={20} className={clsx(isLiked && 'fill-current')} />
              </button>
              <button
                onClick={onShare}
                className="w-12 h-12 rounded-full bg-white dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 shadow-lg flex items-center justify-center text-slate-400 active:scale-95 transition-all"
                aria-label="Share outfit"
              >
                <Share2 size={20} />
              </button>
            </div>
          </div>

          {/* Brand labels */}
          <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
            {outfitItems.slice(0, 4).map((item, idx) => (
              <span key={idx} className="text-caption text-slate-400 dark:text-slate-500 font-medium">
                {item.brand || item.category}
                {idx < Math.min(outfitItems.length, 4) - 1 && <span className="ml-2 text-slate-300">&middot;</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Wardrobe Gap */}
      {!emptyCloset && !outfitError && outfitItems.length === 0 && (
        <div className="p-8 rounded-[2rem] bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30 text-center">
          <p className="text-headline font-bold text-orange-900 dark:text-orange-300 mb-1">Wardrobe Gap!</p>
          <p className="text-body text-orange-700/70 dark:text-orange-400/70">
            No items match the current weather in this style.
          </p>
          <button
            onClick={onShuffle}
            className="mt-4 px-6 py-3 bg-orange-600 text-white font-bold rounded-full text-body active:scale-[0.98] transition-transform"
            aria-label="Try a different outfit"
          >
            Try Again
          </button>
        </div>
      )}
    </section>
  );
};
