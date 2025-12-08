
import React, { useEffect } from 'react';
import { HashRouter, useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { Closet } from './pages/Closet';
import { AddItem } from './pages/AddItem';
import { Stats } from './pages/Stats';
import { Settings } from './pages/Settings';
import { SignUp } from './pages/SignUp';
import { db } from './db';
import clsx from 'clsx';

const AppContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const isAddItem = path === '/add';
  const isSignUp = path === '/signup';

  // Check onboarding status
  useEffect(() => {
    const checkOnboarding = async () => {
        // If we are already on signup, don't redirect
        if (location.pathname === '/signup') return;
        
        const onboarded = localStorage.getItem('tiny_closet_onboarded');
        if (!onboarded) {
             // Double check DB to be safe (if they cleared cache but DB persists)
             try {
                const profiles = await db.profile.toArray();
                // If profile is missing or is the default 'My Kid' seed
                if (profiles.length === 0 || (profiles[0].name === 'My Kid')) {
                    navigate('/signup');
                } else {
                    // Auto-heal localstorage if DB suggests they are already set up
                    localStorage.setItem('tiny_closet_onboarded', 'true');
                }
             } catch (e) {
                console.error("DB Error checking profile", e);
             }
        }
    };
    checkOnboarding();
  }, [navigate, location.pathname]);

  // Helper to determine visibility
  // We use visibility:hidden instead of display:none to potentially preserve layout,
  // but display:none is often safer for focus management.
  // However, for scroll preservation, a separate scroll container for each tab is key.
  const getTabClass = (activePath: string) => {
    const isActive = path === activePath;
    return clsx(
      "absolute inset-0 w-full h-full overflow-y-auto overflow-x-hidden no-scrollbar bg-orange-50 pt-[env(safe-area-inset-top)] pb-[calc(6rem+env(safe-area-inset-bottom))]", 
      isActive ? "z-10 opacity-100 visible pointer-events-auto" : "z-0 opacity-0 invisible pointer-events-none"
    );
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-orange-50">
       {/* Persistent Tabs - These stay mounted to prevent 'refreshing' flicker */}
       <div className={getTabClass('/')}><Dashboard /></div>
       <div className={getTabClass('/closet')}><Closet /></div>
       <div className={getTabClass('/stats')}><Stats /></div>
       <div className={getTabClass('/settings')}><Settings /></div>
       
       {/* Sign Up Page - Needs full screen handling with safe areas */}
       <div className={clsx("absolute inset-0 w-full h-full z-50 bg-orange-50 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]", isSignUp ? "visible" : "invisible")}>
            <SignUp />
       </div>

       {/* Navbar - Hidden when adding an item or on sign up page */}
       <div className={clsx("absolute bottom-0 left-0 right-0 z-40 transition-transform duration-300", (isAddItem || isSignUp) ? "translate-y-full" : "translate-y-0")}>
           <Navbar />
       </div>

       {/* Add Item Overlay - Mounted conditionally to reset state on close */}
       {isAddItem && (
           <div className="absolute inset-0 z-50 bg-orange-50 overflow-y-auto animate-in slide-in-from-bottom-10 duration-300 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
               <AddItem />
           </div>
       )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <div className="antialiased text-slate-800 font-sans selection:bg-sky-200">
        <AppContent />
      </div>
    </HashRouter>
  );
};

export default App;
