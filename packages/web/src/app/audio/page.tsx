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
    if (!session) redirect('/auth/login');
    // Admin-only: signed-in non-admins are bounced, not shown an empty library.
    if (!process.env.ADMIN_EMAIL || session.user.email !== process.env.ADMIN_EMAIL) redirect('/');
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
