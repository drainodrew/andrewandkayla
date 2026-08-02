import { createServiceClient } from "@/lib/supabase/server";
import { SeatingChart } from "@/components/admin/seating-chart";
import type {
  AttendingGuest,
  FloorObject,
  SeatedGuest,
} from "@/lib/seating";

/**
 * Reception seating chart.
 *
 * Only guests who are ATTENDING the wedding are seatable. Declined and
 * no-response guests are excluded outright rather than shown greyed out,
 * because a 208-name list is long enough without padding it with people
 * who aren't coming.
 */
export default async function AdminSeatingPage() {
  const supabase = createServiceClient();

  // The wedding is the only event with a seating chart. Matches the rule the
  // rest of the app uses: slug contains "wedding".
  const { data: events } = await supabase.from("events").select("id, slug, name");
  const weddingEvent = (events ?? []).find((e) => e.slug?.includes("wedding"));

  if (!weddingEvent) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-heading text-3xl text-deep-sage mb-4">Seating</h1>
        <p className="text-dark/70">
          No wedding event found, so there is nothing to seat yet.
        </p>
      </div>
    );
  }

  const [objectsResult, assignmentsResult, rsvpsResult, guestsResult, partiesResult] =
    await Promise.all([
      supabase
        .from("floor_plan_objects")
        .select(
          "id, kind, label, x_ft, y_ft, rotation_deg, seat_count, diameter_ft, width_ft, height_ft, sort_order"
        )
        .order("sort_order"),
      supabase
        .from("seat_assignments")
        .select("guest_id, object_id, seat_number"),
      supabase
        .from("rsvps")
        .select("guest_id")
        .eq("event_id", weddingEvent.id)
        .eq("status", "attending"),
      supabase.from("guests").select("id, party_id, first_name, last_name"),
      supabase.from("parties").select("id, invite_name"),
    ]);

  const attendingIds = new Set((rsvpsResult.data ?? []).map((r) => r.guest_id));
  const partyNameById = new Map(
    (partiesResult.data ?? []).map((p) => [p.id, p.invite_name])
  );

  const attendingGuests: AttendingGuest[] = (guestsResult.data ?? [])
    .filter((g) => attendingIds.has(g.id))
    .map((g) => ({
      id: g.id,
      first_name: g.first_name,
      last_name: g.last_name,
      party_id: g.party_id,
      party_name: partyNameById.get(g.party_id) ?? "Unknown party",
    }))
    .sort((a, b) =>
      `${a.last_name} ${a.first_name}`.localeCompare(
        `${b.last_name} ${b.first_name}`
      )
    );

  // numeric columns come back as strings from PostgREST; normalize once here
  // so every consumer downstream can assume real numbers.
  const objects: FloorObject[] = (objectsResult.data ?? []).map((o) => ({
    id: o.id,
    kind: o.kind,
    label: o.label,
    x_ft: Number(o.x_ft),
    y_ft: Number(o.y_ft),
    rotation_deg: Number(o.rotation_deg),
    seat_count: o.seat_count,
    diameter_ft: o.diameter_ft === null ? null : Number(o.diameter_ft),
    width_ft: o.width_ft === null ? null : Number(o.width_ft),
    height_ft: o.height_ft === null ? null : Number(o.height_ft),
    sort_order: o.sort_order,
  }));

  // Drop assignments for guests who are no longer attending (someone can
  // decline after being seated). They stay in the DB but shouldn't render.
  const assignments: SeatedGuest[] = (assignmentsResult.data ?? [])
    .filter((a) => attendingIds.has(a.guest_id))
    .map((a) => ({
      guest_id: a.guest_id,
      object_id: a.object_id,
      seat_number: a.seat_number,
    }));

  return (
    <SeatingChart
      objects={objects}
      assignments={assignments}
      guests={attendingGuests}
    />
  );
}
