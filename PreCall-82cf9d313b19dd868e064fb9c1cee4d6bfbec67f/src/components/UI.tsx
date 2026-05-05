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
    primary: 'bg-violet-600 text-white hover:bg-violet-700 shadow-md shadow-violet-200 active:scale-[0.98]',
    secondary: 'bg-orange-500 text-white hover:bg-orange-600 shadow-md shadow-orange-200 active:scale-[0.98]',
    outline: 'border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98]',
    ghost: 'text-violet-600 hover:bg-violet-50 active:bg-violet-100',
    link: 'text-violet-600 hover:underline p-0 h-auto font-bold',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-5 py-2.5 text-sm rounded-xl',
    lg: 'px-8 py-4 text-base rounded-2xl',
    icon: 'p-2 rounded-lg',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-bold transition-all focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none touch-manipulation',
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
        'bg-white p-5 rounded-3xl border border-slate-100 shadow-sm transition-all duration-300',
        hover && 'hover:shadow-xl hover:shadow-violet-100/50 hover:-translate-y-1',
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
    free: 'bg-emerald-50 text-emerald-700',
    premium: 'bg-amber-50 text-amber-700',
    coming_soon: 'bg-slate-50 text-slate-500',
    live: 'bg-violet-50 text-violet-700',
    new: 'bg-blue-50 text-blue-700',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest',
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
      <Card className="relative z-10 w-full max-w-lg p-8 sm:p-10 rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-300 border-none">
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
