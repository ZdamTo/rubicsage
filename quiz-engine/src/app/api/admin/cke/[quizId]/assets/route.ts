import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/auth";
import { ApiError, assertSameOrigin, assertUuid, errorResponse, requireApiSuperAdmin } from "@/lib/cke/server";
import { assetStatus, loadCkeQuizForAdmin } from "@/lib/cke/admin";
import { ASSET_BUCKET, assetObjectPath, requiredAssets, sniffImageType } from "@/lib/cke/assets";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // under Vercel's request cap; the bucket also enforces 5 MB

// GET /api/admin/cke/:quizId/assets — the images this exam needs, and which are uploaded.
export async function GET(_req: NextRequest, { params }: { params: { quizId: string } }) {
  try {
    await requireApiSuperAdmin();
    const { content } = await loadCkeQuizForAdmin(assertUuid(params.quizId, "quizId"));
    return NextResponse.json({ assets: await assetStatus(content) });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * POST /api/admin/cke/:quizId/assets (multipart: partId, path, file)
 *
 * Uploads the image for ONE reference of the exam. The storage key is derived
 * from the reference's own file name (not from the uploaded file's name), so
 * a file renamed on the way — the 2024 Kordian poster lost half its name to a
 * colon in the prototype's zip — still lands where the sheet looks for it.
 * Only references that exist in the exam are accepted, the content must
 * really be an image (checked by its bytes, not its extension), and only the
 * service role can write to the bucket.
 */
export async function POST(req: NextRequest, { params }: { params: { quizId: string } }) {
  try {
    assertSameOrigin(req);
    const admin = await requireApiSuperAdmin();
    const quizId = assertUuid(params.quizId, "quizId");
    const declared = Number(req.headers.get("content-length") ?? "0");
    if (declared > MAX_IMAGE_BYTES + 64_000) throw new ApiError(413, "Plik jest zbyt duży (maks. 4 MB).");

    const form = await req.formData();
    const partId = form.get("partId");
    const path = form.get("path");
    const file = form.get("file");
    if (typeof partId !== "string" || typeof path !== "string" || !(file instanceof Blob)) {
      throw new ApiError(400, "Wymagane pola: partId, path, file.");
    }
    if (file.size === 0) throw new ApiError(400, "Plik jest pusty.");
    if (file.size > MAX_IMAGE_BYTES) throw new ApiError(413, "Plik jest zbyt duży (maks. 4 MB).");

    const { content } = await loadCkeQuizForAdmin(quizId);
    const wanted = requiredAssets(content.questions).find((a) => a.partId === partId && a.path === path);
    if (!wanted) throw new ApiError(400, "Ten arkusz nie odwołuje się do takiego obrazu.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffImageType(bytes);
    if (!type) throw new ApiError(415, "Dozwolone są tylko obrazy JPEG, PNG, GIF i WebP.");

    const service = createServiceRoleClient();
    const objectPath = assetObjectPath(partId, path);
    const { error } = await service.storage.from(ASSET_BUCKET).upload(objectPath, bytes, {
      contentType: type,
      upsert: true,
      cacheControl: "86400",
    });
    if (error) throw new ApiError(500, `Nie udało się zapisać pliku: ${error.message}`);

    await writeAuditLog({
      actorId: admin.id,
      action: "cke_exam.asset_upload",
      targetType: "quiz",
      targetId: quizId,
      details: { object: objectPath, bytes: bytes.length, type },
    });

    return NextResponse.json({ assets: await assetStatus(content) });
  } catch (err) {
    return errorResponse(err);
  }
}
