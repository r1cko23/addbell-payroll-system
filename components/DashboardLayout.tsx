'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Toaster as SonnerToaster } from 'sonner';
import { dbContentShell } from '@/lib/dashboard-ui';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-background">
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
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-foreground/40" aria-hidden="true" onClick={closeSidebar} />
          <Sidebar
            className="relative z-50 h-full w-80 max-w-full shadow-lg"
            onClose={closeSidebar}
          />
        </div>
      )}
      <Header onMenuClick={() => setIsSidebarOpen(true)} />
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-background">
        <div className={dbContentShell}>
          {children}
        </div>
      </main>
    </div>
  );
}
