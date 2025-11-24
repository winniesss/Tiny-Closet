import React from 'react';

export const Logo: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const scale = size === 'sm' ? 0.6 : size === 'lg' ? 1.5 : 1;
  
  return (
    <div className="relative inline-flex items-baseline font-black tracking-tight" style={{ fontFamily: '"Nunito", sans-serif', transform: `scale(${scale})`, transformOrigin: 'left center' }}>
      {/* S */}
      <span className="text-orange-400 text-5xl transform -rotate-6 inline-block">S</span>
      
      {/* l */}
      <span className="text-sky-400 text-5xl transform -rotate-2 inline-block mx-0.5">l</span>
      
      {/* i */}
      <span className="text-orange-400 text-5xl transform rotate-3 inline-block mx-0.5">i</span>
      
      {/* p */}
      <span className="text-pink-400 text-5xl transform -rotate-3 inline-block mx-0.5 translate-y-1">p</span>
      
      {/* p (with spark) */}
      <div className="relative inline-block mx-0.5">
        <span className="text-sky-400 text-5xl transform rotate-6 inline-block">p</span>
        {/* Spark */}
        <div className="absolute -top-4 -left-1 w-full h-8 flex justify-center">
            <svg width="30" height="20" viewBox="0 0 30 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 15L15 2" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
                <path d="M5 12L0 5" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
                <path d="M25 12L30 5" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
            </svg>
        </div>
      </div>
      
      {/* s */}
      <span className="text-orange-400 text-5xl transform -rotate-6 inline-block ml-0.5">s</span>
    </div>
  );
};