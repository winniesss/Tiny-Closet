import React from 'react';
import clsx from 'clsx';

interface Segment {
  key: string;
  label: string;
  icon?: React.ReactNode;
  badge?: boolean;
}

interface SegmentedControlProps {
  segments: Segment[];
  activeKey: string;
  onChange: (key: string) => void;
  color?: 'sky' | 'orange' | 'slate';
}

const colorMap = {
  sky: { active: 'bg-sky-600 text-white shadow-md', inactive: 'text-slate-500' },
  orange: { active: 'bg-orange-600 text-white shadow-md', inactive: 'text-slate-500' },
  slate: { active: 'bg-slate-800 text-white shadow-md dark:bg-slate-600', inactive: 'text-slate-500' },
};

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  segments,
  activeKey,
  onChange,
  color = 'sky',
}) => {
  const colors = colorMap[color];

  return (
    <div className="bg-white dark:bg-slate-800 p-1.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex" role="tablist">
      {segments.map((seg) => (
        <button
          key={seg.key}
          role="tab"
          aria-selected={activeKey === seg.key}
          onClick={() => onChange(seg.key)}
          className={clsx(
            'flex-1 py-2.5 px-3 rounded-xl text-body font-bold transition-all duration-200 flex items-center justify-center gap-1.5 relative',
            activeKey === seg.key ? colors.active : colors.inactive
          )}
        >
          {seg.icon}
          {seg.label}
          {seg.badge && activeKey !== seg.key && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
};
