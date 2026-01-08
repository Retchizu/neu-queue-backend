import { NextFunction, Request, Response } from "express";

export const verifyRole = (requiredRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !requiredRoles.includes(req.user.role!)) {
        res.status(401).json({ message: "Unauthorized request" });
        return;
      }
      next();
      return;
    } catch (error) {
      res.status(500).json({ message: `Authentication failed: ${(error as Error).message}` });
      return;
    }
  };
};
