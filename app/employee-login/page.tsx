'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EmployeeLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login?mode=employee');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100">
      <div className="text-center space-y-4 px-6">
        <p className="text-lg font-semibold text-gray-700">
          Redirecting to the new employee login...
        </p>
        <p className="text-sm text-gray-500">
          If you are not redirected automatically,{' '}
          <button
            className="text-emerald-600 underline"
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

