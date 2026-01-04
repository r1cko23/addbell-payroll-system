import { Suspense } from 'react';
import { LoginPageClient } from './LoginPageClient';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
          Loading login screen...
        </div>
      }
    >
      <LoginPageClient />
    </Suspense>
  );
}