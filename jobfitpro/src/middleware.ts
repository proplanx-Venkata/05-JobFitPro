import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware: runs on every request matching the config below.
 *
 * Responsibilities:
 * 1. Refresh Supabase session cookies so tokens never expire mid-session.
 * 2. Protect all /api/* routes except /api/auth/* — returns 401 JSON for
 *    unauthenticated requests, so API clients get a consistent error shape.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  // Create a Supabase client that can read/write cookies on the response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // IMPORTANT: always call getUser() so the session cookie is refreshed.
  // Do NOT use getSession() here — it can be spoofed by client-side code.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect /api/* routes, excluding /api/auth/*
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");
  const isAuthRoute = pathname.startsWith("/api/auth/");

  if (isApiRoute && !isAuthRoute && !user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
