# Plan de Implementación — Sistema de Venta de Moldes Audaces

---

## Resumen General

Módulo completo de venta de moldes con **dos métodos de pago** (MercadoPago y Transferencia bancaria con descuento configurable). **Todo pago, sin excepción, queda en estado "En verificación"** hasta que el admin lo aprueba manualmente. Al aprobar, con un solo click se genera el mensaje de WhatsApp con los links de descarga listos para enviar al comprador.

---

## Flujo Universal (igual para MP y Transferencia)

```
COMPRADOR                    ADMIN                        SISTEMA
──────────                   ─────                        ───────
1. Elige molde
   Completa datos
   Elige método de pago
   Paga / Confirma

2. Ve pantalla:                                           3. Crea registro en
   "✅ Recibimos tu pago                                     moldes_compras
    Tu pedido está                                           estado = 'en_verificacion'
    en verificación.
    Te enviaremos los                                     4. Inserta en
    archivos por WhatsApp                                    finanzas_movimientos
    una vez confirmado."                                     como deuda pendiente

                             5. Ve en /admin/moldes
                                tab "Ventas" la compra
                                con estado 🔵 En verificación

                             6. Verifica el pago en
                                su cuenta de MP
                                o en su banco

                             7. Click "✅ Aprobar y enviar"
                                                          8. Genera signed URLs
                                                             (24 horas de validez)

                                                          9. Actualiza estado
                                                             → 'aprobado'
                                                          10. Actualiza finanzas
                                                              → pago completo

                             11. Se abre WhatsApp con
                                 el mensaje y los links
                                 ya redactados, listo
                                 para enviar con un tap

12. Recibe el WhatsApp
    con los links de
    descarga
    Descarga los archivos
```

---

## Estados de una Compra

```
ESTADO                  QUIÉN LO SETEA    DESCRIPCIÓN
──────────────────────  ────────────────  ──────────────────────────────────────────
en_verificacion         Sistema           Se setea automáticamente al crear la compra,
                                          sin importar si fue MP o transferencia.
                                          El admin debe verificar y aprobar.

aprobado                Admin (manual)    El admin verificó el pago y clickeó
                                          "Aprobar y enviar". Se generan los links.

rechazado               Admin (manual)    El admin rechazó la compra (pago falló,
                                          comprobante inválido, etc.). Se puede
                                          agregar una nota de motivo.
```

No hay un estado "pendiente" intermedio ni verificación automática vía API de MP. El admin siempre aprueba.

---

## Parte 1 — Configuración en Admin (app_settings)

Nuevas claves editables desde `ConfiguracionPage.jsx`:

```
CLAVE                              TIPO    DESCRIPCIÓN
─────────────────────────────────  ──────  ────────────────────────────────────────────
moldes_cbu                         text    CBU de la cuenta bancaria
moldes_alias                       text    Alias de la cuenta bancaria
moldes_titular                     text    Nombre del titular de la cuenta
moldes_banco                       text    Nombre del banco (Ej: "Banco Galicia")
moldes_descuento_transferencia     number  % de descuento por pagar con transferencia
                                           0 → desactiva la opción de transferencia
moldes_whatsapp_comprobante        text    WhatsApp del admin para recibir comprobantes
                                           y desde donde se envían los links
```

### Sección nueva en ConfiguracionPage — "Moldes y Pagos"

```
┌──────────────────────────────────────────────────────┐
│  💳 Moldes — Métodos de Pago                         │
├──────────────────────────────────────────────────────┤
│  CBU *                                               │
│  [____________________________________]              │
│                                                      │
│  Alias *                                             │
│  [____________________________________]              │
│                                                      │
│  Titular de la cuenta *                              │
│  [____________________________________]              │
│                                                      │
│  Banco                                               │
│  [____________________________________]              │
│                                                      │
│  Descuento por transferencia (%)                     │
│  [10]  ← 0 = desactiva la opción de transferencia   │
│                                                      │
│  WhatsApp para comprobantes y envío de links *       │
│  [5491162020911]                                     │
│  (sin + ni espacios, solo números)                   │
│                                                      │
│  Vista previa: $3.500 → con transferencia $3.150     │
└──────────────────────────────────────────────────────┘
```

---

## Parte 2 — Base de Datos (Supabase SQL Editor)

**5 scripts SQL** en orden de ejecución obligatorio: A → B → C → D → E

---

### Script A — Tabla `moldes_categorias`

```
COLUMNA               TIPO          DESCRIPCIÓN
─────────────────     ───────────   ──────────────────────────────────────
id                    uuid          Clave primaria automática
nombre                text          Ej: "Mujer", "Bebés", "Niños"
slug                  text          Ej: "mujer", "bebes", "ninos"
icono                 text          Nombre de ícono Material Symbols
color                 text          Color CSS del badge
orden                 integer       Orden en el filtro público
activo                boolean
eliminado_en          timestamptz   Soft delete
eliminado_por         uuid
eliminado_por_email   text
creado_en             timestamptz
```

**Categorías iniciales:** Mujer · Varón · Niñas · Niños · Nenas · Nenes · Bebés

---

### Script B — Tabla `moldes_subcategorias`

```
COLUMNA               TIPO          DESCRIPCIÓN
─────────────────     ───────────   ──────────────────────────────────────
id                    uuid
categoria_id          uuid          FK → moldes_categorias.id
nombre                text          Ej: "Pantalones", "Buzos"
slug                  text
orden                 integer
activo                boolean
eliminado_en          timestamptz   Soft delete
eliminado_por         uuid
eliminado_por_email   text
creado_en             timestamptz
```

**Subcategorías iniciales por categoría:**

```
Mujer   → Pantalones, Buzos, Vestidos, Camisas, Faldas
Varón   → Pantalones, Remeras, Camisas, Camperas
Niñas   → Vestidos, Pantalones, Buzos
Niños   → Pantalones, Remeras, Buzos
Nenas   → Vestidos, Conjuntos
Nenes   → Pantalones, Conjuntos
Bebés   → Bodies, Ajuares, Mamelucos
```

---

### Script C — Tabla `moldes`

```
COLUMNA               TIPO          DESCRIPCIÓN
─────────────────     ───────────   ──────────────────────────────────────
id                    uuid
categoria_id          uuid          FK → moldes_categorias.id
subcategoria_id       uuid          FK → moldes_subcategorias.id (opcional)
titulo                text
descripcion           text
precio                numeric       Precio base en ARS
activo                boolean
orden                 integer
archivo_ads_path      text          Storage privado (.ads)
archivo_pdf_path      text          Storage privado (PDF, opcional)
imagen_1_path         text          Storage público
imagen_2_path         text          Storage público (opcional)
imagen_3_path         text          Storage público (opcional)
eliminado_en          timestamptz   Soft delete
eliminado_por         uuid
eliminado_por_email   text
creado_en             timestamptz
actualizado_en        timestamptz
```

---

### Script D — Tabla `moldes_compras`

```
COLUMNA                  TIPO          DESCRIPCIÓN
──────────────────────   ───────────   ────────────────────────────────────────────
id                       uuid

── PRODUCTO ──────────────────────────────────────────────────────────────────────
molde_id                 uuid          FK → moldes.id
categoria_id             uuid          Desnormalizado para reportes
subcategoria_id          uuid          Desnormalizado para reportes
titulo_molde             text          Snapshot del título al momento de la compra
precio_base_molde        numeric       Precio de lista al momento de la compra
descuento_aplicado_pct   numeric       % de descuento (0 si MP, N si transferencia)
monto_cobrado            numeric       Precio final que paga el comprador

── MÉTODO Y ESTADO DE PAGO ───────────────────────────────────────────────────────
metodo_pago              text          'mercadopago' | 'transferencia'
mp_preference_id         text          ID de preferencia MP (solo si fue MP)
mp_payment_id            text          ID del pago MP (solo si fue MP)
estado                   text          'en_verificacion' | 'aprobado' | 'rechazado'
rechazo_motivo           text          Nota del admin al rechazar (opcional)

── DATOS DEL COMPRADOR ───────────────────────────────────────────────────────────
nombre                   text
email                    text
whatsapp                 text          Con código de país: +54 11 12345678
provincia                text
ciudad                   text
como_llego               text          'instagram'|'google'|'referido'|'whatsapp'|'otro'
como_llego_detalle       text          Campo libre si eligió "otro"

── METADATA ──────────────────────────────────────────────────────────────────────
creado_en                timestamptz
ip_hash                  text
user_agent_resumen       text          'mobile-android' | 'desktop-windows' | etc.
finanzas_mov_id          uuid          FK → finanzas_movimientos.id

── SOFT DELETE ───────────────────────────────────────────────────────────────────
eliminado_en             timestamptz
eliminado_por            uuid
eliminado_por_email      text
```

**Tabla de estados:**

```
MÉTODO          ESTADO INICIAL      ESTADO FINAL (admin)
──────────────  ──────────────────  ──────────────────────────
MercadoPago     en_verificacion     aprobado / rechazado
Transferencia   en_verificacion     aprobado / rechazado
```

---

### Script E — Storage Buckets y Políticas

```
BUCKET              VISIBILIDAD   CONTIENE
──────────────────  ────────────  ──────────────────────────────────────────
moldes-imagenes     PÚBLICO       Fotos de preview comprimidas (< 250KB)
moldes-archivos     PRIVADO       Archivos .ads y PDFs (solo via signed URL)
```

---

## Parte 3 — Flujo Detallado por Método de Pago

### 3.1 — MercadoPago

```
1. Usuario elige "MercadoPago" → precio normal → completa datos
   → click "Ir a MercadoPago"
   → POST /api/create-molde-preference
   → Backend crea preferencia MP + inserta compra con estado='en_verificacion'
   → Redirige al checkout de MP

2. Usuario paga en MP
   → MP redirige a /moldes?status=approved&mp_payment_id=X&molde_id=Y&compra_id=Z
   → (o /moldes?status=failure si falló)

3. Frontend detecta parámetros → actualiza compra con mp_payment_id si llegó
   → Muestra pantalla de confirmación (NO entrega archivos todavía):

   ┌──────────────────────────────────────────┐
   │  ✅ ¡Gracias! Recibimos tu pago          │
   │                                          │
   │  Camisa básica hombre · Mujer › Camisas  │
   │  Pagado con MercadoPago                  │
   │                                          │
   │  🔵 Tu pedido está en verificación       │
   │                                          │
   │  Una vez que confirmemos el pago         │
   │  te enviamos los archivos por            │
   │  WhatsApp al: +54 11 ****-5678           │
   │                                          │
   │  ¿Dudas? Escribinos →                    │
   │  [Contactar por WhatsApp]                │
   └──────────────────────────────────────────┘

4. Admin ve la compra en el tab "Ventas" con:
   🔵 En verificación · MercadoPago · $3.500
   Verifica en su cuenta de MP que el pago llegó
   → Click "✅ Aprobar y enviar"
```

---

### 3.2 — Transferencia Bancaria

```
1. Usuario elige "Transferencia" → precio con descuento → completa datos
   → click "Confirmar compra"
   → POST /api/create-molde-transferencia
   → Backend inserta compra con estado='en_verificacion'
   → Muestra instrucciones de transferencia:

   ┌──────────────────────────────────────────┐
   │  🏦 Realizá la transferencia             │
   │                                          │
   │  Monto: $3.150  (10% de descuento)       │
   │                                          │
   │  CBU:     [moldes_cbu]                   │
   │  Alias:   [moldes_alias]                 │
   │  Titular: [moldes_titular]               │
   │  Banco:   [moldes_banco]                 │
   │                                          │
   │  Una vez transferido, envianos el        │
   │  comprobante por WhatsApp:               │
   │                                          │
   │  [📲 Enviar comprobante por WhatsApp →]  │
   │                                          │
   │  🔵 Tu pedido quedará en verificación    │
   │  hasta confirmar el pago.                │
   └──────────────────────────────────────────┘

   El botón WhatsApp abre:
   wa.me/{moldes_whatsapp_comprobante}?text=
   "Hola! Hice la transferencia por el molde
   [titulo] - $3.150.
   Nombre: [nombre]. Email: [email].
   Te adjunto el comprobante."

2. Admin ve la compra en el tab "Ventas":
   🔵 En verificación · Transferencia · $3.150
   Verifica en su banco que el dinero llegó
   → Click "✅ Aprobar y enviar"
```

---

## Parte 4 — Acción "Aprobar y enviar" (Admin)

Este es el momento central del flujo. El admin hace un solo click que encadena todo:

```
ADMIN CLICK                SISTEMA                           RESULTADO
"✅ Aprobar y enviar"
                           1. POST /api/molde-aprobar
                              { compra_id }

                           2. Actualiza moldes_compras:
                              estado = 'aprobado'

                           3. Genera signed URLs en Supabase
                              Storage (validez: 24 horas):
                              • URL del archivo .ads
                              • URL del PDF (si existe)
                              • Las imágenes son públicas,
                                no necesitan signed URL

                           4. Actualiza finanzas_movimientos:
                              deuda_restante = 0
                              monto_pagado = monto_cobrado

                           5. Devuelve al frontend:
                              { ads_url, pdf_url, imagenes[] }

                           6. Frontend construye el mensaje
                              de WhatsApp y abre wa.me:

   wa.me/{whatsapp_comprador}?text=
   "Hola [nombre]! ✅ Tu pago fue aprobado.
   Aquí están tus archivos de descarga
   (válidos por 24 horas):

   📐 Archivo Audaces (.ads):
   [ads_url]

   📄 PDF del molde:
   [pdf_url]

   🖼 Imagen de referencia:
   [imagen_1_url]

   Gracias por tu compra en Moldi Tex! 🧵"
```

El admin ve la app de WhatsApp abierta con el mensaje listo. Solo tiene que tocar "Enviar".

---

### Vista del botón en Admin

```
┌─────────────────────────────────────────────────────────────────┐
│  /admin/moldes — Tab: Ventas                                    │
│                                                                 │
│  PENDIENTES DE APROBACIÓN                                       │
│  ─────────────────────────────────────────────────────────────  │
│  Ana García          Camisa básica hombre                       │
│  ana@email.com       Mujer › Camisas                            │
│  +54 11 1234-5678    💳 MercadoPago · $3.500                    │
│  26/05/2026 14:32    🔵 En verificación                         │
│                                                                 │
│  [✅ Aprobar y enviar WhatsApp]   [❌ Rechazar]                  │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  Pedro López         Body manga larga                           │
│  pedro@email.com     Bebés › Bodies                             │
│  +54 9 8765-4321     🏦 Transferencia · $1.620 (-10%)           │
│  26/05/2026 11:15    🔵 En verificación                         │
│                                                                 │
│  [✅ Aprobar y enviar WhatsApp]   [❌ Rechazar]                  │
└─────────────────────────────────────────────────────────────────┘
```

Al rechazar, se muestra un campo de texto para escribir el motivo (opcional), que queda guardado en `rechazo_motivo`.

---

## Parte 5 — Selector de Método de Pago (Modal Público)

```
┌──────────────────────────────────────────┐
│  ¿Cómo querés pagar?                     │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │  💳 MercadoPago                  │    │
│  │  Tarjeta, débito, transferencia  │    │
│  │  Precio: $3.500                  │    │
│  │  ● SELECCIONADO                  │    │
│  └──────────────────────────────────┘    │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │  🏦 Transferencia bancaria       │    │
│  │  ⚡ 10% de descuento             │    │
│  │  $3.500 → $3.150                 │    │
│  │  ○ Seleccionar                   │    │
│  └──────────────────────────────────┘    │
│                                          │
│  ⚠ Ambos métodos quedan en verificación  │
│  hasta que confirmemos el pago.          │
│  Los archivos se envían por WhatsApp.    │
└──────────────────────────────────────────┘
```

Si `moldes_descuento_transferencia = 0`, la opción de transferencia no aparece.

---

## Parte 6 — Distinción en Finanzas

```
COMPRA              CATEGORÍA               MÉTODO              ESTADO INICIAL
──────────────────  ──────────────────────  ──────────────────  ────────────────
Molde por MP        Venta de molde          MercadoPago         Deuda (pendiente)
Molde por transf.   Venta de molde          Transferencia bcr.  Deuda (pendiente)
```

Cuando el admin aprueba → el movimiento en `finanzas_movimientos` pasa a saldo completo.
Cuando el admin rechaza → el movimiento se marca como rechazado/eliminado.

**Vista en Finanzas filtrada por categoría:**

```
Filtro: [Venta de molde]

Fecha      Categoría       Descripción               Monto    Método       Estado
─────────  ─────────────── ───────────────────────   ──────   ──────────   ──────────
26/05/26   Venta de molde  Molde: Camisa básica…      $3.500   💳 MP        Pagado ✅
26/05/26   Venta de molde  Molde: Body manga larga    $1.620   🏦 Transf.   Pagado ✅
25/05/26   Venta de molde  Molde: Pantalón recto…     $2.800   💳 MP        Pendiente 🔵
```

---

## Parte 7 — Compresión de Imágenes

**Archivo:** `src/utils/imageCompression.js`

Extrae la lógica que ya existe en `FinanzasPage.jsx` (línea 28):

```
Imagen original → Canvas API nativo → < 250KB · JPEG 80% · máx 1200px
100 moldes × 3 imágenes = ~45–75 MB total (vs 1.2–2.4 GB sin compresión)
```

---

## Parte 8 — Panel Admin

**`src/pages/admin/MoldesAdminPage.jsx`** — 3 tabs:

### Tab: Categorías
Lista de categorías con sus subcategorías inline. Admin puede agregar, editar y borrar subcategorías por categoría, y crear nuevas categorías.

### Tab: Moldes
Grid con filtro por categoría + subcategoría. Modal de alta/edición con selector de subcategoría dinámico según la categoría elegida. Upload de .ads, PDF e imágenes (con compresión automática).

### Tab: Ventas
Listado de todas las compras. Filtros: Todas / En verificación / Aprobadas / Rechazadas / MercadoPago / Transferencia.

```
CARD DE COMPRA EN VERIFICACIÓN:
┌──────────────────────────────────────────────────────┐
│  🔵 En verificación                                  │
│                                                      │
│  Ana García          ana@email.com                   │
│  +54 11 1234-5678    Córdoba · Capital                │
│  Llegó por: Instagram                                │
│                                                      │
│  Camisa básica hombre                                │
│  Mujer › Camisas                                     │
│  💳 MercadoPago · $3.500                             │
│  26/05/2026 a las 14:32                              │
│                                                      │
│  [✅ Aprobar y enviar WhatsApp]  [❌ Rechazar]        │
└──────────────────────────────────────────────────────┘

CARD APROBADA:
┌──────────────────────────────────────────────────────┐
│  ✅ Aprobado — 26/05/2026 15:00                      │
│  Pedro López · Pantalón recto · $2.800 · MP          │
│  [Ver detalle]                                       │
└──────────────────────────────────────────────────────┘
```

---

## Parte 9 — Papelera (solo `ing.lp.tech@gmail.com`)

Extensión de `PapeleraPage.jsx` con 4 tabs nuevos:

```
TABS ACTUALES       TABS NUEVOS
─────────────────   ──────────────────────────────────────────────────
Recursos            Moldes  (restaurar + eliminar definitivo con storage)
Estudiantes         Categorías  (restaurar + eliminar definitivo)
                    Subcategorías  (restaurar + eliminar definitivo)
                    Compras  (solo restaurar — nunca se eliminan definitivo)
```

---

## Parte 10 — Archivos del Proyecto

### Nuevos

```
src/
├── pages/
│   ├── admin/
│   │   └── MoldesAdminPage.jsx     ← 3 tabs: Categorías / Moldes / Ventas
│   └── MoldesPage.jsx              ← Grid público + filtro + modal + pago
└── utils/
    └── imageCompression.js         ← Canvas API, sin dependencias extra

api/
├── create-molde-preference.js      ← Crea preferencia MP + inserta compra
├── create-molde-transferencia.js   ← Registra compra por transferencia
└── molde-aprobar.js                ← Admin aprueba: genera signed URLs
                                       + actualiza BD + devuelve URLs
                                       para armar el mensaje de WhatsApp
```

### Modificados

```
ARCHIVO                                QUÉ CAMBIA
────────────────────────────────────   ───────────────────────────────────────────
src/App.jsx                            + /moldes (lazy, pública)
                                       + /admin/moldes (lazy, admin)

src/pages/admin/AdminLayout.jsx        + "Moldes" en sidebar (ícono: straighten)

src/components/Navbar.jsx              + link "Moldes" → /moldes

src/pages/admin/ConfiguracionPage.jsx  + sección "Moldes y Pagos" (6 campos)

src/context/AppSettingsContext.jsx     + 6 nuevas claves en DEFAULTS y parseSettings

src/pages/admin/FinanzasPage.jsx       + 'Venta de molde' en CATEGORIAS.ingreso

src/pages/admin/PapeleraPage.jsx       + 4 tabs nuevos
```

---

## Parte 11 — Scripts SQL (orden de ejecución)

```
ORDEN   SCRIPT                  LO QUE HACE
─────   ──────────────────────  ────────────────────────────────────────────
  1     01_categorias.sql       Tabla moldes_categorias + 7 filas + RLS
  2     02_subcategorias.sql    Tabla moldes_subcategorias + filas iniciales + RLS
  3     03_moldes.sql           Tabla moldes con FKs + RLS
  4     04_compras.sql          Tabla moldes_compras completa + RLS
  5     05_storage.sql          Buckets + políticas de acceso
```

Los 6 campos nuevos de `app_settings` no necesitan script SQL propio: se insertan con `upsert` desde `ConfiguracionPage` la primera vez que el admin guarda.

---

## Parte 12 — Optimización de Storage

```
SIN COMPRESIÓN     CON COMPRESIÓN (Canvas API)
────────────────   ──────────────────────────────────────────
4–8 MB por foto    < 250KB por foto  (reducción ~97%)
100 moldes c/3     100 moldes ≈ 45–75 MB
fotos = 1.2-2.4GB  Plan gratuito Supabase (500MB) → ~650 moldes
```

---

## Decisiones de Diseño

| Decisión | Por qué |
|---|---|
| Estado único `en_verificacion` para ambos métodos | Simplifica enormemente el flujo: el admin tiene un solo tablero de pendientes sin importar cómo pagaron |
| No hay verificación automática vía API de MP | Evita complejidad de webhooks; el admin igual tiene que revisar su cuenta; el flujo queda uniforme |
| "Aprobar y enviar" en un solo click | El admin no tiene que copiar URLs, redactar mensajes ni buscar el contacto; todo listo en un tap |
| WhatsApp del comprador como destino del mensaje | Los archivos llegan directamente al celular del comprador por el canal más usado en Argentina |
| Signed URLs de 24 horas | El admin puede aprobar y el comprador tiene tiempo razonable para descargar sin presión |
| Las imágenes (preview) no necesitan signed URL | Están en el bucket público; se mandan directamente como URL en el mensaje |
| `rechazo_motivo` opcional | El admin puede explicar por qué rechazó (pago no llegó, monto incorrecto, etc.) |
| Movimiento en finanzas se crea al comprar, se salda al aprobar | Así el tablero de finanzas muestra los pendientes reales en tiempo real |
| Papelera solo para `ing.lp.tech@gmail.com` | Consistente con `isSuperAdmin` ya implementado en `AdminLayout.jsx` |
| Compras nunca se eliminan definitivamente | Auditoría y resolución de disputas futuras |

---

*Documento actualizado el 26/05/2026 — Moldi Tex*
