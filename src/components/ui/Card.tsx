interface CardProps {
  children: React.ReactNode;
  highlighted?: boolean;
  className?: string;
}

export default function Card({ children, highlighted = false, className = '' }: CardProps) {
  return (
    <div
      className={`rounded-2xl p-6 ${
        highlighted
          ? 'border-2 border-primary bg-accent shadow-lg'
          : 'border border-gray-200 bg-white shadow-sm'
      } ${className}`}
    >
      {children}
    </div>
  );
}
