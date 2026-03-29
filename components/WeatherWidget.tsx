
import React, { useMemo } from 'react';
import { CloudSun, CloudRain, Sun, Wind, Snowflake, MapPin } from 'lucide-react';
import { WeatherData } from '../types';

interface Props {
  data: WeatherData;
  locationEnabled?: boolean;
}

export const WeatherWidget: React.FC<Props> = ({ data, locationEnabled }) => {
  const Icon = useMemo(() => {
    switch (data.condition) {
      case 'Rainy': return CloudRain;
      case 'Sunny': return Sun;
      case 'Snowy': return Snowflake;
      case 'Windy': return Wind;
      default: return CloudSun;
    }
  }, [data.condition]);

  const theme = useMemo(() => {
    switch (data.condition) {
      case 'Rainy': return { bg: 'bg-sky-100 dark:bg-sky-900/40', iconBg: 'bg-white/40 dark:bg-white/10', text: 'text-sky-900 dark:text-sky-100' };
      case 'Sunny': return { bg: 'bg-orange-100 dark:bg-orange-900/40', iconBg: 'bg-white/40 dark:bg-white/10', text: 'text-orange-900 dark:text-orange-100' };
      case 'Snowy': return { bg: 'bg-blue-100 dark:bg-blue-900/40', iconBg: 'bg-white/40 dark:bg-white/10', text: 'text-blue-900 dark:text-blue-100' };
      default: return { bg: 'bg-pink-100 dark:bg-pink-900/40', iconBg: 'bg-white/40 dark:bg-white/10', text: 'text-pink-900 dark:text-pink-100' };
    }
  }, [data.condition]);

  return (
    <div className={`px-5 py-4 rounded-[1.8rem] mb-6 flex items-center justify-between ${theme.bg} transition-colors duration-500 shadow-sm relative overflow-hidden group`}>
      <div className="flex items-center gap-4 relative z-10">
        <div className={`p-2.5 rounded-full ${theme.iconBg}`}>
            <Icon size={20} className={theme.text} strokeWidth={2.5} />
        </div>
        <div className="flex flex-col">
            <span className={`text-footnote font-bold uppercase tracking-wider opacity-80 ${theme.text}`}>{data.condition}</span>
            <span className={`text-caption font-medium opacity-60 ${theme.text} leading-none`}>{data.description}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 relative z-10">
          {locationEnabled && <MapPin size={14} className={theme.text} style={{opacity: 0.4}} />}
          <div className={`text-largeTitle font-black ${theme.text} font-sans leading-none`}>{data.temp}</div>
      </div>

      {/* Decorative background shape */}
      <div className={`absolute -right-6 -bottom-10 w-24 h-24 rounded-full ${theme.iconBg} opacity-50 pointer-events-none group-active:scale-110 transition-transform duration-700`}></div>
    </div>
  );
};
