import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';
import { cn } from '../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  icon?: LucideIcon;
  loading?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  className,
  children,
  ...props
}: ButtonProps) {
  const variants = {
    primary: 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm active:bg-violet-800',
    secondary: 'bg-orange-500 text-white hover:bg-orange-600 shadow-sm active:bg-orange-700',
    outline: 'border border-violet-200 text-violet-700 hover:bg-violet-50 active:bg-violet-100',
    ghost: 'text-violet-600 hover:bg-violet-50 active:bg-violet-100',
    link: 'text-violet-600 hover:underline p-0 h-auto font-semibold',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    icon: 'p-2',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-bold transition-all focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none active:scale-95 touch-manipulation',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={props.disabled || loading}
      {...props}
    >
      {loading ? (
        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : Icon && (
        <Icon className={cn('h-4 w-4', children && 'mr-2', size === 'lg' && 'h-5 w-5')} />
      )}
      {children}
    </button>
  );
}

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export function Card({ children, className, onClick, hover = true }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl border border-violet-100 bg-white p-5 shadow-sm transition-all duration-200',
        hover && 'hover:shadow-md hover:border-violet-200',
        onClick && 'cursor-pointer active:scale-[0.98] touch-manipulation',
        className
      )}
    >
      {children}
    </div>
  );
}

interface BadgeProps {
  children: ReactNode;
  variant?: 'free' | 'premium' | 'coming_soon' | 'live' | 'new';
  className?: string;
}

export function Badge({ children, variant = 'free', className }: BadgeProps) {
  const variants = {
    free: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    premium: 'bg-amber-50 text-amber-700 border-amber-100',
    coming_soon: 'bg-slate-50 text-slate-500 border-slate-100',
    live: 'bg-violet-50 text-violet-700 border-violet-100',
    new: 'bg-blue-50 text-blue-700 border-blue-100',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-xl bg-slate-200', className)} />
  );
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-lg p-8 shadow-2xl animate-in zoom-in-95 duration-300 rounded-[2rem]">
        <h3 className="text-2xl font-black text-violet-950 mb-4 tracking-tight">{title}</h3>
        <div className="mb-8 text-slate-600 font-medium leading-relaxed">
          {children}
        </div>
        {footer && (
          <div className="flex justify-end gap-3">
            {footer}
          </div>
        )}
      </Card>
    </div>
  );
}
