"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  isSuperAdmin: boolean;
  isLoggedIn: boolean;
  displayName: string | null;
}

const SUBJECT_LINKS = [
  { href: "/subjects/polish", label: "Polski" },
  { href: "/subjects/math", label: "Matematyka" },
  { href: "/subjects/informatics", label: "Informatyka" },
];

export default function NavbarClient({ isSuperAdmin, isLoggedIn, displayName }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="font-bold text-lg text-blue-600">
            RubicSage
          </Link>

          <div className="flex items-center gap-1">
            {SUBJECT_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {item.label}
              </Link>
            ))}

            {isLoggedIn && (
              <Link
                href="/streak"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/streak")
                    ? "bg-orange-100 text-orange-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                Streak
              </Link>
            )}

            <Link
              href="/settings"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive("/settings")
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              Settings
            </Link>

            {isSuperAdmin && (
              <Link
                href="/admin"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/admin")
                    ? "bg-purple-100 text-purple-700"
                    : "text-purple-600 hover:bg-purple-50 hover:text-purple-700"
                }`}
              >
                Admin
              </Link>
            )}

            <div className="ml-2 flex items-center gap-2">
              {isLoggedIn ? (
                <>
                  <span className="text-xs text-gray-400 hidden sm:inline">{displayName}</span>
                  <button
                    onClick={handleSignOut}
                    className="text-sm px-3 py-1.5 border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <Link
                  href="/auth/login"
                  className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
