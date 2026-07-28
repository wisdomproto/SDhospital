import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const path = request.nextUrl.pathname;
  // 앱 설치에 필요한 파일들은 로그인 전에도 받을 수 있어야 한다.
  // (서비스 워커가 로그인 화면 HTML 을 받아버리면 등록 자체가 실패한다)
  const isAppShell =
    path === "/sw.js" || path === "/offline.html" || path === "/manifest.webmanifest";
  const isPublic = isAppShell || path.startsWith("/login") || path.startsWith("/invite");

  // Public pages need no session — skip the Supabase getUser() round trip
  // entirely so the login screen (and its post-login redirects) don't each
  // pay an auth network call.
  if (isPublic) return response;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    // portal (보호자·1차병원 앱) has its own login screen
    url.pathname = path.startsWith("/portal") ? "/login/portal" : "/login";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
