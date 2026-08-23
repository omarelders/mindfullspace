-- ============================================================
-- MindfulSpace Cloud Sync Database & Storage Schema
-- Run this in Supabase Dashboard -> SQL Editor -> New Query
-- ============================================================

-- 1. USER PROFILES
-- Stores user display name, avatar, and timestamps.
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL DEFAULT 'Mindful User',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. WORKSPACES
-- One row per workspace per user. Maps to local workspace IDs.
CREATE TABLE IF NOT EXISTS public.workspaces (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'New Workspace',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, user_id)
);

-- 3. WORKSPACE DATA
-- Stores the full JSON workspace snapshot payload (18 state collections).
CREATE TABLE IF NOT EXISTS public.workspace_data (
    workspace_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    version INTEGER NOT NULL DEFAULT 1,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, user_id),
    FOREIGN KEY (workspace_id, user_id) REFERENCES public.workspaces(id, user_id) ON DELETE CASCADE
);

-- 4. IMAGE REGISTRY
-- Maps local image IDs (e.g. img-paste-...) to Supabase Storage paths.
CREATE TABLE IF NOT EXISTS public.images (
    image_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    size_bytes INTEGER,
    mime_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (image_id, user_id)
);

-- 5. SYNC METADATA
-- Tracks per-device sync timestamps for conflict resolution and debugging.
CREATE TABLE IF NOT EXISTS public.sync_metadata (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    last_sync_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_agent TEXT,
    PRIMARY KEY (user_id, device_id)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON public.workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_data_user_id ON public.workspace_data(user_id);
CREATE INDEX IF NOT EXISTS idx_images_user_id ON public.images(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_user_id ON public.sync_metadata(user_id);

-- ============================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data ->> 'full_name',
            NEW.raw_user_meta_data ->> 'name',
            split_part(NEW.email, '@', 1),
            'Mindful User'
        ),
        COALESCE(
            NEW.raw_user_meta_data ->> 'avatar_url',
            NEW.raw_user_meta_data ->> 'picture',
            NULL
        )
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Trigger to auto-create profile on auth signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS workspaces_updated_at ON public.workspaces;
CREATE TRIGGER workspaces_updated_at
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_metadata ENABLE ROW LEVEL SECURITY;

-- PROFILES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- WORKSPACES
DROP POLICY IF EXISTS "Users can view own workspaces" ON public.workspaces;
CREATE POLICY "Users can view own workspaces"
    ON public.workspaces FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own workspaces" ON public.workspaces;
CREATE POLICY "Users can create own workspaces"
    ON public.workspaces FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own workspaces" ON public.workspaces;
CREATE POLICY "Users can update own workspaces"
    ON public.workspaces FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own workspaces" ON public.workspaces;
CREATE POLICY "Users can delete own workspaces"
    ON public.workspaces FOR DELETE
    USING (auth.uid() = user_id);

-- WORKSPACE DATA
DROP POLICY IF EXISTS "Users can view own workspace data" ON public.workspace_data;
CREATE POLICY "Users can view own workspace data"
    ON public.workspace_data FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own workspace data" ON public.workspace_data;
CREATE POLICY "Users can create own workspace data"
    ON public.workspace_data FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own workspace data" ON public.workspace_data;
CREATE POLICY "Users can update own workspace data"
    ON public.workspace_data FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own workspace data" ON public.workspace_data;
CREATE POLICY "Users can delete own workspace data"
    ON public.workspace_data FOR DELETE
    USING (auth.uid() = user_id);

-- IMAGES
DROP POLICY IF EXISTS "Users can view own images" ON public.images;
CREATE POLICY "Users can view own images"
    ON public.images FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own images" ON public.images;
CREATE POLICY "Users can create own images"
    ON public.images FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own images" ON public.images;
CREATE POLICY "Users can update own images"
    ON public.images FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own images" ON public.images;
CREATE POLICY "Users can delete own images"
    ON public.images FOR DELETE
    USING (auth.uid() = user_id);

-- SYNC METADATA
DROP POLICY IF EXISTS "Users can view own sync metadata" ON public.sync_metadata;
CREATE POLICY "Users can view own sync metadata"
    ON public.sync_metadata FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sync metadata" ON public.sync_metadata;
CREATE POLICY "Users can insert own sync metadata"
    ON public.sync_metadata FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sync metadata" ON public.sync_metadata;
CREATE POLICY "Users can update own sync metadata"
    ON public.sync_metadata FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKET & POLICIES (for Picture Cards)
-- ============================================================

-- Create private bucket 'user-images' (5MB limit matching MAX_IMAGE_SIZE)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'user-images',
    'user-images',
    false,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies: file path convention is {user_id}/{image_id}.{ext}
DROP POLICY IF EXISTS "Users can upload own images" ON storage.objects;
CREATE POLICY "Users can upload own images"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'user-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Users can view own images" ON storage.objects;
CREATE POLICY "Users can view own images"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'user-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Users can update own images" ON storage.objects;
CREATE POLICY "Users can update own images"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'user-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'user-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- ============================================================
-- REALTIME PUBLICATION (required for cross-device live sync)
-- The client subscribes to postgres_changes on workspace_data.
-- Without publishing the table to supabase_realtime those
-- subscriptions silently receive no events.
-- ============================================================
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_data;
EXCEPTION
    WHEN duplicate_object THEN NULL;  -- table already in publication
END $$;

-- ============================================================
-- ATOMIC WORKSPACE PUSH RPC (optimistic locking)
--
-- Replaces the old client-side read-version/increment/upsert dance,
-- which allowed two racing devices to silently overwrite each other.
--
-- Guarantees:
--   1. Parent workspaces row is ensured -> a workspace created locally
--      while signed in can be pushed without an FK violation.
--   2. Single-statement conditional upsert: the WHERE clause is
--      re-evaluated after any row-lock wait, so two concurrent writers
--      can never both increment the same version. The loser receives
--      status='conflict' plus the current cloud row so it can preserve
--      its local copy and adopt the remote one.
--   3. SECURITY DEFINER + explicit auth.uid() guards: RLS-equivalent
--      scoping enforced inside the function; anon callers are revoked.
--
-- Returns: TABLE(status TEXT, version INTEGER, data JSONB)
--   status='inserted'|'updated' -> version is the NEW server version
--   status='conflict'           -> version/data describe the CURRENT
--                                  cloud row that beat the caller
-- ============================================================
CREATE OR REPLACE FUNCTION public.push_workspace_snapshot(
    p_workspace_id TEXT,
    p_data JSONB,
    p_workspace_name TEXT DEFAULT NULL,
    p_expected_version INTEGER DEFAULT NULL
)
RETURNS TABLE (status TEXT, version INTEGER, data JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_user UUID := auth.uid();
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    INSERT INTO public.workspaces (id, user_id, name)
    VALUES (p_workspace_id, v_user, COALESCE(p_workspace_name, 'Workspace'))
    ON CONFLICT (id, user_id) DO NOTHING;

    INSERT INTO public.workspace_data AS wd
        (workspace_id, user_id, data, version, synced_at)
    VALUES (p_workspace_id, v_user, p_data, 1, now())
    ON CONFLICT (workspace_id, user_id) DO UPDATE
        SET data = EXCLUDED.data,
            synced_at = now(),
            version = wd.version + 1
        WHERE wd.version = COALESCE(p_expected_version, wd.version)
    RETURNING
        CASE WHEN wd.version = 1 THEN 'inserted' ELSE 'updated' END,
        wd.version,
        NULL::jsonb
    INTO status, version, data;

    IF NOT FOUND THEN
        SELECT 'conflict', cur.version, cur.data
          INTO status, version, data
          FROM public.workspace_data AS cur
         WHERE cur.workspace_id = p_workspace_id
           AND cur.user_id = v_user;
    END IF;

    RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.push_workspace_snapshot(TEXT, JSONB, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.push_workspace_snapshot(TEXT, JSONB, TEXT, INTEGER) TO authenticated;

DROP POLICY IF EXISTS "Users can delete own images" ON storage.objects;
CREATE POLICY "Users can delete own images"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'user-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
