// Ciudad aproximada de quien pide, según Vercel. No usa servicios externos ni guarda nada.
function leer(valor) {
  if (typeof valor !== 'string' || !valor) return ''
  try {
    return decodeURIComponent(valor)
  } catch {
    return ''
  }
}

export default function handler(req, res) {
  const ciudad = leer(req.headers['x-vercel-ip-city'])
  const pais = leer(req.headers['x-vercel-ip-country'])
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ ciudad: [ciudad, pais].filter(Boolean).join(', ') })
}
