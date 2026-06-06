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
    <div className="flex min-h-screen overflow-x-clip bg-background">
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
          <div className="absolute inset-0 bg-foreground/40" aria-hidden="true" onClick={closeSidebar} />
          <Sidebar
            className="relative z-50 w-80 max-w-full shadow-lg"
            onClose={closeSidebar}
          />
        </div>
      )}
      <div className={cn('flex min-w-0 flex-1 flex-col overflow-hidden', 'lg:ml-0')}>
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <div className="dashboard-content container mx-auto w-full min-w-0 max-w-7xl px-3 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}