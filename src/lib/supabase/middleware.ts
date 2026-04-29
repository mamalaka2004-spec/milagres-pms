import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage =
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname === "/forgot-password";

  const isPublicPage =
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/p/") ||
    request.nextUrl.pathname.startsWith("/book/") ||
    request.nextUrl.pathname === "/booking-success" ||
    request.nextUrl.pathname === "/faq" ||
    request.nextUrl.pathname === "/contact" ||
    request.nextUrl.pathname.startsWith("/api/booking/");

  const isDashboardPage =
    request.nextUrl.pathname === "/dashboard" ||
    request.nextUrl.pathname.startsWith("/reservations") ||
    request.nextUrl.pathname.startsWith("/calendar") ||
    request.nextUrl.pathname.startsWith("/guests") ||
    request.nextUrl.pathname.startsWith("/properties") ||
    request.nextUrl.pathname.startsWith("/owners") ||
    request.nextUrl.pathname === "/finance" ||
    request.nextUrl.pathname === "/operations" ||
    request.nextUrl.pathname === "/ai-assistant" ||
    request.nextUrl.pathname === "/settings";

  // Public pages: no auth needed
  if (isPublicPage) {
    return supabaseResponse;
  }

  // Auth pages: redirect to dashboard if already logged in
  if (isAuthPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Dashboard pages: redirect to login if not authenticated
  if (isDashboardPage && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Only allow safe relative paths in redirectTo to avoid open-redirect attacks
    // (e.g. /login?redirectTo=https://evil.com after login would forward there).
    const target = request.nextUrl.pathname;
    if (target.startsWith("/") && !target.startsWith("//") && !target.includes(":")) {
      url.searchParams.set("redirectTo", target);
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
