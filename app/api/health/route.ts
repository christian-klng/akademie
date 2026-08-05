// Liveness probe for the container HEALTHCHECK and for Coolify's rolling
// update: the old container only goes away once this answers 200 on the new one.
//
// Deliberately does NOT touch the database. A short DB hiccup would otherwise
// mark the container unhealthy, Traefik would drop it from routing, and a small
// problem would turn into an outage. This answers one question only: is this
// process serving HTTP?
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json(
    { status: "ok" },
    { headers: { "cache-control": "no-store" } },
  );
}
