import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_AUTH_COOKIE } from "@/lib/supabase/env";

const privatePrefixes = [
  "/today",
  "/workouts",
  "/workout-session",
  "/progress",
  "/profile",
  "/settings",
  "/admin",
  "/onboarding",
];

export async function proxy(request: NextRequest) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.SUPABASE_INTERNAL_URL ??
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: { name: SUPABASE_AUTH_COOKIE },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(items) {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isPrivate = privatePrefixes.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );
  if (isPrivate && !user)
    return NextResponse.redirect(
      new URL(
        `/login?next=${encodeURIComponent(request.nextUrl.pathname)}`,
        request.url,
      ),
    );
  if (user && ["/login", "/sign-up"].includes(request.nextUrl.pathname))
    return NextResponse.redirect(new URL("/today", request.url));
  return response;
}

export const config = {
  matcher: [
    "/((?!supabase|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
