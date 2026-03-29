import React, { useState, useRef } from 'react';
import { Camera, Sparkles, Calendar, ChevronRight } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

const screens = [
  {
    icon: Camera,
    color: 'text-orange-500',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    title: 'Snap & Add',
    description: 'Take a photo of any clothing item. Our AI identifies the type, size, brand, and season automatically.',
  },
  {
    icon: Sparkles,
    color: 'text-sky-500',
    bg: 'bg-sky-100 dark:bg-sky-900/30',
    title: 'Daily Outfits',
    description: 'Get outfit suggestions based on the weather and what\'s in the closet. Save your favorites to the Lookbook.',
  },
  {
    icon: Calendar,
    color: 'text-pink-500',
    bg: 'bg-pink-100 dark:bg-pink-900/30',
    title: 'Plan Your Week',
    description: 'Map out outfits for the whole week. Share outfit postcards with family and friends.',
  },
];

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const scrollLeft = scrollRef.current.scrollLeft;
    const width = scrollRef.current.offsetWidth;
    const newIndex = Math.round(scrollLeft / width);
    setActiveIndex(newIndex);
  };

  const goToNext = () => {
    if (activeIndex === screens.length - 1) {
      handleComplete();
    } else if (scrollRef.current) {
      const width = scrollRef.current.offsetWidth;
      scrollRef.current.scrollTo({ left: (activeIndex + 1) * width, behavior: 'smooth' });
    }
  };

  const handleComplete = () => {
    localStorage.setItem('tiny_closet_onboarding_seen', 'true');
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[300] bg-orange-50 dark:bg-slate-900 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {/* Skip button */}
      <div className="flex justify-end p-4">
        <button
          onClick={handleComplete}
          className="text-body font-medium text-slate-400 px-3 py-2"
          aria-label="Skip onboarding"
        >
          Skip
        </button>
      </div>

      {/* Scrollable screens */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
      >
        {screens.map((screen, idx) => {
          const Icon = screen.icon;
          return (
            <div
              key={idx}
              className="w-full shrink-0 snap-center flex flex-col items-center justify-center px-10"
            >
              <div className={`w-28 h-28 rounded-full ${screen.bg} flex items-center justify-center mb-8`}>
                <Icon size={48} className={screen.color} strokeWidth={1.5} />
              </div>
              <h2 className="text-title font-serif font-bold text-slate-800 dark:text-slate-50 mb-3 text-center">
                {screen.title}
              </h2>
              <p className="text-body text-slate-500 dark:text-slate-400 font-medium text-center leading-relaxed max-w-[280px]">
                {screen.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Dots + Action button */}
      <div className="pb-8 px-6">
        {/* Dot indicators */}
        <div className="flex justify-center gap-2 mb-6">
          {screens.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === activeIndex ? 'w-6 bg-orange-500' : 'w-2 bg-slate-300 dark:bg-slate-600'
              }`}
            />
          ))}
        </div>

        {/* Action button */}
        <button
          onClick={goToNext}
          className="w-full py-4 bg-slate-800 dark:bg-slate-700 text-white font-bold text-body rounded-full shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
        >
          {activeIndex === screens.length - 1 ? 'Get Started' : 'Next'}
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};
