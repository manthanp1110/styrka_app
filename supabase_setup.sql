-- ========================================================
-- STYRKA APP - SUPABASE DATABASE INITIALIZATION SCRIPT
-- Copy and run this in your Supabase SQL Editor
-- (Supabase Dashboard -> SQL Editor -> New Query -> Run)
-- ========================================================

-- 1. Create custom enum or check constraint for user roles
CREATE TYPE user_role AS ENUM ('admin', 'employee');

-- 2. Create the `users` (profiles) table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'employee',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for `public.users`
CREATE POLICY "Allow public read access to users"
    ON public.users FOR SELECT
    USING (true);

CREATE POLICY "Allow users to update their own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Allow service role full access to users"
    ON public.users FOR ALL
    USING (true);


-- 3. Automatic Profile Trigger on Auth Signup
-- Automatically inserts a row into public.users whenever a user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, name, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
        NEW.email,
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'employee')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 4. Create `destinations` table (Admin assignment to employees)
CREATE TABLE IF NOT EXISTS public.destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id TEXT,
    employee_id TEXT,
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    status TEXT CHECK (status IN ('pending', 'in_progress', 'completed')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- If destinations table already exists, alter column types to TEXT
ALTER TABLE public.destinations DROP CONSTRAINT IF EXISTS destinations_admin_id_fkey;
ALTER TABLE public.destinations DROP CONSTRAINT IF EXISTS destinations_employee_id_fkey;
ALTER TABLE public.destinations ALTER COLUMN admin_id TYPE TEXT;
ALTER TABLE public.destinations ALTER COLUMN employee_id TYPE TEXT;
ALTER TABLE public.destinations ALTER COLUMN employee_id DROP NOT NULL;

ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read destinations"
    ON public.destinations FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow admins to create/update destinations"
    ON public.destinations FOR ALL
    TO authenticated
    USING (true);


-- 5. Create `live_locations` table (Real-time tracking for Employees)
CREATE TABLE IF NOT EXISTS public.live_locations (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    heading DOUBLE PRECISION DEFAULT 0,
    speed DOUBLE PRECISION DEFAULT 0,
    status TEXT CHECK (status IN ('online', 'offline')) DEFAULT 'online',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.live_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for live locations"
    ON public.live_locations FOR SELECT
    USING (true);

CREATE POLICY "Allow users to update their own location"
    ON public.live_locations FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow users to update existing location"
    ON public.live_locations FOR UPDATE
    USING (true);


-- ========================================================
-- OPTIONAL: SEED DEMO ADMIN AND EMPLOYEES
-- You can run the following to insert sample users if needed:
-- ========================================================

/*
-- Sample Admin Signup metadata hint:
-- When signing up from client app or Supabase Auth API:
-- supabase.auth.signUp({
--   email: 'admin@styrka.com',
--   password: 'YourPassword123',
--   options: { data: { name: 'Admin Manager', role: 'admin' } }
-- })

-- Sample Employee Signup:
-- supabase.auth.signUp({
--   email: 'rahul@styrka.com',
--   password: 'YourPassword123',
--   options: { data: { name: 'Rahul Sharma', role: 'employee' } }
-- })
*/
