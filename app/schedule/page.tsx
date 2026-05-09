import { createServiceClient } from "@/lib/supabase/server";

export const revalidate = 3600; // revalidate every hour

export default async function SchedulePage() {
  const supabase = createServiceClient();
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .order("sort_order", { ascending: true });

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-heading text-deep-sage mb-2 text-center">
        Schedule
      </h1>
      <p className="text-center text-dark/60 mb-12">
        Here&apos;s what we have planned. More details to come as the day gets
        closer.
      </p>

      {!events || events.length === 0 ? (
        <p className="text-center text-dark/60">
          Events will be posted here soon. Check back!
        </p>
      ) : (
        <div className="space-y-6">
          {events.map((event) => (
            <div
              key={event.id}
              className="rounded-xl border border-sage/30 bg-white p-6"
            >
              <h2 className="text-xl font-heading text-deep-sage mb-2">
                {event.name}
              </h2>

              <div className="space-y-1 mb-4">
                {event.starts_at && (
                  <p className="text-sm text-dark/70">
                    {new Date(event.starts_at).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {event.ends_at && (
                      <>
                        {" "}
                        &middot;{" "}
                        {new Date(event.starts_at).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}{" "}
                        to{" "}
                        {new Date(event.ends_at).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </>
                    )}
                  </p>
                )}

                {event.location && (
                  <p className="text-sm text-dark/70">{event.location}</p>
                )}

                {event.address && (
                  <p className="text-sm text-dark/50">{event.address}</p>
                )}

                {event.dress_code && (
                  <p className="text-sm text-dark/70">
                    Dress code: {event.dress_code}
                  </p>
                )}
              </div>

              {event.description && (
                <p className="text-dark/70">{event.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
