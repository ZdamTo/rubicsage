import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireSuperAdmin, writeAuditLog } from "@/lib/auth";
import { Quiz } from "@/lib/quiz/schemas";

// POST /api/admin/quizzes/[id]/versions – create a new version
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireSuperAdmin();
  const body = await req.json();

  // Validate quiz content against the canonical Quiz schema
  const contentParsed = Quiz.safeParse(body.content);
  if (!contentParsed.success) {
    return NextResponse.json(
      { error: "Quiz content validation failed", details: contentParsed.error.flatten() },
      { status: 400 }
    );
  }

  const service = createServiceRoleClient();

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
      content: JSON.parse(JSON.stringify(contentParsed.data)),
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
