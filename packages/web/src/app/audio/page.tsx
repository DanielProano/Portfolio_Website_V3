import dynamic from 'next/dynamic';
import { redirect } from 'next/navigation';
import { getSessionSafe } from '@/lib/auth0';

const AudioClient = dynamic(
    () => import('./AudioClient').then(m => m.AudioClient),
    { ssr: false }
);

export const metadata = {
    title: 'Audio',
    robots: { index: false, follow: false },
};

export default async function AudioPage() {
    const session = await getSessionSafe();
    // Every signed-in user gets their own encrypted library, keyed by their own
    // passphrase. Signed-out visitors never reach the client.
    if (!session) redirect('/auth/login');
    return (
        <>
            {/* Warms the TLS connection to R2 ahead of the first track click — playback
                fetches never send credentials cross-origin, so this must match with
                crossOrigin, or the browser opens a second connection anyway. */}
            {process.env.R2_ACCOUNT_ID && (
                <link
                    rel="preconnect"
                    href={`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`}
                    crossOrigin="anonymous"
                />
            )}
            <AudioClient />
        </>
    );
}
