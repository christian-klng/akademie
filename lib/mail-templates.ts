import { formatEventDate, formatEventTime } from "./format";
import type { Event, Registration } from "./schema";
import { SITE_URL, SUPPORT_EMAIL } from "./site";
import { checkoutUrlFor } from "./stripe";
import type { Mail } from "./mail";

// All participant mails. Plain German, du-form, short sentences — same voice as
// the website. Every mail ships text and a very simple HTML version; the HTML
// is built from the same lines, so the two can't drift apart.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Turn the plain-text body into HTML: paragraphs, URLs as links. */
function toHtml(text: string): string {
  const paragraphs = text
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const lines = escapeHtml(block).split("\n").join("<br />");
      const linked = lines.replace(
        /(https?:\/\/[^\s<]+)/g,
        '<a href="$1" style="color:#1d4ed8">$1</a>',
      );
      return `<p style="margin:0 0 16px">${linked}</p>`;
    })
    .join("\n");

  return [
    '<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;',
    'font-size:15px;line-height:1.6;color:#171717;max-width:560px">',
    paragraphs,
    "</div>",
  ].join("");
}

function mail(to: string, subject: string, text: string): Mail {
  return { to, subject, text: text.trim(), html: toHtml(text) };
}

/** "Mittwoch, 19. August 2026, 09:00–13:00 Uhr" */
function when(event: Event): string {
  return `${formatEventDate(event.startsAt)}, ${formatEventTime(event.startsAt, event.endsAt)}`;
}

/**
 * Where the event happens. `withAccess` adds the online link — that one is only
 * ever sent to people who actually hold a seat.
 */
function where(event: Event, withAccess: boolean): string {
  if (event.format === "online") {
    const label = event.location || "Online";
    if (withAccess && event.onlineUrl) {
      return `${label}\nDein Zugangslink: ${event.onlineUrl}`;
    }
    return `${label}\nDen Zugangslink schicken wir dir rechtzeitig vor dem Termin.`;
  }
  return event.location || "Der Ort steht noch nicht fest.";
}

function eventBlock(event: Event, withAccess: boolean): string {
  const lines = [
    `Was: ${event.title}`,
    `Wann: ${when(event)}`,
    `Wo: ${where(event, withAccess)}`,
  ];
  if (event.price) lines.push(`Preis: ${event.price}`);
  return lines.join("\n");
}

function signature(): string {
  return [
    "Wenn du Fragen hast, antworte einfach auf diese E-Mail.",
    "",
    "Viele Grüße",
    "Christian von der Kubikraum Akademie",
    SUPPORT_EMAIL,
  ].join("\n");
}

/** Sent once a seat is really secured — free event, or payment confirmed. */
export function confirmationMail(event: Event, reg: Registration): Mail {
  return mail(
    reg.email,
    `Anmeldung bestätigt: ${event.title}`,
    `Hallo ${reg.name},

deine Anmeldung ist bestätigt. Wir freuen uns auf dich!

${eventBlock(event, true)}

Alle Infos zur Veranstaltung findest du hier:
${SITE_URL}/events/${event.slug}

Du kannst nicht kommen? Sag uns kurz Bescheid, dann rückt jemand von der Warteliste nach.

${signature()}`,
  );
}

/** Sent when the event was already full at sign-up time. */
export function waitlistMail(event: Event, reg: Registration): Mail {
  return mail(
    reg.email,
    `Warteliste: ${event.title}`,
    `Hallo ${reg.name},

danke für deine Anmeldung. Alle Plätze sind gerade vergeben — du stehst jetzt auf der Warteliste.

${eventBlock(event, false)}

Sobald ein Platz frei wird, melden wir uns bei dir. Du musst nichts weiter tun.

${signature()}`,
  );
}

/**
 * Sent when an admin moves someone up from the waiting list. For a paid event
 * the seat is held but not yet secured — the mail carries the payment link.
 */
export function seatFreeMail(event: Event, reg: Registration): Mail {
  const payLine = event.stripeCheckoutUrl
    ? `Damit dein Platz sicher ist, bezahle bitte über diesen Link:
${checkoutUrlFor(event.stripeCheckoutUrl, reg.id, reg.email)}

`
    : "";

  return mail(
    reg.email,
    `Ein Platz ist frei geworden: ${event.title}`,
    `Hallo ${reg.name},

gute Nachricht: Es ist ein Platz frei geworden, und der gehört jetzt dir.

${eventBlock(event, !event.stripeCheckoutUrl)}

${payLine}${signature()}`,
  );
}

/** Short internal notice so a new sign-up is visible without opening the admin. */
export function adminNoticeMail(
  to: string,
  event: Event,
  reg: Registration,
): Mail {
  const status =
    reg.status === "warteliste"
      ? "Warteliste"
      : reg.paymentStatus === "offen"
        ? "angemeldet, Zahlung offen"
        : "angemeldet";

  return mail(
    to,
    `Neue Anmeldung: ${event.title}`,
    `${reg.name} <${reg.email}> hat sich angemeldet.

Veranstaltung: ${event.title}
Termin: ${when(event)}
Status: ${status}
${reg.message ? `\nNachricht:\n${reg.message}\n` : ""}
Alle Anmeldungen: ${SITE_URL}/admin/anmeldungen?event=${event.id}`,
  );
}
