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

**Tipografías** (Google Fonts, cargadas en `index.html`):
- `Plus Jakarta Sans` — headings y montos
- `Inter` — texto de cuerpo e interfaz

---

## Funcionalidades

### Autenticación
- Registro con datos personales (nombre, apellido, DNI, email, teléfono, dirección, fecha de nacimiento)
- Login / logout con Supabase Auth
- Protección de rutas: rutas privadas (`/dashboard`, `/transferir`, `/historial`, `/depositar`, `/perfil`, `/contactos`, `/pagar`, `/reservas`, `/tarjeta`, `/mercado-monix`, `/promos`, `/cashback`, `/financiacion`) requieren sesión activa; rutas públicas (`/`, `/login`, `/register`) redirigen al dashboard si ya hay sesión
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

### Pagar (servicios y suscripciones)
- Catálogo de servicios/suscripciones (Spotify, Netflix, Disney+, etc.) — catálogo hardcodeado a modo de demo
- Flujo de selección → confirmación → éxito
- Al confirmar, debita `cuentas.saldo` y registra el movimiento correspondiente en `movimientos`
- El estado "ya pagado" es solo en memoria (no persiste entre recargas)

### Reservas
- "Bolsillo" de ahorro separado del saldo principal, con interés diario compuesto (TNA configurable, 32% por defecto)
- Mover fondos entre cuenta principal y Reservas, actualizando `cuentas.saldo`, `reservas.saldo` y registrando el movimiento
- Card resumen en el Dashboard (`ReservasHomeCard`) con saldo, TNA y estimación de interés diario
- Lógica de acumulación de interés en el hook `useReserva` (tabla `reservas`)

### Mi Tarjeta
- Tarjeta de débito virtual 3D interactiva (`MonixCard3D`, tilt con el mouse), con flip para ver frente (PAN enmascarado) y dorso (CBU/alias con copiar al portapapeles)
- Congelar / descongelar tarjeta y mostrar/ocultar el número (estado guardado en `localStorage` por cuenta; es un toggle visual, no bloquea operaciones en el backend)
- Límites diarios de compra/extracción/online (informativos, sin enforcement real)

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
│   ├── LoadingScreen.tsx          # Pantalla de carga animada (mínimo 2.4 s)
│   ├── MissingEnvScreen.tsx       # Fallback si faltan variables de entorno de Supabase
│   ├── MonixCard3D.tsx            # Tarjeta de débito virtual 3D interactiva (tilt + flip)
│   ├── MonixLogoAnimated.tsx      # Logo con animación de salto letra por letra (hover)
│   ├── MonixLogoNavbar.tsx        # Logo compacto con shimmer para la navbar
│   ├── NotificationBell.tsx       # Campanita de notificaciones (depósitos/transferencias entrantes)
│   ├── OnboardingTour.tsx         # Tour guiado con spotlight animado (Framer Motion)
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
│   ├── useContactos.ts            # CRUD de contactos (Zustand persist en localStorage)
│   ├── useCuenta.ts               # Fetch de cuenta + suscripción Realtime de saldo
│   ├── useMovimientos.ts          # Fetch de movimientos con límite
│   ├── useReserva.ts              # CRUD + cálculo de interés diario compuesto de Reservas
│   ├── useSyncTransferenciasEntrantes.ts  # Polling cada 2 min al BC para recibir transferencias externas
│   └── useTransferenciasRecientes.ts      # Últimos CBUs a los que se transfirió
│
├── lib/
│   └── supabaseClient.ts          # Instancia única del cliente Supabase + isSupabaseConfigured
│
├── pages/
│   ├── CashbackPage.tsx           # Simulador de cashback por comercio (demo)
│   ├── ContactosPage.tsx          # Gestión de agenda de contactos
│   ├── DashboardPage.tsx          # Página principal con saldo y movimientos recientes
│   ├── DepositPage.tsx            # Formulario de depósito
│   ├── FinanciacionPage.tsx       # Simulador de cuotas (demo)
│   ├── HistorialPage.tsx          # Historial completo con filtros avanzados
│   ├── LandingPage.tsx            # Página de bienvenida (no autenticado)
│   ├── LoginPage.tsx              # Formulario de inicio de sesión
│   ├── MercadoMonixPage.tsx       # Mini-marketplace interno (mercadoMONIX)
│   ├── PagarPage.tsx              # Pago de servicios/suscripciones
│   ├── ProfilePage.tsx            # Perfil y configuración del usuario
│   ├── PromosPage.tsx             # Listado de ofertas/descuentos (demo)
│   ├── RegisterPage.tsx           # Registro de nuevo usuario
│   ├── ReservasPage.tsx           # Bolsillo de ahorro con interés diario
│   ├── TarjetaPage.tsx            # Gestión de la tarjeta de débito virtual
│   └── TransferPage.tsx           # Formulario de transferencia paso a paso
│
├── services/
│   └── bancoCentral.ts            # Cliente HTTP para la API del Banco Central
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
│   └── index.ts                   # Tipos TypeScript: Persona, Cuenta, Movimiento, Contacto
│
├── utils/
│   └── comprobante.ts             # Generación de PDF con html2canvas + jsPDF
│
├── App.tsx                        # Router, guards de autenticación, AppShell
├── index.css                      # Directivas Tailwind + utilidad no-scrollbar
└── main.tsx                       # Entry point de React

supabase/
├── policies.sql                   # Políticas RLS de personas, cuentas, movimientos y reservas
├── reservas.sql                   # Tabla `reservas` (saldo, tasa_anual, ultima_interes_at) + RLS
└── cuentas_interes.sql            # Agrega tasa_anual / ultima_interes_at a `cuentas`
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
| `created_at` | timestamptz | Auto |

### `cuentas`
Una cuenta bancaria por usuario.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid (PK) | — |
| `persona_id` | uuid (FK → personas) | — |
| `numero_cuenta` | text | Número de 10 dígitos generado al registrarse |
| `tipo` | text | `caja_ahorro` \| `cuenta_corriente` |
| `saldo` | numeric | Saldo actual en ARS |
| `activa` | boolean | — |
| `cbu` | text (unique) | Obtenido del Banco Central al registrarse |
| `alias` | text (unique) | Generado aleatoriamente (tres palabras con punto) |
| `tasa_anual` | numeric | TNA de la cuenta principal, default 32% (agregada en `supabase/cuentas_interes.sql`) |
| `ultima_interes_at` | timestamptz | Última vez que se acreditó interés (agregada en `supabase/cuentas_interes.sql`) |
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
| `VITE_BC_URL` | URL base de la API (ej: `https://bc-api.example.com`) |
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

---

## Variables de entorno

Crear un archivo `.env` en la raíz del proyecto (ver `.env.example`):

```env
# Supabase
VITE_SUPABASE_URL=https://<proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>

# API Banco Central (cátedra)
VITE_BC_URL=https://<url-del-banco-central>
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

> El repo incluye SQL ya escrito para correr directamente en el SQL Editor de Supabase: `supabase/policies.sql` (políticas RLS de `personas`, `cuentas`, `movimientos` y `reservas`), `supabase/reservas.sql` (crea la tabla `reservas`) y `supabase/cuentas_interes.sql` (agrega `tasa_anual` / `ultima_interes_at` a `cuentas`). Ejecutar en ese orden: `reservas.sql` → `cuentas_interes.sql` → `policies.sql`.

### Realtime

Habilitar replicación en tiempo real para la tabla `cuentas` (Supabase → Database → Replication → supabase_realtime). Esto permite que el dashboard actualice el saldo instantáneamente cuando se recibe una transferencia sin necesidad de recargar la página.

---

## Decisiones de diseño relevantes

**Modo oscuro sin flash**: Un `<script>` inline en `index.html` lee `localStorage` y aplica la clase `dark` al `<html>` antes de que React monte, evitando el parpadeo blanco inicial.

**Descripcion compuesta**: El campo `descripcion` en `movimientos` almacena `"Motivo|Mensaje"` para no requerir una columna extra. Se parsea en todos los puntos de visualización (modal, historial, dashboard, PDF).

**Transferencias internas vs externas**: Las transferencias Monix→Monix se procesan localmente (actualización de saldo en Supabase + registro de movimiento entrante). Las transferencias a bancos externos pasan por la API del Banco Central, y las entrantes se detectan mediante polling cada 2 minutos en `useSyncTransferenciasEntrantes`.

**PDF con fuentes reales**: Se usa `html2canvas` para capturar un div HTML invisible renderizado con los estilos CSS del proyecto (incluyendo Google Fonts ya cargadas en el browser), en lugar de dibujar con las fuentes nativas de jsPDF. Esto garantiza que el PDF use Plus Jakarta Sans e Inter.

**Saldo en tiempo real**: `useCuenta` mantiene una suscripción activa a `postgres_changes` en la fila de la cuenta del usuario. Cuando `saldo` cambia en la base de datos, el dashboard anima el CountUp desde el valor anterior al nuevo valor y muestra un indicador temporal del delta.

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
