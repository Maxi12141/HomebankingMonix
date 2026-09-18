# Monix — Homebanking Digital

Aplicación de homebanking completa construida con **React + TypeScript + Vite** y **Supabase** como backend. Simula las operaciones de un banco digital argentino: registro, autenticación, transferencias, historial, contactos y más. Se integra con una **API externa del Banco Central** (de la cátedra de Práctica Profesional) para operar en un entorno bancario compartido entre todos los alumnos.

---

## Stack tecnológico

| Categoría | Tecnología |
|---|---|
| Framework UI | React 18 + TypeScript |
| Build tool | Vite 6 |
| Estilos | TailwindCSS 3 |
| Backend / DB | Supabase (PostgreSQL + Auth + Realtime) |
| Estado global | Zustand 5 |
| Routing | React Router DOM 6 |
| Animaciones | Framer Motion 12 |
| Iconos | Lucide React |
| Notificaciones | React Hot Toast |
| Contador animado | React CountUp |
| Generación de PDF | jsPDF + html2canvas |
| API Banco Central | REST HTTP (cátedra) |
| QR (generar / escanear) | `qrcode` + `jsqr` |
| App nativa Android | Capacitor 7 + plugin propio `monix-radio` (Kotlin, BLE + HCE) |

**Tipografías** (Google Fonts, cargadas en `index.html`):
- `Plus Jakarta Sans` — headings y montos
- `Inter` — texto de cuerpo e interfaz

---

## Funcionalidades

### Autenticación
- Registro con datos personales (nombre, apellido, DNI, email, teléfono, dirección, fecha de nacimiento)
- Login / logout con Supabase Auth
- Protección de rutas: rutas privadas (`/dashboard`, `/cuentas`, `/dolares`, `/transferir`, `/cerca`, `/historial`, `/depositar`, `/perfil`, `/contactos`, `/pagar`, `/reservas`, `/prestamos`, `/tarjeta`, `/mercado-monix`, `/promos`, `/cashback`, `/financiacion`) requieren sesión activa; rutas públicas (`/`, `/login`, `/register`) redirigen al dashboard si ya hay sesión
- `ErrorBoundary` alrededor de toda la app: si algo cuelga (Realtime, un hook nativo), muestra un fallback en vez de dejar la pantalla en blanco
- Pantalla de fallback (`MissingEnvScreen`) si faltan o son inválidas las variables `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, en vez de romper la app con pantalla en blanco (ver `isSupabaseConfigured` en `src/lib/supabaseClient.ts`)

### Dashboard
- Saldo actual con animación CountUp al cargar y al recibir transferencias en tiempo real
- Indicador delta (`+$ X recibido` / `-$ X enviado`) que aparece y desaparece automáticamente al detectar cambios de saldo vía Supabase Realtime
- Últimos 5 movimientos clickeables con modal de detalle completo
- Acciones rápidas: Transferir, Pagar, Historial, Depositar
- Card de Reservas (`ReservasHomeCard`) con saldo del "bolsillo" de ahorro, TNA y estimación diaria
- Banner publicitario (`AdBanner`) con acceso a mercadoMONIX y tarjetas expandibles de Ofertas, Cashback y Financiación
- Campanita de notificaciones (`NotificationBell`) en el header, visible en todas las páginas: alerta con toast y badge de no leídas ante depósitos/transferencias entrantes
- Onboarding tour para usuarios nuevos (spotlight animado con guía paso a paso)
- Modal de bono de bienvenida ($150.000) al registrarse por primera vez

### Transferencias
- Búsqueda de destinatario por CBU (22 dígitos) o alias
- Búsqueda en cuentas Monix internas y en el Banco Central externo
- Campo de motivo (dropdown con 22 opciones predefinidas) obligatorio
- Campo de mensaje libre (opcional, máx. 120 caracteres)
- Pantalla de confirmación antes de ejecutar
- Transferencias internas actualizan saldo en ambas cuentas Monix y registran movimiento entrante
- Transferencias externas operan vía API del Banco Central
- Pantalla de éxito con opción de agregar destinatario a contactos
- Agenda de contactos en panel lateral (desktop) y acordeón (mobile)
- Transferencias recientes como accesos directos

### Cuentas
- Una caja de ahorro en pesos (creada al registrarse) y, opcionalmente, una segunda en dólares — cada una con su propio CBU/alias asignado por el Banco Central
- Apertura de cuenta en USD sin restricciones de situación crediticia: cualquier usuario puede solicitarla
- `useCuenta` expone tanto la cuenta "activa" (para operar) como la lista completa de `cuentas` del usuario

### Compra y Venta de Dólares
- Compra o venta de USD contra la caja en pesos, al tipo de cambio oficial (`useMercadoFinanciero`, refresco cada 20 s)
- Requiere tener ambas cuentas (ARS y USD) abiertas; acredita/debita en las dos cuentas y registra el movimiento correspondiente

### Monix Cerca
- Transferencias por proximidad: acercar dos celulares con Monix identifica a la otra persona (nombre y alias) y permite transferirle al toque, sin compartir CBU
- Funciona por NFC (tocar los teléfonos, disponible en el navegador con Chrome Android) o por Bluetooth de fondo con la APK nativa (`monix-radio`, plugin Capacitor en Kotlin) — con la APK, el otro no necesita tener Monix abierto
- Presencia "visible" publica un token rotativo de 30 minutos en `presencia_cerca`; el token nunca es el CBU/alias real — el servidor resuelve identidad y destino recién al confirmar la transferencia (`resolver_presencia` / `abrir_destino_cerca`, RPCs de Supabase)
- Al detectar a alguien cerca con la app en segundo plano, se muestra un prompt (`CercaPrompt`) para transferirle sin tener que abrir la pantalla de Cerca

### Historial
- Listado de hasta 100 movimientos con paginación
- Filtros por tipo (todos / entradas / salidas)
- Búsqueda por texto (tipo, descripción, nombre, CBU, alias)
- Filtro por alias/nombre de destinatario/emisor
- Filtro por rango de fechas con DatePicker personalizado
- Modal de detalle clickeable en cada movimiento
- Nombre del banco origen resuelto via API del Banco Central

### Depósito
- Acreditación de fondos en la cuenta propia

### Pagar (cobro y pago contactless)
- Dos modos: **Cobrar** (generás un cobro con monto y descripción, se muestra como QR) y **NFC** (pagás un cobro escaneando el QR o tocando con NFC)
- Cada cobro (`cobros_nfc`) tiene estado `pendiente` / `pagado` / `expirado` / `cancelado` y vence a los pocos minutos
- El pago se resuelve en el servidor vía RPCs de Supabase (`crear_cobro_nfc`, `pagar_cobro_nfc`) que debitan/acreditan las cuentas de comprador y comercio y registran el movimiento
- Acceso directo desde el botón QR central de la barra de navegación mobile

### Reservas
- "Bolsillo" de ahorro separado del saldo principal, con interés diario compuesto (TNA configurable, 32% por defecto)
- Mover fondos entre cuenta principal y Reservas, actualizando `cuentas.saldo`, `reservas.saldo` y registrando el movimiento
- Card resumen en el Dashboard (`ReservasHomeCard`) con saldo, TNA y estimación de interés diario
- Lógica de acumulación de interés en el hook `useReserva` (tabla `reservas`)

### Mi Tarjeta
- Tarjeta de débito virtual 3D interactiva (`MonixCard3D`, tilt con el mouse), con flip para ver frente (PAN enmascarado) y dorso (CBU/alias con copiar al portapapeles)
- Congelar / descongelar tarjeta: persiste en `cuentas.tarjeta_congelada` (es un estado real de la cuenta, no solo visual)
- Pago contactless: activar/desactivar el chip NFC (`cuentas.nfc_contacto_activo`) y grabar un sticker NFC físico contra el teléfono (`registrarTarjetaNfc`, plugin nativo `monix-radio`)
- En iPhone (sin NFC de escritura disponible en el navegador) el pago contactless se resuelve mostrando un QR de la tarjeta (`QrBox`) que el comercio escanea, en vez de acercar el chip
- Límites diarios de compra/extracción/online (informativos, sin enforcement real)

### Préstamos
- Préstamo personal real en pesos: simulador (sistema francés, cuota fija) → desembolso que acredita el monto en la cuenta ARS y registra el movimiento → cuotas que se van cobrando automáticamente con el tiempo (mismo patrón que el interés diario de Reservas: se calculan al entrar a la pantalla, sin cron real)
- Tasa (TNA), monto máximo y plazo máximo varían según la **situación crediticia real** del usuario, consultada a la Central de Deudores del Banco Central (`GET /central-deudores/{dni}`, situación 1 a 5 — igual escala que usa el BCRA)
- Bonificación de tasa y de monto máximo para quien tiene activado "Cobro mi sueldo en Monix" en su Perfil (dato ficticio, inspirado en el trato preferencial real de Banco Nación/BBVA/Macro a clientes con sueldo acreditado)
- Tope de cuota sobre el ingreso mensual declarado en Perfil (25-35% según el caso, mismo criterio que usa Banco Nación)
- Situación 5 (irrecuperable) bloquea el acceso a préstamos nuevos; el resto de las situaciones acceden con condiciones más o menos favorables
- Si no hay saldo suficiente para cobrar una cuota, queda "atrasada" y se reintenta en la próxima carga — no se reporta mora a la Central de Deudores real (es un entorno compartido entre todos los alumnos)
- **Ya no gatea la apertura de cuenta en USD** (ver sección Cuentas) — es un feature aparte, exclusivamente de Préstamos

### mercadoMONIX, Promos, Cashback y Financiación
> Accesibles desde el banner publicitario del Dashboard (no están en el menú principal). Son funcionalidades de demo/marketing salvo donde se indica.

- **mercadoMONIX** (`/mercado-monix`): mini-marketplace interno con búsqueda, filtro por categorías y grilla de productos (catálogo estático en `src/data/mercadoMonixProductos.ts`, imágenes en `public/mercado`). Al comprar, debita `cuentas.saldo` y registra el movimiento (`mercadoMONIX|...`) — lógica de saldo real, catálogo mock
- **Promos** (`/promos`): listado de ofertas/descuentos de comercios asociados con términos expandibles — solo estado local, sin persistencia
- **Cashback** (`/cashback`): simulador de cashback por comercio adherido sobre un monto ingresado — solo estado local, sin persistencia
- **Financiación** (`/financiacion`): simulador de cuotas (3/6/12) sobre un monto — solo estado local, sin persistencia

### Contactos
- Agenda persistida en `localStorage` via Zustand persist
- Agregar, editar apodo y eliminar contactos
- Acceso directo para iniciar transferencia a un contacto

### Perfil
- Datos personales del usuario
- Información de la cuenta (CBU, alias, número de cuenta, tipo)
- Datos financieros ficticios usados por Préstamos: toggle "Cobro mi sueldo en Monix" e ingreso mensual declarado
- Foto de avatar (guardada como base64 en `localStorage` vía `avatarStore`, no en Supabase Storage)
- Cambio de contraseña con verificación del password actual
- Toggle de tema claro / oscuro (persistido en `localStorage`)

### Comprobante PDF
- Descargable desde el modal de detalle de cualquier movimiento
- Renderizado con `html2canvas` sobre HTML real → captura la tipografía del proyecto (Plus Jakarta Sans + Inter) y el logo Monix
- Layout: header navy con logo blanco + línea gradiente mint → sección de monto → badge APROBADO → tarjetas de detalle y contraparte → footer
- Muestra el nombre real del banco origen (no solo el código)
- Motivo y Mensaje separados (no el string crudo con `|`)

### UX / Diseño
- Modo oscuro completo con detección automática al cargar (script inline en `index.html` antes de React para evitar flash blanco)
- DatePicker personalizado en español con selector de año tipo drum-roll (scroll-snap iOS)
- Pantalla de carga animada con mínimo 2.4 segundos
- Toasts de notificación con estilo de la marca
- Responsive: sidebar en desktop, drawer hamburger en mobile
- Barra de navegación inferior en mobile (`Navbar`, estilo Mercado Libre): accesos a Transferir/Pagar/Historial/Depositar + botón QR flotante central que lleva directo a Pagar → Cobrar

---

## Estructura del proyecto

```
src/
├── assets/
│   └── logos/              # logo-blanco.svg, logo-azul.svg, logo-blanco.png (PDF)
│
├── components/
│   ├── layout/
│   │   ├── MobileDrawer.tsx       # Menú lateral mobile (hamburger)
│   │   ├── Navbar.tsx             # Barra superior
│   │   ├── PageWrapper.tsx        # Shell de página con navbar + sidebar
│   │   └── Sidebar.tsx            # Navegación lateral desktop
│   ├── ui/
│   │   ├── Button.tsx             # Botón con variantes primary/secondary y estado loading
│   │   ├── Card.tsx               # Contenedor con borde y fondo de superficie
│   │   ├── DatePicker.tsx         # Selector de fecha en español con wheel de año
│   │   ├── Input.tsx              # Input con label integrado
│   │   └── Modal.tsx              # Modal con overlay y AnimatePresence
│   ├── AgendaContactosPanel.tsx   # Panel de contactos guardados
│   ├── CercaPrompt.tsx            # Modal "¿Transferirle?" al detectar a alguien con Monix Cerca
│   ├── ErrorBoundary.tsx          # Fallback de error de React para toda la app
│   ├── LoadingScreen.tsx          # Pantalla de carga animada (mínimo 2.4 s)
│   ├── MissingEnvScreen.tsx       # Fallback si faltan variables de entorno de Supabase
│   ├── MonixCard3D.tsx            # Tarjeta de débito virtual 3D interactiva (tilt + flip)
│   ├── MonixLogoAnimated.tsx      # Logo con animación de salto letra por letra (hover)
│   ├── MonixLogoNavbar.tsx        # Logo compacto con shimmer para la navbar
│   ├── NfcPayPanels.tsx           # Paneles "Cobrar" (genera QR) y "NFC" (paga) de Pagar
│   ├── NfcWaves.tsx               # Animación de ondas mientras se espera el tap NFC
│   ├── NotificationBell.tsx       # Campanita de notificaciones (depósitos/transferencias entrantes)
│   ├── OnboardingTour.tsx         # Tour guiado con spotlight animado (Framer Motion)
│   ├── QrBox.tsx                  # Genera y muestra un QR (cobro, tarjeta) a partir de un payload
│   ├── ReservasHomeCard.tsx       # Card resumen de Reservas en el Dashboard
│   ├── TransactionDetailModal.tsx # Modal de detalle de movimiento + descarga PDF
│   └── WelcomeBonusModal.tsx      # Modal de bono de bienvenida ($150.000)
│
├── data/
│   └── mercadoMonixProductos.ts   # Catálogo estático de productos de mercadoMONIX
│
├── hooks/
│   ├── useAuth.ts                 # Sincroniza sesión de Supabase con authStore
│   ├── useBankNames.ts            # Resuelve códigos de banco a nombres via BC API
│   ├── useCerca.tsx               # Contexto de Monix Cerca: visibilidad, búsqueda BLE/NFC, prompt de transferencia
│   ├── useContactos.ts            # CRUD de contactos (Zustand persist en localStorage)
│   ├── useCuenta.ts               # Fetch de cuenta + suscripción Realtime de saldo
│   ├── useMovimientos.ts          # Fetch de movimientos con límite
│   ├── usePrestamos.ts            # Fetch de préstamos + cobro automático de cuotas vencidas (sistema francés)
│   ├── useReserva.ts              # CRUD + cálculo de interés diario compuesto de Reservas
│   ├── useSyncTransferenciasEntrantes.ts  # Polling cada 2 min al BC para recibir transferencias externas
│   └── useTransferenciasRecientes.ts      # Últimos CBUs a los que se transfirió
│
├── lib/
│   ├── scanQr.ts                  # Escaneo de QR desde cámara/imagen (jsqr) + detección de iOS
│   ├── supabaseClient.ts          # Instancia única del cliente Supabase + isSupabaseConfigured
│   └── tokens.ts                  # Helpers de tokens rotativos (Cerca/NFC) y mensajes de error de RPC
│
├── native/
│   └── monixRadio.ts              # Wrapper del plugin Capacitor `monix-radio` (BLE/HCE nativo, Android)
│
├── pages/
│   ├── CashbackPage.tsx           # Simulador de cashback por comercio (demo)
│   ├── CercaPage.tsx              # Monix Cerca: buscar y transferir a personas cercanas
│   ├── CompraVentaDolaresPage.tsx # Compra/venta de USD contra la caja en pesos
│   ├── ContactosPage.tsx          # Gestión de agenda de contactos
│   ├── CuentasPage.tsx            # Cajas de ahorro (ARS/USD) del usuario
│   ├── DashboardPage.tsx          # Página principal con saldo y movimientos recientes
│   ├── DepositPage.tsx            # Formulario de depósito
│   ├── FinanciacionPage.tsx       # Simulador de cuotas (demo)
│   ├── HistorialPage.tsx          # Historial completo con filtros avanzados
│   ├── LandingPage.tsx            # Página de bienvenida (no autenticado)
│   ├── LoginPage.tsx              # Formulario de inicio de sesión
│   ├── MercadoMonixPage.tsx       # Mini-marketplace interno (mercadoMONIX)
│   ├── PagarPage.tsx              # Cobro con QR y pago contactless (NFC)
│   ├── PrestamosPage.tsx          # Simulador y gestión de préstamos personales
│   ├── ProfilePage.tsx            # Perfil y configuración del usuario
│   ├── PromosPage.tsx             # Listado de ofertas/descuentos (demo)
│   ├── RegisterPage.tsx           # Registro de nuevo usuario
│   ├── ReservasPage.tsx           # Bolsillo de ahorro con interés diario
│   ├── TarjetaPage.tsx            # Gestión de la tarjeta de débito virtual
│   └── TransferPage.tsx           # Formulario de transferencia paso a paso
│
├── services/
│   ├── bancoCentral.ts            # Cliente HTTP para la API del Banco Central
│   ├── cerca.ts                   # RPCs de Supabase para presencia y resolución de Monix Cerca
│   └── nfcPago.ts                 # RPCs de Supabase para cobros/pagos contactless (QR/NFC)
│
├── store/
│   ├── authStore.ts               # Estado de sesión (user + persona)
│   └── cuentaStore.ts             # Estado de la cuenta activa (saldo, refreshTick)
│
├── stores/
│   ├── avatarStore.ts             # Foto de avatar por usuario (base64, localStorage)
│   ├── notificacionesStore.ts     # Timestamp de última notificación leída
│   └── themeStore.ts              # Tema claro/oscuro (persistido en localStorage)
│
├── types/
│   ├── index.ts                   # Tipos TypeScript: Persona, Cuenta, Movimiento, Prestamo, Contacto
│   └── nfc.d.ts                   # Tipos para las APIs Web NFC del navegador
│
├── utils/
│   ├── comprobante.ts             # Generación de PDF con html2canvas + jsPDF
│   └── prestamos.ts               # Niveles de tasa/monto por situación crediticia + fórmula de cuota (sistema francés)
│
├── App.tsx                        # Router, guards de autenticación, AppShell
├── index.css                      # Directivas Tailwind + utilidad no-scrollbar
└── main.tsx                       # Entry point de React

supabase/
├── policies.sql                   # Políticas RLS de personas, cuentas, movimientos y reservas
├── reservas.sql                   # Tabla `reservas` (saldo, tasa_anual, ultima_interes_at) + RLS
├── cuentas_interes.sql            # Agrega tasa_anual / ultima_interes_at a `cuentas`
├── cuentas_moneda.sql             # Agrega `moneda` (ARS/USD) a `cuentas`
├── personas_credito.sql           # Agrega sueldo_acreditado / ingreso_mensual a `personas` (usados por Préstamos)
├── prestamos.sql                  # Tabla `prestamos` (monto, cuotas, tna, situación crediticia) + RLS
└── cerca_nfc.sql                  # Tablas `presencia_cerca` y `cobros_nfc` + columnas de tarjeta en `cuentas` + RLS

plugins/monix-radio/                # Plugin nativo de Capacitor (Android, Kotlin): BLE de fondo + emulación de tarjeta NFC (HCE)
```

---

## Base de datos — Supabase

El proyecto usa las siguientes tablas en Supabase (PostgreSQL):

### `personas`
Datos del usuario registrado.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid (PK) | Mismo ID que `auth.users` de Supabase |
| `nombre` | text | — |
| `apellido` | text | — |
| `dni` | text (unique) | — |
| `email` | text | — |
| `telefono` | text | Opcional |
| `fecha_nac` | date | Opcional |
| `direccion` | text | Opcional |
| `sueldo_acreditado` | boolean | Ficticio, editable en Perfil — bonifica tasa y monto máximo en Préstamos |
| `ingreso_mensual` | numeric | Ficticio, editable en Perfil — usado para el tope de cuota/ingreso en Préstamos |
| `created_at` | timestamptz | Auto |

### `cuentas`
Una cuenta bancaria por usuario.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid (PK) | — |
| `persona_id` | uuid (FK → personas) | — |
| `numero_cuenta` | text | Número de 10 dígitos generado al registrarse |
| `tipo` | text | `caja_ahorro` \| `cuenta_corriente` |
| `moneda` | text | `ARS` \| `USD` — una fila por caja de ahorro (agregada en `supabase/cuentas_moneda.sql`) |
| `saldo` | numeric | Saldo actual, en la moneda de la fila |
| `activa` | boolean | — |
| `cbu` | text (unique) | Obtenido del Banco Central al registrarse |
| `alias` | text (unique) | Generado aleatoriamente (tres palabras con punto) |
| `tasa_anual` | numeric | TNA de la cuenta principal, default 32% (agregada en `supabase/cuentas_interes.sql`) |
| `ultima_interes_at` | timestamptz | Última vez que se acreditó interés (agregada en `supabase/cuentas_interes.sql`) |
| `tarjeta_congelada` | boolean | Tarjeta congelada por el usuario (agregada en `supabase/cerca_nfc.sql`) |
| `nfc_contacto_activo` | boolean | Pago contactless (NFC/QR) activado (agregada en `supabase/cerca_nfc.sql`) |
| `created_at` | timestamptz | Auto |

### `reservas`
Bolsillo de ahorro con interés diario compuesto, uno por cuenta (definida en `supabase/reservas.sql`).

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid (PK) | — |
| `cuenta_id` | uuid (FK → cuentas, unique) | Una reserva por cuenta |
| `saldo` | numeric | Saldo actual en Reservas |
| `tasa_anual` | numeric | TNA aplicada, default 32% |
| `ultima_interes_at` | timestamptz | Última vez que se acreditó interés |
| `created_at` | timestamptz | Auto |

### `prestamos`
Préstamos personales en pesos (definida en `supabase/prestamos.sql`).

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid (PK) | — |
| `cuenta_id` | uuid (FK → cuentas) | Cuenta ARS a la que se acreditó el préstamo |
| `monto` | numeric | Capital otorgado |
| `cuotas_totales` | integer | Plazo en cuotas mensuales |
| `cuotas_pagadas` | integer | Cuotas ya cobradas |
| `cuota_monto` | numeric | Cuota fija (sistema francés) |
| `tna` | numeric | Tasa nominal anual aplicada (ya con los ajustes por situación y sueldo) |
| `situacion_bcra` | integer | Situación crediticia (1-5) al momento de aprobarse — foto histórica |
| `sueldo_acreditado` | boolean | Si tenía el sueldo acreditado al aprobarse — foto histórica |
| `estado` | text | `activo` \| `pagado` |
| `proxima_cuota_at` | timestamptz | Fecha de la próxima cuota a cobrar |
| `created_at` | timestamptz | Auto |

### `presencia_cerca`
Quién está "visible" para Monix Cerca, una fila por persona (definida en `supabase/cerca_nfc.sql`).

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | bigint (PK) | — |
| `persona_id` | uuid (FK → personas, unique) | — |
| `cuenta_id` | uuid (FK → cuentas) | Cuenta a acreditar si le transfieren |
| `token_hash` | text (unique) | Hash del token rotativo que se publica por BLE/NFC — nunca el CBU/alias |
| `visible` | boolean | Si está publicando presencia activamente |
| `expires_at` | timestamptz | El token deja de resolverse pasado este momento (rotación ~30 min) |
| `last_seen_at` | timestamptz | Último heartbeat |
| `created_at` | timestamptz | Auto |

### `cobros_nfc`
Cobros con QR o NFC, generados por el comercio y pagados por el cliente (definida en `supabase/cerca_nfc.sql`).

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid (PK) | — |
| `comercio_cuenta_id` | uuid (FK → cuentas) | Cuenta que cobra |
| `comercio_persona_id` | uuid (FK → personas) | Persona que cobra |
| `monto` | numeric | — |
| `descripcion` | text | Opcional |
| `estado` | text | `pendiente` \| `pagado` \| `expirado` \| `cancelado` |
| `pagador_cuenta_id` | uuid (FK → cuentas) | Se completa al pagarse |
| `expires_at` | timestamptz | El cobro vence a los pocos minutos de creado |

### `movimientos`
Registro de todas las operaciones.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid (PK) | — |
| `cuenta_id` | uuid (FK → cuentas) | Cuenta del usuario dueño del movimiento |
| `tipo` | text | `deposito` \| `extraccion` \| `transferencia_entrada` \| `transferencia_salida` |
| `monto` | numeric | Siempre positivo |
| `saldo_resultante` | numeric | Saldo de la cuenta después de la operación |
| `descripcion` | text | Formato: `"Motivo"` o `"Motivo\|Mensaje"` |
| `cuenta_destino_id` | uuid | FK → cuentas (si es transferencia Monix→Monix) |
| `destinatario_nombre` | text | Nombre de la contraparte |
| `destinatario_apellido` | text | — |
| `destinatario_dni` | text | — |
| `destino_cbu` | text | CBU de la contraparte |
| `destino_alias` | text | Alias de la contraparte |
| `bc_transaccion_id` | text | ID de transacción en el Banco Central (evita duplicados) |
| `banco_codigo_origen` | integer | Código de banco para resolver nombre via API |
| `created_at` | timestamptz | Auto |

> **Nota sobre `descripcion`**: se almacena como `"Motivo"` (solo motivo) o `"Motivo|Mensaje"` (con mensaje opcional separado por `|`). Al mostrarse en la UI y en el PDF se parsea y se presentan como campos separados.

---

## API del Banco Central

Todos los alumnos comparten un entorno `test` de una API REST que simula el sistema interbancario argentino. Monix actúa como un banco registrado en ese sistema.

**Variables de entorno necesarias:**

| Variable | Descripción |
|---|---|
| `VITE_BC_URL` | Siempre `/bc-api` — un proxy same-origin, nunca la URL absoluta del Banco Central directo (que no manda CORS y el navegador la bloquearía). En dev/preview lo proxea `vite.config.ts`; en producción (Vercel), el rewrite de `vercel.json` |
| `VITE_BC_API_KEY` | API key del banco Monix registrado |
| `VITE_BC_ENV` | Entorno (`test`) |

**Endpoints utilizados:**

| Método | Ruta | Uso |
|---|---|---|
| `POST` | `/persons` | Registrar persona en el Banco Central al crear cuenta |
| `GET` | `/persons/:cbu` | Buscar destinatario por CBU |
| `GET` | `/persons/alias/:alias` | Buscar destinatario por alias |
| `PUT` | `/persons/:cbu/alias` | Asignar alias a la cuenta recién creada |
| `POST` | `/transactions` | Ejecutar una transferencia |
| `GET` | `/transactions?minutos=N` | Listar transacciones recibidas (últimos N minutos) |
| `GET` | `/banks/:bankCode` | Obtener nombre del banco por su código |
| `POST` | `/accounts` | Abrir una cuenta en USD (CBU/alias separados de la caja en pesos) |
| `PUT` | `/accounts/:cbu/alias` | Asignar alias a la cuenta en USD |
| `GET` | `/accounts/:cbu` | Buscar cuenta en USD por CBU |
| `GET` | `/accounts/alias/:alias` | Buscar cuenta en USD por alias |
| `GET` | `/central-deudores/:dni` | Situación crediticia (BCRA) usada por Préstamos |

---

## Variables de entorno

Crear un archivo `.env` en la raíz del proyecto (ver `.env.example`):

```env
# Supabase
VITE_SUPABASE_URL=https://<proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>

# API Banco Central (cátedra)
VITE_BC_URL=/bc-api
VITE_BC_API_KEY=<api-key-del-banco-monix>
VITE_BC_ENV=test
```

> Nunca commitear el `.env` real. El `.env.example` con los nombres de las variables sí puede commitearse.

---

## Instalación y ejecución

### Requisitos

- Node.js >= 18
- npm >= 9
- Cuenta en [Supabase](https://supabase.com) con las tablas creadas
- Credenciales de la API del Banco Central de la cátedra

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/<usuario>/Homebanking-MONIX.git
cd Homebanking-MONIX

# 2. Instalar dependencias
npm install

# 3. Crear variables de entorno
cp .env.example .env
# Completar los valores en .env

# 4. Iniciar el servidor de desarrollo
npm run dev
# App disponible en http://localhost:5173
```

### Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con hot-reload |
| `npm run build` | Build de producción (TypeScript check + Vite bundle) |
| `npm run preview` | Preview del build de producción localmente |
| `npm run cap:add` | Build + agrega el proyecto Android nativo (Capacitor) |
| `npm run cap:sync` | Build + sincroniza el proyecto Android con el último build web |
| `npm run apk:debug` | Sync + compila un APK debug (`android/gradlew assembleDebug`) — requiere Android SDK/Gradle instalados |

---

## App nativa Android (Monix Cerca / NFC)

La web corre en cualquier navegador, pero dos features de Cerca necesitan la APK (Capacitor) porque el navegador no da acceso a Bluetooth/NFC en segundo plano:

- **BLE de fondo**: quedar "visible" para otros aunque la app esté cerrada (`plugins/monix-radio/.../CercaService.kt`)
- **Emulación de tarjeta NFC (HCE)**: que un lector de tarjetas físico le pague a la cuenta como si tocara una tarjeta real (`MonixHceService.kt`)

Sin la APK, Monix Cerca funciona igual pero solo con la app abierta y por NFC de lectura/escritura del navegador (Chrome Android); en iPhone, el pago contactless cae al fallback de QR (`isIosDevice`, `QrBox`). El código nativo vive en `plugins/monix-radio/android` (Kotlin) y se expone al lado web mediante `src/native/monixRadio.ts`. Para generar el proyecto Android y el APK: `npm run cap:add` (una vez) → `npm run apk:debug`.

---

## Código legacy sin usar (raíz del repo)

En la raíz conviven archivos de un prototipo anterior con **Express + PostgreSQL crudo** (`app.js`, `config/db.js`, `controllers/`, `models/`, `routes/`, `init/*.sql`, `files/`), previo a la migración a Supabase. No forman parte de la app actual: ningún script de `package.json` los ejecuta, y sus dependencias (`express`, `pg`, `dotenv`) **no** están en `package.json` ni instaladas en `node_modules`. Si no se van a usar, se pueden borrar sin afectar la app de React/Vite/Supabase; si se quieren correr como servidor aparte, hay que instalarlos manualmente (`npm install express pg dotenv`) y configurar `DATABASE_URL`.

---

## Configuración de Supabase

### Autenticación

En el panel de Supabase → Authentication → Settings:
- Habilitar **Email + Password** como proveedor
- Configurar la URL de redirección si se usa email confirmation (opcional en entorno de desarrollo)

### Row Level Security (RLS)

Habilitar RLS en todas las tablas y crear políticas para que cada usuario solo acceda a sus propios datos. Ejemplo para `cuentas`:

```sql
-- Lectura: solo tu propia cuenta
CREATE POLICY "propietario puede ver su cuenta"
ON cuentas FOR SELECT
USING (persona_id = auth.uid());

-- Escritura: solo tu propia cuenta
CREATE POLICY "propietario puede actualizar su cuenta"
ON cuentas FOR UPDATE
USING (persona_id = auth.uid());
```

> El repo incluye SQL ya escrito para correr directamente en el SQL Editor de Supabase: `supabase/policies.sql` (políticas RLS de `personas`, `cuentas`, `movimientos` y `reservas`), `supabase/reservas.sql` (crea la tabla `reservas`), `supabase/cuentas_interes.sql` (agrega `tasa_anual` / `ultima_interes_at` a `cuentas`), `supabase/cuentas_moneda.sql` (agrega `moneda` a `cuentas`), `supabase/personas_credito.sql` (agrega `sueldo_acreditado` / `ingreso_mensual` a `personas`), `supabase/prestamos.sql` (crea la tabla `prestamos`, con sus propias políticas RLS incluidas) y `supabase/cerca_nfc.sql` (crea `presencia_cerca` y `cobros_nfc`, agrega `tarjeta_congelada` / `nfc_contacto_activo` a `cuentas`, con sus propias políticas RLS incluidas). Ejecutar en ese orden: `reservas.sql` → `cuentas_interes.sql` → `cuentas_moneda.sql` → `personas_credito.sql` → `prestamos.sql` → `cerca_nfc.sql` → `policies.sql`.

### Realtime

Habilitar replicación en tiempo real para la tabla `cuentas` (Supabase → Database → Replication → supabase_realtime). Esto permite que el dashboard actualice el saldo instantáneamente cuando se recibe una transferencia sin necesidad de recargar la página.

---

## Decisiones de diseño relevantes

**Modo oscuro sin flash**: Un `<script>` inline en `index.html` lee `localStorage` y aplica la clase `dark` al `<html>` antes de que React monte, evitando el parpadeo blanco inicial.

**Descripcion compuesta**: El campo `descripcion` en `movimientos` almacena `"Motivo|Mensaje"` para no requerir una columna extra. Se parsea en todos los puntos de visualización (modal, historial, dashboard, PDF).

**Transferencias internas vs externas**: Las transferencias Monix→Monix se procesan localmente (actualización de saldo en Supabase + registro de movimiento entrante). Las transferencias a bancos externos pasan por la API del Banco Central, y las entrantes se detectan mediante polling cada 2 minutos en `useSyncTransferenciasEntrantes`.

**PDF con fuentes reales**: Se usa `html2canvas` para capturar un div HTML invisible renderizado con los estilos CSS del proyecto (incluyendo Google Fonts ya cargadas en el browser), en lugar de dibujar con las fuentes nativas de jsPDF. Esto garantiza que el PDF use Plus Jakarta Sans e Inter.

**Saldo en tiempo real**: `useCuenta` mantiene una suscripción activa a `postgres_changes` en la fila de la cuenta del usuario. Cuando `saldo` cambia en la base de datos, el dashboard anima el CountUp desde el valor anterior al nuevo valor y muestra un indicador temporal del delta.

**Un solo canal Realtime por cuenta**: como `CercaProvider` y cada página montan su propio `useCuenta()`, las suscripciones se comparten por `cuenta.id` con conteo de referencias (`useCuenta.ts`) — evita el crash de supabase-js al intentar agregar un segundo listener `postgres_changes` sobre un canal ya suscripto.

**Tokens rotativos en Cerca/NFC**: lo que viaja por Bluetooth, NFC o en un QR nunca es el CBU/alias real, sino un token de corta duración. El servidor (RPCs de Supabase) es quien resuelve identidad y cuenta destino recién al confirmar la operación.

---

## Paleta de colores

| Token | Valor | Uso |
|---|---|---|
| `navy` | `#001A3D` | Fondo principal dark, headers |
| `navy-card` | `#0D2B52` | Superficies elevadas en dark mode |
| `mint` | `#26FFC1` | Acento principal, montos positivos, CTA |
| `mint-hover` | `#1FE6AF` | Estado hover de mint |
| `slate-secondary` | `#8A9BB5` | Texto secundario, labels |
| `slate-input` | `#F0F2F5` | Fondo de inputs y página en light mode |
