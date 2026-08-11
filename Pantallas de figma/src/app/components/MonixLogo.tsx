interface MonixLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'white';
}

export function MonixLogo({ className = '', size = 'md', variant = 'default' }: MonixLogoProps) {
  const sizes = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-5xl'
  };

  const textColor = variant === 'white' ? 'text-white' : 'text-[#001A3D]';

  return (
    <div className={`${sizes[size]} tracking-tight flex items-center gap-0 ${className}`}>
      <span className="relative inline-block">
        <span className={`${textColor} font-['Plus_Jakarta_Sans'] font-semibold`}>
          M
        </span>
        {/* Arco dinámico verde menta en el pico de la M */}
        <span className="absolute top-[0.15em] left-1/2 -translate-x-1/2 text-[#26FFC1] font-['Plus_Jakarta_Sans'] font-bold" style={{ fontSize: '0.3em' }}>
          ∩
        </span>
      </span>
      <span className={`${textColor} font-['Plus_Jakarta_Sans'] font-medium`}>
        onix
      </span>
    </div>
  );
}
