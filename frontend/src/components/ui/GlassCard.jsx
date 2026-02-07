import React from 'react';
import { cn } from '@/lib/utils';

const GlassCard = React.forwardRef(
  ({ className, children, hover = true, shine = false, glow = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'glass-card',
          hover && 'glass-card-hover',
          shine && 'liquid-shine',
          glow && 'glow-border',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
GlassCard.displayName = 'GlassCard';

const GlassCardHeader = React.forwardRef(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pb-2', className)} {...props}>
    {children}
  </div>
));
GlassCardHeader.displayName = 'GlassCardHeader';

const GlassCardContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props}>
    {children}
  </div>
));
GlassCardContent.displayName = 'GlassCardContent';

const GlassCardTitle = React.forwardRef(({ className, children, ...props }, ref) => (
  <h3 ref={ref} className={cn('text-xl font-semibold text-foreground', className)} {...props}>
    {children}
  </h3>
));
GlassCardTitle.displayName = 'GlassCardTitle';

const GlassCardDescription = React.forwardRef(({ className, children, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted-foreground mt-1', className)} {...props}>
    {children}
  </p>
));
GlassCardDescription.displayName = 'GlassCardDescription';

export { GlassCard, GlassCardHeader, GlassCardContent, GlassCardTitle, GlassCardDescription };
