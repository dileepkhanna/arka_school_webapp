import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  variant?: 'default' | 'primary' | 'secondary' | 'accent';
}

export default function StatCard({ title, value, icon, trend, variant = 'default' }: StatCardProps) {
  const variants = {
    default: 'bg-card',
    primary: 'gradient-primary text-white',
    secondary: 'gradient-teacher text-white',
    accent: 'gradient-parent text-white',
  };

  const isColored = variant !== 'default';

  return (
    <div className={cn("card-stat", variants[variant])}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={cn("text-xs sm:text-sm font-medium truncate", isColored ? "text-white/80" : "text-muted-foreground")}>
            {title}
          </p>
          <p className={cn("text-lg sm:text-2xl md:text-3xl font-bold font-display mt-1 truncate", isColored ? "text-white" : "text-foreground")}>
            {value}
          </p>
          {trend && (
            <p className={cn("text-xs mt-2", isColored ? "text-white/70" : "text-muted-foreground")}>
              <span className={cn(
                "font-medium",
                trend.value >= 0 
                  ? (isColored ? "text-white" : "text-success") 
                  : (isColored ? "text-white" : "text-destructive")
              )}>
                {trend.value >= 0 ? '+' : ''}{trend.value}%
              </span>{' '}
              {trend.label}
            </p>
          )}
        </div>
        <div className={cn(
          "w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0",
          isColored ? "bg-white/20" : "bg-primary/10"
        )}>
          <span className={cn("text-xl", isColored ? "text-white" : "text-primary")}>
            {icon}
          </span>
        </div>
      </div>
    </div>
  );
}
