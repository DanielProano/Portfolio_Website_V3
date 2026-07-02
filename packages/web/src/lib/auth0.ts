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
