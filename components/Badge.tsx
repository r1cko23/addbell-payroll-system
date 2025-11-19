import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default';
  className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const variants = {
    success: 'bg-primary/10 text-primary border border-primary/20',
    warning: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    danger: 'bg-destructive/10 text-destructive border border-destructive/20',
    info: 'bg-blue-100 text-blue-800 border border-blue-200',
    default: 'bg-muted text-muted-foreground border border-border',
  };
  
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

