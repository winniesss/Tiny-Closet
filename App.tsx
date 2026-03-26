
import React, { useEffect } from 'react';
import { HashRouter, useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { Closet } from './pages/Closet';
import { AddItem } from './pages/AddItem';
import { Stats } from './pages/Stats';
import { Settings } from './pages/Settings';
import { WeeklyPlanner } from './pages/WeeklyPlanner';
import { SignUp } from './pages/SignUp';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { db } from './db';
import { restoreProfilesFromCloud, getFamilyId, embedFamilyIdInUrl } from './services/profileSync';
import clsx from 'clsx';

const AppContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const isAddItem = path === '/add';
  const isPlan = path === '/plan';
  const isSignUp = path === '/signup';
  const isPrivacy = path === '/privacy';

  // Check onboarding status — restore from cloud if local data was wiped by iOS
  useEffect(() => {
    const getOnboardedCookie = (): boolean => {
      return document.cookie.includes('tiny_closet_onboarded=true');
    };
    const setOnboardedFlag = () => {
      localStorage.setItem('tiny_closet_onboarded', 'true');
      // Cookie survives iOS storage purges better than localStorage
      const maxAge = 10 * 365 * 24 * 60 * 60;
      document.cookie = `tiny_closet_onboarded=true; path=/; max-age=${maxAge}; SameSite=Strict`;
      // Embed family_id in URL — survives even complete iOS storage wipe
      embedFamilyIdInUrl(getFamilyId());
      // Request persistent storage so iOS doesn't evict our data
      navigator.storage?.persist?.().catch(() => {});
    };

    const checkOnboarding = async () => {
        // If we are already on signup, don't redirect
        if (location.pathname === '/signup') return;

        const onboarded = localStorage.getItem('tiny_closet_onboarded') || getOnboardedCookie();
        if (!onboarded) {
             try {
                const profiles = await db.profile.toArray();
                const hasRealProfile = profiles.length > 0 && profiles[0].name !== 'My Kid';
                // Check if user has closet items — a clear signal they've used the app before
                const itemCount = await db.items.count();
                const hasExistingData = hasRealProfile || itemCount > 0;

                if (hasExistingData) {
                    // Auto-heal: user clearly onboarded before, storage was just wiped
                    setOnboardedFlag();
                    return;
                }

                // Truly new user or fully wiped — try restoring from cloud
                const cloudProfiles = await restoreProfilesFromCloud();
                if (cloudProfiles && cloudProfiles.length > 0) {
                    // Clear the default seed profile
                    await db.profile.clear();
                    for (const p of cloudProfiles) {
                        await db.profile.add(p);
                    }
                    setOnboardedFlag();
                    // Restored — no redirect needed, just reload state
                    navigate('/');
                    return;
                }
                navigate('/signup');
             } catch (e) {
                console.error("DB Error checking profile", e);
             }
        } else if (!getOnboardedCookie()) {
            // Auto-heal: localStorage has it but cookie doesn't
            const maxAge = 10 * 365 * 24 * 60 * 60;
            document.cookie = `tiny_closet_onboarded=true; path=/; max-age=${maxAge}; SameSite=Strict`;
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
      "absolute inset-0 w-full h-full overflow-y-auto overflow-x-hidden no-scrollbar bg-orange-50 pt-[env(safe-area-inset-top)] pb-[calc(5rem+env(safe-area-inset-bottom))]", 
      isActive ? "z-10 opacity-100 visible pointer-events-auto" : "z-0 opacity-0 invisible pointer-events-none"
    );
  };

  return (
    <div className="relative w-full h-screen min-h-[100dvh] overflow-hidden bg-orange-50" style={{ minHeight: '-webkit-fill-available' }}>
       {/* Persistent Tabs - These stay mounted to prevent 'refreshing' flicker */}
       <div className={getTabClass('/')}><Dashboard /></div>
       <div className={getTabClass('/closet')}><Closet /></div>
       <div className={getTabClass('/stats')}><Stats /></div>
       <div className={getTabClass('/settings')}><Settings /></div>
       
       {/* Sign Up Page - Only mounted when on signup */}
       {isSignUp && (
         <div className="absolute inset-0 w-full h-full z-50 bg-orange-50 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
              <SignUp />
         </div>
       )}

       {/* Privacy Policy Page */}
       {isPrivacy && (
         <div className="absolute inset-0 w-full h-full z-50 bg-orange-50 overflow-y-auto pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
              <PrivacyPolicy />
         </div>
       )}

       {/* Navbar - Hidden when adding an item, planning, on sign up, or privacy page */}
       {!(isAddItem || isPlan || isSignUp || isPrivacy) && <Navbar />}

       {/* Add Item Overlay */}
       {isAddItem && (
           <div className="absolute inset-0 z-50 bg-orange-50 overflow-y-auto animate-in slide-in-from-bottom-10 duration-300 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
               <AddItem />
           </div>
       )}

       {/* Weekly Planner Overlay */}
       {isPlan && (
           <div className="absolute inset-0 z-50 bg-orange-50 overflow-y-auto animate-in slide-in-from-bottom-10 duration-300 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
               <WeeklyPlanner />
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
