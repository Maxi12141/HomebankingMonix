// SpecularButton de React Bits (reactbits.dev, SpecularButton-TS-TW, MIT + Commons Clause).
// Adaptado a Tailwind 3: foco con el anillo de la marca (igual que ui/Button) y duración arbitraria.
// El efecto WebGL vive en specularEfecto.ts y se baja aparte: el botón se ve completo sin él.
import { useEffect, useRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import type { Settings } from './specularEfecto';

const SIZES: Record<SpecularButtonSize, string> = {
  sm: 'px-5 py-2.5 text-[0.875rem]',
  md: 'px-7 py-3.5 text-[1rem]',
  lg: 'px-[38px] py-[18px] text-[1.125rem]'
};

const BUTTON =
  'relative isolate m-0 inline-flex cursor-pointer items-center justify-center gap-[0.5em] border-0 [font-family:inherit] font-medium leading-none tracking-[0.01em] [color:var(--sb-text-color)] [border-radius:var(--sb-radius)] [background:color-mix(in_srgb,var(--sb-tint)_calc(var(--sb-tint-opacity)*100%),transparent)] shadow-[0_10px_24px_-14px_rgba(0,0,0,0.45)] [-webkit-backdrop-filter:blur(var(--sb-blur))] [backdrop-filter:blur(var(--sb-blur))] focus:outline-none [-webkit-tap-highlight-color:transparent] transition-transform duration-[250ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy dark:focus-visible:outline-mint disabled:cursor-default disabled:opacity-50 disabled:active:scale-100';

export type SpecularButtonSize = 'sm' | 'md' | 'lg';

export interface SpecularButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'type'> {
  children?: ReactNode;
  size?: SpecularButtonSize;
  radius?: number;
  tint?: string;
  tintOpacity?: number;
  blur?: number;
  textColor?: string;
  lineColor?: string;
  baseColor?: string;
  intensity?: number;
  idleIntensity?: number;
  shineSize?: number;
  shineFade?: number;
  thickness?: number;
  glow?: number;
  speed?: number;
  followMouse?: boolean;
  proximity?: number;
  autoAnimate?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const SpecularButton = ({
  children = 'Get Started',
  size = 'lg',
  radius = 18,
  tint = '#ffffff',
  tintOpacity = 0.04,
  blur = 0,
  textColor = '#f5f5f5',
  lineColor = '#ffffff',
  baseColor = '#525252',
  intensity = 1,
  idleIntensity = 0.35,
  shineSize = 10,
  shineFade = 34,
  thickness = 1.2,
  glow = 1,
  speed = 0.35,
  followMouse = true,
  proximity = 250,
  autoAnimate = false,
  disabled = false,
  onClick,
  className = '',
  type = 'button',
  style,
  ...rest
}: SpecularButtonProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wakeRef = useRef<(() => void) | null>(null);
  const settings: Settings = {
    radius: Math.max(0, radius),
    lineColor: String(lineColor),
    baseColor: String(baseColor),
    intensity: Math.max(0, intensity),
    idleIntensity: clamp(idleIntensity, 0, 1),
    shineSize: Math.max(0, shineSize),
    shineFade: Math.max(0, shineFade),
    thickness: Math.max(0, thickness),
    glow: Math.max(0, glow),
    speed,
    followMouse,
    proximity: Math.max(1, proximity),
    autoAnimate,
    disabled
  };
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    const button = buttonRef.current;
    const canvas = canvasRef.current;
    if (!button || !canvas) return undefined;
    let vivo = true;
    let limpiar: (() => void) | undefined;
    void import('./specularEfecto').then(({ montarSpecular }) => {
      if (vivo) limpiar = montarSpecular(button, canvas, settingsRef, wakeRef);
    });
    return () => {
      vivo = false;
      limpiar?.();
    };
  }, []);

  useEffect(() => {
    wakeRef.current?.();
  });

  return (
    <button
      ref={buttonRef}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${BUTTON} ${SIZES[size] ?? SIZES.lg}${className ? ` ${className}` : ''}`}
      style={
        {
          '--sb-radius': `${radius}px`,
          '--sb-tint': tint,
          '--sb-tint-opacity': tintOpacity,
          '--sb-blur': `${blur}px`,
          '--sb-text-color': textColor,
          ...style
        } as CSSProperties
      }
      {...rest}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute -inset-6 z-[1] block h-[calc(100%+48px)] w-[calc(100%+48px)]"
        aria-hidden="true"
      />
      <span className="relative z-[2] inline-flex items-center gap-[inherit]">{children}</span>
    </button>
  );
};

export default SpecularButton;
