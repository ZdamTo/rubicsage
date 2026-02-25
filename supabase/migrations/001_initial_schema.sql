-- ============================================================
-- RubicSage – Initial Schema
-- Apply via: Supabase SQL Editor or supabase db push
-- ============================================================

-- ── Shared trigger helper (no table dependency) ───────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ── A) profiles ───────────────────────────────────────────────────────────────
-- Must be created BEFORE is_super_admin(), which references it.

CREATE TABLE IF NOT EXISTS public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text UNIQUE,
  display_name  text,
  role          text NOT NULL DEFAULT 'user'
                  CHECK (role IN ('user', 'admin', 'super_admin')),
  status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'banned')),
  timezone      text NOT NULL DEFAULT 'Europe/Warsaw',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Helper: is_super_admin (requires profiles to exist) ──────────────────────
-- Returns true when the calling user's role in profiles is 'super_admin'

CREATE OR REPLACE FUNCTION public.is_super_admin(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid
      AND role = 'super_admin'
      AND status = 'active'
  );
$$;

-- RLS policies for profiles (now is_super_admin exists)
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_super_admin());

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid() OR public.is_super_admin());

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- ── B) quizzes ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.quizzes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject     text NOT NULL CHECK (subject IN ('polish', 'math', 'informatics')),
  title       text NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'published', 'archived')),
  created_by  uuid REFERENCES public.profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_quizzes_updated_at
  BEFORE UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Users see only published quizzes; super_admin sees all
CREATE POLICY "quizzes_select_published" ON public.quizzes
  FOR SELECT USING (status = 'published' OR public.is_super_admin());

CREATE POLICY "quizzes_all_admin" ON public.quizzes
  FOR ALL USING (public.is_super_admin());

-- ── C) quiz_versions ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.quiz_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id     uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  version     int NOT NULL,
  content     jsonb NOT NULL,
  change_note text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, version)
);

ALTER TABLE public.quiz_versions ENABLE ROW LEVEL SECURITY;

-- Users can select active versions of published quizzes
CREATE POLICY "quiz_versions_select" ON public.quiz_versions
  FOR SELECT USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id
        AND (q.status = 'published' OR public.is_super_admin())
    )
  );

CREATE POLICY "quiz_versions_all_admin" ON public.quiz_versions
  FOR ALL USING (public.is_super_admin());

-- ── D) attempts ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.attempts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quiz_id          uuid NOT NULL REFERENCES public.quizzes(id),
  quiz_version_id  uuid REFERENCES public.quiz_versions(id),
  status           text NOT NULL DEFAULT 'in_progress'
                     CHECK (status IN ('in_progress', 'submitted', 'abandoned')),
  started_at       timestamptz NOT NULL DEFAULT now(),
  submitted_at     timestamptz,
  score            numeric NOT NULL DEFAULT 0,
  max_score        numeric NOT NULL DEFAULT 0
);

ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attempts_own" ON public.attempts
  FOR ALL USING (user_id = auth.uid() OR public.is_super_admin());

-- ── E) attempt_answers ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.attempt_answers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id      uuid NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
  question_id     text NOT NULL,
  answer          jsonb NOT NULL,
  attachments     jsonb,
  score           numeric,
  max_score       numeric,
  feedback        jsonb,
  graded_by_model text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);

ALTER TABLE public.attempt_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attempt_answers_own" ON public.attempt_answers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.attempts a
      WHERE a.id = attempt_id
        AND (a.user_id = auth.uid() OR public.is_super_admin())
    )
  );

-- ── F) practice_log ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.practice_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  practice_date date NOT NULL,
  source        text NOT NULL
                  CHECK (source IN ('answer_submit', 'attempt_submit', 'manual_admin')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, practice_date)
);

ALTER TABLE public.practice_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "practice_log_select_own" ON public.practice_log
  FOR SELECT USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "practice_log_insert_own" ON public.practice_log
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "practice_log_admin_all" ON public.practice_log
  FOR ALL USING (public.is_super_admin());

-- ── G) streaks ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.streaks (
  user_id            uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_streak     int NOT NULL DEFAULT 0,
  best_streak        int NOT NULL DEFAULT 0,
  last_practice_date date,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "streaks_select_own" ON public.streaks
  FOR SELECT USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "streaks_all_admin" ON public.streaks
  FOR ALL USING (public.is_super_admin());

-- ── H) admin_audit_log ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES public.profiles(id),
  action      text NOT NULL,
  target_type text NOT NULL,
  target_id   text NOT NULL,
  details     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only super_admin can read; inserts happen via service role
CREATE POLICY "audit_log_select_admin" ON public.admin_audit_log
  FOR SELECT USING (public.is_super_admin());

-- ── RPC: log_practice_and_update_streak ──────────────────────────────────────
-- Called server-side (service role) after an answer submit or attempt submit.
-- p_user_id : the user's uuid
-- p_source  : 'answer_submit' | 'attempt_submit' | 'manual_admin'

CREATE OR REPLACE FUNCTION public.log_practice_and_update_streak(
  p_user_id uuid,
  p_source  text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today          date;
  v_last_date      date;
  v_current_streak int;
  v_best_streak    int;
BEGIN
  -- Determine local date in Europe/Warsaw from current UTC time
  v_today := (now() AT TIME ZONE 'Europe/Warsaw')::date;

  -- Upsert practice_log (ignore conflict – already logged today)
  INSERT INTO public.practice_log (user_id, practice_date, source)
  VALUES (p_user_id, v_today, p_source)
  ON CONFLICT (user_id, practice_date) DO NOTHING;

  -- Upsert streaks row (create if first ever)
  INSERT INTO public.streaks (user_id, current_streak, best_streak, last_practice_date)
  VALUES (p_user_id, 0, 0, NULL)
  ON CONFLICT (user_id) DO NOTHING;

  -- Read current values
  SELECT last_practice_date, current_streak, best_streak
  INTO v_last_date, v_current_streak, v_best_streak
  FROM public.streaks
  WHERE user_id = p_user_id;

  -- No change if already logged today
  IF v_last_date = v_today THEN
    RETURN;
  END IF;

  -- Consecutive day → increment; otherwise reset to 1
  IF v_last_date = v_today - INTERVAL '1 day' THEN
    v_current_streak := v_current_streak + 1;
  ELSE
    v_current_streak := 1;
  END IF;

  IF v_current_streak > v_best_streak THEN
    v_best_streak := v_current_streak;
  END IF;

  UPDATE public.streaks
  SET current_streak     = v_current_streak,
      best_streak        = v_best_streak,
      last_practice_date = v_today,
      updated_at         = now()
  WHERE user_id = p_user_id;
END;
$$;

-- ── Trigger: auto-create profile on new auth.users row ───────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
