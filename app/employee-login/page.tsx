'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EmployeeLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login?mode=employee');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="space-y-4 rounded-xl border border-border/80 bg-card/95 px-6 py-7 text-center shadow-card">
        <p className="font-display text-lg font-semibold text-foreground">
          Redirecting to the new employee login...
        </p>
        <p className="text-sm text-muted-foreground">
          If you are not redirected automatically,{' '}
          <button
            className="font-medium text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:text-accent-secondary"
            onClick={() => router.replace('/login?mode=employee')}
          >
            click here
          </button>
          .
        </p>
      </div>
    </div>
  );
}