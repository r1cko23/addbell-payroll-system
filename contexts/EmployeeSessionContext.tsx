'use client';

import { createContext, useContext } from 'react';

export interface EmployeeSession {
  id: string;
  employee_id: string;
  full_name: string;
  loginTime: string;
}

interface EmployeeSessionContextValue {
  employee: EmployeeSession;
  logout: () => void;
  refreshSession: () => void;
}

const EmployeeSessionContext = createContext<EmployeeSessionContextValue | null>(null);

export function EmployeeSessionProvider({
  value,
  children,
}: {
  value: EmployeeSessionContextValue;
  children: React.ReactNode;
}) {
  return (
    <EmployeeSessionContext.Provider value={value}>
      {children}
    </EmployeeSessionContext.Provider>
  );
}

export function useEmployeeSession() {
  const context = useContext(EmployeeSessionContext);
  if (!context) {
    throw new Error('useEmployeeSession must be used within an EmployeeSessionProvider');
  }
  return context;
}
