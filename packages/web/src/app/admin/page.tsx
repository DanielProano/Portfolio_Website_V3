import { redirect } from 'next/navigation';
import { auth0 } from '@/lib/auth0';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

export default async function AdminPage() {
    const session = await auth0.getSession();

    if (!session) {
        redirect('/auth/login?returnTo=/admin');
    }

    if (session.user.email !== ADMIN_EMAIL) {
        redirect('/');
    }

    return (
        <main style={{ padding: '2rem', color: '#f0e8e8' }}>
            <h1 style={{ marginBottom: '0.5rem' }}>Admin Dashboard</h1>
            <p style={{ color: '#aaa' }}>Welcome, {session.user.name}.</p>
        </main>
    );
}
