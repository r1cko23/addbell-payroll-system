'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Toaster as SonnerToaster } from 'sonner';
import { cn } from '@/lib/utils';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="flex min-h-screen overflow-x-clip bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.08),transparent_22%),radial-gradient(circle_at_bottom_right,hsl(var(--accent-secondary)/0.08),transparent_25%),linear-gradient(to_bottom,hsl(var(--muted)/0.45),hsl(var(--background))_18%)]">
      <SonnerToaster
        position="top-right"
        richColors
        closeButton
        expand
        offset={24}
        toastOptions={{
          style: {
            background: 'hsl(var(--background))',
            color: 'hsl(var(--foreground))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '1rem',
            boxShadow: 'var(--shadow-card)',
          },
        }}
      />
      <aside
        className="hidden lg:flex lg:flex-shrink-0"
        style={{
          position: 'relative',
          zIndex: 10,
          minWidth: '256px',
          width: '256px'
        }}
      >
        <Sidebar />
      </aside>
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" aria-hidden="true" onClick={closeSidebar} />
          <Sidebar
            className="relative z-50 w-80 max-w-full bg-background shadow-hover"
            onClose={closeSidebar}
          />
        </div>
      )}
      <div className={cn('flex min-w-0 flex-1 flex-col overflow-hidden', 'lg:ml-0')}>
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="flex w-full min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 xl:px-8 2xl:px-10">
            <div className="w-full min-w-0">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}