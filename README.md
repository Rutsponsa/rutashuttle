# Ruta Shuttle · rutashuttle.com

Sitio web bilingüe (inglés y español) de **Ruta Shuttle**, nombre comercial de **Ruta del Spondylus Rutsponsa S.A.** (RUC 1391854234001), empresa ecuatoriana de transporte turístico privado fundada en 2017 en Puerto López, Manabí, con servicio en todo el Ecuador.

**Sitio publicado:** https://rutashuttle.com · **Instagram:** https://www.instagram.com/ruta_shuttle_transporte/

## Qué hace el sitio

- Buscador de rutas por origen y destino, con precio por vehículo en dólares.
- Páginas de destino para Quito, Cuenca y Guayaquil, cada una con su buscador y su lista de rutas.
- Una página por ruta (28 rutas), con duración, precio, qué incluye y preguntas frecuentes.
- Reserva en línea con el calendario de WeTravel dentro de la misma página. Las rutas que no están en la lista se cotizan por WhatsApp.
- Formulario de contacto (Web3Forms) y botón de WhatsApp fijo en todas las páginas.
- 64 páginas en total: 32 en inglés (raíz `/`) y 32 en español (`/es/`, con direcciones en español).
- Páginas 404 propias en cada idioma.

## SEO, AEO y GEO

- Un solo H1 por página, title y meta description únicos en las 64 páginas, canonical y hreflang (en, es, x-default).
- Datos estructurados JSON-LD: LocalBusiness (con dirección, fecha de fundación, RUC y sameAs), WebSite, BreadcrumbList, Service con Offer y precio por ruta, ItemList y FAQPage.
- Preguntas frecuentes escritas para que un asistente de IA pueda contestar con el sitio: ciudades y aeropuertos, precios, capacidad de vehículos, pagos, cancelación, idioma y cómo reservar.
- `sitemap.xml` con las 64 páginas, versiones de idioma, fecha de actualización (lastmod) e imágenes, más una vista legible (`sitemap.xsl`).
- `robots.txt` que permite el acceso a buscadores y asistentes de IA (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, Bingbot y otros).
- `llms.txt` con destinos, rutas, precios, vehículos, preguntas frecuentes y datos de contacto.
- HTTPS con HSTS, imágenes en AVIF y WebP en varios tamaños, carga diferida y HTML estático sin dependencias, para que cargue rápido en celular.

## Estructura del proyecto

| Carpeta o archivo | Contenido |
|---|---|
| `data/` | Todos los textos, rutas, precios y destinos en inglés y español (JSON) |
| `assets/` | Diseño (CSS), funciones (JS), logo y fotos optimizadas |
| `src/build.mjs` | Generador: arma las 64 páginas, el SEO, el schema, el sitemap, robots.txt y llms.txt |
| `src/photos.py` | Retoque de color y exportación de fotos en varios tamaños |
| `src/htaccess-hostinger.txt` | Configuración para Hostinger: https, páginas 404 por idioma, caché y HSTS |
| `src/_headers` | Encabezados de seguridad y caché para Cloudflare |

## Cómo generar el sitio

Requiere Node.js 18 o superior.

    node src/build.mjs site      # crea la carpeta dist/, que es lo que se publica
    node src/build.mjs preview   # vista previa en preview/

Para Hostinger se sube el contenido de `dist/` a `public_html`, junto con `src/htaccess-hostinger.txt` renombrado como `.htaccess`.

## Dónde se cambia cada cosa

| Qué quieres cambiar | Archivo |
|---|---|
| Textos generales (menú, botones, preguntas frecuentes, contacto, inicio) | data/text.json |
| Rutas: precios, duración, códigos de WeTravel, textos en inglés | data/routes.json |
| Rutas: títulos, palabras clave, textos y direcciones en español | data/routes.es.json |
| Páginas de ciudades | data/hubs.json y data/hubs.es.json |
| Página larga de Cuenca a Guayaquil | data/rich.json |
| Lugares del buscador | data/places.json |
| WhatsApp, correo, dirección, redes sociales, clave del formulario | data/config.json |
| Diseño (colores, tamaños) | assets/site.css |
| Funciones (buscador, ventana de reserva) | assets/site.js |

## Decisiones tomadas

- La búsqueda pide solo origen y destino. Fecha, pasajeros y dirección de recogida se ingresan en el calendario de WeTravel.
- Cada ruta tiene su propio código de WeTravel (`wetravelUuid` en routes.json). Sin código, el botón lleva a la página de la ruta en WeTravel o a WhatsApp.
- El teléfono se agrega a los datos estructurados cuando el número de WhatsApp de Ruta Shuttle sea el definitivo (`whatsappPending` en config.json).
