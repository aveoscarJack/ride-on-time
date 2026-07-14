import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Bell, Bus, Clock, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { DAY_LABELS_FULL, formatTime, statusColor, statusLabel } from "@/lib/shuttle";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const today = new Date().getDay();

  const trips = useQuery({
    queryKey: ["trips", "today", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shuttle_trips")
        .select("*")
        .contains("days_of_week", [today])
        .order("departure_time");
      if (error) throw error;
      return data;
    },
  });

  const announcements = useQuery({
    queryKey: ["announcements", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  const now = new Date();
  const upcoming = trips.data?.filter((t) => {
    const [h, m] = t.departure_time.split(":").map(Number);
    return h * 60 + m >= now.getHours() * 60 + now.getMinutes();
  }) ?? [];
  const next = upcoming[0];

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="hero-gradient text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-14 md:py-20">
          <p className="mb-3 text-sm font-medium uppercase tracking-wider opacity-80">
            {DAY_LABELS_FULL[today]}
            {" · "}
            {now.toLocaleDateString(undefined, { month: "long", day: "numeric" })}
          </p>
          <h1 className="max-w-2xl text-4xl font-bold leading-tight md:text-5xl">
            Never miss another shuttle.
          </h1>
          <p className="mt-3 max-w-xl text-lg opacity-90">
            The live schedule, delays, and announcements — all in one place, kept up to date by
            the transport office.
          </p>

          {next && (
            <div className="mt-8 max-w-xl rounded-2xl bg-background/10 p-5 backdrop-blur border border-white/15">
              <p className="text-xs font-medium uppercase tracking-wider opacity-70">
                Next shuttle
              </p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-4">
                <span className="font-display text-3xl font-bold">
                  {formatTime(next.departure_time)}
                </span>
                <span className="text-lg opacity-90">{next.route_name}</span>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-sm opacity-90">
                <MapPin className="h-4 w-4" />
                {next.origin} → {next.destination}
              </p>
              <div className="mt-3">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColor(next.status)}`}
                >
                  {statusLabel(next.status, next.delay_minutes)}
                </span>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/schedule">
                Full schedule <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="text-primary-foreground hover:bg-white/10">
              <Link to="/announcements">
                <Bell className="mr-1.5 h-4 w-4" />
                Announcements
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold">Today's shuttles</h2>
            <p className="text-sm text-muted-foreground">
              {trips.data?.length ?? 0} trips scheduled
            </p>
          </div>
          <Link to="/schedule" className="text-sm font-medium text-primary hover:underline">
            View all →
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {trips.isLoading && (
            <div className="col-span-full text-sm text-muted-foreground">Loading…</div>
          )}
          {trips.data?.slice(0, 6).map((t) => (
            <div key={t.id} className="card-elevated rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-2xl font-bold font-display">
                    <Clock className="h-5 w-5 text-primary" />
                    {formatTime(t.departure_time)}
                  </div>
                  <p className="mt-1 text-sm font-medium">{t.route_name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.origin} → {t.destination}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor(t.status)}`}
                >
                  {statusLabel(t.status, t.delay_minutes)}
                </span>
              </div>
              {t.notes && (
                <p className="mt-3 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                  {t.notes}
                </p>
              )}
            </div>
          ))}
          {trips.data?.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed p-8 text-center">
              <Bus className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No shuttles scheduled today.</p>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="mb-4 text-2xl font-bold">Latest announcements</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {announcements.data?.map((a) => (
            <div key={a.id} className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">
                {new Date(a.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <h3 className="mt-1 text-base font-semibold">{a.title}</h3>
              <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{a.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t bg-muted/30 py-6 text-center text-xs text-muted-foreground">
        Updated by the campus transport office · CampusShuttle
      </footer>
    </div>
  );
}
