import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export function validate<T>(schema: z.ZodSchema<T>) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: result.error.flatten().fieldErrors,
            });
            return;
        }
        req.body = result.data;
        next();
    };
}
