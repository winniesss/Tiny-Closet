import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { Closet } from './pages/Closet';
import { AddItem } from './pages/AddItem';
import { Stats } from './pages/Stats';
import { Settings } from './pages/Settings';

const App: React.FC = () => {
  return (
    <HashRouter>
      <div className="antialiased text-slate-800 bg-orange-50 min-h-screen font-sans selection:bg-sky-200">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/closet" element={<Closet />} />
          <Route path="/add" element={<AddItem />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
        <Navbar />
      </div>
    </HashRouter>
  );
};

export default App;