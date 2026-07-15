import { EventForm } from "../event-form";

export const dynamic = "force-dynamic";

export default function NewEventPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Neues Event</h1>
      <div className="mt-6">
        <EventForm
          initial={{
            id: "",
            title: "",
            slug: "",
            teaser: "",
            body: "",
            location: "",
            price: "",
            startsAt: "",
            endsAt: "",
            published: false,
          }}
        />
      </div>
    </div>
  );
}
