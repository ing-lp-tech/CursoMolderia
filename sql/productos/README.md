# Créditos de digitalización — contrato para la app externa

**Estado: la app de digitalización todavía no existe. El endpoint tampoco.**
La base y el panel ya están: la cola de trabajos, el bucket privado y el
descuento automático del crédito. Este documento fija cómo se conecta la app
cuando se construya, para que quien la haga sepa contra qué programa y para que
las decisiones ya tomadas no se pierdan.

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
| `api/digitalizacion.js` (endpoint para la app) | ❌ sin hacer |

Mientras el endpoint no exista, las digitalizaciones se cargan a mano desde el
panel (botón **Cargar**) y se les mueve el estado desde la misma tarjeta. El
crédito se descuenta solo al pasar a **procesado**.

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

## El contrato del endpoint (a construir)

```
POST /api/digitalizacion
Header: x-api-key: <secreto en variable de entorno>
```

**Validar un código** — no consume nada, sirve para que la app avise antes de
procesar:

```json
{ "accion": "validar", "codigo": "MTX-7K4P-9RTX" }

→ 200 { "valido": true, "creditos_restantes": 7, "cliente": "Ana" }
→ 200 { "valido": false, "motivo": "agotado" | "anulado" | "inexistente" }
```

**Consumir un crédito:**

```json
{ "accion": "consumir", "codigo": "MTX-7K4P-9RTX", "referencia": "<id único>" }

→ 200 { "ok": true, "creditos_restantes": 6 }
→ 409 { "error": "Sin créditos disponibles" }
```

### Cuatro reglas que no son negociables

1. **La app nunca habla con Supabase.** Se autentica contra este endpoint con
   una API key propia. Pasarle la `SUPABASE_SERVICE_ROLE_KEY` a un tercero le da
   lectura y escritura sobre toda la base: alumnos, finanzas, todo.

2. **El descuento tiene que ser atómico**, en una sola sentencia:

   ```sql
   update digitalizacion_creditos
      set creditos_usados = creditos_usados + 1
    where codigo = $1
      and estado = 'activo'
      and creditos_usados < creditos_total
   returning creditos_restantes;
   ```

   Si se hace "leo, sumo, guardo", dos digitalizaciones simultáneas gastan un
   solo crédito. Cero filas devueltas = no había crédito.

3. **Idempotencia por `referencia`.** Si a la app se le corta la conexión y
   reintenta, el mismo `referencia` no puede descontar dos veces: se guarda y el
   reintento devuelve el resultado anterior.

4. **La tabla no es pública.** `anon` no tiene acceso (verificado en el script
   05). Si lo tuviera, alguien podría probar códigos hasta pegarle a uno válido.

### Un detalle de infraestructura

El plan Hobby de Vercel admite **12 serverless functions** y el proyecto está
justo en 11. `api/digitalizacion.js` entra en el último lugar libre. Si más
adelante hacen falta más endpoints, hay que agrupar acciones dentro de un mismo
archivo (como hace `envia-cotizar.js` con `accion: 'sucursales'`) o pasar a plan
Pro.

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
