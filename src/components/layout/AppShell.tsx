import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import Topbar from './Topbar';
import DevBanner from '@/components/ui/DevBanner';

export default function AppShell({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* DEV environment warning — hidden in production automatically */}
      <DevBanner />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — desktop only */}
        <aside className="hidden md:flex w-52 flex-col flex-shrink-0">
          <Sidebar />
        </aside>

        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
            {children ?? <Outlet />}
          </main>
        </div>
      </div>

      {/* Bottom nav — mobile only */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden z-50">
        <BottomNav />
      </nav>
    </div>
  );
}
