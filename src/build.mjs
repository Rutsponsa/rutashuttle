// Ruta Shuttle static site generator (English + Spanish).
// node src/build.mjs site     -> dist/     (clean URLs, for Cloudflare)
// node src/build.mjs preview  -> preview/  (flat files, inlined CSS/JS, for the Claude preview)
//
// Where the words live:
//   data/text.json        shared interface text, both languages
//   data/routes.json      routes, prices and English route text
//   data/routes.es.json   Spanish route text and Spanish URLs
//   data/hubs.json        English city pages;  data/hubs.es.json  Spanish city pages
//   data/rich.json        long-form route pages (Cuenca to Guayaquil)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const PAGE_HASH = {};
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MODE = process.argv[2] === "preview" ? "preview" : "site";
const OUT = path.join(ROOT, MODE === "preview" ? "preview" : "dist");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const cfg = read("data/config.json");
const places = read("data/places.json");
const routesEn = read("data/routes.json");
const routesEs = read("data/routes.es.json");
const hubsEn = read("data/hubs.json");
const hubsEs = read("data/hubs.es.json");
const rich = read("data/rich.json");
const TEXT = read("data/text.json");
const CSS = fs.readFileSync(path.join(ROOT, "assets/site.css"), "utf8");
// Inlined in every page so the browser can paint without waiting for an extra request.
const CSS_MIN = CSS.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{};:,>])\s*/g, "$1").replace(/;}/g, "}").trim();
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Lexend:wght@500;600&family=Nunito+Sans:opsz,wght@6..12,400;6..12,600;6..12,700&display=swap";
const JS = fs.readFileSync(path.join(ROOT, "assets/site.js"), "utf8");
const LANGS = ["en", "es"];

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmt = (s, v = {}) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
const fmtElev = (n, lang) => n.toLocaleString(lang === "es" ? "es-EC" : "en-US", { useGrouping: lang === "es" ? "always" : true }).replace(/,/g, lang === "es" ? "." : ",") + " m";
const durEs = (d) => ({ "Per hour": "Por hora", "Round trip": "Ida y vuelta" }[d] || d.replace(/(\d)\.(\d)/g, "$1,$2").replace(/ to /g, " a "));

// ---------- Localized data ----------
function routesFor(lang) {
  return routesEn.map((r) => {
    if (lang === "en") return { ...r, id: r.slug };
    const x = routesEs[r.slug] || {};
    return { ...r, id: r.slug, slug: x.slug || r.slug, title: x.title || r.title, keyword: x.keyword || r.keyword, blurb: x.blurb || r.blurb, duration: durEs(r.duration) };
  });
}
const hubsFor = (lang) => (lang === "en" ? hubsEn : Object.fromEntries(Object.entries(hubsEn).map(([k, h]) => [k, { ...h, ...hubsEs[k] }])));
const pName = (id, lang) => (lang === "es" ? places[id].nameEs : places[id].name);
const pLabel = (id, lang) => (lang === "es" ? places[id].labelEs : places[id].label);

// ---------- URLs ----------
const ROUTE_BY_ID = { en: Object.fromEntries(routesFor("en").map((r) => [r.id, r])), es: Object.fromEntries(routesFor("es").map((r) => [r.id, r])) };
const P = (lang) => (MODE === "preview" ? (lang === "es" ? "es-" : "") : lang === "es" ? "/es/" : "/");
const PAGES = read("data/pages.json");
const url = {
  home: (lang) => (MODE === "preview" ? (lang === "es" ? "es.html" : "index.html") : P(lang)),
  hub: (h, lang) => (MODE === "preview" ? `${P(lang)}${h}.html` : `${P(lang)}${h}/`),
  route: (r, lang) => {
    const x = ROUTE_BY_ID[lang][r.id];
    return MODE === "preview" ? `${P(lang)}${x.slug}.html` : `${P(lang)}${x.hub}/${x.slug}/`;
  },
  page: (k, lang) => (MODE === "preview" ? `${P(lang)}${PAGES[lang].slugs[k]}.html` : `${P(lang)}${PAGES[lang].slugs[k]}/`),
  anchor: (a, lang) => `${url.home(lang)}#${a}`,
  asset: (f) => (MODE === "preview" ? f : `/assets/${f}`),
};
const fileFor = (u) => (MODE === "preview" ? u : u.replace(/^\//, "") + "index.html");
const wa = (text) => `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(text)}`;

// ---------- Icons ----------
const I = {
  wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.4-.2Z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  person: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="7.5" r="4"/><path d="M4 21a8 8 0 0 1 16 0Z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
};
const FLAGS = {
  en: '<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" fill="#b22234"/><g fill="#fff">' +
    [1, 3, 5, 7, 9, 11].map((i) => `<rect y="${(i * 20 / 13).toFixed(2)}" width="30" height="${(20 / 13).toFixed(2)}"/>`).join("") +
    '</g><rect width="12" height="10.77" fill="#3c3b6e"/><g fill="#fff">' +
    [[2, 2], [5, 2], [8, 2], [3.5, 4.2], [6.5, 4.2], [9.5, 4.2], [2, 6.4], [5, 6.4], [8, 6.4], [3.5, 8.6], [6.5, 8.6]].map(([x, y]) => `<circle cx="${x + 0.5}" cy="${y}" r=".6"/>`).join("") +
    "</g></svg>",
  es: '<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="10" fill="#ffd100"/><rect y="10" width="30" height="5" fill="#034ea2"/><rect y="15" width="30" height="5" fill="#ed1c24"/>' +
    '<path d="M11.2 6.6 Q15 4.4 18.8 6.6 L15 8Z" fill="#5b3a1e"/><ellipse cx="15" cy="10.6" rx="2.4" ry="2.9" fill="#7fc4ec" stroke="#5b3a1e" stroke-width=".6"/><path d="M12.8 11.6 L14.4 9.8 L15.6 11 L16.4 10.2 L17.3 11.6 V12.2 Q15 14.4 12.8 12.2Z" fill="#2f8f46"/></svg>',
};

// Line icons, front of the vehicle on the left. 96 x 46 grid.
const wheel = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/><circle cx="${cx}" cy="${cy}" r="1.7" fill="var(--orange)" stroke="none"/>`;
const VEH = {
  sedan: `<path d="M9 34V29.5q0-3.4 3.4-4L26 23l7.6-7.4q1.6-1.6 3.9-1.6H57q2.3 0 3.9 1.6L68.5 23l15 1.6Q87 25 87 28.5V34H81a8 8 0 0 0-16 0H31a8 8 0 0 0-16 0Z"/><path d="M30.5 22.5l6.2-6H46v6ZM50 16.5h7.8l6.2 6H50Z"/><path d="M12 28h3.5M43.5 26.5h3M58.5 26.5h3"/>${wheel(23, 34, 5.6)}${wheel(73, 34, 5.6)}`,
  suv: `<path d="M8 35V27q0-3 3-3.4L23 21.5l8.6-10Q33.4 9 36.6 9H70q2.8 0 4.4 2L81 19.5l3.8 1.2Q88 21.6 88 25v10H81a9 9 0 0 0-18 0H35a9 9 0 0 0-18 0Z"/><path d="M29.2 19.6L36 12.4h12.5v7.2ZM52.5 12.4H69q1.6 0 2.6 1.3l4.6 5.9H52.5Z"/><path d="M41 5.5h26M44 5.5V9M64 5.5V9M11 25.5h4M50.5 22.5v8M8 30.5h8.5M81 30.5h7"/>${wheel(26, 35, 6.6)}${wheel(72, 35, 6.6)}`,
  van: `<path d="M7 35v-6.4q0-3.5 3.4-4.6L18 22l12-11q2-2 5-2h49q4 0 4 4v22H82a8 8 0 0 0-16 0H33a8 8 0 0 0-16 0Z"/><path d="M22.4 21.5L31 13h10v8.5ZM45 13h15v8.5H45ZM64 13h20v8.5H64Z"/><path d="M10 27.5h4M43 24.5v7M37.5 25.5h3"/>${wheel(25, 35, 6)}${wheel(74, 35, 6)}`,
  bigvan: `<path d="M5 36v-6.5q0-3.5 3.5-4.5L14 23.5 23 9q2-3.5 6-3.5h58q4 0 4 4V36h-6a7.5 7.5 0 0 0-15 0H29a7.5 7.5 0 0 0-15 0Z"/><path d="M17.6 22.5l7-12H31v12ZM35 10.5h13V20H35ZM52 10.5h13V20H52ZM69 10.5h17V20H69Z"/><path d="M8 28h4M33 25.5v7"/>${wheel(21.5, 36, 5.6)}${wheel(77.5, 36, 5.6)}`,
  bus: `<path d="M5 36V9.5Q5 5 9.5 5h77Q91 5 91 9.5V36h-6a7.5 7.5 0 0 0-15 0H30a7.5 7.5 0 0 0-15 0Z"/><path d="M9 9h8v14H9ZM20 33V9h6v24M30 9h11.5v11H30ZM44.5 9H56v11H44.5ZM59 9h11.5v11H59ZM73.5 9H86v11H73.5Z"/><path d="M28 25h63M7.5 30h3"/>${wheel(22.5, 36, 5.6)}${wheel(77.5, 36, 5.6)}`,
};
const vehicleSvg = (k) => `<svg viewBox="0 0 96 46" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${VEH[k]}</g></svg>`;

const heroArt = `<svg viewBox="0 0 1440 240" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <path d="M1080 150a120 120 0 0 1 240 0" fill="none" stroke="var(--orange)" stroke-width="5" opacity=".75"/>
  <path d="M0 210 L160 150 L250 175 L380 95 L470 140 L560 110 L690 170 L820 120 L900 150 L1010 70 L1080 105 L1200 40 L1300 110 L1440 80 L1440 240 L0 240Z" fill="var(--blue-ink)" opacity=".10"/>
  <path d="M0 230 L120 200 L260 214 L420 170 L560 205 L700 180 L860 210 L1000 175 L1160 200 L1300 170 L1440 195 L1440 240 L0 240Z" fill="var(--blue-ink)" opacity=".14"/>
  <path d="M-20 238 C 400 200, 900 250, 1460 214" fill="none" stroke="var(--blue-ink)" stroke-width="3" opacity=".35" stroke-dasharray="18 14"/>
</svg>`;
const RIDGES = {
  quito: "M0 60 L40 38 L70 50 L110 12 L140 34 L170 26 L220 52 L260 60",
  cuenca: "M0 60 L30 44 L70 52 L100 30 L130 40 L160 22 L200 46 L230 38 L260 60",
  guayaquil: "M0 60 C 40 54, 70 48, 110 50 S 180 40, 210 44 S 245 52, 260 50",
};
const ridge = (h) => `<svg viewBox="0 0 260 64" preserveAspectRatio="none" aria-hidden="true"><path d="${RIDGES[h]} L260 64 L0 64Z" fill="currentColor" opacity=".12"/><path d="${RIDGES[h]}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/></svg>`;


const SCENE404 = (label) => `<svg class="e404-art" viewBox="0 0 640 292" role="img" aria-label="${esc(label)}">
  <defs><linearGradient id="e404fade" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".12" stop-color="#fff"/><stop offset=".88" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="e404mask"><rect width="640" height="300" fill="url(#e404fade)"/></mask></defs>
  <g mask="url(#e404mask)">
    <path class="e404-sun" d="M500 176a62 62 0 0 1 124 0" fill="none" stroke="var(--orange)" stroke-width="6" stroke-linecap="round"/>
    <path d="M0 206 L80 150 L140 176 L240 82 L320 156 L392 116 L470 176 L560 124 L640 166 V232 H0Z" fill="var(--blue-ink)" opacity=".09"/>
    <path d="M220 101 L240 82 L262 104 L251 99 L242 108 L232 98Z" fill="var(--card)" opacity=".9"/>
    <rect y="232" width="640" height="56" rx="0" fill="var(--surface)"/>
    <path d="M0 232 H640" stroke="var(--line)" stroke-width="3"/>
    <path d="M0 262 H640" stroke="var(--line)" stroke-width="4" stroke-dasharray="26 18"/>
  </g>
  <g class="e404-van" transform="rotate(-2.6 277 232)">
    <g transform="translate(55 109) scale(3)" fill="none" stroke="var(--blue-ink)" stroke-linecap="round" stroke-linejoin="round">
      <path d="M7 35v-6.4q0-3.5 3.4-4.6L18 22l12-11q2-2 5-2h49q4 0 4 4v22H82a8 8 0 0 0-16 0H33a8 8 0 0 0-16 0Z" fill="var(--card)" stroke-width="1"/>
      <path d="M22.4 21.5L31 13h10v8.5ZM45 13h15v8.5H45ZM64 13h20v8.5H64Z" fill="var(--blue-soft)" stroke-width="1"/>
      <path d="M10 27.5h4M43 24.5v7M37.5 25.5h3M18 29h66" stroke-width="1"/>
      <path d="M18 29h66" stroke="var(--orange)" stroke-width="1.4"/>
    </g>
    <circle cx="277" cy="214" r="18" fill="var(--ink)"/><circle cx="277" cy="214" r="7" fill="var(--card)"/><circle cx="277" cy="214" r="3" fill="var(--orange)"/>
    <path d="M110 226 Q108 210 130 207 Q152 210 150 226 Q140 230 130 229 Q120 230 110 226Z" fill="var(--ink)"/>
    <ellipse cx="130" cy="218" rx="7" ry="5" fill="var(--card)"/><circle cx="130" cy="218" r="2.6" fill="var(--orange)"/>
  </g>
  <g class="e404-puff" fill="none" stroke="var(--muted)" stroke-width="2.5" stroke-linecap="round">
    <path d="M100 214 q-10 -4 -18 2"/><path d="M98 224 q-12 0 -20 6"/><path d="M104 204 q-8 -8 -16 -6"/>
  </g>
  <g class="e404-tri" fill="none" stroke="var(--orange)" stroke-width="4" stroke-linejoin="round">
    <path d="M548 232 L566 198 L584 232Z" fill="var(--card)"/><path d="M558 226 L566 211 L574 226Z" stroke-width="2.5"/>
  </g>
  <g class="e404-driver" stroke="var(--blue-ink)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M410 192 L404 230 M430 192 L436 230" fill="none"/>
    <path d="M396 231 H410 M430 231 H444" stroke-width="5"/>
    <path d="M400 150 Q400 140 410 139 H430 Q440 140 440 150 V194 H400Z" fill="var(--blue-soft)"/>
    <path d="M412 141 L420 152 L428 141" fill="none" stroke-width="2.5"/>
    <path d="M401 152 L388 176 L384 190" fill="none"/>
    <path d="M384 190 L372 206" stroke="var(--muted)" stroke-width="5"/><circle cx="370" cy="209" r="5" fill="none" stroke="var(--muted)" stroke-width="3"/>
    <path class="e404-arm" d="M439 152 L452 128 L438 106" fill="none"/>
    <circle cx="420" cy="118" r="19" fill="#f2c9a3"/>
    <path d="M401 114 Q402 94 422 94 Q440 95 440 112 Z" fill="var(--blue)"/><path d="M403 112 H388" stroke-width="4"/>
    <circle cx="437" cy="104" r="5.5" fill="#f2c9a3"/>
    <path d="M407 113 q4 -5 9 -1 M422 112 q4 -4 9 0" fill="none" stroke-width="2.4"/>
    <circle cx="412" cy="120" r="2.3" fill="var(--blue-ink)" stroke="none"/><circle cx="426" cy="120" r="2.3" fill="var(--blue-ink)" stroke="none"/>
    <ellipse cx="419" cy="130" rx="3.4" ry="4.2" fill="var(--card)" stroke-width="2.4"/>
    <path d="M444 116 q3 5 0 8 q-3 -3 0 -8Z" fill="#8cc8f0" stroke="none"/>
  </g>
  <text class="e404-q" x="452" y="84" font-family="Lexend, sans-serif" font-weight="600" font-size="34" fill="var(--orange)">?!</text>
</svg>`;
const TIRE = `<svg class="tire" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="16"/><circle cx="50" cy="50" r="40" fill="none" stroke="var(--bg)" stroke-width="3" stroke-dasharray="6 9" opacity=".7"/><circle cx="50" cy="50" r="15" fill="none" stroke="var(--orange)" stroke-width="6"/><circle cx="50" cy="50" r="4" fill="var(--orange)"/></svg>`;

// Full-width cover photos: home fleet + one per city. Files come from src/photos.py.
const COVERS = {
  home: { dir: "hero", base: "fleet", w: [640, 960, 1280, 1672], h: 941, pos: "58% 70%", posM: "52% 78%" },
  cuenca: { dir: "covers", base: "cuenca", w: [640, 960, 1280, 1920], h: 1080, pos: "50% 45%", posM: "57% 50%" },
  quito: { dir: "covers", base: "quito", w: [640, 960, 1280, 1500], h: 844, pos: "50% 30%", posM: "58% 35%" },
  guayaquil: { dir: "covers", base: "guayaquil", w: [640, 960, 1280, 1920], h: 1080, pos: "50% 45%", posM: "72% 40%" },
};
const coverSet = (c, ext) => c.w.map((w) => `${url.asset(`${c.dir}/${c.base}-${w}.${ext}`)} ${w}w`).join(", ");
const coverPreload = (k) => `<link rel="preload" as="image" type="image/avif" imagesrcset="${coverSet(COVERS[k], "avif")}" imagesizes="100vw" fetchpriority="high">`;
const coverPicture = (k, alt) => {
  const c = COVERS[k], big = c.w[c.w.length - 1];
  return `<picture>
  <source type="image/avif" srcset="${coverSet(c, "avif")}" sizes="100vw">
  <source type="image/webp" srcset="${coverSet(c, "webp")}" sizes="100vw">
  <img src="${url.asset(`${c.dir}/${c.base}-${big}.jpg`)}" alt="${esc(alt)}" width="${big}" height="${Math.round(big * 9 / 16)}" fetchpriority="high" decoding="async" style="--pos:${c.pos};--pos-m:${c.posM}">
</picture>`;
};

// ---------- Structured data: the business ----------
const SITEMAP = [];
function BIZ(lang) {
  const D = cfg.domain;
  const node = {
    "@type": "LocalBusiness", "@id": D + "/#business", name: "Ruta Shuttle", legalName: cfg.legalName,
    alternateName: "Ruta del Spondylus Rutsponsa S.A.", url: D + "/", logo: D + "/assets/logo-full.png", image: D + "/assets/og-image.jpg",
    description: TEXT[lang].home.desc, email: cfg.email, priceRange: "$$", currenciesAccepted: "USD",
    address: { "@type": "PostalAddress", streetAddress: cfg.address.street, addressLocality: cfg.address.locality, addressRegion: cfg.address.region, addressCountry: cfg.address.country },
    geo: { "@type": "GeoCoordinates", latitude: cfg.geo.lat, longitude: cfg.geo.lng }, hasMap: cfg.maps,
    foundingDate: cfg.foundingDate, foundingLocation: { "@type": "Place", name: "Puerto López, Manabí, Ecuador" }, taxID: cfg.taxID, sameAs: cfg.sameAs,
    areaServed: [{ "@type": "Country", name: "Ecuador" }, ...["Quito", "Cuenca", "Guayaquil", "Puerto López"].map((n) => ({ "@type": "City", name: n }))],
    knowsLanguage: ["en", "es"],
  };
  node.telephone = "+" + cfg.phone;
  node.contactPoint = [
    { "@type": "ContactPoint", contactType: "customer service", telephone: "+" + cfg.phone, email: cfg.email, availableLanguage: ["English", "Spanish"], areaServed: "EC" },
    { "@type": "ContactPoint", contactType: "reservations", name: "WhatsApp", telephone: "+" + cfg.whatsapp, url: "https://wa.me/" + cfg.whatsapp, availableLanguage: ["English", "Spanish"], areaServed: "EC" },
  ];
  return node;
}

// ---------- Page builder for one language ----------
function buildLang(lang) {
  const T = TEXT[lang];
  const routes = routesFor(lang);
  const hubs = hubsFor(lang);

  function header(alt) {
    const sw = LANGS.map((l) => {
      const label = l === "en" ? "ENG" : "ESP";
      const name = l === "en" ? "English" : "Español";
      const cur = l === lang;
      return `<a href="${alt[l]}" hreflang="${l}" lang="${l}" class="lang-opt${cur ? " on" : ""}"${cur ? ' aria-current="true"' : ""} aria-label="${name}"><span class="flag">${FLAGS[l]}</span><span class="lang-code">${label}</span></a>`;
    }).join("");
    return `<a class="skip" href="#main">${T.skip}</a>
<header class="site-header"><div class="wrap">
  <a class="brand" href="${url.home(lang)}" aria-label="${T.brandHome}"><img class="brand-mark" src="${url.asset("logo-mark.png")}" alt="${T.brandLogoAlt}" width="54" height="40"><span class="brand-name">Ruta <b>Shuttle</b></span></a>
  <nav class="nav" id="site-nav" aria-label="Main">
    <a href="${url.home(lang)}">${T.nav.home}</a>
    <a href="${url.hub("quito", lang)}">Quito</a>
    <a href="${url.hub("cuenca", lang)}">Cuenca</a>
    <a href="${url.hub("guayaquil", lang)}">Guayaquil</a>
    <a href="${url.anchor("fleet", lang)}">${T.nav.vehicles}</a>
    <a href="${url.page("about", lang)}">${T.nav.about}</a>
    <a href="${url.page("contact", lang)}">${T.nav.contact}</a>
  </nav>
  <div class="lang-switch" role="group" aria-label="${T.langGroup}">${sw}</div>
  <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="${T.openMenu}">${I.menu}</button>
</div></header>`;
  }

  const dateField = (id, name, label) => `<div class="field"><label for="${id}">${label}</label><div class="control date" data-datepicker><input id="${id}" class="date-display" type="text" readonly role="combobox" placeholder="${T.search.datePh}" aria-haspopup="dialog" aria-expanded="false" autocomplete="off">${I.cal}<input type="hidden" name="${name}"></div></div>`;

  function searchBox({ from = "", heading = T.search.heading } = {}) {
    const S = T.search;
    return `<div class="search-wrap">
<form class="search" data-from="${from}" aria-label="${S.aria}">
  <h2 class="eyebrow" style="font-size:.78rem">${esc(heading)}</h2>
  <div class="search-grid">
    <div class="field"><label for="f-from">${S.from}</label><div class="control select"><select id="f-from" name="from" autocomplete="off"></select></div></div>
    <div class="field"><label for="f-to">${S.to}</label><div class="control select"><select id="f-to" name="to" autocomplete="off"></select></div></div>
    <button class="btn btn-primary" type="submit">${S.submit}</button>
  </div>
  <p class="search-note">${I.cal}<span>${esc(S.later)}</span></p>
</form>
<div class="results" aria-live="polite"></div>
</div>`;
  }

  const cityPhoto = (k) => `<div class="hub-photo"><picture>
    <source type="image/avif" srcset="${url.asset(`cities/${k}-480.avif`)} 480w, ${url.asset(`cities/${k}-960.avif`)} 960w" sizes="(max-width: 620px) calc(100vw - 32px), (max-width: 900px) 46vw, 380px">
    <source type="image/webp" srcset="${url.asset(`cities/${k}-480.webp`)} 480w, ${url.asset(`cities/${k}-960.webp`)} 960w" sizes="(max-width: 620px) calc(100vw - 32px), (max-width: 900px) 46vw, 380px">
    <img src="${url.asset(`cities/${k}-960.jpg`)}" alt="${esc(T.cityAlt[k])}" width="960" height="640" loading="lazy" decoding="async">
  </picture></div>`;
  const trustRow = () => `<div class="trust">${T.trust.map((t) => `<span>${I.check}${esc(t)}</span>`).join("")}</div>`;

  const routeCard = (r) => `<a class="route" href="${url.route(r, lang)}">
  <div class="route-line"><span><b></b>${esc(pName(r.from, lang))}</span><i></i><span class="to">${esc(pName(r.to, lang))}<b></b></span></div>
  <h3>${esc(r.title)}</h3>
  <p>${esc(r.blurb)}</p>
  <div class="route-foot"><div class="price num"><small>${T.fromLabel}</small>$${r.price}</div><span class="dur num">${esc(r.duration)}</span></div>
</a>`;

  const fleetSection = (id = "fleet") => `<section class="section" id="${id}"><div class="wrap">
  <div class="section-head"><p class="eyebrow">${T.fleet.eyebrow}</p><h2>${T.fleet.h2}</h2><p class="lede">${T.fleet.lede}</p></div>
  <div class="fleet">${T.fleet.items.map((v) => `<div class="vehicle"><div class="veh-art">${vehicleSvg(v.k)}</div><h3>${esc(v.name)}</h3><div class="cap">${I.person}<span><span class="num">${v.pax}</span> ${T.fleet.unit}</span></div><p class="ex">${esc(v.note)}</p></div>`).join("")}</div>
</div></section>`;

  const stepsSection = () => `<section class="section tint"><div class="wrap">
  <div class="section-head"><p class="eyebrow">${T.steps.eyebrow}</p><h2>${T.steps.h2}</h2></div>
  <div class="grid cols-3 steps">${T.steps.items.map(([h, p]) => `<div class="step"><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join("")}</div>
</div></section>`;

  const includedList = () => `<ul class="checks">${T.included.items.map((t) => `<li>${I.check}<span>${esc(t)}</span></li>`).join("")}</ul>`;
  // Internal links inside FAQ answers: route names ("Cuenca to Guayaquil") and city names point to their pages.
  const linkTargets = [
    ...routes.map((r) => [`${pName(r.from, lang)} ${lang === "es" ? "a" : "to"} ${pName(r.to, lang)}`, url.route(r, lang)]),
    ...routes.map((r) => [r.title, url.route(r, lang)]),
    ...Object.keys(hubs).map((k) => [hubs[k].name, url.hub(k, lang)]),
    // a destination town on its own ("Mindo") points to the closest (cheapest) route that goes there
    ...[...new Set(routes.map((r) => r.to))].filter((id) => !hubs[id] && places[id] && ["town", "beach", "park"].includes(places[id].kind))
      .map((id) => [pName(id, lang), url.route(routes.filter((r) => r.to === id).sort((x, y) => x.price - y.price)[0], lang)]),
  ].sort((x, y) => y[0].length - x[0].length);
  const linkify = (text, here) => {
    let out = esc(text);
    const used = new Set([here]);
    const tokens = [];
    for (const [phrase, href] of linkTargets) {
      if (used.has(href)) continue;
      const re = new RegExp(`(?<![\\p{L}>])${esc(phrase).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "iu");
      const m = out.match(re);
      if (!m) continue;
      tokens.push(`<a href="${href}">${m[0]}</a>`);
      out = out.slice(0, m.index) + `\u0000${tokens.length - 1}\u0000` + out.slice(m.index + m[0].length);
      used.add(href);
    }
    return out.replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[i]);
  };
  const faqBlock = (items, here) => `<div class="faq">${items.map(([q, a]) => `<details><summary><h3>${esc(q)}</h3></summary><p>${linkify(a, here)}</p></details>`).join("")}</div>`;

  function contactSection(top) {
    const C = T.contact;
    const head = top
      ? `<div class="section-head">${top.crumbs}<h1>${esc(top.h1)}</h1><p class="lede">${top.lede}</p></div>`
      : `<div class="section-head"><p class="eyebrow">${C.eyebrow}</p><h2>${C.h2}</h2><p class="lede">${C.lede}</p></div>`;
    return `<section class="section tint${top ? " contact-top" : ""}" id="contact"><div class="wrap">
  ${head}
  <div class="contact">
    <div class="contact-ways">
      <a class="btn btn-wa" href="${wa(C.waHello)}" target="_blank" rel="noopener">${I.wa}${C.chat}</a>
      <div class="way-pair">
        <div class="way"><span>${C.phoneLabel}</span><strong class="num"><a href="tel:+${cfg.phone}">${esc(cfg.phoneDisplay)}</a></strong></div>
        <div class="way"><span>${C.waLabel}</span><strong class="num"><a href="${wa(C.waHello)}" target="_blank" rel="noopener">${esc(cfg.whatsappDisplay)}</a></strong></div>
      </div>
      <div class="way"><span>${C.email}</span><strong><a href="mailto:${cfg.email}">${esc(cfg.email)}</a></strong></div>${top ? top.extra : ""}
    </div>
    <form class="card-form" data-contact novalidate toolname="contact_ruta_shuttle" tooldescription="Send a message to Ruta Shuttle about a private transfer in Ecuador: name, email, phone, travel date and trip details.">
      <div class="form-row">
        <div class="field"><label for="c-name">${C.name}</label><div class="control"><input id="c-name" name="name" autocomplete="name" required></div></div>
        <div class="field"><label for="c-email">${C.email}</label><div class="control"><input id="c-email" name="email" type="email" autocomplete="email" spellcheck="false" required></div></div>
      </div>
      <div class="form-row">
        <div class="field"><label for="c-phone">${C.phone}</label><div class="control"><input id="c-phone" name="phone" type="tel" autocomplete="tel"></div></div>
        ${dateField("c-date", "date", C.date)}
      </div>
      <div class="field"><label for="c-msg">${C.trip}</label><textarea id="c-msg" name="message" placeholder="${esc(C.tripPh)}" required></textarea></div>
      <button class="btn btn-blue" type="submit">${C.send}</button>
      <p class="form-status" role="status"></p>
    </form>
  </div>
</div></section>`;
  }

  function footer() {
    const F = T.footer;
    const PG = PAGES[lang];
    const top = routes.filter((r) => r.featured).slice(0, 6);
    return `<footer class="site-footer"><div class="wrap">
  <div class="foot-grid">
    <div style="display:grid;gap:12px;align-content:start"><img class="foot-logo" src="${url.asset("logo-full.png")}" alt="${F.logoAlt}" width="170" height="135" loading="lazy" decoding="async"><p class="note">${F.tag}</p></div>
    <div><h2>${F.destinations}</h2><ul>${Object.keys(hubs).map((h) => `<li><a href="${url.hub(h, lang)}">${hubs[h].name}</a></li>`).join("")}</ul></div>
    <div><h2>${F.popular}</h2><ul>${top.map((r) => `<li><a href="${url.route(r, lang)}">${esc(r.title)}</a></li>`).join("")}</ul></div>
    <div><h2>${F.contact}</h2><ul><li class="num">${F.phone}: <a href="tel:+${cfg.phone}">${esc(cfg.phoneDisplay)}</a></li><li class="num">${F.wa}: <a href="https://wa.me/${cfg.whatsapp}" target="_blank" rel="noopener">${esc(cfg.whatsappDisplay)}</a></li><li><a href="mailto:${cfg.email}">${esc(cfg.email)}</a></li><li><a href="${cfg.instagram}" target="_blank" rel="noopener">${F.follow}</a></li><li><a href="${cfg.tripadvisor}" target="_blank" rel="noopener">${F.ta}</a></li><li class="note">${F.address}: ${esc(cfg.address.display)}</li><li><a href="${url.page("contact", lang)}">${F.form}</a></li></ul></div>
    <div><h2>${PG.labels.company}</h2><ul>${["about", "contact", "privacy", "terms"].map((x) => `<li><a href="${url.page(x, lang)}">${PG.labels[x]}</a></li>`).join("")}</ul></div>
  </div>
  <p class="legal">© ${new Date().getFullYear()} ${esc(cfg.legalName)}, ${F.ruc} ${cfg.taxID}</p>
</div></footer>
<a class="wa-pin" href="${wa(T.contact.waHello)}" target="_blank" rel="noopener" aria-label="${F.pinAria}">${I.wa}<span>${F.pin}</span></a>
<dialog class="book" id="book-dialog" aria-labelledby="book-title">
  <div class="book-head"><div><p class="eyebrow">${T.dialog.eyebrow}</p><h2 id="book-title" style="font-size:1.4rem;margin-top:6px"></h2></div><button class="close" type="button" data-close aria-label="${T.dialog.close}">×</button></div>
  <div class="book-body">
    <div class="book-summary"></div>
    <div class="wt-slot"></div>
    <div class="book-wa" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center"></div>
    <p class="note">${T.dialog.note}</p>
  </div>
</dialog>`;
  }

  function page({ title, desc, body, here, alt, ld = [], noindex = false, file: fileOverride, head = "" }) {
    const data = {
      lang, locale: T.locale, t: T.js,
      places: Object.fromEntries(Object.entries(places).map(([k, p]) => [k, { name: pName(k, lang), label: pLabel(k, lang), kind: p.kind, quoteFrom: p.quoteFrom }])),
      routes: routes.map(({ id, from, to, title, price, duration, wetravelUuid, bookLink }) => ({ slug: id, from, to, title, price, duration, wetravelUuid, bookLink })),
      config: cfg, urls: Object.fromEntries(routes.map((r) => [r.id, url.route(r, lang)])), contactUrl: url.anchor("contact", lang),
      preview: MODE === "preview", icons: { wa: I.wa },
    };
    const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="preload" as="style" href="${FONT_CSS}" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="${FONT_CSS}"></noscript>`;
    const css = `<style>${CSS_MIN}</style>`;
    const js = `<script>window.RS=${JSON.stringify(data)};</script>` + (MODE === "preview" ? `<script>${JS}</script>` : `<script src="/assets/site.js" defer></script>`);
    const hreflang = MODE === "site" && !noindex ? LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${cfg.domain}${alt[l]}">`).join("\n") + `\n<link rel="alternate" hreflang="x-default" href="${cfg.domain}${alt.en}">` : "";
    const D = cfg.domain;
    const seo = noindex ? `<meta name="robots" content="noindex">` : MODE === "site" ? [
      `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">`,
      `<link rel="canonical" href="${D}${here}">`,
      `<meta property="og:type" content="website">`,
      `<meta property="og:site_name" content="Ruta Shuttle">`,
      `<meta property="og:title" content="${esc(title)}">`,
      `<meta property="og:description" content="${esc(desc)}">`,
      `<meta property="og:url" content="${D}${here}">`,
      `<meta property="og:image" content="${D}/assets/og-image.jpg">`,
      `<meta property="og:image:width" content="1200">`,
      `<meta property="og:image:height" content="630">`,
      `<meta property="og:locale" content="${lang === "es" ? "es_EC" : "en_US"}">`,
      `<meta property="og:locale:alternate" content="${lang === "es" ? "en_US" : "es_EC"}">`,
      `<meta name="twitter:card" content="summary_large_image">`,
    ].join("\n") : "";
    const graph = [BIZ(lang), { "@type": "WebSite", "@id": D + "/#website", url: D + "/", name: "Ruta Shuttle", inLanguage: ["en", "es"], publisher: { "@id": D + "/#business" } }, ...ld];
    const jsonld = noindex ? "" : `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c")}</script>`;
    const headBits = `<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0e141c" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${url.asset("logo-mark.png")}">
${hreflang}
${seo}
${jsonld}
${head}
${fonts}
${css}`;
    const inner = `${header(alt)}\n<main id="main">\n${body}\n</main>\n${footer()}\n${js}`;
    const file = fileOverride || fileFor(here);
    const isPreviewMain = MODE === "preview" && file === "index.html";
    const html = isPreviewMain
      ? `${headBits}\n<div lang="${lang}">${inner}</div>\n`
      : `<!doctype html>\n<html lang="${lang}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${headBits}\n</head>\n<body>\n${inner}\n</body>\n</html>\n`;
    const dest = path.join(OUT, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, html);
    if (MODE === "site" && here && !noindex) PAGE_HASH[here] = crypto.createHash("sha1").update(html).digest("hex");
  }
  const alts = (fn) => Object.fromEntries(LANGS.map((l) => [l, fn(l)]));
  const D = cfg.domain;
  const abs = (u) => (MODE === "site" ? D + u : u);
  const crumbs = (items) => ({ "@type": "BreadcrumbList", itemListElement: items.map(([name, u], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(u) })) });
  const faqLd = (items) => ({ "@type": "FAQPage", inLanguage: lang, mainEntity: items.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
  const serviceLd = (r) => ({
    "@type": "Service", "@id": abs(url.route(r, lang)) + "#service", name: r.title, description: r.blurb, inLanguage: lang,
    serviceType: lang === "es" ? "Traslado privado" : "Private transfer",
    provider: { "@id": D + "/#business" }, areaServed: { "@type": "Country", name: "Ecuador" }, url: abs(url.route(r, lang)),
    offers: { "@type": "Offer", price: String(r.price), priceCurrency: "USD", url: abs(url.route(r, lang)), availability: "https://schema.org/InStock",
      priceSpecification: { "@type": "UnitPriceSpecification", price: String(r.price), priceCurrency: "USD", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitText: lang === "es" ? "vehículo" : "vehicle" } } },
  });

  // ----- Home -----
  {
    const H = T.home;
    const hubCards = Object.entries(hubs).map(([k, h]) => {
      const rs = routes.filter((r) => r.hub === k);
      const min = Math.min(...rs.map((r) => r.price));
      return `<article class="hub">
  <div class="hub-top"><h3><a href="${url.hub(k, lang)}">${h.name}</a></h3><span class="hub-elev num">${h.elev}</span></div>
  <a class="hub-photo-a" href="${url.hub(k, lang)}" tabindex="-1" aria-hidden="true">${cityPhoto(k)}</a>
  <ul>${rs.slice(0, 4).map((r) => `<li><a href="${url.route(r, lang)}">${esc(r.title)}</a></li>`).join("")}</ul>
  <div class="hub-foot"><span class="num">${fmt(H.routesFrom, { n: rs.length, min })}</span><a class="go" href="${url.hub(k, lang)}">${H.seeAll}</a></div>
</article>`;
    }).join("");
    const reviews = cfg.reviews.length
      ? `<div class="grid cols-3">${cfg.reviews.map((r) => `<blockquote class="info"><p>${esc(r.text)}</p><footer class="note">${esc(r.name)}</footer></blockquote>`).join("")}</div>`
      : MODE === "preview" ? `<div class="placeholder">${H.reviewsPh}</div>` : "";
    const body = `
<section class="hero hero-photo"><div class="hero-bg">${coverPicture("home", H.heroAlt)}</div><div class="wrap">
  <div class="hero-copy"><p class="eyebrow">${H.eyebrow}</p><h1>${H.h1}</h1><p class="lede">${H.lede}</p></div>
</div></section>
<section class="search-band"><div class="wrap">
  ${searchBox()}
  ${trustRow()}
</div></section>

<section class="section" id="destinations"><div class="wrap">
  <div class="section-head"><p class="eyebrow">${H.destEyebrow}</p><h2>${H.destH2}</h2><p class="lede">${H.destLede}</p></div>
  <div class="grid cols-3">${hubCards}</div>
</div></section>

${stepsSection()}

<section class="section"><div class="wrap">
  <div class="section-head"><p class="eyebrow">${H.popEyebrow}</p><h2>${H.popH2}</h2></div>
  <div class="grid cols-3">${routes.filter((r) => r.featured).map(routeCard).join("")}</div>
</div></section>

${fleetSection()}

<section class="section tint"><div class="wrap grid cols-2" style="gap:40px;align-items:start">
  <div class="section-head" style="margin:0"><p class="eyebrow">${T.included.eyebrow}</p><h2>${T.included.h2}</h2></div>
  ${includedList()}
</div></section>

<section class="section" id="about"><div class="wrap grid cols-2" style="gap:40px;align-items:start">
  <div class="section-head" style="margin:0"><p class="eyebrow">${H.aboutEyebrow}</p><h2>${H.aboutH2}</h2></div>
  <div class="prose"><p>${fmt(H.aboutP1, { legal: esc(cfg.legalName) })}</p><p>${H.aboutP2}</p></div>
</div></section>

${reviews ? `<section class="section tint" id="reviews"><div class="wrap"><div class="section-head"><p class="eyebrow">${H.reviewsEyebrow}</p><h2>${H.reviewsH2}</h2></div>${reviews}</div></section>` : ""}

<section class="section"><div class="wrap">
  <div class="section-head"><p class="eyebrow">${H.faqEyebrow}</p><h2>${H.faqH2}</h2></div>
  ${faqBlock(T.faqGeneral, url.home(lang))}
</div></section>

${contactSection()}`;
    page({ title: H.title, desc: H.desc, body, here: url.home(lang), alt: alts((l) => url.home(l)), ld: [faqLd(T.faqGeneral)], head: coverPreload("home") });
  }

  // ----- City pages -----
  for (const k of Object.keys(hubs)) {
    const h = hubs[k], X = T.hub;
    const rs = routes.filter((r) => r.hub === k);
    const min = Math.min(...rs.map((r) => r.price));
    const origin = Object.keys(places).find((p) => places[p].hub === k && places[p].kind === "city");
    const others = Object.keys(hubs).filter((x) => x !== k);
    const v = { city: h.name, kw: h.keyword, lede: h.lede };
    const body = `
<section class="hero hero-photo hero-city"><div class="hero-bg">${coverPicture(k, T.cityAlt[k])}</div><div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="${url.home(lang)}">${T.nav.home}</a> / ${h.name}</nav>
  <div class="hero-copy"><p class="eyebrow">${fmt(X.eyebrow, v)}</p><h1>${esc(h.h1)}</h1><p class="lede">${esc(h.lede)}</p></div>
</div></section>
<section class="search-band"><div class="wrap">
  ${searchBox({ from: origin, heading: fmt(T.search.headingHub, v) })}
  ${trustRow()}
</div></section>

<section class="section"><div class="wrap">
  <dl class="facts">
    ${h.facts.map(([a, b]) => `<div class="fact"><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join("")}
    <div class="fact"><dt>${X.routes}</dt><dd class="num">${fmt(X.routesVal, { n: rs.length, min })}</dd></div>
  </dl>
</div></section>

<section class="section" style="padding-top:0"><div class="wrap">
  <div class="section-head"><p class="eyebrow">${fmt(X.allEyebrow, v)}</p><h2>${fmt(X.allH2, v)}</h2><p class="lede">${X.allLede}</p></div>
  <div class="grid cols-3">${rs.map(routeCard).join("")}</div>
  <p class="note" style="margin-top:18px">${X.notListed} <a href="${wa(fmt(X.waNotListed, v))}" target="_blank" rel="noopener">${X.notListedLink}</a> ${X.notListedTail}</p>
</div></section>

${stepsSection()}

<section class="section"><div class="wrap">
  <div class="section-head"><p class="eyebrow">${X.localEyebrow}</p><h2>${fmt(X.localH2, v)}</h2></div>
  <div class="grid cols-3">${h.local.map(([a, b]) => `<div class="info"><h3>${esc(a)}</h3><p>${esc(b)}</p></div>`).join("")}</div>
</div></section>

${fleetSection("vehicles")}

<section class="section tint"><div class="wrap">
  <div class="section-head"><p class="eyebrow">${X.faqEyebrow}</p><h2>${fmt(X.faqH2, v)}</h2></div>
  ${faqBlock([...h.faq, ...T.faqGeneral.slice(1, 4)], url.hub(k, lang))}
</div></section>

<section class="section"><div class="wrap">
  <div class="section-head"><p class="eyebrow">${X.otherEyebrow}</p><h2>${X.otherH2}</h2></div>
  <div class="grid cols-2">${others.map((o) => `<a class="hub" href="${url.hub(o, lang)}"><div class="hub-top"><h3>${hubs[o].name}</h3><span class="hub-elev num">${hubs[o].elev}</span></div>${cityPhoto(o)}<div class="hub-foot"><span>${esc(hubs[o].airport)}</span><span class="go">${X.seeRoutes}</span></div></a>`).join("")}</div>
</div></section>`;
    if (lang === "en") SITEMAP.push(alts((l) => url.hub(k, l)));
    page({ title: fmt(X.title, v), desc: fmt(X.desc, v), body, here: url.hub(k, lang), alt: alts((l) => url.hub(k, l)), head: coverPreload(k), ld: [
      crumbs([[T.nav.home, url.home(lang)], [h.name, url.hub(k, lang)]]),
      { "@type": "ItemList", name: fmt(X.allH2, v), itemListElement: rs.map((r, i) => ({ "@type": "ListItem", position: i + 1, url: abs(url.route(r, lang)), name: r.title })) },
      faqLd([...h.faq, ...T.faqGeneral.slice(1, 4)]),
    ] });
  }

  // ----- Route pages -----
  function profileSvg(pts, names) {
    const R0 = T.route;
    const W = 760, H = 260, L = 46, R = 20, Tp = 70, B = 40;
    const maxKm = pts[pts.length - 1][2], maxE = 4500;
    const x = (km) => L + (km / maxKm) * (W - L - R);
    const y = (e) => Tp + (1 - e / maxE) * (H - Tp - B);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p[2]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(" ");
    const area = `${line} L${x(maxKm)} ${y(0)} L${x(0)} ${y(0)}Z`;
    const ticks = [0, 1000, 2000, 3000, 4000].map((e) => `<line x1="${L}" x2="${W - R}" y1="${y(e)}" y2="${y(e)}" stroke="var(--line)"/><text class="axis" x="${L - 8}" y="${y(e) + 4}" text-anchor="end">${e ? e / 1000 + "k" : "0"}</text>`).join("");
    let prevX = -999, prevLift = 0;
    const labels = pts.map((p, i) => {
      const anchor = i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle";
      let ly = y(p[1]) - 26;
      const lift = Math.abs(x(p[2]) - prevX) < 110 && !prevLift ? 30 : 0;
      ly -= lift; prevX = x(p[2]); prevLift = lift;
      const last = i === pts.length - 1;
      return `<circle cx="${x(p[2])}" cy="${y(p[1])}" r="4.5" fill="${last ? "var(--orange)" : "var(--card)"}" stroke="${last ? "var(--orange)" : "var(--blue-ink)"}" stroke-width="2.5"/>
<text class="lbl" x="${x(p[2])}" y="${ly}" text-anchor="${anchor}">${esc(names[p[0]] || p[0])}</text><text class="sub" x="${x(p[2])}" y="${ly + 13}" text-anchor="${anchor}">${fmtElev(p[1], lang)}</text>`;
    }).join("");
    const kmTicks = [0, 50, 100, 150, maxKm].map((k) => `<text class="axis" x="${x(k)}" y="${H - 14}" text-anchor="middle">${k} km</text>`).join("");
    const first = pts[0], last = pts[pts.length - 1];
    const aria = fmt(R0.profileAria, { a: names[first[0]] || first[0], ae: fmtElev(first[1], lang), b: names[last[0]] || last[0], be: fmtElev(last[1], lang) });
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}">${ticks}<path d="${area}" fill="var(--blue-ink)" opacity=".12"/><path d="${line}" fill="none" stroke="var(--blue-ink)" stroke-width="3" stroke-linejoin="round"/>${labels}${kmTicks}<text class="axis" x="${L - 8}" y="${Tp - 18}" text-anchor="end">m</text></svg>`;
  }

  for (const r of routes) {
    const R0 = T.route;
    const a = pName(r.from, lang), b = pName(r.to, lang);
    const rc = rich[r.id] && rich[r.id][lang];
    const h = hubs[r.hub];
    const reverse = routes.find((x) => x.from === r.to && x.to === r.from);
    const related = routes.filter((x) => x.hub === r.hub && x.id !== r.id).slice(0, 6);
    const facts = rc ? rc.facts : [
      [R0.factFrom, pLabel(r.from, lang)], [R0.factTo, pLabel(r.to, lang)],
      [R0.factTime, r.duration + (r.km ? "" : R0.approx)],
      [R0.factElev, fmt(R0.elevVal, { a: fmtElev(places[r.from].elev, lang), b: fmtElev(places[r.to].elev, lang) })],
    ];
    const intro = rc ? rc.intro : [fmt(R0.intro1, { blurb: r.blurb, to: b }), R0.intro2];
    const faq = rc ? [...rc.faq, ...T.faqGeneral.slice(1, 5)] : [[fmt(R0.faqDurQ, { a, b }), fmt(R0.faqDurA, { dur: r.duration })], ...T.faqGeneral.slice(1, 5)];
    const v = { city: h.name, title: r.title, kw: r.keyword, blurb: r.blurb, price: r.price };
    const body = `
<section class="hero"><div class="hero-art">${heroArt}</div><div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="${url.home(lang)}">${T.nav.home}</a> / <a href="${url.hub(r.hub, lang)}">${h.name}</a> / ${esc(r.title)}</nav>
  <div class="hero-copy"><p class="eyebrow">${R0.eyebrow}</p><h1>${esc(r.keyword)}</h1><p class="lede">${esc(r.blurb)}</p></div>
  ${trustRow()}
</div></section>

<section class="section" style="padding-top:44px"><div class="wrap route-layout">
  <div class="stack">
    <dl class="facts">${facts.map(([x, y]) => `<div class="fact"><dt>${esc(x)}</dt><dd>${esc(y)}</dd></div>`).join("")}</dl>
    <div class="prose">${intro.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
    ${r.profile ? `<figure class="profile" style="margin:0"><figcaption><h2 style="font-size:1.3rem">${R0.profileH2}</h2><p class="note">${R0.profileNote}</p></figcaption><div class="profile-chart">${profileSvg(r.profile, (rc && rc.profile) || {})}</div></figure>` : ""}
    ${rc ? rc.sections.map(([t, p]) => `<div class="prose"><h2 style="font-size:1.35rem">${esc(t)}</h2><p>${esc(p)}</p></div>`).join("") : ""}
    <div class="stack" style="gap:16px"><h2 style="font-size:1.35rem">${T.included.h2Route}</h2>${includedList()}</div>
  </div>
  <aside class="book-card" aria-label="${R0.bookAria}">
    <div class="price num"><small>${R0.fromPerVehicle}</small>$${r.price}</div>
    <ul>${R0.bookList.map((li) => `<li>${esc(li)}</li>`).join("")}</ul>
    <button class="btn btn-primary" type="button" data-book="${r.id}">${T.js.book}</button>
    <a class="btn btn-wa" href="${wa(fmt(R0.waBook, v))}" target="_blank" rel="noopener">${I.wa}${R0.askWA}</a>
    ${reverse ? `<p class="note">${R0.reverse} <a href="${url.route(reverse, lang)}">${esc(reverse.title)}</a></p>` : ""}
  </aside>
</div></section>

${fleetSection("vehicles")}

<section class="section tint"><div class="wrap">
  <div class="section-head"><p class="eyebrow">${R0.faqEyebrow}</p><h2>${fmt(R0.faqH2, v)}</h2></div>
  ${faqBlock(faq, url.route(r, lang))}
</div></section>

<section class="section"><div class="wrap">
  <div class="section-head"><p class="eyebrow">${fmt(R0.moreEyebrow, v)}</p><h2>${fmt(R0.moreH2, v)}</h2></div>
  <div class="grid cols-3">${related.map(routeCard).join("")}</div>
  <p style="margin-top:20px"><a class="btn btn-ghost" href="${url.hub(r.hub, lang)}">${fmt(R0.allBtn, v)}</a></p>
</div></section>`;
    // Keep titles under ~60 characters and descriptions under ~160 so Google shows them whole.
    let rTitle = fmt(R0.title, v);
    if (rTitle.length > 60) rTitle = `${v.kw} | Ruta Shuttle`;
    let rDesc = fmt(R0.desc, v);
    if (rDesc.length > 160) rDesc = rDesc.replace(lang === "es" ? "Privado, puerta a puerta, desde" : "Private, door to door, from", lang === "es" ? "Desde" : "From");
    page({ title: rTitle, desc: rDesc, body, here: url.route(r, lang), alt: alts((l) => url.route(r, l)), ld: [
      crumbs([[T.nav.home, url.home(lang)], [h.name, url.hub(r.hub, lang)], [r.title, url.route(r, lang)]]),
      serviceLd(r),
      faqLd(faq),
    ] });
    if (lang === "en") SITEMAP.push(alts((l) => url.route(r, l)));
  }

  // ----- About, contact, privacy, terms -----
  {
    const PG = PAGES[lang];
    const fill = (s) => s.replace("{address}", esc(cfg.address.display)).replace("{email}", `<a href="mailto:${cfg.email}">${cfg.email}</a>`);
    const simple = (k, inner, extraLd = []) => {
      const X = PG[k];
      const body = `
<section class="section page-head"><div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="${url.home(lang)}">${T.nav.home}</a> / ${esc(X.h1)}</nav>
  <h1>${esc(X.h1)}</h1>${X.lede ? `<p class="lede">${X.lede}</p>` : ""}${X.updated ? `<p class="note">${X.updated}</p>` : ""}
</div></section>
${inner}`;
      page({ title: X.title, desc: X.desc, body, here: url.page(k, lang), alt: alts((l) => url.page(k, l)),
        ld: [crumbs([[T.nav.home, url.home(lang)], [X.h1, url.page(k, lang)]]), ...extraLd] });
      if (lang === "en") SITEMAP.push(alts((l) => url.page(k, l)));
    };
    const H = T.home, A = PG.about;
    simple("about", `<section class="section" style="padding-top:8px"><div class="wrap grid cols-2" style="gap:40px;align-items:start">
  <div class="prose"><p>${fmt(H.aboutP1, { legal: esc(cfg.legalName) })}</p><p>${H.aboutP2}</p></div>
  <div><h2 style="font-size:1.25rem;margin-bottom:12px">${A.factsH2}</h2><dl class="facts-list">${A.facts.map(([d, v]) => `<div><dt>${d}</dt><dd>${fill(v)}</dd></div>`).join("")}</dl></div>
</div></section>`, [{ "@type": "AboutPage", url: abs(url.page("about", lang)), about: { "@id": cfg.domain + "/#business" } }]);
    const C = PG.contact;
    {
      const crumbsHtml = `<nav class="crumbs" aria-label="Breadcrumb"><a href="${url.home(lang)}">${T.nav.home}</a> / ${esc(C.h1)}</nav>`;
      const extra = `
      <div class="way-pair">
        <div class="way"><span>${C.social}</span><strong><a href="${cfg.instagram}" target="_blank" rel="noopener">@ruta_shuttle_transporte</a></strong></div>
        <div class="way"><span>${C.reviews}</span><strong><a href="${cfg.tripadvisor}" target="_blank" rel="noopener">${C.taLink}</a></strong></div>
      </div>`;
      const mapSrc = `https://maps.google.com/maps?q=${cfg.geo.lat},${cfg.geo.lng}&z=15&hl=${lang}&output=embed`;
      const body = `${contactSection({ h1: C.h1, lede: C.lede, crumbs: crumbsHtml, extra })}
<section class="section"><div class="wrap map-wrap">
  <div class="map-copy"><h2>${C.mapH2}</h2><p class="lede">${C.mapP}</p><p class="addr-line">${esc(cfg.address.display)}</p>
    <a class="btn btn-ghost" href="${cfg.maps}" target="_blank" rel="noopener">${C.mapBtn}</a></div>
  <div class="map-frame"><iframe src="${mapSrc}" title="${esc(C.mapTitle)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>
</div></section>`;
      page({ title: C.title, desc: C.desc, body, here: url.page("contact", lang), alt: alts((l) => url.page("contact", l)),
        ld: [crumbs([[T.nav.home, url.home(lang)], [C.h1, url.page("contact", lang)]]), { "@type": "ContactPage", url: abs(url.page("contact", lang)), about: { "@id": cfg.domain + "/#business" } }] });
      if (lang === "en") SITEMAP.push(alts((l) => url.page("contact", l)));
    }
    for (const k of ["privacy", "terms"]) simple(k, `<section class="section" style="padding-top:8px"><div class="wrap"><div class="prose">
  ${PG[k].sections.map(([h, p]) => `<h2 style="font-size:1.2rem;margin-top:8px">${h}</h2><p>${fill(p)}</p>`).join("\n  ")}
</div></div></section>`);
  }

  // ----- 404 -----
  {
    const E = T.e404;
    const body = `
<section class="hero e404"><div class="hero-art">${heroArt}</div><div class="wrap e404-grid">
  <div class="e404-copy">
    <p class="eyebrow">${E.eyebrow}</p>
    <p class="err-code" aria-hidden="true">4${TIRE}4</p>
    <h1>${E.h1}</h1>
    <p class="lede">${E.p1}</p>
    <p class="lede">${E.p2}</p>
    <div class="e404-actions"><a class="btn btn-primary" href="${url.home(lang)}">${E.home}</a><a class="btn btn-wa" href="${wa(E.waText)}" target="_blank" rel="noopener">${I.wa}${E.wa}</a></div>
  </div>
  <div class="e404-scene">${SCENE404(E.art)}</div>
</div></section>

<section class="section" style="padding-top:44px"><div class="wrap">
  ${searchBox({ heading: E.searchH })}
</div></section>

<section class="section tint"><div class="wrap">
  <div class="section-head"><h2>${E.destH2}</h2></div>
  <div class="grid cols-3">${Object.keys(hubs).map((o) => `<a class="hub" href="${url.hub(o, lang)}"><div class="hub-top"><h3>${hubs[o].name}</h3><span class="hub-elev num">${hubs[o].elev}</span></div>${cityPhoto(o)}<div class="hub-foot"><span>${esc(hubs[o].airport)}</span><span class="go">${T.hub.seeRoutes}</span></div></a>`).join("")}</div>
</div></section>

<section class="section"><div class="wrap">
  <div class="section-head"><h2>${E.popH2}</h2></div>
  <div class="grid cols-3">${routes.filter((r) => r.featured).map(routeCard).join("")}</div>
</div></section>`;
    page({ title: E.title, desc: E.desc, body, here: lang === "es" ? "/es/404.html" : "/404.html", alt: alts((l) => url.home(l)), noindex: true,
      file: MODE === "preview" ? `${P(lang)}404.html` : (lang === "es" ? "es/404.html" : "404.html") });
  }
}

// ---------- Build ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
LANGS.forEach(buildLang);
const assetOut = MODE === "preview" ? OUT : path.join(OUT, "assets");
fs.mkdirSync(assetOut, { recursive: true });
for (const f of ["logo-mark.png", "logo-full.png", ...(MODE === "site" ? ["site.js", "og-image.jpg"] : [])]) fs.copyFileSync(path.join(ROOT, "assets", f), path.join(assetOut, f));
fs.mkdirSync(path.join(assetOut, "hero"), { recursive: true });
for (const dir of ["hero", "cities", "covers"]) { fs.mkdirSync(path.join(assetOut, dir), { recursive: true }); for (const f of fs.readdirSync(path.join(ROOT, "assets", dir))) fs.copyFileSync(path.join(ROOT, "assets", dir, f), path.join(assetOut, dir, f)); }
if (MODE === "site") {
  const D = cfg.domain, today = new Date().toISOString().slice(0, 10);
  // lastmod = the day a page's HTML really changed (kept in data/lastmod.json)
  const lmFile = path.join(ROOT, "data", "lastmod.json");
  const LM = fs.existsSync(lmFile) ? JSON.parse(fs.readFileSync(lmFile, "utf8")) : {};
  for (const [u, h] of Object.entries(PAGE_HASH)) if (!LM[u] || LM[u].hash !== h) LM[u] = { hash: h, date: today };
  for (const u of Object.keys(LM)) if (!PAGE_HASH[u]) delete LM[u];
  fs.writeFileSync(lmFile, JSON.stringify(Object.fromEntries(Object.entries(LM).sort()), null, 1) + "\n");
  const all = [{ en: url.home("en"), es: url.home("es") }, ...SITEMAP];
  const imgFor = (p) => {
    const hub = Object.keys(COVERS).find((k) => k !== "home" && p === url.hub(k, "en"));
    const c = p === url.home("en") ? COVERS.home : hub ? COVERS[hub] : null;
    const extra = p === url.home("en") ? ["cuenca", "quito", "guayaquil"].map((k) => `${D}/assets/cities/${k}-960.jpg`) : [];
    const list = c ? [`${D}/assets/${c.dir}/${c.base}-${c.w[c.w.length - 1]}.jpg`, ...extra] : [`${D}/assets/og-image.jpg`];
    return list.map((u) => `    <image:image><image:loc>${u}</image:loc></image:image>\n`).join("");
  };
  const entry = (alt, l) => `  <url>\n    <loc>${D}${alt[l]}</loc>\n    <lastmod>${(LM[alt[l]] || { date: today }).date}</lastmod>\n` +
    LANGS.map((x) => `    <xhtml:link rel="alternate" hreflang="${x}" href="${D}${alt[x]}"/>`).join("\n") +
    `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${D}${alt.en}"/>\n` + imgFor(alt.en) + `  </url>`;
  fs.writeFileSync(path.join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    all.flatMap((alt) => LANGS.map((l) => entry(alt, l))).join("\n") + `\n</urlset>\n`);
  const BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "Bingbot", "Googlebot"];
  fs.writeFileSync(path.join(OUT, "robots.txt"), `# Search engines and AI assistants are welcome to read this site.\n# Content signals: https://contentsignals.org/\nUser-agent: *\nContent-Signal: search=yes, ai-input=yes, ai-train=yes\nAllow: /\n\n` + BOTS.map((x) => `User-agent: ${x}\nAllow: /\n`).join("\n") + `\nSitemap: ${D}/sitemap.xml\n`);
  const R = routesFor("en");
  const llms = [
    "# Ruta Shuttle", "",
    "> Private tourist transportation across Ecuador: airport transfers and door-to-door rides from Quito, Cuenca and Guayaquil. Ruta Shuttle is the trade name of " + cfg.legalName + ", founded in 2017 and registered in Puerto López, Manabí, Ecuador. It holds a national tourist transport permit and has vehicles based in Ecuador's main cities, so it serves the whole country. Prices are per vehicle, in US dollars. Bookings online through WeTravel or on WhatsApp. Service in English and Spanish.", "",
    "## Destinations",
    ...Object.keys(hubsEn).map((h) => `- [${hubsEn[h].keyword}](${D}${url.hub(h, "en")}): ${hubsEn[h].lede}`), "",
    "## Routes",
    ...R.map((r) => `- [${r.title}](${D}${url.route(r, "en")}): from $${r.price} per vehicle, ${r.duration}. ${r.blurb}`), "",
    "## Questions travelers ask",
    ...TEXT.en.faqGeneral.map(([q, a]) => `### ${q}\n${a}\n`), "",
    "## Vehicles",
    ...TEXT.en.fleet.items.map((v) => `- ${v.name}: ${v.pax} passengers. ${v.note}.`), "",
    "## Español",
    `- [Transportes Ecuador](${D}${url.home("es")}): versión en español del sitio.`, "",
    "## Company",
    ...["about", "contact", "privacy", "terms"].map((k) => `- [${PAGES.en.labels[k]}](${D}/${PAGES.en.slugs[k]}/)`), "",
    "## Contact",
    `- Phone (calls): ${cfg.phoneDisplay}`, `- WhatsApp: ${cfg.whatsappDisplay} (https://wa.me/${cfg.whatsapp})`, `- Email: ${cfg.email}`, `- Registered office: ${cfg.address.display}`, `- Instagram: ${cfg.instagram}`, `- Google Maps: ${cfg.maps}`, `- Tripadvisor: ${cfg.tripadvisor}`, `- Contact page: ${D}/contact/`, "",
  ].join("\n");
  fs.writeFileSync(path.join(OUT, "llms.txt"), llms);
  fs.writeFileSync(path.join(OUT, "index.md"), llms);
  for (const f of ["sitemap.xsl", "_headers"]) fs.copyFileSync(path.join(ROOT, "src", f), path.join(OUT, f));
}
const built = fs.readdirSync(OUT, { recursive: true }).filter((f) => String(f).endsWith(".html")).length;
console.log(`Built ${MODE}: ${built} HTML pages (${built / LANGS.length} per language, incl. 404) -> ${OUT}`);
