# Graph Report - HomebankingMonix  (2026-10-18)

## Corpus Check
- 143 files · ~150,445 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 4, .example 1, .css 1)

## Summary
- 1172 nodes · 2976 edges · 87 communities (60 shown, 27 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 44 edges (avg confidence: 0.85)
- Token cost: 160,626 input · 0 output

## Community Hubs (Navigation)
- Biometría y Login
- Asistente Moni y Voz
- Páginas Depósito y Dólares
- Onboarding y Banners
- SQL Metas Comunes
- Cobros QR (cliente)
- Metas Comunes (UI)
- Cuenta, Saldo y Reservas
- SQL Limpieza de Base
- Dashboard y Cuentas
- Cliente API Banco Central
- SQL Cobros QR
- Prototipo Express legacy
- Comprobantes PDF
- UI Inputs y Password
- Navbar y Escáner QR
- Instalación PWA
- Ticker Mercado Financiero
- tsconfig
- QR JWT Interbancario
- Préstamos (UI)
- Lectura QR por cámara
- Rutas y Shell de App
- Landing y Logo animado
- DatePicker
- Agenda de Contactos
- Escanear y Pagar QR
- Pantalla Transferir
- Motor de Préstamos
- package.json meta
- Dependencias runtime
- Supabase client y recientes
- Tarjeta 3D
- Despliegue y Auth (docs)
- Dependencias dev
- Historial de Movimientos
- Arquitectura y Seguridad (docs)
- Edge Function index
- Mercado Monix
- Aviso de lectura QR (docs)
- Notificaciones
- Drawer móvil y logo
- Firma QR JWT (docs)
- SQL Transferencia Atómica
- index.html y Vercel (docs)
- DER (diagrama)
- Schema Postgres legacy
- Auth y Sidebar
- Recuperar clave y Tema
- tsconfig.node
- Migraciones y Cobros (docs)
- Vite y proxy BC
- ErrorBoundary
- Ayuda de Metas
- Abrir cuenta USD y Alias
- Idempotencia transferencias
- Términos y Privacidad
- Permisos de dispositivo
- SQL qr_lecturas
- npm scripts
- Sync transferencias entrantes
- SQL Préstamos
- SQL Reservas
- Realtime de saldo
- Seed Central Deudores
- Agendar post-pago
- vercel.json
- MCP config

## God Nodes (most connected - your core abstractions)
1. `react` - 56 edges
2. `Button()` - 51 edges
3. `Card()` - 44 edges
4. `PageWrapper()` - 41 edges
5. `lucide-react` - 40 edges
6. `EscanearYPagar()` - 40 edges
7. `TransferPage()` - 37 edges
8. `LoginPage()` - 35 edges
9. `RegisterPage()` - 34 edges
10. `useCuenta()` - 33 edges

## Surprising Connections (you probably didn't know these)
- `QrPanels 5s incoming-transfer sync` --semantically_similar_to--> `useSyncTransferenciasEntrantes hook`  [INFERRED] [semantically similar]
  docs/manual-despliegue.md → README.md
- `vercel.json mandatory config (rewrites, no-cache, Permissions-Policy)` --semantically_similar_to--> `Permissions-Policy meta (camera, microphone, WebAuthn)`  [INFERRED] [semantically similar]
  docs/manual-despliegue.md → index.html
- `Manual de despliegue Monix v1.2` --references--> `Monix Homebanking (README)`  [EXTRACTED]
  docs/manual-despliegue.md → README.md
- `Supabase Reset Password email template (Monix)` --references--> `Supabase backend`  [INFERRED]
  docs/email-recuperar-contrasena.html → README.md
- `Monix architecture (no own app server)` --references--> `API del Banco Central (catedra)`  [EXTRACTED]
  docs/manual-despliegue.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Interbank signed-QR payment flow** — docs_manual_despliegue_firmar_qr, docs_qr_interbancario_jwt_jwt_firmado, docs_qr_interbancario_jwt_verification, docs_manual_despliegue_qr_lectura, docs_qr_interbancario_jwt_qr_un_solo_uso [EXTRACTED 1.00]
- **Transfer consistency with Banco Central** — readme_bc_api_proxy, docs_manual_despliegue_operacion_id, supabase_fix_transferencia_bc_id, readme_use_sync_transferencias_entrantes, readme_movimientos_table [INFERRED 0.85]
- **Password reset flow** — docs_email_recuperar_contrasena_reset_password_template, docs_email_recuperar_contrasena_redirect_url, docs_manual_despliegue_auth_config [EXTRACTED 1.00]
- **Productos con subtipos Cuenta/Tarjeta y catalogos tipo/estado** — files_der_productos, files_der_cuentas_bancarias, files_der_tarjetas_credito, files_der_tipos_producto, files_der_estados_producto [INFERRED 0.85]
- **Asignacion de roles a personas (n:m)** — files_der_personas, files_der_roles, files_der_roles_x_personas [EXTRACTED 1.00]

## Communities (87 total, 27 thin omitted)

### Community 0 - "Biometría y Login"
Cohesion: 0.07
Nodes (60): HuellaLockScreen(), pedirBiometria(), dentroDeGracia(), guardarMarca(), marcarActivo(), useBiometriaLock(), alSalir(), alVolver() (+52 more)

### Community 1 - "Asistente Moni y Voz"
Cohesion: 0.06
Nodes (52): AsistenteBubble(), abrirChat(), ask(), preguntar(), toggleMic(), vozYaEnviada(), ChatMsg, fromReply() (+44 more)

### Community 2 - "Páginas Depósito y Dólares"
Cohesion: 0.13
Nodes (26): lucide-react, react, react-hot-toast, react-router-dom, PageWrapper(), PageWrapperProps, Button(), ButtonProps (+18 more)

### Community 3 - "Onboarding y Banners"
Cohesion: 0.07
Nodes (33): react-countup, OnboardingTour(), goBack(), goNext(), goTo(), Pos, Props, setDrawer() (+25 more)

### Community 4 - "SQL Metas Comunes"
Cohesion: 0.09
Nodes (19): metas_aportes_meta_idx, metas_comunes_codigo_uidx, metas_comunes_creador_idx, metas_miembros_meta_idx, metas_miembros_persona_idx, metas_votaciones_abierta_uidx, metas_votaciones_meta_idx, metas_votos_votacion_idx (+11 more)

### Community 5 - "Cobros QR (cliente)"
Cohesion: 0.12
Nodes (30): qrcode, QrBox(), pagarCobro(), pagarCuenta(), MiCodigoQr(), cambiarMoneda(), nuevoCobro(), nuevoQr() (+22 more)

### Community 6 - "Metas Comunes (UI)"
Cohesion: 0.13
Nodes (30): estadoMeta(), etiquetaAporte(), MetasPage(), abrir(), cargarLista(), compartirInvitacion(), onAportar(), onCrear() (+22 more)

### Community 7 - "Cuenta, Saldo y Reservas"
Cohesion: 0.13
Nodes (26): formatARS(), Props, ReservasHomeCard(), accrueInterest(), cargarCuentas(), cargarCuentasCompartido(), pendingUnsub, realtimeChannels (+18 more)

### Community 8 - "SQL Limpieza de Base"
Cohesion: 0.10
Nodes (11): cobros_qr_comercio_cuenta_id_idx, cobros_qr_comercio_persona_id_idx, cobros_qr_estado_expires_idx, cobros_qr_pagador_cuenta_id_idx, private.assert_token(), private.cuenta_propia(), private.enforce_rate(), private.obtener_cobro_qr() (+3 more)

### Community 9 - "Dashboard y Cuentas"
Cohesion: 0.15
Nodes (19): CargaCuentas, CopyField(), CuentaCard(), Estado, containerVariants, formatMonto(), itemVariants, SaldoCard() (+11 more)

### Community 10 - "Cliente API Banco Central"
Cohesion: 0.13
Nodes (26): BancoCentralError, BASE_URL, BCBank, BCCuenta, BCDestinatario, BCDeuda, BCPersona, BCPersonaTransaccion (+18 more)

### Community 11 - "SQL Cobros QR"
Cohesion: 0.10
Nodes (11): cobros_qr_comercio_cuenta_id_idx, cobros_qr_comercio_persona_id_idx, cobros_qr_estado_expires_idx, cobros_qr_pagador_cuenta_id_idx, private.assert_token(), private.cuenta_propia(), private.enforce_rate(), private.obtener_cobro_qr() (+3 more)

### Community 12 - "Prototipo Express legacy"
Cohesion: 0.08
Nodes (13): app, express, personaController, tablaController, { Pool }, Persona, mapaRutas, TablaModel (+5 more)

### Community 13 - "Comprobantes PDF"
Cohesion: 0.16
Nodes (22): html2canvas, jspdf, DetailRow(), esEntrada(), tipoLabel, TransactionDetailModal(), handleDownload(), handleShare() (+14 more)

### Community 14 - "UI Inputs y Password"
Cohesion: 0.16
Nodes (13): Props, Input(), InputProps, PasswordInput(), Props, calcularFuerza(), NIVELES, PasswordStrengthMeter() (+5 more)

### Community 15 - "Navbar y Escáner QR"
Cohesion: 0.15
Nodes (15): Navbar(), SideLink(), sideLinks, coverRadius(), layoutViewport(), QrScannerFullscreen(), generarQr(), moverArrastre() (+7 more)

### Community 16 - "Instalación PWA"
Cohesion: 0.16
Nodes (13): react-dom, esIOS(), esStandalone(), ResultadoInstalarPwa, usePwaInstall(), BeforeInstallPromptEvent, consumirPromptCapturado(), getPromptCapturado() (+5 more)

### Community 17 - "Ticker Mercado Financiero"
Cohesion: 0.21
Nodes (16): DOLAR_LABELS, formatARS(), formatPct(), MarketTicker(), TickerItem, MercadoFinanciero, useMercadoFinanciero(), load() (+8 more)

### Community 18 - "tsconfig"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+11 more)

### Community 19 - "QR JWT Interbancario"
Cohesion: 0.15
Nodes (18): jose, avisarLectura(), BancoAviso, BancoConocido, BANCOS_AVISO, BANCOS_CONOCIDOS, chequearVencimiento(), esJwtQr() (+10 more)

### Community 20 - "Préstamos (UI)"
Cohesion: 0.27
Nodes (16): Card(), roundMoney(), usePrestamos(), refreshPrestamos(), EsquemaPagoModal(), formatARS(), PLAZOS_CANDIDATOS, PrestamoCard() (+8 more)

### Community 21 - "Lectura QR por cámara"
Cohesion: 0.19
Nodes (14): jsqr, leerQrDeCamara(), BarcodeDetectorLike, detectQrUntil(), engancharCamara(), esPantallaChica(), getBarcodeDetector(), isIosDevice() (+6 more)

### Community 22 - "Rutas y Shell de App"
Cohesion: 0.21
Nodes (12): framer-motion, App(), AppRoutes(), AppShell(), CuentasGlobales(), RequireAuth(), LoadingScreen(), MissingEnvScreen() (+4 more)

### Community 23 - "Landing y Logo animado"
Cohesion: 0.18
Nodes (14): containerVariant, letterVariant, MonixLogoAnimated(), Props, Chip(), containerVariants, CreditCardSVG(), DebitCardSVG() (+6 more)

### Community 24 - "DatePicker"
Cohesion: 0.14
Nodes (8): DatePicker(), DAYS_ES, daysInMonth(), firstWeekday(), isoToDisplay(), MONTHS_ES, Props, YEARS

### Community 25 - "Agenda de Contactos"
Cohesion: 0.17
Nodes (10): AgendaContactosPanel(), buscarPersona(), Iniciales(), PersonaEncontrada, Props, ContactosState, useContactos(), useContactosStore (+2 more)

### Community 26 - "Escanear y Pagar QR"
Cohesion: 0.28
Nodes (14): aplicarQr(), EscanearYPagar(), apagarCamara(), cargarCobro(), cargarCuenta(), cargarDestinoJwt(), escanearFoto(), escanearQr() (+6 more)

### Community 27 - "Pantalla Transferir"
Cohesion: 0.17
Nodes (12): BadgeOtroBanco(), convertir(), Iniciales(), roundMoney(), TransferPage(), buscarDestinatario(), handleConfirm(), seleccionarAcceso() (+4 more)

### Community 28 - "Motor de Préstamos"
Cohesion: 0.14
Nodes (15): BONUS_SUELDO_PUNTOS, calcularOferta(), ColorNivel, DISTRIBUCION_SITUACION, FilaAmortizacion, MAX_MONTO_MULT_SUELDO, montoAlAzar(), NivelCrediticio (+7 more)

### Community 29 - "package.json meta"
Cohesion: 0.13
Nodes (13): name, private, type, version, autoprefixer, playwright, postcss, tailwindcss (+5 more)

### Community 30 - "Dependencias runtime"
Cohesion: 0.13
Nodes (15): dependencies, framer-motion, html2canvas, jose, jspdf, jsqr, lucide-react, qrcode (+7 more)

### Community 31 - "Supabase client y recientes"
Cohesion: 0.15
Nodes (11): @supabase/supabase-js, TransferenciaReciente, useTransferenciasRecientes(), isSupabaseConfigured, supabaseAnonKey, supabaseUrl, Destinatario, Moneda (+3 more)

### Community 32 - "Tarjeta 3D"
Cohesion: 0.19
Nodes (10): buildCvv(), buildPan(), faceBaseStyle, MonixCard3D(), MonixCard3DProps, freezeKey(), LimitRow(), TarjetaPage() (+2 more)

### Community 33 - "Despliegue y Auth (docs)"
Cohesion: 0.19
Nodes (14): Redirect URL /restablecer-contrasena, Supabase Reset Password email template (Monix), Monix architecture (no own app server), Supabase Auth config (Confirm email off, redirect URLs), Post-deploy checklist, Cotizaciones APIs (dolarapi, argentinadatos), Client-only login rate limiting, Manual de despliegue Monix v1.2 (+6 more)

### Community 34 - "Dependencias dev"
Cohesion: 0.14
Nodes (14): devDependencies, autoprefixer, playwright, postcss, tailwindcss, @types/qrcode, @types/react, @types/react-dom (+6 more)

### Community 35 - "Historial de Movimientos"
Cohesion: 0.24
Nodes (10): Props, useBankNames(), useMovimientos(), coincideBusqueda(), esEntrada(), Filtro, HistorialPage(), tipoLabel (+2 more)

### Community 36 - "Arquitectura y Seguridad (docs)"
Cohesion: 0.18
Nodes (12): init scripts volume (docker-entrypoint-initdb.d), Postgres 15 db service (banco_postgres), API del Banco Central (catedra), Central de Deudores situacion crediticia, cuentas table, Legacy Express + raw PostgreSQL prototype, Monix Homebanking (README), Prestamos (personal loans, French system) (+4 more)

### Community 37 - "Edge Function index"
Cohesion: 0.18
Nodes (5): corsHeaders, corsHeaders, jsonResponse(), MONIX_PUBLIC_JWK, yaUsado()

### Community 38 - "Mercado Monix"
Cohesion: 0.27
Nodes (9): CATEGORIAS_MERCADO, productoImagen(), ProductoMercado, PRODUCTOS_MERCADO, formatARS(), MercadoMonixPage(), confirmarCompra(), ProductImage() (+1 more)

### Community 39 - "Aviso de lectura QR (docs)"
Cohesion: 0.23
Nodes (10): Edge Function qr-lectura, qr_lecturas table, Aviso de lectura contract (202/409/400/401), Banco Tuo (bankCode 12), jti claim for QR closure, Prompt: aviso de lectura y QR de un solo uso for Banco Tuo, Banco Tuo qr-lectura Edge Function, Aviso de lectura v1 (section 12) (+2 more)

### Community 40 - "Notificaciones"
Cohesion: 0.24
Nodes (8): zustand, currency(), esNotificable(), NotificationBell(), titulo(), AvatarStore, NotificacionesStore, useNotificacionesStore

### Community 41 - "Drawer móvil y logo"
Cohesion: 0.21
Nodes (9): links, MobileDrawer(), Props, MonixLogoNavbar(), handleHoverStart(), eio(), step(), Props (+1 more)

### Community 42 - "Firma QR JWT (docs)"
Cohesion: 0.29
Nodes (9): BANCOS_CONOCIDOS / BANCOS_AVISO (qrJwt.ts), Edge Function firmar-qr, QR_JWT_PRIVATE_KEY secret, firmar-qr Edge Function contract, jose library (WebCrypto), JWT firmado ES256 (iss, cbu, alias, monto, moneda, iat, exp), Manual public key (JWK) distribution, QR interbancario firmado (JWT) spec (+1 more)

### Community 44 - "index.html y Vercel (docs)"
Cohesion: 0.22
Nodes (6): vercel.json mandatory config (rewrites, no-cache, Permissions-Policy), Google Fonts Plus Jakarta Sans + Inter, index.html app entry, Permissions-Policy meta (camera, microphone, WebAuthn), Inline theme script (monix-theme localStorage), PWA (vite-plugin-pwa, WebAuthn, Web Speech)

### Community 45 - "DER (diagrama)"
Cohesion: 0.44
Nodes (9): DER Homebanking Monix (diagrama entidad-relacion), Cuentas_Bancarias (id_cuenta, id_producto, cbu, alias, moneda, saldo), Estados_Producto (id_estado_producto, nombre), Personas (id, nombre, apellido, dni, direccion, email, telefono, fecha_nac), Productos (id_producto, id_persona, id_tipo_producto, id_estado_producto, fecha_alta), Roles (id_rol, nombre, descripcion, activo, fecha_creacion), Roles_x_Personas (tabla puente id_persona, id_rol), Tarjetas_Credito (id_tarjeta, id_producto, numero, marca, fecha_vencimiento, limite, dia_cierre) (+1 more)

### Community 46 - "Schema Postgres legacy"
Cohesion: 0.42
Nodes (8): Cuentas_Bancarias, Estados_Producto, Personas, Productos, Roles, Roles_x_Personas, Tarjetas_Credito, Tipos_Producto

### Community 47 - "Auth y Sidebar"
Cohesion: 0.31
Nodes (8): PublicOnly(), links, Sidebar(), useAuth(), fetchPersona(), login(), restaurarSesion(), withTimeout()

### Community 48 - "Recuperar clave y Tema"
Cohesion: 0.36
Nodes (5): ForgotPasswordPage(), leerCooldown(), Theme, ThemeStore, useThemeStore

### Community 49 - "tsconfig.node"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 50 - "Migraciones y Cobros (docs)"
Cohesion: 0.33
Nodes (5): Metas comunes (shared goals with majority vote), Supabase SQL migration order, monix-limpieza-base.sql (rename cobros_nfc to cobros_qr), cobros_qr table, useSyncTransferenciasEntrantes hook

### Community 51 - "Vite y proxy BC"
Cohesion: 0.29
Nodes (5): vite, vite-plugin-pwa, vite-plugin-svgr, @vitejs/plugin-react, bcProxy

### Community 52 - "ErrorBoundary"
Cohesion: 0.29
Nodes (3): ErrorBoundary, Props, State

### Community 53 - "Ayuda de Metas"
Cohesion: 0.48
Nodes (6): claveVista(), marcarVista(), MetasAyuda(), cerrar(), PASOS, yaLaVio()

### Community 54 - "Abrir cuenta USD y Alias"
Cohesion: 0.52
Nodes (7): CuentasPage(), solicitarUSD(), abrirCuenta(), asignarAliasCuenta(), mensajeAmigableBC(), generateAlias(), generateNumeroCuenta()

### Community 56 - "Términos y Privacidad"
Cohesion: 0.47
Nodes (5): PrivacidadContenido(), Props, TerminosContenido(), TermsModal(), TITULOS

### Community 57 - "Permisos de dispositivo"
Cohesion: 0.47
Nodes (5): conTiempo(), isAbortError(), pedirMediosWeb(), pedirTodosLosPermisos(), permitirDispositivos()

### Community 58 - "SQL qr_lecturas"
Cohesion: 0.47
Nodes (3): public.qr_lecturas, qr_lecturas_jti_unico, qr_lecturas_persona_idx

### Community 59 - "npm scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, dev:celular, preview

### Community 60 - "Sync transferencias entrantes"
Cohesion: 0.70
Nodes (4): sincronizar(), sincronizarTransferenciasEntrantes(), useSyncTransferenciasEntrantes(), listarTransacciones()

### Community 65 - "Agendar post-pago"
Cohesion: 0.67
Nodes (3): BotonAgendar(), agendar(), accionesPostPago()

## Knowledge Gaps
- **18 isolated node(s):** `@types/qrcode`, `@types/react`, `@types/react-dom`, `autoprefixer`, `playwright` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 423 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Páginas Depósito y Dólares` to `Biometría y Login`, `Asistente Moni y Voz`, `Onboarding y Banners`, `Cobros QR (cliente)`, `Cuenta, Saldo y Reservas`, `Dashboard y Cuentas`, `Comprobantes PDF`, `UI Inputs y Password`, `Navbar y Escáner QR`, `Instalación PWA`, `Ticker Mercado Financiero`, `Préstamos (UI)`, `Rutas y Shell de App`, `DatePicker`, `Agenda de Contactos`, `package.json meta`, `Supabase client y recientes`, `Tarjeta 3D`, `Historial de Movimientos`, `Mercado Monix`, `Notificaciones`, `Drawer móvil y logo`, `Recuperar clave y Tema`, `ErrorBoundary`, `Ayuda de Metas`, `Sync transferencias entrantes`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **What connects `@types/qrcode`, `@types/react`, `@types/react-dom` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Biometría y Login` be split into smaller, more focused modules?**
  _Cohesion score 0.07140538786108407 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `Páginas Depósito y Dólares` to `Biometría y Login`, `Asistente Moni y Voz`, `Onboarding y Banners`, `Cobros QR (cliente)`, `Cuenta, Saldo y Reservas`, `Dashboard y Cuentas`, `Comprobantes PDF`, `UI Inputs y Password`, `Navbar y Escáner QR`, `Ticker Mercado Financiero`, `Préstamos (UI)`, `Landing y Logo animado`, `DatePicker`, `Agenda de Contactos`, `package.json meta`, `Supabase client y recientes`, `Tarjeta 3D`, `Historial de Movimientos`, `Mercado Monix`, `Notificaciones`, `Drawer móvil y logo`, `Auth y Sidebar`, `Recuperar clave y Tema`, `Ayuda de Metas`, `Términos y Privacidad`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Should `Asistente Moni y Voz` be split into smaller, more focused modules?**
  _Cohesion score 0.058941058941058944 - nodes in this community are weakly interconnected._
- **Why does `Button()` connect `Páginas Depósito y Dólares` to `Biometría y Login`, `Onboarding y Banners`, `Cobros QR (cliente)`, `Metas Comunes (UI)`, `Cuenta, Saldo y Reservas`, `Dashboard y Cuentas`, `UI Inputs y Password`, `Préstamos (UI)`, `Rutas y Shell de App`, `Landing y Logo animado`, `Escanear y Pagar QR`, `Pantalla Transferir`, `Supabase client y recientes`, `Tarjeta 3D`, `Mercado Monix`, `Recuperar clave y Tema`, `Ayuda de Metas`, `Abrir cuenta USD y Alias`, `Términos y Privacidad`, `Agendar post-pago`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Should `Páginas Depósito y Dólares` be split into smaller, more focused modules?**
  _Cohesion score 0.1294871794871795 - nodes in this community are weakly interconnected._