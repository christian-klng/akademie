import { listVideos } from "@/lib/queries";
import { EventForm } from "../event-form";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const videos = await listVideos();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Neues Event</h1>
      <div className="mt-6">
        <EventForm
          videos={videos.map((v) => ({ id: v.id, title: v.title }))}
          initial={{
            id: "",
            title: "",
            slug: "",
            teaser: "",
            body: "",
            location: "",
            format: "vor_ort",
            onlineUrl: "",
            price: "",
            capacity: "",
            stripeCheckoutUrl: "",
            registrationOpen: true,
            videoId: "",
            startsAt: "",
            endsAt: "",
            published: false,
          }}
        />
      </div>
    </div>
  );
}
