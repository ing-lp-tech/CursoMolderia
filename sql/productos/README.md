# Créditos de digitalización — contrato para la app externa

**Estado: el endpoint ya existe (`api/digitalizacion.js` + script 13). La app de
digitalización todavía no.** La base y el panel ya están: la cola de trabajos,
el bucket privado, el descuento automático del crédito y la API para validar y
consumir códigos. Este documento fija cómo se conecta la app, para que quien la
haga sepa contra qué programa y para que las decisiones ya tomadas no se pierdan.

---

## Qué existe hoy

| Pieza | Estado |
|---|---|
| `digitalizacion_creditos` (tabla) | ✅ creada (script 05) |
| Emisión del código al aprobar una venta | ✅ `api/producto-admin.js` |
| Panel para ver y descontar créditos a mano | ✅ `/admin/pizarras → Créditos` |
| `digitalizaciones` (cola de trabajos) | ✅ creada (script 09) |
| Bucket privado `digitalizaciones` | ✅ creado (script 09) |
| Descuento automático del crédito | ✅ trigger `trg_digitalizacion_consume_credito` |
| Galería del admin | ✅ `/admin/pizarras → Digitalizaciones` |
| `api/digitalizacion.js` (validar y consumir códigos) | ✅ hecho, necesita el script 13 y `SOFTWARE_API_KEY` |
| `credito_movimientos` (historial) + `fn_usar_credito()` | ✅ script 13 |
| Origen de cada código: compra · manual · demo | ✅ script 13, columna `origen` |
| Página `/software` (el comprador ve y copia su código) | ✅ |
| Códigos manuales con límite a elección | ✅ `/admin/pizarras → Créditos → Nuevo código` |
| Dirección del software, editable | ✅ `/admin/configuracion → Software de digitalización` |

Hay **dos formas de gastar un código**, y las dos suman al mismo contador:

- **Por API** (`accion: 'consumir'`): el software descuenta cuando el cliente
  usa el código.
- **Por la cola** (`digitalizaciones`): el trigger descuenta al pasar a
  **procesado**. Las digitalizaciones se pueden seguir cargando a mano desde el
  panel (botón **Cargar**).

Todo lo que le pasa a un código (emisión, usos, devoluciones, cambios de
límite, anulación) queda en `credito_movimientos` con fecha, origen
(`compra` · `panel` · `software` · `cola` · `sistema`), admin y referencia. Lo
escribe un trigger de la base, así que no hay forma de cambiar un código sin
que quede anotado. Se ve en `/admin/pizarras → Créditos → Historial`.

Si el software usa la API para cobrar, **no** tiene que además pasar filas de la
cola a `procesado` con el mismo código: cobraría dos veces el mismo trabajo.

---

## La cola de trabajos — qué tiene que hacer el procesador

La app que convierte la foto en PDF/DXF trabaja contra la tabla
`digitalizaciones` y el bucket privado del mismo nombre.

```
LO QUE ÉL RECIBE                          LO QUE ÉL TIENE QUE HACER
────────────────────────────────────────  ──────────────────────────────────────
Filas en `digitalizaciones` con           1. Marcar la fila como 'procesando'
estado_procesamiento = 'pendiente',       2. Bajar imagen_original_path del
ordenadas por creado_en                      bucket privado (signed URL)
                                          3. Hacer su magia (ArUco → DXF/PDF)
El archivo original en el bucket          4. Subir el resultado al MISMO bucket,
privado `digitalizaciones`                   en la misma carpeta
                                          5. Escribir archivo_pdf_path y/o
Los parámetros en `parametros` (jsonb)       archivo_dxf_path
                                          6. Setear estado_procesamiento a
                                             'procesado' (o 'error' +
                                             error_mensaje si falló)

LO QUE ÉL NO TIENE QUE TOCAR
────────────────────────────────────────────────────────────────────────────────
Los créditos: el trigger los descuenta solo.
Las tablas de productos, compras, finanzas o alumnos.
El frontend del admin: la galería ya lee lo que él escriba.
```

Las carpetas del bucket:

```
{codigo}/{digitalizacion_id}/original.jpg   la foto del cliente
{codigo}/{digitalizacion_id}/molde.pdf      resultado
{codigo}/{digitalizacion_id}/molde.dxf      resultado
```

**La foto original no se comprime.** El plan decía `original.webp`; se guarda el
archivo tal cual vino, con su extensión real, porque el procesador mide sobre
esos píxeles y recomprimir le saca la precisión que necesita.

**El descuento del crédito es de la base, no de su código.** Cuando la fila pasa
a `'procesado'`, el trigger suma 1 a `creditos_usados` del código y marca la fila
con `credito_consumido = true`. Si él además descuenta por su lado, no hay doble
cobro: el trigger no vuelve a tocar una fila ya cobrada. Si el estado vuelve
atrás (`'error'`, por ejemplo), el crédito se devuelve. Si al procesar no
quedaban créditos, el trabajo queda procesado con `credito_consumido = false` y
el panel lo muestra en rojo.

**Él no entra a Supabase con la service role.** Igual que la app, pasa por
`api/digitalizacion.js` cuando exista; hasta entonces trabaja contra una copia de
desarrollo.

---

## El modelo: un código con contador, no N claves

Una compra emite **un** código `MTX-XXXX-XXXX` con N créditos. **1 crédito = 1
digitalización.**

```
créditos emitidos = cantidad comprada × plan.creditos_por_unidad

  "Solo Software"  → comprás 3, creditos_por_unidad = 1  → 3 créditos
  "Inicial"        → comprás 1, creditos_por_unidad = 10 → 10 créditos
```

Se descartó la alternativa de emitir N claves de un solo uso: el cliente
perdería los códigos sueltos y el soporte se vuelve "¿cuál ya usé?". Con
contador, el cliente guarda un solo dato y ve lo mismo que ve el panel.

El alfabeto del código no tiene `0`/`O` ni `1`/`I`, porque estos códigos se
dictan y se copian a mano por WhatsApp.

---

## El contrato del endpoint

```
POST https://<el sitio>/api/digitalizacion
Header: x-api-key: <SOFTWARE_API_KEY>
Header: Content-Type: application/json
```

`SOFTWARE_API_KEY` es una variable de entorno de Vercel: un secreto largo y
aleatorio (por ejemplo, la salida de `openssl rand -hex 32`). La misma clave se
le pasa al programador del software, que la guarda en **su servidor**, nunca en
el código que corre en el navegador.

**Validar un código.** No gasta nada. Sirve para que la app avise antes de
procesar:

```json
{ "accion": "validar", "codigo": "MTX-7K4P-9RTX" }

→ 200 { "valido": true,  "motivo": null, "codigo": "MTX-7K4P-9RTX", "cliente": "Ana",
        "creditos_total": 10, "creditos_restantes": 7, "vence_en": null }
→ 200 { "valido": false, "motivo": "agotado" | "anulado" | "vencido" | "inexistente",
        "error": "<mensaje para mostrar>", ... }
```

**Consumir créditos.** `cantidad` es opcional (default 1). `referencia` es
opcional pero muy recomendada: el id del trabajo en el software.

```json
{ "accion": "consumir", "codigo": "MTX-7K4P-9RTX", "cantidad": 1, "referencia": "trabajo-123" }

→ 200 { "ok": true, "repetido": false, "creditos_total": 10, "creditos_restantes": 6, "estado": "activo" }
→ 200 { "ok": true, "repetido": true, ... }   misma referencia otra vez: NO descontó
→ 404 { "ok": false, "motivo": "inexistente", "error": "El código no existe." }
→ 409 { "ok": false, "motivo": "agotado" | "anulado" | "vencido", "error": "…", "creditos_restantes": 0 }
→ 401 { "error": "API key inválida" }
```

El código se acepta en minúsculas y con espacios alrededor: el endpoint lo
normaliza.

**Hay una tercera acción, `consultar`, que es de la página `/software` y no
lleva clave.** Devuelve solo el estado y los usos del código, sin datos
personales. El software no la necesita.

### Cuatro reglas que no son negociables

1. **La app nunca habla con Supabase.** Se autentica contra este endpoint con
   una API key propia. Pasarle la `SUPABASE_SERVICE_ROLE_KEY` a un tercero le da
   lectura y escritura sobre toda la base: alumnos, finanzas, todo.

2. **El descuento es atómico.** `fn_usar_credito()` (script 13) toma un lock
   sobre la fila del código (`select … for update`) antes de mirar cuánto le
   queda. Si se hiciera "leo, sumo, guardo", dos digitalizaciones simultáneas
   gastarían un solo crédito.

3. **Idempotencia por `referencia`.** Si a la app se le corta la conexión y
   reintenta, el mismo `referencia` no descuenta dos veces: queda guardado en
   `credito_movimientos` (índice único por código + referencia) y el reintento
   devuelve `repetido: true`.

4. **La tabla no es pública.** `anon` no tiene acceso (verificado en el script
   05). Si lo tuviera, alguien podría probar códigos hasta pegarle a uno válido.

### Un detalle de infraestructura

El plan Hobby de Vercel admite **12 serverless functions**, y con
`api/digitalizacion.js` el proyecto quedó **justo en 12: no queda lugar libre**.
Por eso ese archivo atiende a la vez al comprador (`consultar`) y al software
(`validar`, `consumir`). Cualquier endpoint nuevo tiene que entrar como una
acción dentro de un archivo que ya exista, o hay que pasar a plan Pro.

---

## Lo que queda sin resolver

**"10 digitalizaciones mensuales".** El texto del plan "Inicial" habla de
mensuales, pero los créditos no se renuevan: se emiten una vez y cuando se
agotan, se agotaron. Hoy hay dos caminos:

- Decir **"10 digitalizaciones incluidas"** y emitirlas de una vez
  (`creditos_por_unidad = 10`). Es lo que el sistema hace hoy.
- Renovación mensual de verdad: hace falta una tarea programada que recargue.
  La columna `vence_en` de `digitalizacion_creditos` está prevista para eso pero
  nadie la usa todavía.
