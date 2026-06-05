import { createServiceClient } from "@/lib/supabase/server";

/**
 * Admin registry management page.
 * Shows all registry items with claim status, party info, and timestamps.
 */
export default async function AdminRegistryPage() {
  const supabase = createServiceClient();

  const [itemsResult, partiesResult] = await Promise.all([
    supabase
      .from("registry_items")
      .select(
        "id, name, price_cents, merchant_name, merchant_url, image_url, status, claimed_by_party_id, claimed_at, purchased_at, sort_order"
      )
      .order("sort_order"),
    supabase.from("parties").select("id, invite_name"),
  ]);

  const items = itemsResult.data ?? [];
  const parties = partiesResult.data ?? [];
  const partyMap = new Map(parties.map((p) => [p.id, p.invite_name]));

  const available = items.filter((i) => i.status === "available").length;
  const pending = items.filter((i) => i.status === "pending").length;
  const purchased = items.filter((i) => i.status === "purchased").length;

  function formatPrice(cents: number | null): string {
    if (!cents) return "-";
    return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 === 0 ? 0 : 2 })}`;
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <div className="max-w-6xl">
      <h1 className="font-heading text-3xl text-deep-sage mb-8">Registry</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-sage/30 p-6">
          <p className="text-sm text-dark/60 mb-1">Total Items</p>
          <p className="text-3xl font-heading text-dark">{items.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-sage/30 p-6">
          <p className="text-sm text-dark/60 mb-1">Available</p>
          <p className="text-3xl font-heading text-dark">{available}</p>
        </div>
        <div className="bg-white rounded-xl border border-sage/30 p-6">
          <p className="text-sm text-dark/60 mb-1">Pending</p>
          <p className="text-3xl font-heading text-yellow-600">{pending}</p>
        </div>
        <div className="bg-white rounded-xl border border-sage/30 p-6">
          <p className="text-sm text-dark/60 mb-1">Purchased</p>
          <p className="text-3xl font-heading text-green-700">{purchased}</p>
        </div>
      </div>

      {/* Items table */}
      <div className="bg-white rounded-xl border border-sage/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sage/20 bg-sage/5">
                <th className="text-left px-4 py-3 font-medium text-dark/70">Item</th>
                <th className="text-left px-4 py-3 font-medium text-dark/70">Price</th>
                <th className="text-left px-4 py-3 font-medium text-dark/70">Merchant</th>
                <th className="text-left px-4 py-3 font-medium text-dark/70">Status</th>
                <th className="text-left px-4 py-3 font-medium text-dark/70">Claimed By</th>
                <th className="text-left px-4 py-3 font-medium text-dark/70">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sage/10">
              {items.map((item) => {
                const statusStyles =
                  item.status === "purchased"
                    ? "bg-green-100 text-green-800"
                    : item.status === "pending"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-sage/20 text-dark/60";

                return (
                  <tr key={item.id} className="hover:bg-sage/5">
                    <td className="px-4 py-3">
                      <p className="font-medium text-dark truncate max-w-[200px]">
                        {item.name}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-dark/70 whitespace-nowrap">
                      {formatPrice(item.price_cents)}
                    </td>
                    <td className="px-4 py-3 text-dark/60 text-xs">
                      {item.merchant_url ? (
                        <a
                          href={item.merchant_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-deep-sage underline hover:text-pink"
                        >
                          {item.merchant_name || "Link"}
                        </a>
                      ) : (
                        item.merchant_name || "-"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusStyles}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-dark/70 text-xs">
                      {item.claimed_by_party_id
                        ? partyMap.get(item.claimed_by_party_id) || "Unknown party"
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-dark/50 text-xs whitespace-nowrap">
                      {item.status === "purchased"
                        ? formatDate(item.purchased_at)
                        : formatDate(item.claimed_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
