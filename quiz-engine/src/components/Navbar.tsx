import { getProfile } from "@/lib/auth";
import NavbarClient from "./NavbarClient";

// Server component – fetches auth state then delegates rendering to the client component
export async function Navbar() {
  const profile = await getProfile();

  return (
    <NavbarClient
      isSuperAdmin={profile?.role === "super_admin"}
      isLoggedIn={!!profile}
      displayName={profile?.display_name ?? profile?.email ?? null}
    />
  );
}
