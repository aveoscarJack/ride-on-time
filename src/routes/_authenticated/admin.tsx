import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DAY_LABELS, formatTime, statusLabel } from "@/lib/shuttle";

export const Route = createFileRoute("/_authenticated/admin")({
  component: Admin,
  head: () => ({ meta: [{ title: "Admin — CampusShuttle" }] }),
});

function Admin() {
  const { isAdmin, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="p-8 text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-warning" />
          <h1 className="mt-4 text-2xl font-bold">Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account isn't an admin yet. Ask an existing admin to grant you access, or if
            you're the first user, promote yourself in the database with:
          </p>
          <pre className="mt-4 overflow-x-auto rounded-md bg-muted p-3 text-left text-xs">
{`INSERT INTO user_roles (user_id, role)
VALUES ('${user?.id ?? "<your-user-id>"}', 'admin');`}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-3xl font-bold">Admin console</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the shuttle schedule and post announcements. Changes are live immediately.
        </p>

        <Tabs defaultValue="trips" className="mt-6">
          <TabsList>
            <TabsTrigger value="trips">Shuttle trips</TabsTrigger>
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
          </TabsList>
          <TabsContent value="trips" className="mt-4">
            <TripsAdmin />
          </TabsContent>
          <TabsContent value="announcements" className="mt-4">
            <AnnouncementsAdmin userId={user!.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function TripsAdmin() {
  const qc = useQueryClient();
  const trips = useQuery({
    queryKey: ["trips", "admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shuttle_trips")
        .select("*")
        .order("departure_time");
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    route_name: "",
    origin: "",
    destination: "",
    departure_time: "08:00",
    days_of_week: [1, 2, 3, 4, 5],
    notes: "",
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("shuttle_trips").insert({ ...form });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Trip added");
      qc.invalidateQueries({ queryKey: ["trips"] });
      setForm({ ...form, route_name: "", notes: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("shuttle_trips").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trips"] }),
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shuttle_trips").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Trip removed");
      qc.invalidateQueries({ queryKey: ["trips"] });
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="rounded-xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-semibold">All trips</h2>
          <p className="text-xs text-muted-foreground">
            Change status inline. Delete to remove permanently.
          </p>
        </div>
        <ul className="divide-y">
          {trips.data?.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="w-16 shrink-0 font-display font-bold text-primary">
                {formatTime(t.departure_time)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.route_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {t.origin} → {t.destination}
                </p>
              </div>
              <Select
                value={t.status}
                onValueChange={(v) => update.mutate({ id: t.id, patch: { status: v } })}
              >
                <SelectTrigger className="w-36">
                  <SelectValue>{statusLabel(t.status, t.delay_minutes)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_time">On time</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              {t.status === "delayed" && (
                <Input
                  type="number"
                  min={0}
                  className="w-20"
                  defaultValue={t.delay_minutes}
                  onBlur={(e) =>
                    update.mutate({
                      id: t.id,
                      patch: { delay_minutes: Number(e.target.value) || 0 },
                    })
                  }
                />
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove.mutate(t.id)}
                aria-label="Delete trip"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
          {trips.data?.length === 0 && (
            <li className="p-8 text-center text-sm text-muted-foreground">No trips yet.</li>
          )}
        </ul>
      </div>

      <form
        className="h-fit rounded-xl border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <h2 className="font-semibold">Add trip</h2>
        <div className="mt-3 space-y-3">
          <div>
            <Label>Route name</Label>
            <Input
              required
              value={form.route_name}
              onChange={(e) => setForm({ ...form, route_name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Origin</Label>
              <Input
                required
                value={form.origin}
                onChange={(e) => setForm({ ...form, origin: e.target.value })}
              />
            </div>
            <div>
              <Label>Destination</Label>
              <Input
                required
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Departure time</Label>
            <Input
              type="time"
              required
              value={form.departure_time}
              onChange={(e) => setForm({ ...form, departure_time: e.target.value })}
            />
          </div>
          <div>
            <Label>Days</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {DAY_LABELS.map((d, i) => {
                const on = form.days_of_week.includes(i);
                return (
                  <button
                    type="button"
                    key={d}
                    onClick={() =>
                      setForm({
                        ...form,
                        days_of_week: on
                          ? form.days_of_week.filter((x) => x !== i)
                          : [...form.days_of_week, i].sort(),
                      })
                    }
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                      on ? "border-primary bg-primary text-primary-foreground" : "bg-background"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending}>
            <Plus className="h-4 w-4" /> Add trip
          </Button>
        </div>
      </form>
    </div>
  );
}

function AnnouncementsAdmin({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const list = useQuery({
    queryKey: ["announcements", "admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("announcements")
        .insert({ title, body, created_by: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Announcement posted");
      setTitle("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["announcements"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        {list.data?.map((a) => (
          <div key={a.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString()}
                </p>
                <h3 className="mt-0.5 font-semibold">{a.title}</h3>
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                  {a.body}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove.mutate(a.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <form
        className="h-fit rounded-xl border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <h2 className="font-semibold">New announcement</h2>
        <div className="mt-3 space-y-3">
          <div>
            <Label>Title</Label>
            <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea
              required
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending}>
            Publish
          </Button>
        </div>
      </form>
    </div>
  );
}
