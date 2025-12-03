'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { EmployeeSession, EmployeeSessionProvider } from '@/contexts/EmployeeSessionContext';
import { Clock, User, LogOut } from 'lucide-react';

const navItems = [
  { name: 'Bundy Clock', href: '/employee-portal/bundy', icon: Clock },
  { name: 'My Information', href: '/employee-portal/info', icon: User },
];

export default function EmployeePortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [employee, setEmployee] = useState<EmployeeSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('employee_session');
    if (!stored) {
      router.replace('/login?mode=employee');
      return;
    }

    try {
      const parsed = JSON.parse(stored) as EmployeeSession;
      setEmployee(parsed);
    } catch {
      localStorage.removeItem('employee_session');
      router.replace('/login?mode=employee');
      return;
    } finally {
      setLoading(false);
    }
  }, [router]);

  const refreshSession = () => {
    const stored = localStorage.getItem('employee_session');
    if (stored) {
      setEmployee(JSON.parse(stored));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('employee_session');
    router.replace('/login?mode=employee');
  };

  if (loading || !employee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <EmployeeSessionProvider
      value={{
        employee,
        logout: handleLogout,
        refreshSession,
      }}
    >
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <header className="bg-white border-b shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                {employee.full_name
                  .split(' ')
                  .map((part) => part[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">{employee.full_name}</p>
                <p className="text-sm text-gray-500">ID: {employee.employee_id}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-white border text-gray-600 hover:bg-blue-50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
              <Button variant="secondary" onClick={handleLogout} className="inline-flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      </div>
    </EmployeeSessionProvider>
  );
}

