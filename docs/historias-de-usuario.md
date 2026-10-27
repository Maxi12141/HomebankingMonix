# Historias de usuario — Monix

Monix es un homebanking con versión desktop y mobile (con biometría) que se conecta con la API del Banco Central para registrar personas, obtener CBU y alias y realizar transferencias interbancarias.

Cada historia se presenta como una tarjeta: en el frente, la historia con su prioridad y estimación; en el dorso, las confirmaciones (criterios de aceptación) que deben cumplirse para darla por terminada.

| ID | Historia | Prioridad | Estimación |
|----|----------|-----------|------------|
| HU-01 | Iniciar sesión | Debe tener | 5 puntos |
| HU-02 | Consultar cuentas y saldo | Debe tener | 3 puntos |
| HU-03 | Transferir a un CBU o alias | Debe tener | 8 puntos |
| HU-04 | Consultar movimientos | Debería tener | 3 puntos |
| HU-05 | Modificar el alias de la cuenta | Debería tener | 2 puntos |

---

## HU-01 — Iniciar sesión

### Frente de la tarjeta

Como cliente, yo puedo iniciar sesión en Monix con mi email y contraseña, o con mi huella desde el celular, de forma tal que accedo a mis cuentas de manera segura y solo yo puedo operar con mi dinero.

- **Prioridad:** Debe tener
- **Estimación:** 5 puntos
- **Valor:** Protege el dinero y los datos del cliente y, en el celular, reduce el ingreso a un solo gesto.

### Dorso de la tarjeta — Confirmaciones

- El cliente debe estar registrado en Monix con un email y una contraseña para poder iniciar sesión.
- Si el email o la contraseña no son correctos, el sistema rechaza el ingreso sin indicar cuál de los dos datos falló.
- A partir del tercer intento fallido, el sistema bloquea temporalmente el ingreso con esperas crecientes de 10, 20, 40 y 60 segundos.
- El cliente puede elegir que se recuerde su email en el dispositivo; la contraseña nunca se guarda con esa opción.
- El ingreso con huella solo está disponible en celulares y solo si el cliente la activó previamente en ese dispositivo.
- Si el cliente cambió su contraseña después de activar la huella, el ingreso con huella deja de ser válido y se le pide la contraseña actual.
- En celulares con huella activada, la aplicación vuelve a pedir la huella cuando el cliente regresa a ella después de más de 30 segundos fuera.
- Un cliente que olvidó su contraseña puede restablecerla mediante un enlace enviado a su email.

---

## HU-02 — Consultar cuentas y saldo

### Frente de la tarjeta

Como cliente, yo puedo ver mis cuentas con su saldo, CBU y alias de forma tal que sé cuánto dinero tengo disponible y puedo compartir mis datos para recibir transferencias.

- **Prioridad:** Debe tener
- **Estimación:** 3 puntos
- **Valor:** Da al cliente una visión inmediata de su dinero y le permite recibir pagos sin tener que pedir sus datos al banco.

### Dorso de la tarjeta — Confirmaciones

- El cliente debe haber iniciado sesión para consultar sus cuentas.
- El cliente solo puede ver las cuentas de las que es titular.
- Cada cliente tiene una caja de ahorro en pesos, creada al registrarse con un bono de bienvenida de $150.000, y puede tener como máximo una caja de ahorro en dólares.
- Cada cuenta muestra su moneda, su saldo actual, su CBU de 22 dígitos y su alias.
- Los saldos en pesos se muestran con el símbolo "$" y los saldos en dólares con "US$", siempre con dos decimales.
- El cliente puede copiar su CBU y su alias, y compartir sus datos de cuenta desde la aplicación.
- El cliente puede ocultar y volver a mostrar su saldo en la pantalla principal.
- Las transferencias recibidas desde otros bancos se acreditan en el saldo automáticamente, en un plazo máximo de 2 minutos mientras la aplicación está abierta.

---

## HU-03 — Transferir a un CBU o alias

### Frente de la tarjeta

Como cliente, yo puedo transferir dinero a cualquier cuenta indicando su CBU o alias de forma tal que pago o envío dinero a otras personas, sean de Monix o de otro banco, sin usar efectivo.

- **Prioridad:** Debe tener
- **Estimación:** 8 puntos
- **Valor:** Es la operación central del homebanking: permite mover dinero entre bancos sin efectivo ni trámites presenciales.

### Dorso de la tarjeta — Confirmaciones

- El cliente debe haber iniciado sesión y tener una cuenta activa con CBU asignado para transferir.
- El destino se indica con un CBU de exactamente 22 dígitos o con un alias; si no existe ninguna cuenta con ese dato, el sistema lo informa y no permite continuar.
- Antes de confirmar, el sistema muestra el nombre y apellido del titular de la cuenta destino, su banco y la moneda de su cuenta.
- El monto debe ser mayor a cero y no puede superar el saldo disponible de la cuenta de origen.
- El cliente no puede transferirse a la misma cuenta de origen.
- Si la cuenta de origen y la de destino son de distinta moneda, el monto se convierte con la cotización oficial del día; si no se puede obtener la cotización, la transferencia no se realiza.
- Toda transferencia se informa al Banco Central, y una misma transferencia nunca se envía dos veces aunque el cliente reintente la operación.
- Al finalizar, el saldo de la cuenta de origen se actualiza y el cliente puede descargar o compartir el comprobante en PDF.

---

## HU-04 — Consultar movimientos

### Frente de la tarjeta

Como cliente, yo puedo consultar el historial de movimientos de mis cuentas de forma tal que controlo en qué usé mi dinero y verifico lo que recibí.

- **Prioridad:** Debería tener
- **Estimación:** 3 puntos
- **Valor:** Brinda transparencia y control sobre el dinero, y permite al cliente respaldar sus pagos con un comprobante.

### Dorso de la tarjeta — Confirmaciones

- El cliente debe haber iniciado sesión y solo ve los movimientos de las cuentas de las que es titular.
- El historial muestra los últimos 100 movimientos, ordenados del más reciente al más antiguo.
- Cada movimiento indica su tipo (depósito, extracción, transferencia recibida o transferencia enviada), su monto en la moneda de la cuenta y su fecha.
- El cliente puede filtrar los movimientos por entradas o salidas.
- El cliente puede filtrar por rango de fechas y buscar por nombre, CBU, alias o descripción.
- Si ningún movimiento coincide con los filtros, el sistema lo informa con un mensaje.
- Desde el detalle de un movimiento, el cliente puede descargar o compartir su comprobante en PDF.

---

## HU-05 — Modificar el alias de la cuenta

### Frente de la tarjeta

Como cliente, yo puedo cambiar el alias de mi cuenta en pesos por uno propio de forma tal que me resulta fácil de recordar y de compartir para recibir transferencias.

- **Prioridad:** Debería tener
- **Estimación:** 2 puntos
- **Valor:** Un alias fácil de recordar reduce errores al recibir transferencias y evita tener que dictar un CBU de 22 dígitos.

### Dorso de la tarjeta — Confirmaciones

- El cliente debe haber iniciado sesión y su cuenta debe tener un CBU asignado para modificar el alias.
- Al crearse la cuenta, el sistema le asigna un alias por defecto con el formato palabra.palabra.palabra.
- El alias es obligatorio y no puede contener espacios.
- El alias debe ser único: si ya pertenece a otra cuenta en el Banco Central, el sistema rechaza el cambio.
- El nuevo alias se registra en el Banco Central y en Monix, de modo que ambos quedan con el mismo valor.
- Una vez guardado, el nuevo alias reemplaza al anterior y queda disponible de inmediato para que otras personas encuentren la cuenta al transferir.
