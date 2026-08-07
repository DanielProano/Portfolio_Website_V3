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
 * Session for any signed-in user, or null. This is the gate for the personal
 * features (audio, calendar, tasks, flashcards, ideas): every user gets their own
 * isolated copy, so the check is "is there a user?", not "which user is it?".
 *
 * Isolation itself is NOT enforced here — it comes from every query filtering on
 * `session.user.sub`. Any handler using this must scope its SQL by user_id.
 */
export async function getUserSession() {
    const session = await getSessionSafe();
    if (!session?.user?.sub) return null;
    return session;
}

/**
 * Session for the admin only — every other signed-in user gets null.
 * Fails closed: if ADMIN_EMAIL is unset, nobody is admin.
 *
 * Reserved for genuinely single-tenant surfaces (the admin dashboard). Per-user
 * features must use getUserSession instead.
 */
export async function getAdminSession() {
    const session = await getSessionSafe();
    if (!session?.user?.sub) return null;
    if (!process.env.ADMIN_EMAIL || session.user.email !== process.env.ADMIN_EMAIL) return null;
    return session;
}
