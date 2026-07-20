import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Navigation, Play, Square, PowerOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { formatTime } from "@/lib/shuttle";

export const Route = createFileRoute("/_authenticated/drive")({
  component: DrivePage,
});

function DrivePage() {
  const { user } = useAuth();
  const [selectedTrip, setSelectedTrip] = useState<string>("");
  const [sharing, setSharing] = useState(false);
  const [status, setStatus] = useState<string>("Idle");
  const [lastFix, setLastFix] = useState<GeolocationPosition | null>(null);
  const watchIdRef = useRef<number | null>(null);

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

  const pushLocation = async (pos: GeolocationPosition) => {
    if (!user) return;
    const { error } = await supabase.from("shuttle_locations").upsert(
      {
        driver_id: user.id,
        trip_id: selectedTrip || null,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        heading: pos.coords.heading ?? null,
        speed: pos.coords.speed ?? null,
        accuracy: pos.coords.accuracy ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "driver_id" },
    );
    if (error) setStatus(`Error: ${error.message}`);
    else setStatus(`Broadcasting · updated ${new Date().toLocaleTimeString()}`);
  };

  const startSharing = () => {
    if (!("geolocation" in navigator)) {
      setStatus("Geolocation not supported on this device");
      return;
    }
    setSharing(true);
    setStatus("Requesting location…");
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLastFix(pos);
        pushLocation(pos);
      },
      (err) => setStatus(`Error: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
  };

  const stopSharing = async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSharing(false);
    setStatus("Stopped");
    if (user) {
      await supabase.from("shuttle_locations").delete().eq("driver_id", user.id);
    }
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Navigation className="h-7 w-7 text-primary" /> Driver Mode
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Share your live GPS so students can see the shuttle move on the map. Keep this page
          open while driving.
        </p>

        <div className="mt-6 space-y-4 rounded-2xl border bg-card p-5">
          <div>
            <label className="text-sm font-medium">Trip you're driving</label>
            <select
              value={selectedTrip}
              onChange={(e) => setSelectedTrip(e.target.value)}
              disabled={sharing}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">— Select a trip —</option>
              {trips.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {formatTime(t.departure_time)} · {t.route_name} ({t.origin} → {t.destination})
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm">
            <div className="font-medium">{status}</div>
            {lastFix && (
              <div className="mt-1 text-xs text-muted-foreground">
                {lastFix.coords.latitude.toFixed(5)}, {lastFix.coords.longitude.toFixed(5)}
                {lastFix.coords.speed != null && lastFix.coords.speed >= 0 && (
                  <> · {Math.round(lastFix.coords.speed * 3.6)} km/h</>
                )}
                {lastFix.coords.accuracy && <> · ±{Math.round(lastFix.coords.accuracy)}m</>}
              </div>
            )}
          </div>

          {!sharing ? (
            <div className="space-y-2">
              <Button className="w-full" size="lg" onClick={startSharing}>
                <Play className="mr-1.5 h-4 w-4" /> Start sharing location
              </Button>
              <Button
                className="w-full"
                size="lg"
                variant="outline"
                onClick={async () => {
                  if (!user) return;
                  setStatus("Going off duty…");
                  const { error } = await supabase
                    .from("shuttle_locations")
                    .delete()
                    .eq("driver_id", user.id);
                  setStatus(error ? `Error: ${error.message}` : "Off duty · removed from map");
                  setLastFix(null);
                }}
              >
                <PowerOff className="mr-1.5 h-4 w-4" /> Go off duty (hide from map)
              </Button>
            </div>
          ) : (
            <Button className="w-full" size="lg" variant="destructive" onClick={stopSharing}>
              <Square className="mr-1.5 h-4 w-4" /> Stop sharing
            </Button>
          )}

          <p className="text-xs text-muted-foreground">
            Your position updates in real time on the public map. Stopping or going off duty
            removes your marker immediately.
          </p>

        </div>
      </section>
    </div>
  );
}
