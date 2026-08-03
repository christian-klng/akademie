import { desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db, schema } from "@/lib/db";

// CSV of the sign-ups, for attendance lists and name badges. Behind the admin
// gate (proxy.ts matches /admin/:path*).
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COLUMNS = [
  "Name",
  "E-Mail",
  "Veranstaltung",
  "Status",
  "Zahlung",
  "Angemeldet am",
  "Nachricht",
];

/** Quote everything: names contain commas, messages contain line breaks. */
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest): Promise<Response> {
  const param = request.nextUrl.searchParams.get("event");
  const eventId = param && UUID_RE.test(param) ? param : null;

  const query = db
    .select({
      registration: schema.registration,
      eventTitle: schema.event.title,
    })
    .from(schema.registration)
    .innerJoin(schema.event, eq(schema.registration.eventId, schema.event.id))
    .orderBy(desc(schema.registration.createdAt));

  const rows = eventId
    ? await query.where(eq(schema.registration.eventId, eventId))
    : await query;

  const lines = [
    COLUMNS.map(csvCell).join(";"),
    ...rows.map(({ registration: r, eventTitle }) =>
      [
        r.name,
        r.email,
        eventTitle,
        r.status,
        r.paymentStatus,
        r.createdAt.toISOString().slice(0, 10),
        r.message,
      ]
        .map(csvCell)
        .join(";"),
    ),
  ];

  // Semicolons and a BOM: that's the combination German Excel opens correctly.
  // Written as an escape — an invisible literal is too easy to lose in an edit.
  const body = `\uFEFF${lines.join("\r\n")}\r\n`;

  return new Response(body, {
    headers: {
      "content-type": "text/csv;charset=utf-8",
      "content-disposition": 'attachment; filename="anmeldungen.csv"',
      "cache-control": "no-store",
    },
  });
}
