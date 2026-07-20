DROP POLICY IF EXISTS "Anyone views shuttle locations" ON public.shuttle_locations;
REVOKE SELECT ON public.shuttle_locations FROM anon;
CREATE POLICY "Authenticated users view shuttle locations"
  ON public.shuttle_locations
  FOR SELECT
  TO authenticated
  USING (true);