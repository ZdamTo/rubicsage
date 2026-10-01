import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { writeAuditLog } from "@/lib/auth";
import { ApiError, assertSameOrigin, errorResponse, readJson, requireApiSuperAdmin } from "@/lib/cke/server";
import { CkeBookletSchema, CkeExamContentSchema, formatZodIssues, type CkeBookletInput } from "@/lib/cke/schema";
import { buildExamContent, groupBooklets, quizRowFor } from "@/lib/cke/import";
import { assetStatus, insertActiveVersion } from "@/lib/cke/admin";
import type { CkeExamContent } from "@/lib/cke/types";

// Vercel caps request bodies at ~4.5 MB; a full year (3 booklets) is < 0.5 MB.
const MAX_BODY = 4_000_000;

/**
 * POST /api/admin/cke/import { files: [{ name, json }] }
 *
 * Validates every booklet, joins P1+P2 into one exam, then creates the quiz
 * (as a DRAFT) or adds a new version to the existing one with the same exam
 * code. Publishing stays a separate, deliberate click in the admin panel.
 */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const admin = await requireApiSuperAdmin();
    const body = await readJson<{ files?: Array<{ name?: unknown; json?: unknown }> }>(req, MAX_BODY);
    if (!Array.isArray(body.files) || !body.files.length) throw new ApiError(400, "Nie przesłano żadnych plików.");
    if (body.files.length > 30) throw new ApiError(400, "Maksymalnie 30 plików naraz.");

    const fileErrors: Array<{ file: string; errors: string[] }> = [];
    const booklets: CkeBookletInput[] = [];
    for (const f of body.files) {
      const name = typeof f.name === "string" ? f.name.slice(0, 200) : "(bez nazwy)";
      const parsed = CkeBookletSchema.safeParse(f.json);
      if (!parsed.success) fileErrors.push({ file: name, errors: formatZodIssues(parsed.error) });
      else booklets.push(parsed.data);
    }
    // All-or-nothing: a half-imported year is harder to reason about than none.
    if (fileErrors.length) return NextResponse.json({ error: "Walidacja nie powiodła się.", fileErrors }, { status: 400 });

    const { groups, errors } = groupBooklets(booklets);
    const fatal = errors.filter((e) => !e.includes("dwa razy"));
    if (fatal.length || !groups.length) {
      return NextResponse.json({ error: "Nie zaimportowano niczego.", groupErrors: errors }, { status: 400 });
    }

    const service = createServiceRoleClient();
    const results = [];
    for (const group of groups) {
      const { data: existing } = await service
        .from("quizzes")
        .select("id, status, format, subject")
        .eq("exam_code", group.examCode)
        .maybeSingle();
      if (existing && (existing.format !== "cke_exam" || existing.subject !== "polish")) {
        throw new ApiError(409, `Kod ${group.examCode} jest już użyty przez quiz innego typu.`);
      }

      let previous: CkeExamContent | null = null;
      if (existing) {
        const { data: v } = await service
          .from("quiz_versions")
          .select("content")
          .eq("quiz_id", existing.id)
          .eq("is_active", true)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();
        previous = (v?.content as unknown as CkeExamContent) ?? null;
      }

      let content: CkeExamContent;
      try {
        content = buildExamContent(group, previous);
      } catch (e) {
        throw new ApiError(400, e instanceof Error ? e.message : String(e));
      }
      const check = CkeExamContentSchema.safeParse(content);
      if (!check.success) throw new ApiError(400, `${group.examCode}: ${formatZodIssues(check.error, 5).join("; ")}`);

      const row = quizRowFor(content);
      let quizId: string;
      if (existing) {
        quizId = existing.id;
        const { error } = await service
          .from("quizzes")
          .update({ title: row.title, description: row.description, level: row.level, session: row.session, meta: row.meta as unknown as Json })
          .eq("id", quizId);
        if (error) throw new ApiError(500, error.message);
      } else {
        const { data, error } = await service
          .from("quizzes")
          .insert({ ...row, meta: row.meta as unknown as Json, status: "draft", created_by: admin.id })
          .select("id")
          .single();
        if (error || !data) throw new ApiError(500, error?.message ?? "Nie udało się utworzyć arkusza.");
        quizId = data.id;
      }

      const note = `Import: ${group.booklets.map((b) => b.id).join(" + ")}`;
      const version = await insertActiveVersion(quizId, content, note);
      await writeAuditLog({
        actorId: admin.id,
        action: existing ? "cke_exam.reimport" : "cke_exam.import",
        targetType: "quiz",
        targetId: quizId,
        details: { exam_code: group.examCode, version: version.version, parts: group.booklets.map((b) => b.id) },
      });

      results.push({
        quizId,
        examCode: group.examCode,
        title: row.title,
        created: !existing,
        status: existing?.status ?? "draft",
        version: version.version,
        questions: row.meta.questions,
        maxPoints: row.meta.max_points,
        missingParts: row.meta.missing_parts,
        assets: await assetStatus(content),
      });
    }

    return NextResponse.json({ results, warnings: errors });
  } catch (err) {
    return errorResponse(err);
  }
}
