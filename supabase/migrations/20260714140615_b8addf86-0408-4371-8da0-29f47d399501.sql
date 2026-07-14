
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by owner" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Shuttle trips
CREATE TYPE public.trip_status AS ENUM ('on_time', 'delayed', 'cancelled');

CREATE TABLE public.shuttle_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_name TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_time TIME NOT NULL,
  days_of_week SMALLINT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  status public.trip_status NOT NULL DEFAULT 'on_time',
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shuttle_trips TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shuttle_trips TO authenticated;
GRANT ALL ON public.shuttle_trips TO service_role;
ALTER TABLE public.shuttle_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view trips" ON public.shuttle_trips FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins insert trips" ON public.shuttle_trips FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update trips" ON public.shuttle_trips FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete trips" ON public.shuttle_trips FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_shuttle_trips_updated_at BEFORE UPDATE ON public.shuttle_trips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Announcements
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone views announcements" ON public.announcements FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins insert announcements" ON public.announcements FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update announcements" ON public.announcements FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete announcements" ON public.announcements FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed sample data
INSERT INTO public.shuttle_trips (route_name, origin, destination, departure_time, days_of_week, status, notes) VALUES
  ('Main Campus Loop', 'North Gate', 'Main Library', '07:30', ARRAY[1,2,3,4,5], 'on_time', 'First shuttle of the day'),
  ('Main Campus Loop', 'North Gate', 'Main Library', '08:00', ARRAY[1,2,3,4,5], 'on_time', NULL),
  ('Main Campus Loop', 'North Gate', 'Main Library', '08:30', ARRAY[1,2,3,4,5], 'on_time', NULL),
  ('Residence Express', 'Student Residence', 'Engineering Building', '09:00', ARRAY[1,2,3,4,5], 'on_time', NULL),
  ('Residence Express', 'Student Residence', 'Engineering Building', '12:00', ARRAY[1,2,3,4,5], 'on_time', NULL),
  ('Residence Express', 'Student Residence', 'Engineering Building', '15:00', ARRAY[1,2,3,4,5], 'delayed', 'Traffic on Main St'),
  ('Evening Return', 'Main Library', 'Student Residence', '18:00', ARRAY[1,2,3,4,5], 'on_time', NULL),
  ('Evening Return', 'Main Library', 'Student Residence', '19:30', ARRAY[1,2,3,4,5], 'on_time', 'Additional shuttle added'),
  ('Weekend Mall Run', 'Main Gate', 'City Mall', '10:00', ARRAY[6,0], 'on_time', NULL),
  ('Weekend Mall Run', 'City Mall', 'Main Gate', '16:00', ARRAY[6,0], 'on_time', NULL);

INSERT INTO public.announcements (title, body) VALUES
  ('Welcome to CampusShuttle', 'Check here for the latest shuttle schedule, delays, and cancellations. All updates are real-time.'),
  ('15:00 shuttle delayed 20 minutes', 'The 15:00 Residence Express is running approximately 20 minutes late due to traffic.');
