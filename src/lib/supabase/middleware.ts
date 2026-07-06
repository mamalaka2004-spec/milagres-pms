import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const isPublicPage =
    pathname === "/" ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/apresentacao/") ||
    pathname.startsWith("/book/") ||
    pathname === "/booking-success" ||
    pathname === "/faq" ||
    pathname === "/contact" ||
    pathname.startsWith("/api/booking/") ||
    pathname.startsWith("/api/webhooks/");

  // Fast path: public pages need no auth — skip the Supabase client and the
  // getUser() network round-trip entirely so they render with zero auth latency.
  if (isPublicPage) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAll(cookiesToSet: any[]) {
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

  // APIs resolvem a própria autenticação e devolvem 401 JSON — nunca as
  // redirecionamos para a página de login (as públicas /api/booking e
  // /api/webhooks já saíram no fast-path isPublicPage acima).
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");

  // Auth pages: redirect to dashboard if already logged in
  if (isAuthPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Default-deny: TODA página não-pública e não-auth exige login. As páginas
  // públicas já retornaram no fast-path (isPublicPage) lá em cima. Antes havia
  // uma allowlist fixa de rotas (isDashboardPage) que ficava desatualizada a
  // cada fase nova — trocado por negação padrão, que cobre rotas futuras sozinho.
  if (!user && !isAuthPage && !isApiRoute) {
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
