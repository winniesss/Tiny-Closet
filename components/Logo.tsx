import React from 'react';

export const Logo: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  // Adjusted scale slightly down as the text is longer
  const scale = size === 'sm' ? 0.5 : size === 'lg' ? 1.2 : 0.85;
  
  return (
    <div className="relative inline-flex items-baseline font-black tracking-tight" style={{ fontFamily: '"Nunito", sans-serif', transform: `scale(${scale})`, transformOrigin: 'left center' }}>
      {/* T */}
      <span className="text-orange-400 text-5xl transform -rotate-6 inline-block">T</span>
      
      {/* i (with spark) */}
      <div className="relative inline-block mx-0.5">
        <span className="text-sky-400 text-5xl transform rotate-2 inline-block">i</span>
        {/* Spark */}
        <div className="absolute -top-5 -left-2 w-full h-8 flex justify-center">
            <svg width="30" height="20" viewBox="0 0 30 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 15L15 2" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
                <path d="M5 12L0 5" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
                <path d="M25 12L30 5" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
            </svg>
        </div>
      </div>
      
      {/* n */}
      <span className="text-pink-400 text-5xl transform -rotate-3 inline-block mx-0.5">n</span>
      
      {/* y */}
      <span className="text-orange-400 text-5xl transform rotate-3 inline-block mx-0.5">y</span>

      {/* Space */}
      <span className="inline-block w-3"></span>

      {/* C */}
      <span className="text-sky-400 text-5xl transform -rotate-3 inline-block">C</span>

      {/* l */}
      <span className="text-orange-400 text-5xl transform rotate-2 inline-block mx-0.5">l</span>

      {/* o */}
      <span className="text-pink-400 text-5xl transform -rotate-2 inline-block mx-0.5">o</span>

      {/* s */}
      <span className="text-sky-400 text-5xl transform rotate-3 inline-block mx-0.5">s</span>

      {/* e */}
      <span className="text-orange-400 text-5xl transform -rotate-3 inline-block mx-0.5">e</span>

      {/* t */}
      <span className="text-pink-400 text-5xl transform rotate-4 inline-block mx-0.5">t</span>
    </div>
  );
};