import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TopBar } from '../../components/layout/top-bar';
import { SideNav } from '../../components/layout/side-nav';
import { useUiStore } from '../../stores/ui-store';

export default function AppLayout() {
  const { mobileNavOpen, setMobileNavOpen } = useUiStore();
  const location = useLocation();

  // A drawer left open across a route change would cover the page the user just asked
  // for. Closing on Escape matches what every other dismissible overlay here does.
  useEffect(() => setMobileNavOpen(false), [location.pathname, setMobileNavOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileNavOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen, setMobileNavOpen]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopBar />

      <div className="flex min-h-0 flex-1">
        {/* Desktop: part of the flow, collapsible to a rail. */}
        <div className="hidden md:block">
          <SideNav />
        </div>

        {/* Mobile: an overlay drawer, so the sidebar never eats a phone's width. */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileNavOpen(false)}
              aria-hidden="true"
            />
            <div className="relative z-10 h-full shadow-xl">
              <SideNav variant="mobile" />
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
