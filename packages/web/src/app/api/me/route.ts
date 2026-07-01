import { getSessionSafe } from '@/lib/auth0';
import { NextResponse } from 'next/server';

export async function GET() {
    const session = await getSessionSafe();
    if (!session?.user) return NextResponse.json(null, { status: 401 });

    const { name, email, picture } = session.user;
    const isAdmin = email === process.env.ADMIN_EMAIL;

    return NextResponse.json({ name, email, picture, isAdmin });
}
