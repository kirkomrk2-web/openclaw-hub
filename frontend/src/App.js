import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { CommandNavbar } from '@/components/layout/CommandNavbar';
import DashboardPage from '@/pages/DashboardPage';
import CalendarPage from '@/pages/CalendarPage';
import ResourcesPage from '@/pages/ResourcesPage';
import WatchtowerPage from '@/pages/WatchtowerPage';
import PlaygroundPage from '@/pages/PlaygroundPage';

// Scroll to top on route change — instant on first load, smooth otherwise
const ScrollToTop = () => {
  const { pathname } = useLocation();
  const isFirstRender = React.useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      isFirstRender.current = false;
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [pathname]);
  return null;
};

function App() {
  return (
    <HashRouter>
      <div className="relative min-h-screen bg-background">
        {/* Navbar */}
        <CommandNavbar />

        {/* Scroll Reset */}
        <ScrollToTop />

        {/* Routes */}
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/watchtower" element={<WatchtowerPage />} />
          <Route path="/playground" element={<PlaygroundPage />} />
        </Routes>

        {/* Toast Notifications */}
        <Toaster position="bottom-right" />
      </div>
    </HashRouter>
  );
}

export default App;
