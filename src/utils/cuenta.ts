const PALABRAS = [
  'sol', 'mar', 'rio', 'paz', 'luz', 'rey', 'pan', 'oro', 'voz',
  'tren', 'nave', 'isla', 'faro', 'cabo', 'pino', 'roca', 'vino', 'miel',
  'lago', 'flor', 'nube', 'vela', 'luna', 'boca', 'loma', 'duna', 'nota',
  'pala', 'rama', 'zona', 'alba', 'foca', 'lana', 'mano', 'puma', 'ruta',
  'taza', 'arco', 'cima', 'hoja', 'mesa', 'olmo', 'polo', 'soga', 'toro',
]

export function generateNumeroCuenta(): string {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString()
}

export function generateAlias(): string {
  const pick = () => PALABRAS[Math.floor(Math.random() * PALABRAS.length)]
  return `${pick()}.${pick()}.${pick()}`
}

export function formatMonto(n: number, moneda: 'ARS' | 'USD') {
  if (moneda === 'USD') {
    // Intl con currency:'USD' en locale en-US también renderiza el símbolo como "$",
    // igual que ARS, y confunde qué cuenta es cuál — se prefija "US$" a mano.
    return `US$${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`
  }
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}
