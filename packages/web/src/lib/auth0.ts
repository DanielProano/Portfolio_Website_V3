import { Auth0Client } from "@auth0/nextjs-auth0/server";

export const auth0 = new Auth0Client({
    authorizationParameters: {
        acr_values: "http://schemas.openid.net/papi/phd",
    },
});

// Returns null instead of throwing when Auth0 env vars are not yet configured
export async function getSessionSafe() {
    try {
        return await auth0.getSession();
    } catch {
        return null;
    }
}

/**
 * Session for the admin only — every other signed-in user gets null.
 * Fails closed: if ADMIN_EMAIL is unset, nobody is admin.
 */
export async function getAdminSession() {
    const session = await getSessionSafe();
    if (!session?.user?.sub) return null;
    if (!process.env.ADMIN_EMAIL || session.user.email !== process.env.ADMIN_EMAIL) return null;
    return session;
}
