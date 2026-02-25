import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: "user" | "admin" | "super_admin";
  status: "active" | "banned";
  timezone: string;
};

/** Get the authenticated user's profile or null */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
}

/** Require authentication – redirects to /auth/login if not signed in */
export async function requireAuth(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/auth/login");
  return profile;
}

/** Require super_admin role – redirects to / with 403 if not authorized */
export async function requireSuperAdmin(): Promise<Profile> {
  const profile = await requireAuth();
  if (profile.role !== "super_admin" || profile.status !== "active") {
    redirect("/?error=forbidden");
  }
  return profile;
}

/** Ensure the profile row exists and super_admin role is applied if email matches */
export async function provisionProfile(userId: string, email: string, displayName?: string) {
  const adminEmails = (process.env.SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const isSuperAdmin = adminEmails.includes(email.toLowerCase());
  const service = createServiceRoleClient();

  const { data: existing } = await service
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .single();

  if (!existing) {
    await service.from("profiles").insert({
      id: userId,
      email,
      display_name: displayName ?? email.split("@")[0],
      role: isSuperAdmin ? "super_admin" : "user",
      status: "active",
    });
  } else if (isSuperAdmin && existing.role !== "super_admin") {
    // Promote to super_admin on re-login
    await service
      .from("profiles")
      .update({ role: "super_admin" })
      .eq("id", userId);
  }
}

/** Write to admin_audit_log using the service role */
export async function writeAuditLog(params: {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
}) {
  const service = createServiceRoleClient();
  await service.from("admin_audit_log").insert({
    actor_id: params.actorId,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId,
    details: params.details ? (JSON.parse(JSON.stringify(params.details)) as import("@/lib/supabase/types").Json) : null,
  });
}
