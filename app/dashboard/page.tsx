'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUserRole } from '@/lib/hooks/useUserRole';
import HRDashboard from './HRDashboard';
import AdminDashboard from './AdminDashboard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Icon, IconSizes } from '@/components/ui/phosphor-icon';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isRestrictedAccess, loading } = useUserRole();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Redirect restricted access users (approver/viewer) to OT approval page
    if (!loading && isRestrictedAccess) {
      router.push('/overtime-approval');
    }
  }, [loading, isRestrictedAccess, router]);

  useEffect(() => {
    if (loading || initialized) return;

    const type = searchParams.get('type');
    if (type !== 'workforce' && type !== 'executive') {
      router.replace('/dashboard?type=workforce');
    }
    setInitialized(true);
  }, [searchParams, loading, initialized, router]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Icon
            name="ArrowsClockwise"
            size={IconSizes.lg}
            className="animate-spin text-muted-foreground"
          />
        </div>
      </DashboardLayout>
    );
  }

  if (isRestrictedAccess) {
    return null;
  }

  const dashboardType = searchParams.get('type');
  const showExecutive = dashboardType === 'executive';

  return (
    <DashboardLayout>
      {showExecutive ? <AdminDashboard /> : <HRDashboard />}
    </DashboardLayout>
  );
}

const LoadingFallback = () => (
  <DashboardLayout>
    <div className="flex items-center justify-center h-64">
      <Icon
        name="ArrowsClockwise"
        size={IconSizes.lg}
        className="animate-spin text-muted-foreground"
      />
    </div>
  </DashboardLayout>
);

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <DashboardContent />
    </Suspense>
  );
}