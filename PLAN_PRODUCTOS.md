# Plan de Implementación — Productos, Categorías, Planes, Créditos y Tienda

*Versión 2 — incorpora tus respuestas del 16/09/2026*

---

## Estado de avance

```
ETAPA                                       ESTADO
──────────────────────────────────────────  ─────────────────────────────────
1 — Categorías + migración                  Código listo (01, 02, 03 + backend
                                            + PizarrasPage/Admin/Papelera)

2 — Planes + créditos                       Código listo (04, 05 + planes en
                                            create-producto/producto-admin,
                                            sección de planes en /pizarras,
                                            tabs Planes y Créditos en el panel)

3 — Navbar administrable                    Código listo (06 + NavegacionPage
                                            + Navbar leyendo de nav_items)

4 a 9                                       Pendientes
```

Scripts extra fuera de la numeración original: `03b` (anulación de guías de
envío) y `04b` (créditos incluidos por plan).

Scripts 00 a 05 ya corridos en Supabase. Falta verificar los checkpoints 1 y 2
en producción (Parte 13).

**Cambio sobre el plan original:** los shims `api/create-pizarra.js` y
`api/pizarra-admin.js` no existen como archivos. El plan Hobby de Vercel admite
12 serverless functions y con ellos eran 13, así que el reenvío se hace con dos
rewrites en `vercel.json`, que no consumen slot. El efecto para el comprador con
la página cacheada es el mismo. En la Etapa 9, "reducir los shims" pasa a ser
"borrar esos dos rewrites".

---

## Resumen General

Generalización del módulo de **pizarras** a un módulo de **productos físicos** con **categorías y subcategorías administrables**, **planes editables**, **créditos de digitalización con código**, **navbar administrable**, **tienda pública unificada** e **historial de stock**.

Todo el trabajo es **aditivo o de renombre reversible**. No se borra ninguna tabla, ninguna fila ni ningún endpoint. **No se toca absolutamente nada de alumnos, estudiantes, cursadas, certificados, cupones, recursos, kanban ni moldes.**

---

## Qué cambió respecto de la versión 1 (por tus respuestas)

```
TEMA                    V1 (lo que había propuesto)        V2 (lo que vos pediste)
──────────────────────  ─────────────────────────────────  ─────────────────────────────────
Categorías              Columna `categoria` con check       TABLAS producto_categorias +
                        fijo de 4 valores                   producto_subcategorias.
                                                            Plotters → Papel, Cartuchos.
                                                            Cada categoría se puede mostrar
                                                            u ocultar del navbar.

Pizarras                Solo una fila más en productos      Están DENTRO de productos, pero
                                                            con sector propio en el admin y
                                                            página propia, porque ahí se va a
                                                            enchufar la digitalización.

Plan "Solo Software"    Pregunta abierta                    Se compra online: el cliente elige
                                                            cuántos créditos y recibe un CÓDIGO
                                                            que sirve para esa cantidad de
                                                            digitalizaciones.

Imágenes                Columna imagen_bucket + 2 buckets   UN solo bucket, convención de
                                                            carpetas por categoría, y
                                                            compresión más agresiva (WebP +
                                                            miniatura). Menos lugar y más orden.

Vistas de compat.       7 días                              24–48 hs. Tu sitio casi no tiene
                                                            tráfico de productos.

Digitalización          Se dejaba para después              Se deja el GANCHO COMPLETO: tablas,
                                                            bucket privado, estados, y la
                                                            galería donde ves la imagen
                                                            digitalizada de cada cliente.
```

---

## Qué NO toca este plan (tu punto sobre finanzas y alumnos)

Me dijiste que lo único que no puede romperse es lo relacionado a **finanzas, alumnos y estudiantes**. Dejo explícito qué queda intacto:

```
TABLA / MÓDULO              ESTADO EN ESTE PLAN
──────────────────────────  ────────────────────────────────────────────────────
perfiles (alumnos)          NO SE TOCA — ni una línea
cursadas / matrículas       NO SE TOCA
costos_alumnos              NO SE TOCA
finanzas_movimientos        NO SE TOCA la tabla, ni sus columnas, ni sus datos,
                            ni el trigger de deudas, ni los pagos parciales
finanzas_notas              NO SE TOCA
certificados                NO SE TOCA
cupones                     NO SE TOCA
recursos                    NO SE TOCA
tablero kanban              NO SE TOCA
sorteos                     NO SE TOCA
moldes / moldes_*           NO SE TOCA
app_settings                NO SE TOCA (se reusan las claves que ya existen)
auditoria                   NO SE TOCA (solo recibe registros nuevos)

ÚNICO cambio que roza Finanzas:
  src/pages/admin/FinanzasPage.jsx línea 8 → se agrega el string
  'Venta de producto' al array CATEGORIAS.ingreso.
  Es una línea, no toca la base de datos, y no altera ningún movimiento existente.
```

El **Checkpoint 1** incluye probar alumnos y finanzas justamente para que veas con tus ojos que siguen andando.

---

## Regla base: migrar sin cortar el servicio

El commit `b54fba0` de este repo ya dejó la lección escrita:

> *"fix: make metodo_envio backward-compatible so a stale cached frontend doesn't break checkout mid-deploy"*

El deploy de Vercel y la migración SQL **no ocurren en el mismo instante**. Entre que corrés el SQL y que el navegador de un cliente baja el código nuevo pueden pasar horas (pestaña abierta, caché del CDN). Por eso la Etapa 1 lleva red de seguridad:

```
1. RENOMBRE, no tabla nueva + copia
   alter table pizarras rename to productos;
   → conserva ids, datos, índices, policies, triggers y FKs
   → es instantáneo y se deshace con el rename inverso
   → NO quedan dos tablas en paralelo: es una sola tabla con nombre nuevo

2. VISTAS DE COMPATIBILIDAD (temporales, para LECTURA)
   create view pizarras        as select ... from productos where <categoría pizarra>;
   create view pizarras_compras as select ..., producto_id as pizarra_id, ... from producto_compras;
   → el navegador que tenga la página vieja abierta sigue viendo el catálogo

3. SHIMS en los endpoints viejos
   api/create-pizarra.js → reenvía a api/create-producto.js
   api/pizarra-admin.js  → reenvía a api/producto-admin.js
   → una compra disparada desde la página vieja se procesa con el código nuevo,
     así que NO se pierde ninguna venta
```

### Respondiendo tu duda: qué pasa cuando borramos las vistas

**No pasa nada.** Las vistas son una red de seguridad que solo sirve para el rato en que alguien tiene tu sitio abierto con el código anterior. Una vez que esa persona recarga la página (o cierra la pestaña), la red deja de tener sentido: el sitio nuevo ya no las usa para nada.

Como tu tráfico de productos es bajo, **las borramos a las 24–48 hs**, no a los 7 días. Si nos olvidamos y quedan para siempre, tampoco rompen nada: no ocupan espacio ni frenan consultas. El único caso que las vistas **no** cubren es que vos tengas el panel de admin viejo abierto e intentes guardar un producto: te va a dar un error y se soluciona apretando F5.

---

## Mapa del estado actual (lo que no se reconstruye)

```
TABLA                 USO HOY                                QUÉ LE PASA
────────────────────  ─────────────────────────────────────  ──────────────────────────
pizarras              Catálogo de la pizarra                 → RENAME a productos
pizarras_compras      Compras + envío envia.com + tracking    → RENAME a producto_compras
todo lo demás         Curso, alumnos, finanzas, moldes        → INTACTO

ENDPOINT                 USO HOY                             QUÉ LE PASA
───────────────────────  ──────────────────────────────────  ──────────────────────────
api/create-pizarra.js    Checkout MP / transferencia         → shim → create-producto.js
api/pizarra-admin.js     Aprobar + guía envia.com            → shim → producto-admin.js
api/envia-cotizar.js     Cotizar envío + sucursales          → acepta producto_id y pizarra_id
api/envia-webhook.js     Estado del envío                    → apunta a producto_compras
api/_lib/envia.js        Cliente envia.com                   → NO SE TOCA: ya es genérico
                                                               (recibe titulo, precio, peso_kg,
                                                               largo/ancho/alto)
api/_lib/notify.js       Aviso de venta nueva                → NO SE TOCA
api/_lib/cors.js         CORS                                → NO SE TOCA
```

---

## Parte 1 — Categorías y subcategorías de producto

Esto es lo que pediste: *"cada categoría de producto tiene su categoría donde hay productos, por ejemplo donde hay plotters podría estar papel para imprimir y cartuchos"*. Se resuelve con el **mismo patrón que ya funciona en moldes** (`moldes_categorias` / `moldes_subcategorias`).

### Tabla `producto_categorias`

```
COLUMNA               TIPO          DESCRIPCIÓN
────────────────────  ───────────   ──────────────────────────────────────────
id                    uuid          PK
nombre                text          Ej: "Plotters"
slug                  text          único — arma la URL /tienda/plotters
icono                 text          Material Symbols (ej: 'print')
descripcion           text          Bajada para el encabezado de la categoría
color                 text          Color del badge (igual que moldes_categorias)
orden                 integer       Orden en la tienda y en el navbar
activo                boolean       Se muestra en la tienda
visible_en_navbar     boolean       ⭐ Vos elegís cuál aparece en el navbar
eliminado_en          timestamptz  ─┐
eliminado_por         uuid          │ soft delete
eliminado_por_email   text         ─┘
creado_en             timestamptz
actualizado_en        timestamptz   trigger fn_set_actualizado_en
```

### Tabla `producto_subcategorias`

```
COLUMNA               TIPO          DESCRIPCIÓN
────────────────────  ───────────   ──────────────────────────────────────────
id                    uuid          PK
categoria_id          uuid          FK → producto_categorias.id
nombre                text          Ej: "Cartuchos y tintas"
slug                  text
icono                 text
orden                 integer
activo                boolean
eliminado_en          timestamptz  ─┐
eliminado_por         uuid          │ soft delete
eliminado_por_email   text         ─┘
creado_en             timestamptz
```

### Semilla inicial

```
CATEGORÍA      SLUG        ICONO        NAVBAR   SUBCATEGORÍAS
─────────────  ──────────  ───────────  ───────  ─────────────────────────────────────
Pizarras       pizarras    draw         sí       Pizarra digitalizadora
                                                 Accesorios de pizarra
Plotters       plotters    print        sí       Plotters de tizada
                                                 Papel para plotter
                                                 Cartuchos y tintas
                                                 Repuestos
PCs            pcs         computer     no       PCs armadas
                                                 Notebooks
                                                 Periféricos
Accesorios     accesorios  category     no       Insumos de taller
                                                 Herramientas de moldería
```

Todo esto se edita desde el panel: agregás "Mesas de corte" como categoría nueva, la marcás visible en el navbar y aparece sola. Sin deploy.

---

## Parte 2 — Tabla `productos` (ex `pizarras`)

### Columnas que ya existen y se conservan intactas

```
id · titulo · descripcion · especificaciones · precio · stock · activo · orden
peso_kg · alto_cm · ancho_cm · largo_cm          (envia.com)
imagen_1_path · imagen_2_path · imagen_3_path
eliminado_en · eliminado_por · eliminado_por_email
creado_en · actualizado_en                       (trigger fn_set_actualizado_en)
```

**Los ids no cambian.** La pizarra que hoy está publicada sigue siendo la misma fila, con la misma historia de ventas colgando de ella.

### Columnas nuevas

```
COLUMNA            TIPO      DESCRIPCIÓN
─────────────────  ────────  ───────────────────────────────────────────────────
categoria_id       uuid      FK → producto_categorias.id
                             Las filas migradas se setean a la categoría
                             "Pizarras" en el mismo script.
subcategoria_id    uuid      FK → producto_subcategorias.id (nullable)
requiere_envio     boolean   default true. false = no se despacha (licencias,
                             créditos de software): saltea dirección y cotización.
thumb_1_path       text     ─┐ miniaturas para el catálogo — ver Parte 9
thumb_2_path       text      │
thumb_3_path       text     ─┘
```

### Renombres administrativos (metadatos, no mueven datos)

```
pizarras                       → productos
pizarras_publico_idx           → productos_publico_idx
pizarras_admin_idx             → productos_admin_idx
trg_pizarras_actualizado_en    → trg_productos_actualizado_en
pizarras_select_public         → productos_select_public
pizarras_all_authenticated     → productos_all_authenticated
+ índice nuevo: productos_categoria_idx (categoria_id, subcategoria_id, activo, eliminado_en, orden)
```

### RLS — igual que hoy, con el nombre nuevo

```sql
create policy "productos_select_public" on productos for select
  using (activo = true and eliminado_en is null);

create policy "productos_all_authenticated" on productos for all to authenticated
  using (true) with check (true);

grant select on table productos to anon;
grant all    on table productos to authenticated;
```

---

## Parte 3 — Tabla `producto_compras` (ex `pizarras_compras`)

*"que pizarras compras siga por si quieren un envío"* — sí: **toda la maquinaria de envío se conserva tal cual**. Dirección completa, cotización, carrier, service, sucursal, shipment_id, tracking, etiqueta, webhook de estado y el modo "coordinar por WhatsApp". No se toca nada de eso.

### Renombres de columna

```
pizarra_id            → producto_id
titulo_pizarra        → titulo_producto
precio_base_pizarra   → precio_base_producto
```

### Renombre de la constraint FK (detalle que rompe si se olvida)

`api/pizarra-admin.js:66` usa el hint de PostgREST `pizarras!pizarras_compras_pizarra_id_fkey(...)`. Ese texto es el **nombre literal de la constraint**, no el de la tabla: renombrar la tabla no lo cambia. El script incluye:

```sql
alter table producto_compras
  rename constraint pizarras_compras_pizarra_id_fkey to producto_compras_producto_id_fkey;
```

### Columnas nuevas

```
COLUMNA               TIPO           DESCRIPCIÓN
────────────────────  ─────────────  ──────────────────────────────────────────
categoria_producto    text           Snapshot del nombre de la categoría
plan_id               uuid           FK → producto_planes.id (nullable)
titulo_plan           text           Snapshot del nombre del plan
precio_base_plan      numeric(10,2)  Snapshot del precio unitario del plan
cantidad              integer        default 1 — cantidad de créditos/unidades
                                     monto_producto = precio_base_plan × cantidad
```

Los snapshots siguen el mismo criterio que `titulo_molde` en `moldes_compras`: **editar un precio hoy no puede reescribir la historia de una venta de ayer.**

---

## Parte 4 — Tabla `producto_planes`

```
COLUMNA               TIPO           DESCRIPCIÓN
────────────────────  ─────────────  ──────────────────────────────────────────
id                    uuid           PK
producto_id           uuid           FK → productos.id
nombre                text           Ej: "Combo Taller"
descripcion           text           Bajada corta
incluye               text           Un ítem por línea (igual que especificaciones)
precio                numeric(10,2)  Precio unitario
precio_sufijo         text           Ej: "por crédito" · null = precio normal
requiere_envio        boolean        default true — false para "Solo Software"
otorga_creditos       boolean        default false — ⭐ dispara el código de créditos
cantidad_min          integer        default 1   ─┐ rango que puede elegir
cantidad_max          integer        default 1   ─┘ el comprador
destacado             boolean        Resalta la card
orden                 integer
activo                boolean
eliminado_en / eliminado_por / eliminado_por_email    soft delete
creado_en / actualizado_en                            trigger
```

### Semilla inicial — los 4 planes de la pizarra

```
ORDEN  NOMBRE                PRECIO    SUFIJO        ENVÍO  CRÉDITOS  CANT.
─────  ────────────────────  ────────  ────────────  ─────  ────────  ──────
  0    Inicial               $250.000  —             sí     no        1
  1    Combo Taller          $400.000  —             sí     no        1
  2    Fábrica/Profesional   $700.000  —             sí     no        1
  3    Solo Software         $3.000    "por crédito" no     SÍ        1–100
```

Contenido de `incluye` (borrador editable desde el panel, sin deploy):

```
Inicial                Pizarra digitalizadora · Software de digitalización ·
                       Soporte de instalación

Combo Taller           Todo lo del plan Inicial · Curso de moldería digital ·
                       Acompañamiento personalizado

Fábrica/Profesional    Todo lo del Combo Taller · Licencia profesional ·
                       Prioridad en soporte

Solo Software          Acceso al software · Créditos de digitalización ·
                       Sin envío: se entrega por WhatsApp
```

**Los precios y los nombres son exactamente los que me pasaste.** Todo editable después desde `/admin/pizarras → Planes`.

---

## Parte 5 — Créditos de digitalización (tu respuesta a la pregunta 1)

> *"las personas eligen su cantidad de créditos y según eso con algún código que les sirve la cantidad de veces de los créditos, por ejemplo 3 créditos sirven para 3 digitalizaciones"*

### Cómo se ve para el comprador

```
┌──────────────────────────────────────────────────┐
│  Solo Software                                   │
│  $3.000 por crédito                              │
│                                                  │
│  ¿Cuántos créditos querés?                       │
│        [ − ]     3     [ + ]                     │
│                                                  │
│  1 crédito = 1 digitalización                    │
│                                                  │
│  Total: $9.000                                   │
│                                                  │
│  Sin envío — recibís tu código por WhatsApp      │
│  [ Comprar ]                                     │
└──────────────────────────────────────────────────┘
```

Al aprobar el pago, el admin aprieta **"Aprobar y enviar código"** y se abre WhatsApp con el mensaje ya escrito:

```
Hola Ana! ✅ Tu pago fue aprobado.
Tu código de digitalización es:

   MTX-7K4P-9RTX

Te sirve para 3 digitalizaciones.
Gracias por tu compra en Moldi Tex! 🧵
```

### Tabla `digitalizacion_creditos`

```
COLUMNA               TIPO           DESCRIPCIÓN
────────────────────  ─────────────  ──────────────────────────────────────────
id                    uuid           PK
codigo                text           ÚNICO. Formato MTX-XXXX-XXXX, sin caracteres
                                     ambiguos (sin O/0, sin I/1)
compra_id             uuid           FK → producto_compras.id
plan_id               uuid           FK → producto_planes.id
cliente_nombre        text          ─┐
cliente_whatsapp      text           │ snapshot para buscar por cliente
cliente_email         text          ─┘
creditos_total        integer        check > 0
creditos_usados       integer        default 0, check >= 0
creditos_restantes    integer        generated always as (total - usados) stored
estado                text           check ('activo','agotado','anulado')
vence_en              timestamptz    nullable — null = no vence
notas                 text           Notas del admin
eliminado_en / eliminado_por / eliminado_por_email    soft delete
creado_en / actualizado_en
```

### RLS — el código NO es consultable públicamente

```sql
alter table digitalizacion_creditos enable row level security;
create policy "creditos_all_authenticated" on digitalizacion_creditos
  for all to authenticated using (true) with check (true);
revoke all on table digitalizacion_creditos from anon;
```

Si un anónimo pudiera leer la tabla, podría probar códigos hasta encontrar uno válido. La validación de un código se hace **siempre por endpoint** (`service_role`), nunca por consulta directa desde el navegador.

---

## Parte 6 — El gancho de digitalización (tu respuesta a la pregunta 5)

> *"deja el gancho de digitalización y el sector donde debería trabajar él, y dónde puedo ver cada imagen de cada cliente digitalizada"*

**Yo no programo nada de visión por computadora.** Dejo la mesa puesta: las tablas, el bucket privado, los estados, el consumo automático de créditos y la galería donde vos ves el trabajo de cada cliente. El otro programador solo tiene que leer filas, procesar y escribir el resultado.

### Tabla `digitalizaciones`

```
COLUMNA                 TIPO           DESCRIPCIÓN
──────────────────────  ─────────────  ────────────────────────────────────────
id                      uuid           PK
credito_id              uuid           FK → digitalizacion_creditos.id
codigo                  text           Snapshot del código usado
cliente_nombre          text          ─┐
cliente_whatsapp        text           │ snapshot: la galería filtra por cliente
cliente_email           text          ─┘
imagen_original_path    text           Bucket PRIVADO `digitalizaciones`
estado_procesamiento    text           check ('pendiente','procesando',
                                              'procesado','error')
                                       default 'pendiente'
archivo_pdf_path        text           Resultado — lo escribe el otro dev
archivo_dxf_path        text           Resultado — lo escribe el otro dev
archivo_plt_path        text           Resultado — opcional
error_mensaje           text           Qué falló, si falló
parametros              jsonb          Entrada libre para el procesador
                                       (escala, marcadores, DPI, etc.)
resultado_meta          jsonb          Salida libre (piezas detectadas, medidas…)
procesado_en            timestamptz
eliminado_en / eliminado_por / eliminado_por_email    soft delete
creado_en

índice: digitalizaciones_cola_idx (estado_procesamiento, creado_en)
índice: digitalizaciones_cliente_idx (cliente_whatsapp, creado_en desc)
```

### Bucket `digitalizaciones` — PRIVADO

```
BUCKET             VISIBILIDAD   CONTIENE
─────────────────  ────────────  ──────────────────────────────────────────────
digitalizaciones   PRIVADO       {codigo}/{digitalizacion_id}/original.webp
                                 {codigo}/{digitalizacion_id}/molde.pdf
                                 {codigo}/{digitalizacion_id}/molde.dxf

Se accede solo por signed URL, exactamente igual que el bucket
`moldes-archivos` que ya funciona en el módulo de moldes.
```

### Consumo automático del crédito (trigger, para que no dependa de que él se acuerde)

```sql
-- Cuando una digitalización pasa a 'procesado', descuenta un crédito
-- y marca el código como agotado si era el último.
create function fn_consumir_credito() returns trigger ...
create trigger trg_digitalizacion_consume_credito
  after update of estado_procesamiento on digitalizaciones ...
```

Así el descuento de créditos es **responsabilidad de la base de datos**, no del código del otro programador. Si él se olvida de descontar, igual se descuenta. Si el procesamiento falla (`estado = 'error'`), **no** se consume el crédito.

### El contrato para el otro programador (queda escrito en `sql/productos/README.md`)

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

### Dónde ves vos las imágenes digitalizadas de cada cliente

Tab **Digitalizaciones** dentro del sector de Pizarras:

```
┌──────────────────────────────────────────────────────────────────┐
│  /admin/pizarras → Digitalizaciones                              │
│                                                                  │
│  [Todas] [⏳ Pendientes] [⚙ Procesando] [✅ Listas] [⚠ Error]     │
│  🔍 Buscar por cliente, código o WhatsApp                        │
│                                                                  │
│  ┌────────┐  Ana García · +54 11 1234-5678                       │
│  │ imagen │  Código MTX-7K4P-9RTX · quedan 2 de 3 créditos       │
│  │ original│ 16/09/2026 14:32 · ✅ Procesado                     │
│  └────────┘  [ Ver original ] [ ⬇ PDF ] [ ⬇ DXF ]                │
│                                                                  │
│  ┌────────┐  Pedro López · +54 9 8765-4321                       │
│  │ imagen │  Código MTX-2M8Q-5WYZ · quedan 1 de 1 crédito        │
│  └────────┘  16/09/2026 11:15 · ⏳ Pendiente                     │
│              (esperando al procesador)                           │
└──────────────────────────────────────────────────────────────────┘
```

Las descargas son por **signed URL de 24 horas**, el mismo mecanismo probado que usa hoy `api/molde-aprobar.js`.

---

## Parte 7 — Navbar administrable (tu respuesta a la pregunta 3)

> *"quiero poder seleccionar cuál quiero ver visible en el navbar"*

### Tabla `nav_items`

```
COLUMNA                 TIPO          DESCRIPCIÓN
──────────────────────  ───────────   ──────────────────────────────────────────
id                      uuid          PK
label                   text          Texto del link
path                    text          '/tienda/plotters' o 'https://…' si es externo
icono                   text          Material Symbols
categoria_id            uuid          FK → producto_categorias.id (nullable)
                                      Si está seteado, el ítem es el link de esa
                                      categoría y se mantiene sincronizado
orden                   integer
visible                 boolean       default true
abre_en_nueva_pestana   boolean       default false
eliminado_en / eliminado_por / eliminado_por_email    soft delete
creado_en / actualizado_en
```

### Cómo se conecta con las categorías

Hay **una sola lista ordenada** (`nav_items`), para que no existan dos fuentes de verdad peleándose por el orden:

```
En el admin de categorías, el switch "Mostrar en el navbar":
  ON  → crea (o vuelve visible) el nav_item de esa categoría
  OFF → lo marca visible = false, sin borrarlo ni perder su posición

En /admin/navegacion ves TODOS los ítems juntos —los fijos y los de
categoría— y los ordenás arrastrando o con las flechas ↑ ↓.
```

### Semilla — los links de hoy (`Navbar.jsx:6-13`) más la tienda

```
ORDEN  LABEL         PATH                  ICONO        ORIGEN
─────  ────────────  ────────────────────  ───────────  ──────────────
  0    Inicio        /                     home         fijo
  1    Programa      /temario              tactic       fijo
  2    Beneficios    /ventajas             star         fijo
  3    Moldes        /moldes               straighten   fijo
  4    Tienda        /tienda               storefront   fijo
  5    Pizarras      /pizarras             draw         categoría
  6    Plotters      /tienda/plotters      print        categoría
  7    Inscribirse   /inscripcion          payments     fijo
```

### Fallback (no negociable)

`Navbar.jsx` conserva el array `NAV_LINKS` actual **como constante en el código**, y lo usa mientras la consulta está en vuelo o si Supabase falla. **Nunca hay un instante con la navbar vacía.** La barra inferior mobile de estudiante/admin y el botón flotante de WhatsApp no se tocan.

---

## Parte 8 — Historial de stock

```
COLUMNA               TIPO          DESCRIPCIÓN
────────────────────  ───────────   ──────────────────────────────────────────
id                    uuid          PK
producto_id           uuid          FK → productos.id
tipo                  text          check ('entrada','salida','ajuste')
cantidad              integer       siempre > 0; el signo lo da `tipo`
stock_resultante      integer       Foto del stock después del movimiento
motivo                text          'Venta aprobada' | texto libre del admin
compra_id             uuid          FK → producto_compras.id (nullable)
fecha                 date          default current_date
creado_por            uuid
creado_por_email      text
creado_en             timestamptz
eliminado_en / eliminado_por / eliminado_por_email    soft delete
```

```
TIPO      ORIGEN                                     CUÁNDO
────────  ─────────────────────────────────────────  ──────────────────────────
salida    api/producto-admin.js → acción 'aprobar'   Automático, en el mismo
                                                     lugar donde HOY ya se
                                                     descuenta el stock
                                                     (pizarra-admin.js:25-30)
entrada   Admin, a mano                               Reposición de mercadería
ajuste    Admin, a mano                               Rotura, devolución, conteo
```

La salida automática **no bloquea la aprobación si falla**, igual que hoy: una venta aprobada nunca se cae por un problema de log de inventario.

**RLS: esta tabla no es pública.** `revoke all ... from anon`. El inventario y el ritmo de ventas no son información para visitantes.

---

## Parte 9 — Imágenes: menos espacio y más orden (tu pedido + pregunta 2)

### Un solo bucket, con carpetas

```
BUCKET               VISIBILIDAD   CONVENCIÓN DE PATHS
───────────────────  ────────────  ────────────────────────────────────────────
productos-imagenes   PÚBLICO       {categoria-slug}/{producto_id}/img_1.webp
                                   {categoria-slug}/{producto_id}/thumb_1.webp
                                   límite 2 MB · jpeg, png, webp

pizarras-imagenes    PÚBLICO       Queda vivo unos días con las fotos actuales,
                                   y se borra en el script de limpieza final.
```

Nada de una columna `imagen_bucket` ni de dos buckets conviviendo para siempre: **un bucket, carpeta por categoría, y el bucket viejo se elimina al final.**

### Compresión: WebP + miniatura

Hoy `src/utils/imageCompression.js` genera **JPEG 1200px calidad 80 (~150–250 KB)** y esa misma imagen pesada se usa tanto en el detalle como en las tarjetas del catálogo.

```
                     HOY                      NUEVO
─────────────────    ──────────────────────   ────────────────────────────────
Formato              JPEG                     WebP (JPEG si el navegador
                                              no sabe generar WebP)
Imagen de detalle    1200px · q0.80           1200px · q0.72
                     ~150–250 KB              ~70–110 KB
Miniatura            no existe                480px · q0.70 → ~15–25 KB
Por slot                  ~250 KB                  ~135 KB
Producto de 3 fotos       ~750 KB                  ~400 KB   (≈ 45% menos)

Catálogo con 12 productos visibles:
  hoy   12 × 250 KB = ~3 MB de descarga
  nuevo 12 ×  25 KB = ~300 KB   (10× más liviano para el cliente)
```

Con ~400 KB por producto, el plan gratuito de Supabase (500 MB) da para **más de 1.000 productos** con sus tres fotos cada uno.

### Detalles de implementación

```
1. NO se toca `compressImage()`.
   La usan MoldesAdminPage, PizarrasAdminPage y FinanzasPage. Se quedan
   exactamente como están. Se AGREGAN dos funciones nuevas en el mismo archivo:
       comprimirWeb(file)   → imagen de detalle (WebP 1200px)
       generarThumb(file)   → miniatura (WebP 480px)

2. Detección de WebP antes de usarlo.
   `canvas.toBlob(cb, 'image/webp', q)` en un navegador que no lo soporta
   devuelve un PNG silenciosamente — que pesa MÁS que el JPEG original.
   Se detecta con toDataURL('image/webp') y, si no hay soporte, se cae a JPEG.

3. Reemplazo limpio.
   Los paths son deterministas, así que subir una foto nueva pisa la anterior
   (`upsert: true`) y no deja basura acumulándose en el storage.

4. Transición de las 3 fotos que ya existen.
   `imgUrl()` mira la forma del path: los viejos (`{id}/img_1.jpg`) se sirven
   del bucket viejo; los nuevos (`{categoria}/{id}/img_1.webp`) del nuevo.
   Son 4 líneas, se borran en la limpieza final.
   Vos, cuando quieras, volvés a subir esas 3 fotos desde el panel y quedan
   convertidas a WebP con miniatura. No hay apuro ni se ve nada roto.
```

---

## Parte 10 — Scripts SQL (orden de ejecución obligatorio)

Van en `sql/productos/`, con la misma cabecera y estilo que `sql/moldes/` y `sql/pizarras/`.

```
ORDEN  SCRIPT                          QUÉ HACE                                    REVERSIBLE
─────  ──────────────────────────────  ──────────────────────────────────────────  ──────────
  00   00_verificacion_previa.sql      NO MUTA NADA. Versión de PostgreSQL,        n/a
                                       conteo de filas, policies, índices y
                                       constraints actuales, para comparar después.

  01   01_categorias.sql               producto_categorias + producto_subcategorias sí (drop)
                                       + RLS + trigger + semilla (4 categorías,
                                       11 subcategorías)

  02   02_productos.sql                rename pizarras → productos                  sí
                                       + categoria_id, subcategoria_id,
                                         requiere_envio, thumb_1/2/3_path
                                       + asigna la categoría "Pizarras" a las
                                         filas existentes
                                       + rename de índices, trigger y policies
                                       + create view pizarras (compat)

  03   03_producto_compras.sql         rename pizarras_compras → producto_compras   sí
                                       + rename de las 3 columnas
                                       + rename de la constraint FK
                                       + categoria_producto, cantidad
                                       + rename de índices
                                       + create view pizarras_compras (compat)

  04   04_producto_planes.sql          producto_planes + RLS + trigger              sí (drop)
                                       + semilla de los 4 planes
                                       + plan_id, titulo_plan, precio_base_plan
                                         en producto_compras + índice

  05   05_creditos.sql                 digitalizacion_creditos + generador de       sí (drop)
                                       códigos MTX-XXXX-XXXX + trigger de estado
                                       + RLS (sin anon)
                                       [Etapa 2 — sin esto no hay código que
                                        entregar al vender "Solo Software"]

  06   06_nav_items.sql                nav_items + RLS + trigger                    sí (drop)
                                       + semilla de los 8 links

  07   07_storage_productos.sql        bucket productos-imagenes (público)          sí
                                       + sus policies

  08   08_movimientos_stock.sql        movimientos_stock + RLS (sin anon)           sí (drop)
                                       + índices

  09   09_digitalizaciones.sql         cola de digitalizaciones + bucket PRIVADO    sí (drop)
                                       + trigger que consume créditos
                                       + índices de cola y cliente

  10   10_drop_vistas_compat.sql       ⚠ FUERA DE ORDEN A PROPÓSITO: se corre a     —
                                       las 24–48 hs de la Etapa 1, con el
                                       checkpoint 1 ya verificado. No espera a
                                       los scripts 06-09.
                                       drop view pizarras, pizarras_compras

  11   11_limpieza_bucket_viejo.sql    ⚠ AL FINAL, cuando ya resubiste las fotos.   —
                                       Borra el bucket pizarras-imagenes.
```

### Rollback

Si algo sale mal después de 02 o 03, se vuelve con renombres inversos más el `drop` de las columnas nuevas. Las columnas agregadas son nullable o tienen default, así que **ninguna fila se pierde en ninguna de las dos direcciones**. No hay un solo `drop table` ni `delete` en todo el plan.

---

## Parte 11 — Backend

### Archivos nuevos

```
api/create-producto.js     Generalización de create-pizarra.js
                           Body: { producto_id, plan_id?, cantidad?, comprador,
                                   envio, metodo, metodo_envio, sucursal }
                           · Lee de `productos`
                           · Valida que el plan pertenezca al producto, esté
                             activo y que `cantidad` esté dentro de
                             cantidad_min..cantidad_max
                           · El precio sale del PLAN × cantidad, no del producto
                           · Si requiere_envio = false: no exige dirección,
                             monto_envio = 0, no cotiza
                           · Guarda todos los snapshots
                           · Descuento por transferencia: misma clave de
                             app_settings de hoy. No se crea ninguna clave nueva.

api/producto-admin.js      Generalización de pizarra-admin.js
                           Acciones: 'aprobar' | 'generar-envio'
                           · aprobar: estado + descuento de stock
                             + movimiento de stock (salida)
                             + finanzas_movimientos con 'Venta de producto'
                             + si el plan otorga créditos: GENERA EL CÓDIGO
                               y lo devuelve para el mensaje de WhatsApp
                           · generar-envio: igual que hoy, con el hint de FK nuevo

api/digitalizacion.js      Endpoint del gancho (sin lógica de imagen)
                           · 'validar-codigo': dice si un código existe y cuántos
                             créditos le quedan (sin exponer la tabla al público)
                           · 'crear': registra una digitalización 'pendiente' y
                             devuelve la URL firmada para subir la foto
                           Si el otro programador prefiere otro contrato, se
                           adapta: la tabla es lo que importa.
```

### Archivos modificados (mínimo indispensable)

```
ARCHIVO                  QUÉ CAMBIA                                    RIESGO
───────────────────────  ────────────────────────────────────────────  ──────────
api/create-pizarra.js    Pasa a ser un shim de ~10 líneas que reenvía  Bajo
                         a create-producto (pizarra_id → producto_id)
api/pizarra-admin.js     Idem → producto-admin.js                      Bajo
api/envia-cotizar.js     Acepta producto_id y sigue aceptando          Bajo
                         pizarra_id. Lee de `productos`.
api/envia-webhook.js     Apunta a producto_compras                     Bajo
```

---

## Parte 12 — Frontend

### El sector aparte de Pizarras (tu pedido)

> *"por más que esté dentro de productos, luego tenga un sector aparte, porque la lógica de digitalización la hace el programador encargado"*

```
/admin/productos    →  TODO el catálogo: categorías, subcategorías, productos
                       de cualquier tipo, stock y ventas generales.

/admin/pizarras     →  SECTOR PROPIO de la pizarra digitalizadora:
                       ├── Planes            (los 4 planes y sus precios)
                       ├── Ventas            (compras de pizarra + envíos)
                       ├── Créditos          (códigos emitidos y su consumo)
                       └── Digitalizaciones  (la galería por cliente) ⭐
                       Acá es donde se enchufa el trabajo del otro programador,
                       sin mezclarse con el resto del catálogo.
```

Los datos viven en `productos` (una sola fuente), pero la pantalla es propia.

### Archivos nuevos

```
src/pages/admin/ProductosAdminPage.jsx     4 tabs: Categorías · Productos ·
                                           Stock · Ventas
src/pages/admin/NavegacionPage.jsx         CRUD de nav_items + reordenar
src/pages/TiendaPage.jsx                   Tienda pública (/tienda y
                                           /tienda/:categoria)
src/components/ProductoCompraModal.jsx     Modal de compra extraído de
                                           PizarrasPage (ver abajo)
src/components/SelectorCreditos.jsx        Selector − / N / + con total en vivo
```

### El modal de compra se EXTRAE, no se reescribe

El flujo actual (detalle → datos → método de envío → cotización → pago → verificación) es **código probado en producción con plata real**. Se mueve tal cual de `PizarrasPage.jsx` a `ProductoCompraModal.jsx`, con los mismos textos, el mismo `normalizeWhatsapp`, la misma `PantallaVerificacion`. Se le agregan dos ramas: plan elegido y cantidad de créditos. **Cero lógica de compra duplicada:** lo usan `/pizarras` y `/tienda`.

### `TiendaPage.jsx`

```
┌──────────────────────────────────────────────────────────────┐
│  Todo para tu taller de moldería                             │
├──────────────────────────────────────────────────────────────┤
│  [Todo] [Pizarras] [Plotters] [PCs] [Accesorios]   ← categorías
│         └─ al elegir Plotters aparecen sus subcategorías:    │
│            [Todos] [Plotters de tizada] [Papel] [Cartuchos]  │
│                                                              │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   ← grid con MINIATURAS │
│  └──────┘ └──────┘ └──────┘ └──────┘                         │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────────────┐ ┌────────────────────────┐       │
│  │ 📐 Moldes Audaces      │ │ 🎓 Curso de Moldería   │       │
│  │ → /moldes              │ │ → /inscripcion         │       │
│  └────────────────────────┘ └────────────────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

### Archivos modificados

```
ARCHIVO                                QUÉ CAMBIA
─────────────────────────────────────  ──────────────────────────────────────────
src/App.jsx                            + /tienda y /tienda/:categoria (lazy)
                                       + /admin/productos, /admin/navegacion
                                       /pizarras y /admin/pizarras SE QUEDAN

src/components/Navbar.jsx              NAV_LINKS pasa de fuente a FALLBACK;
                                       trae nav_items de Supabase

src/pages/PizarrasPage.jsx             Lee de `productos` (categoría pizarras)
                                       + sección de PLANES con selector de créditos
                                       Hero, ventajas, textos e imagen: INTACTOS

src/utils/imageCompression.js          + comprimirWeb() y generarThumb()
                                       compressImage() NO SE TOCA

src/pages/admin/AdminLayout.jsx        "Pizarras" queda + "Productos" (inventory_2)
                                       + "Navegación" (menu)

src/pages/admin/PizarrasAdminPage.jsx  Se convierte en el sector propio:
                                       Planes · Ventas · Créditos · Digitalizaciones

src/pages/admin/PapeleraPage.jsx       + 8 tabs (mismo array declarativo):
                                       Productos, Categorías, Subcategorías,
                                       Planes, Compras prod., Stock, Navegación,
                                       Digitalizaciones

src/pages/admin/FinanzasPage.jsx       + 'Venta de producto' en CATEGORIAS.ingreso
                                       (UNA línea — nada más)

public/sitemap.xml                     + /tienda, /moldes, /pizarras (hoy faltan)
```

### Nota sobre Finanzas

`FinanzasPage` ya maneja deudas (`ingreso` + `tiene_deuda` = "me deben"). **No se crea ningún módulo ni tabla de finanzas.**

Dato que encontré leyendo el código: hoy `api/pizarra-admin.js:42` inserta movimientos con `categoria = 'Venta de pizarra digitalizadora'`, un string que **no existe** en `CATEGORIAS.ingreso` ([FinanzasPage.jsx:8](src/pages/admin/FinanzasPage.jsx#L8)). Esas ventas se ven en la tabla pero no se pueden filtrar desde el desplegable. Propongo agregar las dos (`'Venta de producto'` y `'Venta de pizarra digitalizadora'`) para que el histórico quede filtrable. **Ningún movimiento existente se edita.**

---

## Parte 13 — Orden de trabajo y checkpoints

Cada etapa termina en un checkpoint. **No arranco la siguiente hasta que verifiques la anterior en producción.**

### Etapa 1 — Categorías + migración de productos y compras

```
1. Correr 00 (verificación) y pasarme la salida
2. Correr 01, 02, 03
3. Deploy backend: create-producto, producto-admin, shims, envia-*
4. Deploy frontend mínimo: PizarrasPage y el admin leyendo de las tablas nuevas

CHECKPOINT 1 — verificar en producción:
  □ /pizarras muestra la pizarra, con imagen y precio
  □ Cotización de envío con una dirección real devuelve opciones
  □ Compra de prueba por TRANSFERENCIA → aparece en el admin
  □ Compra de prueba por MERCADOPAGO (test_mode_mp) → vuelve bien
  □ Aprobar → descuenta stock, entra en Finanzas, abre WhatsApp
  □ Generar guía de envia.com sobre una compra aprobada
  □ ⭐ /admin/estudiantes carga y se puede editar un alumno
  □ ⭐ /admin/finanzas carga, los totales dan igual que antes,
       se puede cargar un movimiento y un abono
  □ /admin/moldes sigue funcionando
  □ Papelera: mandar un producto a la papelera y restaurarlo
```

### Etapa 2 — Planes + créditos

```
Correr 04 y 05 → tab Planes → sección de planes en /pizarras → selector de créditos

CHECKPOINT 2:
  □ Los 4 planes aparecen con sus precios
  □ Editar un precio desde el admin se refleja sin deploy
  □ "Combo Taller" cobra $400.000, no el precio del producto
  □ "Solo Software" no pide dirección de envío
  □ Elegir 3 créditos cobra $9.000
  □ Al aprobar, se genera el código y el WhatsApp lo incluye
```

### Etapa 3 — Navbar administrable

```
Correr 06 → NavegacionPage → Navbar dinámica

CHECKPOINT 3:
  □ La navbar se ve igual que hoy
  □ Ocultar una categoría del navbar la saca del sitio
  □ Reordenar funciona en desktop y en mobile
  □ Con la red cortada (DevTools → Offline) aparece el fallback
```

### Etapa 4 — Tienda unificada

```
CHECKPOINT 4:
  □ Filtro por categoría y subcategoría
  □ Comprar desde /tienda usa el mismo flujo que /pizarras
  □ Los accesos a /moldes y /inscripcion funcionan
  □ Las tarjetas cargan miniaturas (verificar peso en DevTools → Network)
```

### Etapa 5 — Stock

```
Correr 08

CHECKPOINT 5:
  □ Aprobar una venta genera un movimiento 'salida' con su compra_id
  □ Una entrada manual actualiza el stock
  □ Un ajuste no deja el stock por debajo de 0
```

### Etapa 6 — Gancho de digitalización

```
Correr 09 → tab Digitalizaciones (el tab Créditos ya existe desde la Etapa 2)

CHECKPOINT 6:
  □ Los códigos emitidos aparecen con sus créditos restantes
  □ Cargando una digitalización de prueba a mano, aparece en la galería
    como 'pendiente'
  □ Pasándola a 'procesado' a mano, el crédito se descuenta solo
  □ El README del contrato queda en sql/productos/
```

### Etapa 7 — Categoría en Finanzas

```
CHECKPOINT 7:
  □ 'Venta de producto' aparece en el desplegable y en los filtros
  □ Los movimientos viejos siguen visibles e intactos
```

### Etapa 8 — Cargar plotters y PCs reales

```
Sin código nuevo: se cargan desde el panel con su categoría, subcategoría,
fotos, stock y dimensiones de envío.

CHECKPOINT 8:
  □ Un plotter se compra de punta a punta con cotización real
  □ El papel y los cartuchos aparecen dentro de Plotters
```

### Etapa 9 — Limpieza

```
□ Correr 10 (drop de las vistas de compatibilidad) — en realidad esto va
  a las 24-48 hs de la Etapa 1, no acá
□ Volver a subir las 3 fotos de la pizarra para que queden en WebP
□ Correr 11 (borrar el bucket viejo)
□ Reducir los shims de los endpoints viejos
```

---

## Decisiones de diseño

| Decisión | Por qué |
|---|---|
| Categorías y subcategorías como **tablas**, no como lista fija en el código | Podés agregar "Mesas de corte" o "Cartuchos" desde el panel, sin esperar un deploy. Y reusa el patrón de `moldes_categorias` que ya funciona acá. |
| `alter table rename` en vez de tabla nueva + copia | Conserva ids, FKs, índices, policies y triggers. Instantáneo y reversible. Y cumple con "no dejes las dos tablas en paralelo". |
| Vistas de compatibilidad por 24–48 hs | El deploy y la migración no son simultáneos. Sin la red, un cliente con la página cacheada ve el catálogo vacío. Con tu tráfico, dos días sobran. |
| Shims en los endpoints viejos | Misma red, del lado del POST: ninguna compra se pierde. Cuestan 10 líneas cada uno. |
| Un solo bucket con carpeta por categoría | Lo pediste: más ordenado y menos lugar. Sin columna extra ni dos buckets conviviendo. |
| WebP + miniatura separada | El catálogo baja de ~3 MB a ~300 KB por pantalla, y el storage cae ~45%. Es donde más se nota. |
| `compressImage()` no se toca | La usan moldes y finanzas. Se agregan funciones nuevas al lado en vez de modificar la que ya anda. |
| Detección de soporte WebP | Un navegador sin WebP devuelve PNG en silencio, que pesa **más** que el JPEG. Sin la detección, "optimizar" empeoraría las cosas. |
| El precio del plan manda sobre el del producto | El producto queda como "precio desde"; se cobra lo que el comprador eligió. |
| `cantidad` en la compra + `cantidad_min/max` en el plan | Es lo que hace posible "elijo 3 créditos y pago $9.000" sin inventar una tabla aparte. |
| Créditos consumidos por **trigger** de base de datos | Si el otro programador se olvida de descontar, se descuenta igual. Y si el proceso falla, no se consume. |
| El código de créditos no es legible por `anon` | Si no, cualquiera podría probar códigos hasta pegarle a uno válido. La validación va por endpoint. |
| Bucket de digitalizaciones **privado** con signed URLs | Son moldes de tus clientes: su trabajo, no contenido público. Mismo mecanismo que `moldes-archivos`. |
| Pizarras con sector propio en el admin | Ahí se enchufa la digitalización sin ensuciar el catálogo general, y vos entrás a un solo lugar a ver códigos, ventas y trabajos. |
| `movimientos_stock` sin acceso `anon` | El inventario y el ritmo de ventas no son públicos. |
| La salida de stock no bloquea la aprobación | Igual que hoy: una venta aprobada no se cae por un problema de log. |
| `NAV_LINKS` sobrevive como fallback | Un error de red no puede dejar el sitio sin navegación. |
| El modal de compra se extrae, no se reescribe | Es código probado con plata real. Se mueve de archivo y se le agregan dos props. |
| `/pizarras` y `/admin/pizarras` se conservan | Links guardados, SEO y tus favoritos del panel. |
| Ningún `drop table` ni `delete` en todo el plan | Todo se revierte con un rename inverso. |

---

## Lo que sigue fuera de alcance

**No programo nada de procesamiento de imagen**: ni detección de marcadores ArUco, ni generación de DXF/PDF/PLT, ni visión por computadora. Eso lo hace el programador encargado.

Lo que sí queda hecho y esperándolo: las tablas, el bucket privado, los estados, el descuento automático de créditos, el contrato escrito en `sql/productos/README.md` y la galería donde vos ves cada imagen digitalizada de cada cliente con su PDF y su DXF para descargar.

---

*Documento actualizado el 16/09/2026 — Moldi Tex · Pendiente de aprobación*
