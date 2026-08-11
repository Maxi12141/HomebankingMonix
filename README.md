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
- Protección de rutas: rutas privadas (`/dashboard`, `/transferir`, `/historial`, `/depositar`, `/perfil`, `/contactos`) requieren sesión activa; rutas públicas (`/`, `/login`, `/register`) redirigen al dashboard si ya hay sesión

### Dashboard
- Saldo actual con animación CountUp al cargar y al recibir transferencias en tiempo real
- Indicador delta (`+$ X recibido` / `-$ X enviado`) que aparece y desaparece automáticamente al detectar cambios de saldo vía Supabase Realtime
- Últimos 5 movimientos clickeables con modal de detalle completo
- Acciones rápidas: Transferir, Historial, Depositar
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

### Contactos
- Agenda persistida en `localStorage` via Zustand persist
- Agregar, editar apodo y eliminar contactos
- Acceso directo para iniciar transferencia a un contacto

### Perfil
- Datos personales del usuario
- Información de la cuenta (CBU, alias, número de cuenta, tipo)
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
│   ├── MonixLogoAnimated.tsx      # Logo con animación de salto letra por letra (hover)
│   ├── MonixLogoNavbar.tsx        # Logo compacto con shimmer para la navbar
│   ├── OnboardingTour.tsx         # Tour guiado con spotlight animado (Framer Motion)
│   ├── TransactionDetailModal.tsx # Modal de detalle de movimiento + descarga PDF
│   └── WelcomeBonusModal.tsx      # Modal de bono de bienvenida ($150.000)
│
├── hooks/
│   ├── useAuth.ts                 # Sincroniza sesión de Supabase con authStore
│   ├── useBankNames.ts            # Resuelve códigos de banco a nombres via BC API
│   ├── useContactos.ts            # CRUD de contactos (Zustand persist en localStorage)
│   ├── useCuenta.ts               # Fetch de cuenta + suscripción Realtime de saldo
│   ├── useMovimientos.ts          # Fetch de movimientos con límite
│   ├── useSyncTransferenciasEntrantes.ts  # Polling cada 2 min al BC para recibir transferencias externas
│   └── useTransferenciasRecientes.ts      # Últimos CBUs a los que se transfirió
│
├── lib/
│   └── supabaseClient.ts          # Instancia única del cliente Supabase
│
├── pages/
│   ├── ContactosPage.tsx          # Gestión de agenda de contactos
│   ├── DashboardPage.tsx          # Página principal con saldo y movimientos recientes
│   ├── DepositPage.tsx            # Formulario de depósito
│   ├── HistorialPage.tsx          # Historial completo con filtros avanzados
│   ├── LandingPage.tsx            # Página de bienvenida (no autenticado)
│   ├── LoginPage.tsx              # Formulario de inicio de sesión
│   ├── ProfilePage.tsx            # Perfil y configuración del usuario
│   ├── RegisterPage.tsx           # Registro de nuevo usuario
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
