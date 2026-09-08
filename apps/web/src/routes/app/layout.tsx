import { Outlet } from 'react-router-dom';
import { TopBar } from '../../components/layout/top-bar';
import { SideNav } from '../../components/layout/side-nav';

export default function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <div className="flex flex-1">
        <SideNav />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
