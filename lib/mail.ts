import "server-only";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { SUPPORT_EMAIL } from "./site";

// SMTP sending. The transport is created LAZILY and cached on globalThis —
// same reasoning as lib/db.ts: modules are evaluated during the Docker build,
// where no SMTP credentials exist.
//
// Without SMTP_HOST the mail is written to the console instead of failing.
// That keeps `npm run dev` usable without a mail account, and a misconfigured
// deployment loses the mail but never the registration.

const globalForMail = globalThis as unknown as {
  akademieMailer?: Transporter;
};

export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

function getTransport(): Transporter {
  if (globalForMail.akademieMailer) return globalForMail.akademieMailer;

  const port = Number(process.env.SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 is implicit TLS; 587 starts plain and upgrades via STARTTLS.
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" }
      : undefined,
  });
  globalForMail.akademieMailer = transport;
  return transport;
}

function fromAddress(): string {
  return process.env.SMTP_FROM ?? `Kubikraum Akademie <${SUPPORT_EMAIL}>`;
}

/** Where internal "new sign-up" notices go. */
export function notifyAddress(): string {
  return process.env.NOTIFY_EMAIL?.trim() || SUPPORT_EMAIL;
}

export type Mail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/**
 * Send one mail. Never throws: a failed mail must not roll back a sign-up that
 * is already in the database. Returns whether it went out.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  if (!isMailConfigured()) {
    console.info(
      `[mail] SMTP_HOST nicht gesetzt — Mail nur geloggt.\n` +
        `        An: ${mail.to}\n        Betreff: ${mail.subject}\n\n${mail.text}\n`,
    );
    return false;
  }

  try {
    await getTransport().sendMail({
      from: fromAddress(),
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    console.info(`[mail] gesendet an ${mail.to}: ${mail.subject}`);
    return true;
  } catch (err) {
    // Log the failure, not the recipient's message body.
    console.error(
      `[mail] Versand fehlgeschlagen (${mail.subject}):`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}
