-- ============================================================
-- RubicSage – Język polski: CKE exam sheets (arkusze maturalne)
-- Run AFTER 001, 002 (optional) and 003.
-- Apply via: Supabase SQL Editor (paste the whole file, Run) or `supabase db push`.
--
-- What this adds:
--   1. quizzes: a `format` column so a quiz row can hold either the existing
--      question-list format ('quiz', used by Informatyka) or a CKE exam sheet
--      ('cke_exam', used by Język polski), plus exam metadata for the picker.
--   2. attempts: practice/exam mode, an exam deadline and a progress cache.
--   3. ai_usage + consume_ai_calls(): an atomic per-user daily AI quota, so a
--      student cannot run up the AI bill.
--   4. Storage bucket `exam-assets` for the images printed in the arkusze.
--   5. Security hardening that also protects the existing Informatyka flow:
--      students can READ their attempts but no longer WRITE them directly
--      through the public API (the app always writes with the service role),
--      and the SECURITY DEFINER streak RPC is no longer callable by anyone.
--
-- The file is idempotent: running it twice is safe.
-- ============================================================

-- ── 1. quizzes: format + exam metadata ───────────────────────────────────────

ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'quiz';

DO $$ BEGIN
  ALTER TABLE public.quizzes
    ADD CONSTRAINT quizzes_format_check CHECK (format IN ('quiz', 'cke_exam'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- e.g. 'MPOP-P0-100-2505' (P1+P2 joined) or 'MPOP-R0-100-2505'
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS exam_code text;
-- 'podstawowy' | 'rozszerzony'
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS level text;
-- CKE session code, e.g. '2505' = May 2025
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS session text;
-- { max_points, questions, kind: 'full'|'essay'|'test', minutes, parts: [...] }
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  ALTER TABLE public.quizzes
    ADD CONSTRAINT quizzes_level_check CHECK (level IS NULL OR level IN ('podstawowy', 'rozszerzony'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.quizzes
    ADD CONSTRAINT quizzes_session_check CHECK (session IS NULL OR session ~ '^[0-9]{4}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS quizzes_exam_code_key
  ON public.quizzes (exam_code) WHERE exam_code IS NOT NULL;

-- ── 2. attempts: mode, deadline, progress ────────────────────────────────────

ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'practice';

DO $$ BEGIN
  ALTER TABLE public.attempts
    ADD CONSTRAINT attempts_mode_check CHECK (mode IN ('practice', 'exam'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Absolute end of an exam-mode attempt. Enforced by the API (answers saved
-- after it are refused), not only by the browser clock.
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS deadline timestamptz;
-- Cached counters for the exam picker: { answered, graded, points, max_points, questions }
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS progress jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_attempts_updated_at ON public.attempts;
CREATE TRIGGER trg_attempts_updated_at
  BEFORE UPDATE ON public.attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS attempts_user_quiz_idx
  ON public.attempts (user_id, quiz_id, status, started_at DESC);

ALTER TABLE public.attempt_answers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_attempt_answers_updated_at ON public.attempt_answers;
CREATE TRIGGER trg_attempt_answers_updated_at
  BEFORE UPDATE ON public.attempt_answers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. AI usage quota ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_usage (
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  usage_date  date NOT NULL,
  calls       int  NOT NULL DEFAULT 0 CHECK (calls >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_usage_select_own" ON public.ai_usage;
CREATE POLICY "ai_usage_select_own" ON public.ai_usage
  FOR SELECT USING (user_id = auth.uid() OR public.is_super_admin());
-- No INSERT/UPDATE/DELETE policies: only the service role writes here.

-- Atomically reserve p_calls AI calls for today (Europe/Warsaw).
-- Returns true when the reservation fits under p_daily_limit, false otherwise.
-- One statement, so two parallel requests can never both squeeze past the limit.
CREATE OR REPLACE FUNCTION public.consume_ai_calls(
  p_user_id     uuid,
  p_calls       int,
  p_daily_limit int
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/Warsaw')::date;
  v_ok    boolean;
BEGIN
  IF p_calls IS NULL OR p_calls < 1 OR p_daily_limit IS NULL OR p_calls > p_daily_limit THEN
    RETURN false;
  END IF;

  INSERT INTO public.ai_usage AS u (user_id, usage_date, calls)
  VALUES (p_user_id, v_today, p_calls)
  ON CONFLICT (user_id, usage_date) DO UPDATE
    SET calls = u.calls + EXCLUDED.calls,
        updated_at = now()
    WHERE u.calls + EXCLUDED.calls <= p_daily_limit
  RETURNING true INTO v_ok;

  RETURN COALESCE(v_ok, false);
END;
$$;

-- Server (service role) only.
REVOKE ALL ON FUNCTION public.consume_ai_calls(uuid, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_calls(uuid, int, int) TO service_role;

-- ── 4. Storage bucket for exam images ────────────────────────────────────────
-- Public READ (images are shown on the exam page; note that this means an
-- unpublished exam's images are reachable by anyone who knows the URL).
-- WRITE is service-role only: there are deliberately no storage.objects
-- policies for anon/authenticated, so RLS denies every client upload.
-- The bucket itself also rejects anything that is not an image or is > 5 MB.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exam-assets', 'exam-assets', true, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── 5. Security hardening ────────────────────────────────────────────────────

-- attempts / attempt_answers: users may only READ their own rows. All writes
-- go through API routes using the service role, which bypasses RLS. Before
-- this, a signed-in user could PATCH their own score through the REST API.
DROP POLICY IF EXISTS "attempts_own" ON public.attempts;
DROP POLICY IF EXISTS "attempts_select_own" ON public.attempts;
CREATE POLICY "attempts_select_own" ON public.attempts
  FOR SELECT USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "attempt_answers_own" ON public.attempt_answers;
DROP POLICY IF EXISTS "attempt_answers_select_own" ON public.attempt_answers;
CREATE POLICY "attempt_answers_select_own" ON public.attempt_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.attempts a
      WHERE a.id = attempt_id
        AND (a.user_id = auth.uid() OR public.is_super_admin())
    )
  );

-- practice_log: no client inserts (streak forging); the RPC writes it.
DROP POLICY IF EXISTS "practice_log_insert_own" ON public.practice_log;

-- The streak RPC is SECURITY DEFINER and takes any user id, so by default
-- (EXECUTE granted to PUBLIC) anyone could change anyone's streak.
REVOKE ALL ON FUNCTION public.log_practice_and_update_streak(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_practice_and_update_streak(uuid, text) TO service_role;
