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
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.09),transparent_22%),linear-gradient(to_bottom,hsl(var(--muted)/0.45),hsl(var(--background))_18%)]">
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
            boxShadow: '0 18px 40px -24px rgba(15, 23, 42, 0.35)',
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
            className="relative z-50 w-80 max-w-full bg-background shadow-2xl"
            onClose={closeSidebar}
          />
        </div>
      )}
      <div className={cn('flex-1 flex flex-col overflow-hidden', 'lg:ml-0')}>
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
            <div className="w-full">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}