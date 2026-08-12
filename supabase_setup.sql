-- ========================================================
-- STYRKA APP - SUPABASE DATABASE INITIALIZATION SCRIPT
-- Copy and run this in your Supabase SQL Editor
-- (Supabase Dashboard -> SQL Editor -> New Query -> Run)
-- ========================================================

-- 1. Create custom enum or check constraint for user roles
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'employee');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create the `users` (profiles) table with TEXT primary key for maximum ID compatibility
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for `public.users`
DROP POLICY IF EXISTS "Allow public read access to users" ON public.users;
DROP POLICY IF EXISTS "Allow full access to users" ON public.users;

CREATE POLICY "Allow full access to users"
    ON public.users FOR ALL
    USING (true)
    WITH CHECK (true);


-- 3. Create `destinations` table (Admin assignment to employees)
CREATE TABLE IF NOT EXISTS public.destinations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    admin_id TEXT,
    employee_id TEXT,
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    status TEXT CHECK (status IN ('pending', 'in_progress', 'completed')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to destinations" ON public.destinations;

CREATE POLICY "Allow full access to destinations"
    ON public.destinations FOR ALL
    USING (true)
    WITH CHECK (true);


-- 4. Create `live_locations` table (Real-time tracking for Employees)
CREATE TABLE IF NOT EXISTS public.live_locations (
    user_id TEXT PRIMARY KEY,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    heading DOUBLE PRECISION DEFAULT 0,
    speed DOUBLE PRECISION DEFAULT 0,
    status TEXT CHECK (status IN ('online', 'offline')) DEFAULT 'online',
    destination_lat DOUBLE PRECISION,
    destination_lng DOUBLE PRECISION,
    destination_address TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.live_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to live locations" ON public.live_locations;

CREATE POLICY "Allow full access to live locations"
    ON public.live_locations FOR ALL
    USING (true)
    WITH CHECK (true);

