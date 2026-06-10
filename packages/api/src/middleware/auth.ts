import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: { user_id: number };
}

export function validateToken(req: AuthRequest, res: Response, next: NextFunction) {
    const header = req.headers['authorization'];
    const token = header && header.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET as string) as { user_id: number };
        req.user = verified;
        next();
    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Expired Token' });
        }
        return res.status(403).json({ error: 'Invalid token' });
    }
}