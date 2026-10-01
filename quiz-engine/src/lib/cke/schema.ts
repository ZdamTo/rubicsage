import { z } from "zod";

/**
 * Validation for CKE booklet JSON uploaded through the admin panel.
 *
 * Strict where the app relies on a field (ids end up in storage paths and
 * database keys, max_points drives the score), permissive everywhere else:
 * unknown keys are kept (`passthrough`) so the pipeline can add fields
 * without breaking the import.
 */

/** MPOP-P1-100-2505: subject, level/part, variant, session (YYMM). */
export const BOOKLET_ID_RE = /^[A-Z]{4}-[A-Z][0-9]-[0-9A-Z]{3}-[0-9]{4}$/;
const QUESTION_ID_RE = /^[A-Za-z0-9._-]{1,120}$/;
const SHORT_ID_RE = /^[A-Za-z0-9._-]{1,80}$/;

const shortText = z.string().max(2_000);
const longText = z.string().max(100_000);

const Footnote = z
  .object({ n: z.union([z.number(), z.string().max(10)]).optional(), text: shortText.optional() })
  .passthrough();

const Reference = z
  .object({
    id: z.string().max(80).optional(),
    type: z.string().max(20).optional(),
    name: shortText.optional(),
    author: shortText.optional(),
    title: shortText.optional(),
    content: longText.optional(),
    // A bare filename inside the booklet's assets folder. No slashes or
    // URLs: images are served only from our own storage bucket.
    path: z
      .string()
      .max(300)
      .refine((p) => p === "" || !/[\\/]|^[a-z]+:/i.test(p), "path must be a bare file name")
      .optional(),
    footnotes: z.array(Footnote).max(100).optional(),
  })
  .passthrough();

const Option = z
  .object({
    id: z.string().regex(SHORT_ID_RE),
    label: z.string().max(20).optional(),
    value: z.string().max(20).optional(),
    number: z.string().max(20).optional(),
    content: shortText.optional(),
  })
  .passthrough();

const TableCell = z.union([
  z.string().max(20_000),
  z
    .object({
      type: z.string().max(20).optional(),
      content: z.string().max(20_000).optional(),
      input_type: z.string().max(20).optional(),
    })
    .passthrough(),
]);

const TableRow = z
  .object({
    id: z.string().regex(SHORT_ID_RE),
    label: z.string().max(20).optional(),
    cells: z.record(TableCell),
    user_answer: z.record(z.unknown()).optional(),
  })
  .passthrough();

const Scoring = z
  .object({
    max_points: z.number().int().min(0).max(100),
    scoring_criteria: z.unknown().optional(),
    exemplary_answers: z.string().max(50_000).optional(),
    correct_answers: z.string().max(20_000).optional(),
  })
  .passthrough();

const Base = z
  .object({
    id: z.string().regex(QUESTION_ID_RE, "question id may only contain letters, digits, . _ -"),
    number: z.union([z.string().max(20), z.number()]).transform(String),
    question: longText.optional(),
    reference_data: z.array(Reference).max(20).optional(),
    scoring: Scoring,
    user_answer: z.unknown().optional(),
  })
  .passthrough();

const PText = Base.extend({ type: z.literal("P-TEXT") });
const PTableText = Base.extend({
  type: z.literal("P-TABLE-TEXT"),
  table: z.object({ rows: z.array(TableRow).min(1).max(50) }).passthrough(),
});
const PTableMatch = Base.extend({
  type: z.literal("P-TABLE-MATCH"),
  table: z.object({ rows: z.array(TableRow).min(1).max(50) }).passthrough(),
  options: z.array(Option).min(1).max(50),
});
const PTf = Base.extend({
  type: z.literal("P-TF"),
  tf_questions: z
    .array(z.object({ id: z.string().regex(SHORT_ID_RE), question: shortText.optional() }).passthrough())
    .min(1)
    .max(20),
});
const PChoice = Base.extend({
  type: z.enum(["P-CHOICE", "P-SINGLE-CHOICE"]),
  options: z.array(Option).min(2).max(20),
});
const PEssay = Base.extend({
  type: z.literal("P-ESSAY"),
  minimum_word_count: z.number().int().min(0).max(5_000).optional(),
  poziom: z.string().max(10).optional(),
  topics: z
    .array(
      z
        .object({
          id: z.string().regex(SHORT_ID_RE),
          number: z.string().max(40).optional(),
          title: z.string().max(5_000).optional(),
          requirements: z.array(shortText).max(20).optional(),
        })
        .passthrough()
    )
    .min(1)
    .max(10),
  scoring: Scoring.extend({
    scoring_criteria: z
      .object({
        common: z.record(z.unknown()).optional(),
        criteria: z.record(z.unknown()),
      })
      .passthrough(),
  }),
});

export const CkeQuestionSchema = z.discriminatedUnion("type", [
  PText,
  PTableText,
  PTableMatch,
  PTf,
  PChoice,
  PEssay,
]);

export const CkeBookletSchema = z
  .object({
    id: z.string().regex(BOOKLET_ID_RE, "booklet id must look like MPOP-P1-100-2505"),
    name: z.string().max(300).optional(),
    questions: z.array(CkeQuestionSchema).min(1).max(100),
  })
  .passthrough()
  .superRefine((b, ctx) => {
    const seen = new Set<string>();
    b.questions.forEach((q, i) => {
      if (seen.has(q.id)) {
        ctx.addIssue({ code: "custom", path: ["questions", i, "id"], message: `duplicate question id ${q.id}` });
      }
      seen.add(q.id);
    });
  });

export type CkeBookletInput = z.infer<typeof CkeBookletSchema>;

/** Stored content (after import). Validated again when an admin edits it by hand. */
export const CkeExamContentSchema = z
  .object({
    format: z.literal("cke_exam"),
    id: z.string().regex(BOOKLET_ID_RE),
    name: z.string().max(300),
    subjectSlug: z.literal("polish"),
    parts: z.array(z.object({ id: z.string().regex(BOOKLET_ID_RE), questions: z.number().int() })).min(1).max(5),
    questions: z
      .array(z.intersection(CkeQuestionSchema, z.object({ part_id: z.string().regex(BOOKLET_ID_RE) })))
      .min(1)
      .max(200),
  })
  .passthrough();

/** Human-readable list of Zod issues ("questions.3.scoring.max_points: Required"). */
export function formatZodIssues(error: z.ZodError, limit = 15): string[] {
  return error.issues.slice(0, limit).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}
