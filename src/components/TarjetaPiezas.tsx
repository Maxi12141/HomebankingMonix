// Piezas de la tarjeta Monix compartidas entre la Landing (TarjetaHero y los productos)
// y TarjetaPage (MonixCard3D). Diseño en motion/tarjeta-hero.aep, comp Tarjeta_Cara.

export type VarianteTarjeta = 'ars' | 'usd' | 'credito'

// Pesos: azul noche con brillo mint. Dólares: grafito con brillo plateado. Crédito: casi negra con brillo dorado.
export const FONDO_FRENTE: Record<VarianteTarjeta, string> = {
  ars: 'radial-gradient(120% 90% at 10% 0%, rgba(38,255,193,0.22) 0%, transparent 45%), linear-gradient(145deg, #0D2B52 0%, #001A3D 55%, #00112A 100%)',
  usd: 'radial-gradient(120% 90% at 10% 0%, rgba(213,219,227,0.2) 0%, transparent 45%), linear-gradient(145deg, #3A4554 0%, #1E2631 55%, #11161D 100%)',
  credito: 'radial-gradient(120% 90% at 10% 0%, rgba(214,186,128,0.2) 0%, transparent 45%), linear-gradient(145deg, #1C2230 0%, #0B0F18 55%, #05070C 100%)',
}

const METAL: Record<VarianteTarjeta, 'oro' | 'plata'> = { ars: 'oro', usd: 'plata', credito: 'oro' }
const COLOR_ARCOS: Record<VarianteTarjeta, string> = { ars: '#C7D4E3', usd: '#C7D4E3', credito: '#D6BA80' }

// La curva del isologo repetida 19 veces (Repetidor de AE: +26, +10 por copia).
const ARCO = 'M300 600 C340 340 570 100 900 70'
const ARCOS = Array.from({ length: 19 }, (_, i) => `translate(${-208 + i * 26} ${-80 + i * 10})`)

export function ArcosTarjeta({ color = '#C7D4E3' }: { color?: string }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 856 540" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
      <g stroke={color} strokeWidth="2" opacity="0.22">
        {ARCOS.map((t) => <path key={t} d={ARCO} transform={t} />)}
      </g>
    </svg>
  )
}

const METALES = {
  oro: { fondo: '#D6BA80', linea: '#8C6E33' },
  plata: { fondo: '#D5DBE3', linea: '#7B8594' },
}

export function ChipTarjeta({ metal = 'oro', className }: { metal?: keyof typeof METALES; className?: string }) {
  const { fondo, linea } = METALES[metal]
  return (
    <svg className={className} viewBox="0 0 96 72" aria-hidden="true">
      <rect x="1" y="1" width="94" height="70" rx="11" fill={fondo} stroke={linea} strokeWidth="2" />
      <g stroke={linea} strokeWidth="1.8" fill="none">
        <rect x="34" y="24" width="28" height="24" rx="6" />
        <path d="M2 24h32M2 48h32M62 24h32M62 48h32M2 36h32M62 36h32M48 2v22M48 48v22" />
      </g>
    </svg>
  )
}

/** M blanca con el arco mint, sin el fondo del ícono (motion/isologo.svg). */
export function IsologoTarjeta({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="86 118 277 229" aria-hidden="true">
      <g transform="translate(-495.89835,-110.66689)">
        <path fill="#fff" d="m 788.49185,272.67634 c 19.64504,-7.66208 38.71358,-12.39442 59.25647,-14.70601 l 10.73329,-1.20776 V 243.4587 c 0,-7.31713 -0.3375,-13.50505 -0.75,-13.75093 -0.4125,-0.24587 -10.47806,-0.15993 -22.36792,0.19099 l -21.61791,0.63803 -24.38209,25.83493 c -13.41014,14.20921 -24.51912,26.20783 -24.68661,26.66358 -0.16749,0.45576 2.53712,-0.68027 6.01024,-2.5245 3.47312,-1.84424 11.48516,-5.36974 17.80453,-7.83446 z" />
        <path fill="#fff" d="m 858.48161,375.92838 v -81.10841 l -2.75,0.67807 c -5.33249,1.31484 -23.86314,9.62407 -33.25,14.90945 l -9.5,5.34909 -0.25671,70.6401 -0.25671,70.64011 h 23.00671 23.00671 z" />
        <path fill="#fff" d="m 628.72507,384.59614 0.25653,-72.44065 21.42233,34.94065 c 11.78229,19.21736 21.68229,34.90713 22.00001,34.86617 0.31772,-0.041 2.79007,-4.58204 5.49412,-10.09127 2.70405,-5.50923 8.22223,-14.97592 12.26261,-21.03708 l 7.34616,-11.02029 -2.2128,-3.63844 c -2.11516,-3.47789 -24.98579,-40.38015 -44.08894,-71.13844 -4.95306,-7.975 -11.50436,-18.55 -14.55844,-23.5 -8.57971,-13.90582 -6.8229,-10.19922 -20.45936,-11.55273 -6.30289,-0.6256 -15.38524,0.0284 -21.57275,0.0366 l -12.13294,0.0161 v 113.5 113.5 h 22.99347 22.99347 z" />
        <path fill="#26ffc1" d="m 667.1758,455.54219 c -1.00426,-1.62493 2.7604,-21.84304 6.83198,-36.69119 12.78486,-46.62357 40.9305,-86.49175 79.43967,-112.52596 23.2938,-15.74782 46.88715,-25.53155 76.51911,-31.73107 7.34556,-1.53681 24.68546,-4.40896 26.63545,-4.41185 0.89334,-10e-4 1.0289,0.60413 1.02109,4.56036 -0.005,2.50903 -0.20991,4.87785 -0.45545,5.26405 -0.24553,0.3862 -3.88362,2.00838 -8.08463,3.60486 -20.81186,7.90893 -37.68137,17.1167 -54.11329,29.53626 -42.94015,32.45502 -68.55285,79.60426 -72.82654,134.06305 l -0.70444,8.97659 h -26.93213 c -18.8916,0 -27.05115,-0.19259 -27.33082,-0.6451 z" />
      </g>
    </svg>
  )
}

/** Tarjeta plana para las cards de productos: mismo diseño que la del hero, sin 3D. */
export function TarjetaMini({ variante, pan, etiqueta }: { variante: VarianteTarjeta; pan: string; etiqueta: string }) {
  return (
    <div
      className="relative aspect-[856/540] w-full overflow-hidden rounded-xl border border-white/[0.12] text-white [container-type:inline-size]"
      style={{ background: FONDO_FRENTE[variante] }}
      aria-hidden="true"
    >
      <ArcosTarjeta color={COLOR_ARCOS[variante]} />
      <IsologoTarjeta className="absolute left-[5.6%] top-[9%] h-[17%] w-auto" />
      <ChipTarjeta metal={METAL[variante]} className="absolute right-[6.5%] top-[11%] w-[11.2%]" />
      <div className="absolute inset-x-[6.5%] bottom-[9%]">
        <p className="font-mono text-[clamp(13px,5.2cqw,20px)] tracking-[0.12em]">{pan}</p>
        <div className="mt-[3cqw] flex items-end justify-between gap-3 font-body text-2xs font-semibold uppercase tracking-[0.14em]">
          <span className="truncate">Martina Gómez</span>
          <span className="shrink-0 text-white/80">{etiqueta}</span>
        </div>
      </div>
    </div>
  )
}
