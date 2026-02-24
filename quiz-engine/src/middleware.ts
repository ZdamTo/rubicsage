import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static assets and API routes
     * that handle their own auth checks.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/grade).*)",
  ],
};
