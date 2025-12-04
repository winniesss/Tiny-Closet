
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Shirt, Plus, PieChart, Settings } from 'lucide-react';
import clsx from 'clsx';

export const Navbar: React.FC = () => {
  const location = useLocation();

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      "flex flex-col items-center justify-center w-full h-full transition-all duration-300 rounded-2xl mx-1",
      isActive ? "text-sky-500 bg-sky-100" : "text-slate-400 hover:text-slate-600"
    );

  const handleNavClick = (e: React.MouseEvent, path: string) => {
    // If we are already on the path, prevent default to avoid "refresh" or scroll reset
    if (location.pathname === path) {
      e.preventDefault();
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/90 backdrop-blur-md rounded-t-[2rem] shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.05)] z-50 px-4 pb-4 pt-2">
      <div className="flex justify-between items-center h-full">
        <NavLink 
          to="/" 
          className={navItemClass}
          onClick={(e) => handleNavClick(e, '/')}
        >
          <Home strokeWidth={2.5} size={24} />
        </NavLink>
        <NavLink 
          to="/closet" 
          className={navItemClass}
          onClick={(e) => handleNavClick(e, '/closet')}
        >
          <Shirt strokeWidth={2.5} size={24} />
        </NavLink>
        <NavLink 
          to="/add" 
          className={({ isActive }) => 
          clsx(
            "flex items-center justify-center w-14 h-14 shrink-0 rounded-full text-white shadow-lg transform transition-transform active:scale-95 mb-4 mx-2 border-4 border-white aspect-square",
            isActive ? "bg-orange-400" : "bg-orange-400"
          )
        }>
             <Plus strokeWidth={3} size={24} />
        </NavLink>
        <NavLink 
          to="/stats" 
          className={navItemClass}
          onClick={(e) => handleNavClick(e, '/stats')}
        >
          <PieChart strokeWidth={2.5} size={24} />
        </NavLink>
        <NavLink 
          to="/settings" 
          className={navItemClass}
          onClick={(e) => handleNavClick(e, '/settings')}
        >
          <Settings strokeWidth={2.5} size={24} />
        </NavLink>
      </div>
    </nav>
  );
};
