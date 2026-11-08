import { NextResponse, type NextRequest } from "next/server";

// Edge middleware: gate pages only. API routes do their own session check.
const PUBLIC = ["/login", "/signup"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get("da_session")?.value);

  if (!hasSession && !PUBLIC.includes(pathname) && !pathname.startsWith("/api")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (hasSession && PUBLIC.includes(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/documents";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|api/).*)"],
};
