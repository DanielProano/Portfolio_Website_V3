import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth0 } from "./lib/auth0";

export async function middleware(request: NextRequest) {
    try {
        const res = await auth0.middleware(request);
        if (res.status >= 400) {
            const body = await res.clone().text();
            console.error('[middleware] Auth0 error response:', res.status, body);
        }
        return res;
    } catch (e) {
        console.error('[middleware] Auth0 threw:', e);
        return NextResponse.next();
    }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"
  ]
};
