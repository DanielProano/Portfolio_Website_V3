import jwt from 'jsonwebtoken';

export function verifyJWT(authHeader: string | null): number | null {
    const token = authHeader?.split(' ')[1];
    if (!token) return null;
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { user_id: number };
        return payload.user_id;
    } catch {
        return null;
    }
}
