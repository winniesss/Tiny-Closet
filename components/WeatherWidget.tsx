import React, { useMemo } from 'react';
import { CloudSun, CloudRain, Sun, Wind, Snowflake } from 'lucide-react';
import { WeatherData } from '../types';

interface Props {
  data: WeatherData;
}

export const WeatherWidget: React.FC<Props> = ({ data }) => {
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
      case 'Rainy': return { bg: 'bg-sky-100', iconBg: 'bg-sky-200', text: 'text-sky-900' };
      case 'Sunny': return { bg: 'bg-orange-100', iconBg: 'bg-orange-200', text: 'text-orange-900' };
      case 'Snowy': return { bg: 'bg-blue-100', iconBg: 'bg-blue-200', text: 'text-blue-900' };
      default: return { bg: 'bg-pink-100', iconBg: 'bg-pink-200', text: 'text-pink-900' };
    }
  }, [data.condition]);

  return (
    <div className={`p-6 rounded-[2rem] mb-8 relative ${theme.bg} transition-colors duration-500`}>
      <div className="flex justify-between items-center">
        <div>
          <h2 className={`text-5xl font-bold tracking-tight mb-2 ${theme.text} font-sans`}>{data.temp}°</h2>
          <div className="flex flex-col">
            <span className={`text-lg font-bold ${theme.text} font-serif`}>{data.condition}</span>
            <span className={`text-sm opacity-70 ${theme.text} font-medium`}>{data.description}</span>
          </div>
        </div>
        <div className={`p-4 rounded-full ${theme.iconBg} shadow-sm`}>
            <Icon size={36} className={theme.text} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
};