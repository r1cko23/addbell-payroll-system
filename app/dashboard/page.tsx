'use client';

import { useUserRole } from '@/lib/hooks/useUserRole';
import AdminDashboard from './AdminDashboard';
import HRDashboard from './HRDashboard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const { isAdmin, loading } = useUserRole();

  // Show loading state while checking user role
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  // Show Admin dashboard for admin users (CEO/COO)
  if (isAdmin) {
    return <AdminDashboard />;
  }

  // Show HR dashboard for HR users (default)
  return <HRDashboard />;
}
