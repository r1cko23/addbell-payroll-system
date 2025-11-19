'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  CreditCard,
  FileText,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Weekly Workflow',
    href: '/workflow',
    icon: Calendar,
  },
  {
    name: 'Employees',
    href: '/employees',
    icon: Users,
  },
  {
    name: 'Weekly Timesheet',
    href: '/timesheet',
    icon: Calendar,
  },
  {
    name: 'Deductions',
    href: '/deductions',
    icon: CreditCard,
  },
  {
    name: 'Payslips',
    href: '/payslips',
    icon: FileText,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  
  return (
    <div className="flex flex-col w-64 border-r bg-muted/10">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 px-4 border-b">
        <img 
          src="/Official Logo Cropped.jpg" 
          alt="Add-bell Tech" 
          className="h-12 w-auto"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="mr-3 h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      
      {/* Footer */}
      <div className="p-4 border-t">
        <p className="text-xs text-muted-foreground text-center">
          © 2025 Add-bell Tech
          <br />
          All rights reserved
        </p>
      </div>
    </div>
  );
}
