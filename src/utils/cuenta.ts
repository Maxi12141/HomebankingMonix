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
