import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { MapPin, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/map")({
  component: MapPage,
  head: () => ({
    meta: [
      { title: "Live Shuttle Map · CampusShuttle" },
      {
        name: "description",
        content:
          "Track shuttles live on the map. See where every active shuttle is right now across the Western Cape.",
      },
      { property: "og:title", content: "Live Shuttle Map · CampusShuttle" },
      {
        property: "og:description",
        content: "Track shuttles live on the map across the Western Cape.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type ShuttleLocation = {
  id: string;
  driver_id: string;
  trip_id: string | null;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  updated_at: string;
};

// Western Cape (Cape Town) default center
const DEFAULT_CENTER = { lat: -33.9249, lng: 18.4241 };
const DEFAULT_ZOOM = 10;

declare global {
  interface Window {
    initShuttleMap?: () => void;
    google: any;
  }
}

function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps?.Map) return Promise.resolve();

  const existing = document.getElementById("gmaps-script") as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve) => {
      const check = () => {
        if (window.google?.maps?.Map) resolve();
        else setTimeout(check, 60);
      };
      check();
    });
  }

  return new Promise((resolve, reject) => {
    window.initShuttleMap = () => resolve();
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    const script = document.createElement("script");
    script.id = "gmaps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=initShuttleMap&channel=${channel}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}

function MapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const infoRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tripsQuery = useQuery({
    queryKey: ["trips", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shuttle_trips").select("id, route_name");
      if (error) throw error;
      return data;
    },
  });
  const tripMap = new Map((tripsQuery.data ?? []).map((t) => [t.id, t.route_name]));

  const [locations, setLocations] = useState<ShuttleLocation[]>([]);

  // Initial load + realtime subscription
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("shuttle_locations").select("*");
      if (!cancelled && data) setLocations(data as ShuttleLocation[]);
    })();

    const channel = supabase
      .channel("shuttle_locations_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shuttle_locations" },
        (payload) => {
          setLocations((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((l) => l.id !== (payload.old as any).id);
            }
            const row = payload.new as ShuttleLocation;
            const idx = prev.findIndex((l) => l.id === row.id);
            if (idx === -1) return [...prev, row];
            const next = [...prev];
            next[idx] = row;
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // Init map
  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        if (!containerRef.current || mapRef.current) return;
        mapRef.current = new window.google.maps.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          disableDefaultUI: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        infoRef.current = new window.google.maps.InfoWindow();
        setReady(true);
      })
      .catch((e) => setError(e.message));
  }, []);

  // Sync markers
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const g = window.google.maps;
    const seen = new Set<string>();

    for (const loc of locations) {
      seen.add(loc.id);
      const pos = { lat: Number(loc.latitude), lng: Number(loc.longitude) };
      const existing = markersRef.current.get(loc.id);
      if (existing) {
        existing.setPosition(pos);
      } else {
        const marker = new g.Marker({
          position: pos,
          map: mapRef.current,
          title: tripMap.get(loc.trip_id ?? "") ?? "Shuttle",
          icon: {
            path: g.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#2563eb",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
        });
        marker.addListener("click", () => {
          const routeName = tripMap.get(loc.trip_id ?? "") ?? "Shuttle";
          const updated = new Date(loc.updated_at).toLocaleTimeString();
          const container = document.createElement("div");
          container.style.fontFamily = "system-ui";
          container.style.fontSize = "13px";
          const strong = document.createElement("strong");
          strong.textContent = routeName;
          container.appendChild(strong);
          container.appendChild(document.createElement("br"));
          container.appendChild(document.createTextNode(`Updated ${updated}`));
          if (loc.speed) {
            container.appendChild(document.createElement("br"));
            container.appendChild(
              document.createTextNode(`${Math.round(loc.speed * 3.6)} km/h`),
            );
          }
          infoRef.current.setContent(container);
          infoRef.current.open({ anchor: marker, map: mapRef.current });
        });

        markersRef.current.set(loc.id, marker);
      }
    }
    // Remove stale
    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    }

    // Auto-fit if we have shuttles
    if (locations.length > 0) {
      const bounds = new g.LatLngBounds();
      locations.forEach((l) =>
        bounds.extend({ lat: Number(l.latitude), lng: Number(l.longitude) }),
      );
      // Only fit on first appearance to avoid constant zoom changes
      if (markersRef.current.size === locations.length && !(mapRef.current as any)._fitted) {
        mapRef.current.fitBounds(bounds, 80);
        (mapRef.current as any)._fitted = true;
      }
    }
  }, [locations, ready, tripsQuery.data]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-4 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <MapPin className="h-7 w-7 text-primary" /> Live Shuttle Map
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Real-time positions from drivers currently on route.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            {locations.length} shuttle{locations.length === 1 ? "" : "s"} online
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border shadow-sm">
          <div ref={containerRef} className="h-[70vh] w-full bg-muted" />
        </div>

        {locations.length === 0 && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            <Radio className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              No shuttles are broadcasting right now. Drivers can go to{" "}
              <a href="/drive" className="font-medium text-primary hover:underline">
                /drive
              </a>{" "}
              to start sharing their location.
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
