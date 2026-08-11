import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  Truck,
  ShieldCheck,
  Star,
  CreditCard,
  ArrowLeft,
  Minus,
  Plus,
  CheckCircle,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import { useCuenta } from '../hooks/useCuenta'
import { useCuentaStore } from '../store/cuentaStore'
import { useAuthStore } from '../store/authStore'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import {
  CATEGORIAS_MERCADO,
  PRODUCTOS_MERCADO,
  productoImagen,
  type ProductoMercado,
} from '../data/mercadoMonixProductos'

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function roundMoney(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function ProductImage({ producto, className = 'h-44' }: { producto: ProductoMercado; className?: string }) {
  const [failed, setFailed] = useState(false)
  const src = productoImagen(producto)

  return (
    <div className={`${className} bg-slate-input dark:bg-white/5 relative overflow-hidden`}>
      {!failed ? (
        <img
          src={src}
          alt={producto.titulo}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 px-3 text-center bg-gradient-to-br from-navy/10 to-mint/10">
          <span className="font-display text-xs font-bold text-mint uppercase tracking-wider">
            {producto.categoria}
          </span>
          <span className="font-body text-[11px] text-navy dark:text-white line-clamp-2">
            {producto.titulo}
          </span>
        </div>
      )}
      {producto.tag && (
        <span className="absolute left-3 top-3 rounded-md bg-mint text-navy text-[10px] font-body font-bold uppercase tracking-wide px-2 py-0.5">
          {producto.tag}
        </span>
      )}
    </div>
  )
}

export function MercadoMonixPage() {
  const { cuenta, refreshCuenta } = useCuenta()
  const { updateSaldo } = useCuentaStore()
  const { persona } = useAuthStore()

  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('Todas')
  const [producto, setProducto] = useState<ProductoMercado | null>(null)
  const [cantidad, setCantidad] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const filtrados = useMemo(() => {
    return PRODUCTOS_MERCADO.filter((p) => {
      const okCat = cat === 'Todas' || p.categoria === cat
      const okQ =
        !q.trim() ||
        p.titulo.toLowerCase().includes(q.trim().toLowerCase()) ||
        p.categoria.toLowerCase().includes(q.trim().toLowerCase())
      return okCat && okQ
    })
  }, [q, cat])

  const total = producto ? roundMoney(producto.precio * cantidad) : 0
  const saldo = cuenta?.saldo ?? 0
  const last4 = (cuenta?.numero_cuenta ?? '').replace(/\D/g, '').slice(-4).padStart(4, '0')
  const titular = [persona?.nombre, persona?.apellido].filter(Boolean).join(' ') || 'Titular MONIX'

  function abrirCompra(p: ProductoMercado) {
    setProducto(p)
    setCantidad(1)
    setError('')
    setSuccess(false)
  }

  function cerrarCompra() {
    setProducto(null)
    setCantidad(1)
    setError('')
    setSuccess(false)
    setLoading(false)
  }

  async function confirmarCompra() {
    if (!cuenta || !producto) return
    if (cantidad < 1) {
      setError('Elegí al menos 1 unidad')
      return
    }
    if (total > cuenta.saldo) {
      setError('No tenés saldo suficiente en tu cuenta')
      return
    }

    setLoading(true)
    setError('')

    try {
      const nuevoSaldo = roundMoney(cuenta.saldo - total)

      const { error: errSaldo } = await supabase
        .from('cuentas')
        .update({ saldo: nuevoSaldo })
        .eq('id', cuenta.id)
      if (errSaldo) throw new Error('No se pudo descontar el saldo')

      const { error: errMov } = await supabase.from('movimientos').insert({
        cuenta_id: cuenta.id,
        tipo: 'extraccion',
        monto: total,
        saldo_resultante: nuevoSaldo,
        descripcion: `mercadoMONIX|${producto.titulo} x${cantidad}`,
      })
      if (errMov) throw new Error('No se pudo registrar la compra')

      updateSaldo(nuevoSaldo)
      await refreshCuenta()
      setSuccess(true)
      toast.success('¡Compra realizada con tu tarjeta MONIX!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo completar la compra'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageWrapper>
      <div className="max-w-5xl mx-auto">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 font-body text-sm text-slate-secondary hover:text-mint transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Volver al inicio
        </Link>

        <div
          className="rounded-2xl p-5 sm:p-7 mb-5 border border-mint/20 overflow-hidden relative"
          style={{
            background:
              'radial-gradient(120% 100% at 0% 0%, rgba(38,255,193,0.25) 0%, transparent 50%), linear-gradient(135deg, #001A3D 0%, #0D2B52 55%, #00112A 100%)',
          }}
        >
          <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-mint/20 blur-2xl pointer-events-none" />
          <p className="font-display text-xs font-bold tracking-[0.22em] text-mint uppercase mb-2">
            mercadoMONIX
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mb-2">
            Comprá fácil. Pagá con Monix.
          </h1>
          <p className="font-body text-sm text-white/70 max-w-lg mb-1">
            Elegí cantidad y pagá con tu tarjeta débito MONIX.
          </p>
          <p className="font-body text-xs text-mint mb-4">
            Saldo disponible: {formatARS(saldo)}
          </p>

          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-secondary pointer-events-none"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar productos, marcas y más..."
              className="w-full rounded-xl pl-10 pr-4 py-3 font-body text-sm text-navy bg-white border-0 focus:outline-none focus:ring-2 focus:ring-mint/50"
            />
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-body text-white/80">
              <Truck size={13} className="text-mint" /> Envío full
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-body text-white/80">
              <ShieldCheck size={13} className="text-mint" /> Compra protegida
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-body text-white/80">
              <CreditCard size={13} className="text-mint" /> Débito MONIX
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar flex-1">
            {CATEGORIAS_MERCADO.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={`shrink-0 rounded-full px-4 py-1.5 font-body text-sm font-medium transition-colors ${
                  cat === c
                    ? 'bg-mint text-navy'
                    : 'bg-white dark:bg-navy-card text-slate-secondary border border-slate-200 dark:border-white/10 hover:text-navy dark:hover:text-white'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <p className="hidden sm:block font-body text-xs text-slate-secondary shrink-0">
            {filtrados.length} resultados
          </p>
        </div>

        {filtrados.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="font-body text-slate-secondary text-sm">
              No encontramos resultados para tu búsqueda.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtrados.map((p) => (
              <Card
                key={p.id}
                className="overflow-hidden flex flex-col cursor-pointer group/product"
                onClick={() => abrirCompra(p)}
              >
                <div className="overflow-hidden">
                  <div className="transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/product:scale-105">
                    <ProductImage producto={p} />
                  </div>
                </div>
                <div className="p-3 sm:p-4 flex flex-col flex-1">
                  <p className="font-body text-xs sm:text-sm text-navy dark:text-white line-clamp-2 mb-2 min-h-[2.5rem] group-hover/product:text-mint transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
                    {p.titulo}
                  </p>
                  <p className="font-display text-lg sm:text-xl font-bold text-navy dark:text-white">
                    {formatARS(p.precio)}
                  </p>
                  <p className="font-body text-[11px] sm:text-xs text-mint mt-0.5">
                    en {p.cuotas} cuotas sin interés
                  </p>
                  {p.envioGratis && (
                    <p className="font-body text-[11px] sm:text-xs text-mint font-medium mt-1.5 inline-flex items-center gap-1">
                      <Truck size={12} /> Envío gratis
                    </p>
                  )}
                  <p className="font-body text-[10px] sm:text-[11px] text-slate-secondary mt-2 inline-flex items-center gap-1">
                    <Star size={11} className="text-mint fill-mint" />
                    {p.rating} · {p.vendidos.toLocaleString('es-AR')} vendidos
                  </p>
                  <Button
                    className="w-full mt-3 text-xs sm:text-sm py-2.5"
                    variant="primary"
                    onClick={(e) => {
                      e.stopPropagation()
                      abrirCompra(p)
                    }}
                  >
                    Comprar con Monix
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <p className="font-body text-[11px] text-slate-secondary text-center mt-6">
          mercadoMONIX · al comprar se descuenta de tu saldo · no afiliado a Mercado Libre
        </p>
      </div>

      <Modal open={!!producto} onClose={cerrarCompra}>
        {producto && (
          <Card className="overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10">
              <p className="font-display font-semibold text-navy dark:text-white text-sm">
                {success ? 'Compra exitosa' : 'Checkout MONIX'}
              </p>
              <button
                type="button"
                onClick={cerrarCompra}
                className="text-slate-secondary hover:text-navy dark:hover:text-white"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            {success ? (
              <div className="p-6 text-center">
                <CheckCircle size={52} className="text-mint mx-auto mb-3" />
                <p className="font-display text-lg font-semibold text-navy dark:text-white mb-1">
                  ¡Listo!
                </p>
                <p className="font-body text-sm text-slate-secondary mb-1">
                  Compraste {producto.titulo}
                </p>
                <p className="font-body text-xs text-slate-secondary mb-2">
                  Cantidad: {cantidad}
                </p>
                <p className="font-display text-xl font-bold text-mint mb-4">
                  {formatARS(total)}
                </p>
                <p className="font-body text-xs text-slate-secondary mb-5">
                  Nuevo saldo: {formatARS(saldo)}
                </p>
                <Button className="w-full" onClick={cerrarCompra}>
                  Seguir comprando
                </Button>
              </div>
            ) : (
              <div className="p-4 sm:p-5 space-y-4">
                <div className="flex gap-3">
                  <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0">
                    <ProductImage producto={producto} className="h-24" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-body text-sm text-navy dark:text-white line-clamp-3">
                      {producto.titulo}
                    </p>
                    <p className="font-display font-bold text-navy dark:text-white mt-1">
                      {formatARS(producto.precio)}
                    </p>
                    <p className="font-body text-xs text-mint">
                      hasta {producto.cuotas} cuotas s/interés
                    </p>
                  </div>
                </div>

                <div>
                  <p className="font-body text-xs text-slate-secondary mb-2">Cantidad</p>
                  <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 dark:border-white/10 px-2 py-1.5">
                    <button
                      type="button"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-navy dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-40"
                      onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                      disabled={cantidad <= 1}
                      aria-label="Menos"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="font-display font-bold text-navy dark:text-white w-6 text-center">
                      {cantidad}
                    </span>
                    <button
                      type="button"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-navy dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-40"
                      onClick={() => setCantidad((c) => Math.min(20, c + 1))}
                      disabled={cantidad >= 20}
                      aria-label="Más"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-mint/30 bg-gradient-to-br from-navy to-navy-card p-4 text-white">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-display text-xs font-bold tracking-[0.18em] text-mint">
                      MONIX DÉBITO
                    </p>
                    <CreditCard size={18} className="text-mint" />
                  </div>
                  <p className="font-mono text-sm tracking-widest mb-2">
                    4532  ••••  ••••  {last4}
                  </p>
                  <p className="font-body text-xs text-white/70 uppercase tracking-wide">
                    {titular}
                  </p>
                  <p className="font-body text-[11px] text-mint mt-2">
                    Se debitará de tu saldo disponible
                  </p>
                </div>

                <div className="rounded-xl bg-slate-input dark:bg-white/5 px-4 py-3 space-y-2">
                  <div className="flex justify-between gap-3">
                    <span className="font-body text-sm text-slate-secondary">Subtotal</span>
                    <span className="font-body text-sm text-navy dark:text-white">
                      {formatARS(total)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="font-body text-sm text-slate-secondary">Saldo actual</span>
                    <span className="font-body text-sm text-navy dark:text-white">
                      {formatARS(saldo)}
                    </span>
                  </div>
                  <div className="h-px bg-slate-200 dark:bg-white/10" />
                  <div className="flex justify-between gap-3">
                    <span className="font-body text-sm text-slate-secondary">Saldo después</span>
                    <span className={`font-display text-sm font-bold ${total > saldo ? 'text-red-500' : 'text-mint'}`}>
                      {formatARS(roundMoney(saldo - total))}
                    </span>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-500 dark:text-red-400 font-body bg-red-50 dark:bg-red-400/10 rounded-xl px-4 py-3">
                    {error}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={cerrarCompra} disabled={loading}>
                    Cancelar
                  </Button>
                  <Button className="flex-1" loading={loading} onClick={confirmarCompra}>
                    Pagar {formatARS(total)}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </Modal>
    </PageWrapper>
  )
}
