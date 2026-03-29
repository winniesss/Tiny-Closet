
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Shirt, Plus, PieChart, Settings } from 'lucide-react';
import clsx from 'clsx';

export const Navbar: React.FC = () => {
  const location = useLocation();

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      "flex flex-col items-center justify-center w-full h-full transition-all duration-300 rounded-2xl mx-1",
      isActive ? "text-sky-600 bg-sky-100 dark:bg-sky-900/30" : "text-slate-400 active:text-slate-600"
    );

  const handleNavClick = (e: React.MouseEvent, path: string) => {
    if (location.pathname === path) {
      e.preventDefault();
    }
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-t-[2rem] shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.05)] z-50 px-4 pt-2"
      style={{ paddingBottom: 'max(2.25rem, calc(1rem + env(safe-area-inset-bottom, 0px)))' }}
      role="tablist"
      aria-label="Main navigation"
    >
      <div className="flex justify-between items-center h-16">
        <NavLink
          to="/"
          className={navItemClass}
          onClick={(e) => handleNavClick(e, '/')}
          aria-label="Home"
          role="tab"
        >
          <Home strokeWidth={2.5} size={24} />
        </NavLink>
        <NavLink
          to="/closet"
          className={navItemClass}
          onClick={(e) => handleNavClick(e, '/closet')}
          aria-label="Closet"
          role="tab"
        >
          <Shirt strokeWidth={2.5} size={24} />
        </NavLink>
        <NavLink
          to="/add"
          aria-label="Add item"
          className={({ isActive }) =>
            clsx(
              "flex items-center justify-center w-14 h-14 shrink-0 rounded-full text-white shadow-lg transform transition-transform active:scale-95 mb-4 mx-2 border-4 border-white dark:border-slate-800 aspect-square",
              "bg-orange-600"
            )
          }
        >
          <Plus strokeWidth={3} size={24} />
        </NavLink>
        <NavLink
          to="/stats"
          className={navItemClass}
          onClick={(e) => handleNavClick(e, '/stats')}
          aria-label="Stats"
          role="tab"
        >
          <PieChart strokeWidth={2.5} size={24} />
        </NavLink>
        <NavLink
          to="/settings"
          className={navItemClass}
          onClick={(e) => handleNavClick(e, '/settings')}
          aria-label="Settings"
          role="tab"
        >
          <Settings strokeWidth={2.5} size={24} />
        </NavLink>
      </div>
    </nav>
  );
};
