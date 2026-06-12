import { Request, Response, NextFunction } from 'express';
export interface AuthRequest extends Request {
    user?: {
        user_id: number;
    };
}
export declare function validateToken(req: AuthRequest, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=auth.d.ts.map