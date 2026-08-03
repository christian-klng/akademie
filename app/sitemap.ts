import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { listPublishedEvents } from "@/lib/queries";
import { quizKategorien } from "@/lib/quizzes";

// Served dynamically: the event list comes from the DB, which isn't reachable
// at build time (placeholder DATABASE_URL in the Docker image).
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/events`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/quizzes`, changeFrequency: "monthly", priority: 0.6 },
    ...quizKategorien.map((k) => ({
      url: `${SITE_URL}/quizzes/${k.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${SITE_URL}/impressum`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/datenschutz`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/agb`, changeFrequency: "yearly", priority: 0.2 },
  ];

  try {
    const events = await listPublishedEvents();
    return [
      ...staticEntries,
      ...events.map((e) => ({
        url: `${SITE_URL}/events/${e.slug}`,
        lastModified: e.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  } catch {
    // DB unavailable — still serve the static part rather than a 500.
    return staticEntries;
  }
}
