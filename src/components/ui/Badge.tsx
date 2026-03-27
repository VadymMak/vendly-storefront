interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'secondary';
  className?: string;
}

const variantStyles = {
  default: 'bg-gray-100 text-neutral',
  primary: 'bg-accent text-primary',
  secondary: 'bg-secondary/10 text-secondary',
} as const;

export default function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
}
