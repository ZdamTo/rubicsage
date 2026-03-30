"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  isSuperAdmin: boolean;
  isLoggedIn: boolean;
  displayName: string | null;
}

const MATURA_LINKS = [
  { href: "/subjects/polish", label: "Polski", icon: "📖" },
  { href: "/subjects/math", label: "Matematyka", icon: "📐" },
  { href: "/subjects/informatics", label: "Informatyka", icon: "💻" },
];

export default function NavbarClient({ isSuperAdmin, isLoggedIn, displayName }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [maturaOpen, setMaturaOpen] = useState(false);
  const maturaRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (maturaRef.current && !maturaRef.current.contains(e.target as Node)) {
        setMaturaOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const isMaturaActive = MATURA_LINKS.some((l) => isActive(l.href));

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="font-extrabold text-lg text-blue-600 tracking-tight">
            ZdamTo.io
          </Link>

          {/* Main navigation */}
          <div className="flex items-center gap-1">

            {/* ── Matura dropdown ── */}
            <div className="relative" ref={maturaRef}>
              <button
                onClick={() => setMaturaOpen((v) => !v)}
                className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isMaturaActive
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                🎓 Matura
                <svg
                  className={`w-3.5 h-3.5 ml-0.5 transition-transform ${maturaOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {maturaOpen && (
                <div className="absolute left-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1">
                  {MATURA_LINKS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMaturaOpen(false)}
                      className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                        isActive(item.href)
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span>{item.icon}</span>
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* ── Tools ── */}
            <Link
              href="/tools"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive("/tools")
                  ? "bg-green-100 text-green-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              🛠️ Narzędzia
            </Link>

            {/* ── Prawo Jazdy ── */}
            <Link
              href="/prawo-jazdy"
              className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive("/prawo-jazdy")
                  ? "bg-gray-100 text-gray-800"
                  : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              }`}
            >
              🚗 Prawo Jazdy
              <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full leading-none">
                soon
              </span>
            </Link>

            {/* ── Streak ── */}
            {isLoggedIn && (
              <Link
                href="/streak"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/streak")
                    ? "bg-orange-100 text-orange-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                🔥 Streak
              </Link>
            )}

            {/* ── Settings ── */}
            <Link
              href="/settings"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive("/settings")
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              ⚙️
            </Link>

            {/* ── Admin ── */}
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

            {/* ── Auth ── */}
            <div className="ml-2 flex items-center gap-2">
              {isLoggedIn ? (
                <>
                  <span className="text-xs text-gray-400 hidden sm:inline">{displayName}</span>
                  <button
                    onClick={handleSignOut}
                    className="text-sm px-3 py-1.5 border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Wyloguj
                  </button>
                </>
              ) : (
                <Link
                  href="/auth/login"
                  className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Zaloguj się
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
