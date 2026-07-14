import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/announcements")({
  component: Announcements,
  head: () => ({
    meta: [
      { title: "Announcements — CampusShuttle" },
      { name: "description", content: "Latest campus shuttle announcements and updates." },
    ],
  }),
});

function Announcements() {
  const q = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center gap-2">
          <Bell className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Announcements</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Latest updates from the transport office.
        </p>

        <div className="mt-6 space-y-3">
          {q.data?.map((a) => (
            <article key={a.id} className="card-elevated rounded-xl border bg-card p-5">
              <p className="text-xs text-muted-foreground">
                {new Date(a.created_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
              <h2 className="mt-1 text-lg font-semibold">{a.title}</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-foreground/90">{a.body}</p>
            </article>
          ))}
          {q.data?.length === 0 && (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              No announcements yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
