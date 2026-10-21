
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      message: 'Authentication required. No token provided.',
    });
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    return res.status(500).json({
      message: 'Server authentication configuration error.',
    });
  }

  try {
    const decoded = jwt.verify(token, secret) as { userId: string };
    req.userId = decoded.userId;
    return next();
  } catch (error) {
    return res.status(403).json({
      message: 'Invalid or expired token.',
    });
  }
};