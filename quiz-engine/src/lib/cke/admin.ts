import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import type { CkeExamContent } from "./types";
import { ASSET_BUCKET, requiredAssets } from "./assets";
import { ApiError } from "./server";

/** Insert a new active version (previous ones are kept, deactivated). */
export async function insertActiveVersion(quizId: string, content: unknown, changeNote: string | null) {
  const service = createServiceRoleClient();
  const { data: versions } = await service
    .from("quiz_versions")
    .select("version")
    .eq("quiz_id", quizId)
    .order("version", { ascending: false })
    .limit(1);
  const next = versions && versions.length ? versions[0].version + 1 : 1;

  const { data, error } = await service
    .from("quiz_versions")
    .insert({ quiz_id: quizId, version: next, content: content as Json, change_note: changeNote, is_active: false })
    .select("id, version")
    .single();
  if (error || !data) throw new ApiError(500, `Nie udało się zapisać wersji: ${error?.message ?? "?"}`);

  // Activate the new one first, then retire the rest: a failure in between
  // leaves two active versions (readers take the newest), never zero.
  const { error: actErr } = await service.from("quiz_versions").update({ is_active: true }).eq("id", data.id);
  if (actErr) throw new ApiError(500, `Nie udało się aktywować wersji: ${actErr.message}`);
  await service.from("quiz_versions").update({ is_active: false }).eq("quiz_id", quizId).neq("id", data.id);
  return data;
}

/** Required images of an exam, each with whether it is already in storage. */
export async function assetStatus(content: CkeExamContent) {
  const required = requiredAssets(content.questions);
  const service = createServiceRoleClient();
  const present = new Map<string, Set<string>>();
  for (const partId of new Set(required.map((r) => r.partId))) {
    const { data } = await service.storage.from(ASSET_BUCKET).list(partId, { limit: 1000 });
    present.set(partId, new Set((data ?? []).map((o) => o.name)));
  }
  return required.map((r) => ({ ...r, uploaded: present.get(r.partId)?.has(r.key) ?? false }));
}

export async function loadCkeQuizForAdmin(quizId: string) {
  const service = createServiceRoleClient();
  const { data: quiz } = await service.from("quizzes").select("id, format, exam_code").eq("id", quizId).single();
  if (!quiz || quiz.format !== "cke_exam") throw new ApiError(404, "To nie jest arkusz CKE.");
  const { data: version } = await service
    .from("quiz_versions")
    .select("content")
    .eq("quiz_id", quizId)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .single();
  if (!version) throw new ApiError(404, "Arkusz nie ma aktywnej wersji.");
  return { quiz, content: version.content as unknown as CkeExamContent };
}
