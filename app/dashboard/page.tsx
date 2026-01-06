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
  const { isAdmin, isHR, isAccountManager, isRestrictedAccess, loading } = useUserRole();
  const [dashboardType, setDashboardType] = useState<'executive' | 'workforce'>('executive');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Redirect restricted access users (ot_approver/ot_viewer) to OT approval page
    if (!loading && isRestrictedAccess) {
      router.push('/overtime-approval');
    }
  }, [loading, isRestrictedAccess, router]);

  useEffect(() => {
    if (loading || initialized) return;

    // Check URL parameter for dashboard type
    const type = searchParams.get('type');
    if (type === 'workforce' || type === 'executive') {
      setDashboardType(type);
      setInitialized(true);
    } else if (isAdmin) {
      // Default to executive for admins if no type specified
      setDashboardType('executive');
      router.replace('/dashboard?type=executive');
      setInitialized(true);
    } else {
      // Default to workforce for non-admins
      setDashboardType('workforce');
      router.replace('/dashboard?type=workforce');
      setInitialized(true);
    }
  }, [searchParams, isAdmin, loading, initialized, router]);

  // Update dashboard type when URL changes
  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'workforce' || type === 'executive') {
      setDashboardType(type);
    }
  }, [searchParams]);

  const handleDashboardChange = (type: 'executive' | 'workforce') => {
    setDashboardType(type);
    router.push(`/dashboard?type=${type}`, { scroll: false });
  };

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

  if (isAdmin) {
    return (
      <DashboardLayout>
        {dashboardType === 'executive' ? <AdminDashboard /> : <HRDashboard />}
      </DashboardLayout>
    );
  }

  return <HRDashboard />;
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