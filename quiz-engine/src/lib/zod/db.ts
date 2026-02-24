import { z } from "zod";

// ── Quiz management ──────────────────────────────────────────────────────────

export const QuizSubject = z.enum(["polish", "math", "informatics"]);
export const QuizStatus = z.enum(["draft", "published", "archived"]);

export const CreateQuizSchema = z.object({
  subject: QuizSubject,
  title: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
});

export const UpdateQuizSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  status: QuizStatus.optional(),
});

export const CreateQuizVersionSchema = z.object({
  quiz_id: z.string().uuid(),
  content: z.record(z.unknown()), // full Quiz JSON – validated separately
  change_note: z.string().max(500).optional(),
});

// ── Attempt management ───────────────────────────────────────────────────────

export const StartAttemptSchema = z.object({
  quiz_id: z.string().uuid(),
  quiz_version_id: z.string().uuid(),
});

export const SubmitAttemptSchema = z.object({
  attempt_id: z.string().uuid(),
});

// ── Profile updates ───────────────────────────────────────────────────────────

export const UpdateProfileSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  timezone: z.string().max(60).optional(),
});

// ── Admin actions ─────────────────────────────────────────────────────────────

export const AdminUpdateUserSchema = z.object({
  user_id: z.string().uuid(),
  status: z.enum(["active", "banned"]).optional(),
  role: z.enum(["user", "admin", "super_admin"]).optional(),
});

export const AdminResetStreakSchema = z.object({
  user_id: z.string().uuid(),
});
