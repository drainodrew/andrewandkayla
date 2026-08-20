import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { SeatingPrint } from "@/components/admin/seating-print";
import { PrintButton } from "@/components/admin/print-button";
import type { AttendingGuest, FloorObject, SeatedGuest } from "@/lib/seating";

export const metadata = { title: "Seating chart to print" };

/**
 * Printable seating chart, one page per table.
 *
 * Lives inside the (dashboard) route group so it inherits that layout's auth
 * guard rather than reimplementing it. The sidebar and page chrome are hidden
 * at print time by the rules below, so what comes out of the printer is just
 * the chart.
 */
export default async function SeatingPrintPage() {
  const supabase = createServiceClient();

  const { data: events } = await supabase.from("events").select("id, slug");
  const weddingEvent = (events ?? []).find((e) => e.slug?.includes("wedding"));

  if (!weddingEvent) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-heading text-3xl text-deep-sage mb-4">
          Seating chart
        </h1>
        <p className="text-dark/70">No wedding event found, so there is nothing to print.</p>
      </div>
    );
  }

  const [objectsResult, assignmentsResult, rsvpsResult, guestsResult, partiesResult] =
    await Promise.all([
      supabase
        .from("floor_plan_objects")
        .select(
          "id, kind, label, internal_name, x_ft, y_ft, rotation_deg, seat_count, diameter_ft, width_ft, height_ft, sort_order"
        )
        .order("sort_order"),
      supabase.from("seat_assignments").select("guest_id, object_id, seat_number"),
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

  const guests: AttendingGuest[] = (guestsResult.data ?? [])
    .filter((g) => attendingIds.has(g.id))
    .map((g) => ({
      id: g.id,
      first_name: g.first_name,
      last_name: g.last_name,
      party_id: g.party_id,
      party_name: partyNameById.get(g.party_id) ?? "Unknown party",
    }));

  // numeric columns come back as strings from PostgREST; normalize once.
  const objects: FloorObject[] = (objectsResult.data ?? []).map((o) => ({
    id: o.id,
    kind: o.kind,
    label: o.label,
    internal_name: o.internal_name,
    x_ft: Number(o.x_ft),
    y_ft: Number(o.y_ft),
    rotation_deg: Number(o.rotation_deg),
    seat_count: o.seat_count,
    diameter_ft: o.diameter_ft === null ? null : Number(o.diameter_ft),
    width_ft: o.width_ft === null ? null : Number(o.width_ft),
    height_ft: o.height_ft === null ? null : Number(o.height_ft),
    sort_order: o.sort_order,
  }));

  const assignments: SeatedGuest[] = (assignmentsResult.data ?? [])
    .filter((a) => attendingIds.has(a.guest_id))
    .map((a) => ({
      guest_id: a.guest_id,
      object_id: a.object_id,
      seat_number: a.seat_number,
    }));

  return (
    <>
      <style>{PRINT_CSS}</style>

      <div className="screen-only flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-heading text-3xl text-deep-sage">
            Seating chart to print
          </h1>
          <p className="text-sm text-dark/60 mt-1">
            One page per table with everyone&apos;s full name, plus an
            alphabetical list up front. Print or save as PDF.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/seating"
            className="px-4 py-2.5 rounded-lg border border-sage/50 text-sm text-dark/80 hover:bg-sage/10 transition-colors"
          >
            Back to seating
          </Link>
          <PrintButton />
        </div>
      </div>

      <SeatingPrint objects={objects} assignments={assignments} guests={guests} />
    </>
  );
}

/**
 * Print rules.
 *
 * `break-after: page` on every card but the last is what makes this one table
 * per sheet. The trailing :last-child reset matters: without it the final page
 * emits a break and every print run ends on a blank sheet, which is the kind of
 * thing you only notice after printing 26 of them.
 */
const PRINT_CSS = `
.print-page + .print-page { break-before: page; }

/* Only the per-table sheets are guaranteed to fit on one page, so only they
   ask not to be split. The summary lists are deliberately allowed to flow
   across as many sheets as they need: telling a three-page block not to break
   just makes the browser break it somewhere worse. Individual table blocks
   inside the summary carry their own break-inside-avoid, so a table's names
   never split across a page boundary. */
.print-page--table { break-inside: avoid; }

@media screen {
  .print-page {
    background: #fff;
    border: 1px solid rgba(197, 208, 179, 0.5);
    border-radius: 0.75rem;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    max-width: 8.5in;
  }
}

@media print {
  @page { size: letter portrait; margin: 0.45in; }

  /* The dashboard shell is screen furniture. The sidebar and the site nav and
     footer are hidden by print:hidden wrappers in their layouts, which also
     catches the sidebar's fixed hamburger button. */
  .screen-only { display: none !important; }

  /* Every ancestor, not just body: the admin shell paints cream on a wrapper
     div, so whitening body alone still printed a cream page. Scoped to the
     ancestors deliberately, since a blanket rule on descendants would also
     strip the shaded table on the mini map. */
  html, body, main, .print-root { background: #fff !important; }

  .print-root { width: 100%; }
  .print-page { padding: 0; margin: 0; border: none; max-width: none; }

  /* Print backgrounds and the highlighted table on the mini map, which
     browsers strip by default. */
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
