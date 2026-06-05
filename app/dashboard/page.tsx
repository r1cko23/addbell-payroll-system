'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUserRole } from '@/lib/hooks/useUserRole';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { resolveDefaultLandingRoute } from '@/lib/default-landing-route';
import HRDashboard from './HRDashboard';
import AdminDashboard from './AdminDashboard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Icon, IconSizes } from '@/components/ui/phosphor-icon';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role, isRestrictedAccess, loading } = useUserRole();
  const { permissions, canRead, loading: permissionsLoading } = usePermissions();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (loading || permissionsLoading) return;

    // Redirect restricted access users (approver/viewer) to OT approval page
    if (isRestrictedAccess) {
      router.replace('/overtime-approval');
      return;
    }

    if (!canRead('dashboard') && permissions && role) {
      router.replace(resolveDefaultLandingRoute(role, permissions));
      return;
    }
  }, [loading, permissionsLoading, isRestrictedAccess, canRead, permissions, role, router]);

  useEffect(() => {
    if (loading || permissionsLoading || initialized) return;
    if (!canRead('dashboard')) return;

    const type = searchParams.get('type');
    const isExecutive =
      role === 'admin' || role === 'upper_management';

    if (type === 'executive' && !isExecutive) {
      router.replace('/dashboard?type=workforce');
      setInitialized(true);
      return;
    }

    if (type !== 'workforce' && type !== 'executive') {
      router.replace(isExecutive ? '/dashboard?type=executive' : '/dashboard?type=workforce');
    }
    setInitialized(true);
  }, [searchParams, loading, permissionsLoading, initialized, router, canRead, role]);

  if (loading || permissionsLoading) {
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

  if (isRestrictedAccess || !canRead('dashboard')) {
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