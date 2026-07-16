# Graph Report - .  (2026-07-16)

## Corpus Check
- 115 files · ~233,480 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 379 nodes · 650 edges · 23 communities (20 shown, 3 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.84)
- Token cost: 164,392 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_App Shell & Admin Layout|App Shell & Admin Layout]]
- [[_COMMUNITY_Papelera & Cost Calculator|Papelera & Cost Calculator]]
- [[_COMMUNITY_Project Dependencies|Project Dependencies]]
- [[_COMMUNITY_Envia.com Shipping Quotes|Envia.com Shipping Quotes]]
- [[_COMMUNITY_Moldes Admin Panel|Moldes Admin Panel]]
- [[_COMMUNITY_Molde Approval Flow|Molde Approval Flow]]
- [[_COMMUNITY_Finance & Debt Tracking|Finance & Debt Tracking]]
- [[_COMMUNITY_Molde Checkout APIs|Molde Checkout APIs]]
- [[_COMMUNITY_Site SEO & Branding|Site SEO & Branding]]
- [[_COMMUNITY_Coupons & Enrollment|Coupons & Enrollment]]
- [[_COMMUNITY_Pizarras Storefront|Pizarras Storefront]]
- [[_COMMUNITY_Resources Page|Resources Page]]
- [[_COMMUNITY_Kanban Board|Kanban Board]]
- [[_COMMUNITY_Course Payment API|Course Payment API]]
- [[_COMMUNITY_Create Student API|Create Student API]]
- [[_COMMUNITY_Reset Password API|Reset Password API]]
- [[_COMMUNITY_Delete Student API|Delete Student API]]
- [[_COMMUNITY_Envia.com Webhook|Envia.com Webhook]]
- [[_COMMUNITY_Build Tooling Notes|Build Tooling Notes]]
- [[_COMMUNITY_Vercel Config|Vercel Config]]

## God Nodes (most connected - your core abstractions)
1. `useAppSettings()` - 21 edges
2. `supabase` - 21 edges
3. `useAuth()` - 17 edges
4. `registrarAuditoria()` - 13 edges
5. `Tabla moldes_compras` - 13 edges
6. `Sistema de Venta de Moldes Audaces` - 9 edges
7. `Digital Atelier (brand, stitch mockups)` - 9 edges
8. `setCors()` - 8 edges
9. `bloquearSiOrigenInvalido()` - 8 edges
10. `notificarNuevaVenta()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Digital Atelier (brand, stitch mockups)` --conceptually_related_to--> `Moldi Tex (brand)`  [AMBIGUOUS]
  src/stitch-screens/landing_desktop.html → index.html
- `Sistema de Venta de Moldes Audaces` --references--> `Moldi Tex (brand)`  [EXTRACTED]
  PLAN_MOLDES.md → index.html
- `Route: /temario` --conceptually_related_to--> `Temario/Curriculum Mockup - Desktop`  [INFERRED]
  public/robots.txt → src/stitch-screens/temario_desktop.html
- `Route: /temario` --conceptually_related_to--> `Temario/Curriculum Mockup - Mobile`  [INFERRED]
  public/robots.txt → src/stitch-screens/temario_mobile.html
- `Route: /ventajas` --conceptually_related_to--> `Ventajas/Advantages Comparison Mockup - Desktop`  [INFERRED]
  public/robots.txt → src/stitch-screens/ventajas_desktop.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Digital Atelier Stitch Mockups Share One Tailwind Design System** — digital_atelier_design_system, src_stitch_screens_landing_desktop_screen, src_stitch_screens_landing_mobile_screen, src_stitch_screens_inscripcion_desktop_screen, src_stitch_screens_registro_mobile_screen, src_stitch_screens_temario_desktop_screen, src_stitch_screens_temario_mobile_screen, src_stitch_screens_ventajas_desktop_screen, src_stitch_screens_ventajas_mobile_screen [INFERRED 0.85]
- **Universal Molde Purchase & Manual Verification Flow** — plan_moldes_flujo_universal, plan_moldes_estado_en_verificacion, plan_moldes_estado_aprobado, plan_moldes_estado_rechazado, plan_moldes_aprobar_y_enviar_accion, plan_moldes_tabla_moldes_compras, plan_moldes_finanzas_distincion [EXTRACTED 1.00]
- **Molde Payment Method Selection & Processing (MP vs Transferencia)** — plan_moldes_mercadopago_flow, plan_moldes_transferencia_flow, plan_moldes_selector_metodo_pago_modal, plan_moldes_tabla_moldes_compras, plan_moldes_app_settings_claves [EXTRACTED 1.00]

## Communities (23 total, 3 thin omitted)

### Community 0 - "App Shell & Admin Layout"
Cohesion: 0.05
Nodes (42): Nuevas claves de app_settings (Moldes y Pagos), Selector de Metodo de Pago (Modal Publico), AdminDashboard, AdminLayout, App(), CertificadosPage, ConfiguracionPage, CuponesPage (+34 more)

### Community 1 - "Papelera & Cost Calculator"
Cohesion: 0.07
Nodes (37): Extension de Papelera (4 tabs nuevos), Rationale: papelera restringida a superadmin, CostosCalculadora(), EMPTY_FORM, EMPTY_INSUMO, fmt(), TODAY, ADMIN_EMAILS (+29 more)

### Community 2 - "Project Dependencies"
Cohesion: 0.06
Nodes (31): dependencies, mercadopago, react, react-dom, devDependencies, autoprefixer, eslint, @eslint/js (+23 more)

### Community 3 - "Envia.com Shipping Quotes"
Cohesion: 0.16
Nodes (25): handleCotizar(), handler(), handleSucursales(), validarDestino(), ALLOWED_ORIGINS, bloquearSiOrigenInvalido(), origenPermitido(), setCors() (+17 more)

### Community 4 - "Moldes Admin Panel"
Cohesion: 0.10
Nodes (18): Compresion de Imagenes (Canvas API), Panel Admin de Moldes (3 tabs: Categorias/Moldes/Ventas), Rationale: compresion de imagenes maximiza plan gratuito Supabase, FORM_INICIAL, imgUrl(), SlotImagen(), TabMoldes(), TabVentas() (+10 more)

### Community 5 - "Molde Approval Flow"
Cohesion: 0.13
Nodes (24): ALLOWED_ORIGINS, handler(), setCors(), Accion "Aprobar y enviar" (Admin), Estado: aprobado, Estado: en_verificacion, Estado: rechazado, Distincion en Finanzas (Venta de molde) (+16 more)

### Community 6 - "Finance & Debt Tracking"
Cohesion: 0.11
Nodes (15): CATEGORIAS, DebtBar(), DeudaCard(), DUENOS, EMPTY_FORM, EMPTY_PAGO, FinanzasPage(), fmt() (+7 more)

### Community 7 - "Molde Checkout APIs"
Cohesion: 0.15
Nodes (15): ALLOWED_ORIGINS, handler(), setCors(), validateWhatsapp(), ALLOWED_ORIGINS, handler(), setCors(), validateWhatsapp() (+7 more)

### Community 8 - "Site SEO & Branding"
Cohesion: 0.16
Nodes (23): Digital Atelier (brand, stitch mockups), Digital Atelier Shared Tailwind Design System, JSON-LD Course Schema, JSON-LD FAQPage Schema, JSON-LD LocalBusiness Schema, JSON-LD Organization Schema, Moldi Tex Site Entry (index.html), TikTok Analytics Pixel (ttq) (+15 more)

### Community 9 - "Coupons & Enrollment"
Cohesion: 0.20
Nodes (15): EMPTY_FORM, buildPlanes(), CAMPOS, getMontoConDescuento(), InscripcionPage(), WAPP_MSG, addCupon(), deleteCupon() (+7 more)

### Community 10 - "Pizarras Storefront"
Cohesion: 0.19
Nodes (9): Carousel(), FORM_EMPTY, imgUrl(), PizarraCard(), pizarraImages(), PizarraModal(), PizarrasPage(), VENTAJAS (+1 more)

### Community 11 - "Resources Page"
Cohesion: 0.25
Nodes (10): detectarFuente(), extractDriveId(), extractVimeoId(), fetchVimeoThumb(), FORM_CARPETA_INICIAL, FORM_INICIAL, getDriveImageSrc(), RecursosPage() (+2 more)

### Community 12 - "Kanban Board"
Cohesion: 0.25
Nodes (4): DEFAULT_COLUMNS, loadLocal(), PRIORIDAD_COLOR, TablreroKanban()

### Community 13 - "Course Payment API"
Cohesion: 0.60
Nodes (4): ALLOWED_ORIGINS, handler(), validateEmail(), validateItems()

### Community 14 - "Create Student API"
Cohesion: 0.67
Nodes (3): ALLOWED_ORIGINS, generarPassword(), handler()

### Community 15 - "Reset Password API"
Cohesion: 0.67
Nodes (3): ALLOWED_ORIGINS, generarPassword(), handler()

### Community 18 - "Build Tooling Notes"
Cohesion: 0.67
Nodes (3): ESLint Configuration Expansion, React Compiler (not enabled), React + Vite Starter Template

## Ambiguous Edges - Review These
- `Moldi Tex (brand)` → `Digital Atelier (brand, stitch mockups)`  [AMBIGUOUS]
  src/stitch-screens/landing_desktop.html · relation: conceptually_related_to

## Knowledge Gaps
- **100 isolated node(s):** `ALLOWED_ORIGINS`, `PROVINCIAS_ARGENTINA`, `ALLOWED_ORIGINS`, `ALLOWED_ORIGINS`, `ALLOWED_ORIGINS` (+95 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Moldi Tex (brand)` and `Digital Atelier (brand, stitch mockups)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Sistema de Venta de Moldes Audaces` connect `Molde Approval Flow` to `Site SEO & Branding`, `Papelera & Cost Calculator`, `Moldes Admin Panel`, `App Shell & Admin Layout`?**
  _High betweenness centrality (0.265) - this node is a cross-community bridge._
- **Why does `Tabla moldes_compras` connect `Molde Approval Flow` to `Molde Checkout APIs`?**
  _High betweenness centrality (0.232) - this node is a cross-community bridge._
- **Why does `supabase` connect `Papelera & Cost Calculator` to `App Shell & Admin Layout`, `Moldes Admin Panel`, `Finance & Debt Tracking`, `Coupons & Enrollment`, `Pizarras Storefront`, `Resources Page`, `Kanban Board`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **What connects `ALLOWED_ORIGINS`, `PROVINCIAS_ARGENTINA`, `ALLOWED_ORIGINS` to the rest of the system?**
  _108 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Shell & Admin Layout` be split into smaller, more focused modules?**
  _Cohesion score 0.052597402597402594 - nodes in this community are weakly interconnected._
- **Should `Papelera & Cost Calculator` be split into smaller, more focused modules?**
  _Cohesion score 0.06821480406386067 - nodes in this community are weakly interconnected._