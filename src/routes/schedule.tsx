import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { Input } from "@/components/ui/input";
import { DAY_LABELS, DAY_LABELS_FULL, formatTime, statusColor, statusLabel } from "@/lib/shuttle";

export const Route = createFileRoute("/schedule")({
  component: SchedulePage,
  head: () => ({
    meta: [
      { title: "Full shuttle schedule — CampusShuttle" },
      { name: "description", content: "Search all campus shuttle routes and times." },
    ],
  }),
});

function SchedulePage() {
  const [q, setQ] = useState("");
  const [day, setDay] = useState<number>(new Date().getDay());

  const trips = useQuery({
    queryKey: ["trips", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shuttle_trips")
        .select("*")
        .order("departure_time");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (trips.data ?? []).filter((t) => {
      if (!t.days_of_week.includes(day)) return false;
      if (!query) return true;
      return (
        t.route_name.toLowerCase().includes(query) ||
        t.origin.toLowerCase().includes(query) ||
        t.destination.toLowerCase().includes(query)
      );
    });
  }, [trips.data, q, day]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-3xl font-bold">Full schedule</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Filter by day or search by route, origin or destination.
        </p>

        <div className="mt-6 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search routes or stops…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DAY_LABELS.map((d, i) => (
              <button
                key={d}
                onClick={() => setDay(i)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  day === i
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-accent"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          {filtered.length} trip{filtered.length === 1 ? "" : "s"} on {DAY_LABELS_FULL[day]}
        </p>

        <ul className="mt-3 divide-y overflow-hidden rounded-xl border bg-card">
          {filtered.map((t) => (
            <li key={t.id} className="flex items-center gap-4 p-4">
              <div className="w-20 shrink-0 font-display text-xl font-bold text-primary">
                {formatTime(t.departure_time)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{t.route_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {t.origin} → {t.destination}
                </p>
                {t.notes && (
                  <p className="mt-1 text-xs text-muted-foreground italic">{t.notes}</p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor(t.status)}`}
              >
                {statusLabel(t.status, t.delay_minutes)}
              </span>
            </li>
          ))}
          {filtered.length === 0 && !trips.isLoading && (
            <li className="p-8 text-center text-sm text-muted-foreground">
              No trips match your filters.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
