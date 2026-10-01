import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireSuperAdmin, writeAuditLog } from "@/lib/auth";
import { Quiz } from "@/lib/quiz/schemas";
import { BOOKLET_ID_RE, CkeExamContentSchema, formatZodIssues } from "@/lib/cke/schema";
import { quizRowFor } from "@/lib/cke/import";
import type { CkeExamContent } from "@/lib/cke/types";
import type { Json } from "@/lib/supabase/types";

// POST /api/admin/quizzes/[id]/versions – create a new version
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireSuperAdmin();
  const body = await req.json();

  const service = createServiceRoleClient();
  const { data: quizRow } = await service.from("quizzes").select("format, exam_code").eq("id", params.id).single();
  if (!quizRow) return NextResponse.json({ error: "Quiz not found" }, { status: 404 });

  // CKE exam sheets (Język polski) have their own content format. Normally they
  // arrive through "Import arkuszy CKE"; this path is for hand edits.
  let validContent: unknown;
  if (quizRow.format === "cke_exam") {
    const ckeParsed = CkeExamContentSchema.safeParse(body.content);
    if (!ckeParsed.success) {
      return NextResponse.json(
        { error: "CKE exam content validation failed", details: formatZodIssues(ckeParsed.error) },
        { status: 400 }
      );
    }
    if (quizRow.exam_code && ckeParsed.data.id !== quizRow.exam_code) {
      return NextResponse.json({ error: `content.id must stay ${quizRow.exam_code}` }, { status: 400 });
    }
    validContent = ckeParsed.data;
    const row = quizRowFor(ckeParsed.data as unknown as CkeExamContent);
    await service.from("quizzes").update({ meta: row.meta as unknown as Json }).eq("id", params.id);
  } else {
    // A CKE booklet pasted into a regular quiz: say where it belongs instead
    // of dumping a schema error about promptMarkdown/maxScore.
    const c = body.content as { id?: unknown; questions?: Array<{ type?: unknown }> } | null;
    const looksLikeBooklet =
      typeof c?.id === "string" && BOOKLET_ID_RE.test(c.id) &&
      Array.isArray(c.questions) && c.questions.some((q) => typeof q?.type === "string" && q.type.startsWith("P-"));
    if (looksLikeBooklet) {
      return NextResponse.json(
        {
          error:
            `To jest arkusz CKE (${c!.id}), a nie zwykły quiz. Nie wklejaj go w „+ Version”. ` +
            "Użyj panelu „Import arkuszy CKE — Język polski” na górze tej strony (wybierz plik JSON albo cały folder) — " +
            "arkusz zostanie utworzony automatycznie. Ten quiz demo możesz usunąć.",
        },
        { status: 400 }
      );
    }

    // Validate quiz content against the canonical Quiz schema
    const contentParsed = Quiz.safeParse(body.content);
    if (!contentParsed.success) {
      return NextResponse.json(
        { error: "Quiz content validation failed", details: contentParsed.error.flatten() },
        { status: 400 }
      );
    }
    validContent = contentParsed.data;
  }

  // Determine next version number
  const { data: versions } = await service
    .from("quiz_versions")
    .select("version")
    .eq("quiz_id", params.id)
    .order("version", { ascending: false })
    .limit(1);

  const nextVersion = versions && versions.length > 0 ? versions[0].version + 1 : 1;

  // Deactivate previous active versions
  await service
    .from("quiz_versions")
    .update({ is_active: false })
    .eq("quiz_id", params.id)
    .eq("is_active", true);

  const { data, error } = await service
    .from("quiz_versions")
    .insert({
      quiz_id: params.id,
      version: nextVersion,
      content: JSON.parse(JSON.stringify(validContent)),
      change_note: body.change_note ?? null,
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    actorId: admin.id,
    action: "quiz_version.create",
    targetType: "quiz",
    targetId: params.id,
    details: { version: nextVersion, change_note: body.change_note },
  });

  return NextResponse.json(data, { status: 201 });
}
