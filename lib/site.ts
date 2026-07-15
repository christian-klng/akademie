// Central site constants. SITE_URL is read at runtime (server-side only), so
// it stays configurable via the container environment without a rebuild.
export const SITE_URL =
  process.env.SITE_URL ?? "https://akademie.kubikraum.digital";
export const SITE_NAME = "Kubikraum Akademie";
export const SITE_SLOGAN =
  "Erstelle deine eigene Software — ohne Programmierkenntnisse";
export const SITE_DESCRIPTION =
  "Weiterbildung rund um KI und Software — für Fachleute ohne Technik-Hintergrund. In einfacher Sprache, Schritt für Schritt.";
export const SUPPORT_EMAIL = "christian@kubikraum.digital";
