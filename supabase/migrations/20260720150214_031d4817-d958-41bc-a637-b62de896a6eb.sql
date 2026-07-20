
CREATE TABLE public.shuttle_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.shuttle_trips(id) ON DELETE SET NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  heading double precision,
  speed double precision,
  accuracy double precision,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(driver_id)
);

GRANT SELECT ON public.shuttle_locations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shuttle_locations TO authenticated;
GRANT ALL ON public.shuttle_locations TO service_role;

ALTER TABLE public.shuttle_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone views shuttle locations"
  ON public.shuttle_locations FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "Drivers insert own location"
  ON public.shuttle_locations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers update own location"
  ON public.shuttle_locations FOR UPDATE
  TO authenticated USING (auth.uid() = driver_id) WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers delete own location"
  ON public.shuttle_locations FOR DELETE
  TO authenticated USING (auth.uid() = driver_id);

CREATE TRIGGER update_shuttle_locations_updated_at
  BEFORE UPDATE ON public.shuttle_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.shuttle_locations;
ALTER TABLE public.shuttle_locations REPLICA IDENTITY FULL;
