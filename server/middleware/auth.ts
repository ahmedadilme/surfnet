/* eslint-disable @typescript-eslint/no-namespace */
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../auth";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  req.userId = payload.userId;
  req.userRole = payload.role;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.userRole !== "admin") {
    res.status(403).json({ error: "Not authorized" });
    return;
  }
  next();
}
