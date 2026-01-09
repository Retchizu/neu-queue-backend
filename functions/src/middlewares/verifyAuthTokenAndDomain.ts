import { NextFunction, Request, Response } from "express";
import { auth } from "../config/firebaseConfig";
import { FirebaseAuthError } from "firebase-admin/auth";

export const verifyAuthTokenAndDomain = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ message: "Invalid or missing token"});
      return;
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
      res.status(401).json({message: "Invalid or missing token"});
      return;
    }
    const decodedToken = await auth.verifyIdToken(token);
    const email = decodedToken.email!;
    if (!email.endsWith("@neu.edu.ph")) {
      auth.updateUser(decodedToken.uid, {
        disabled: true,
      });
      res.status(403).json({ message: "Unauthorized email domain. Contact admin for more info." });
      return;
    }
    req.user = {...decodedToken, role: decodedToken.role};
    next();
    return;
  } catch (error) {
    switch ((error as FirebaseAuthError).code) {
    case "auth/id-token-expired":
      res.status(401).json({ message: "Token expired. Please sign in again." });
      return;
    case "auth/argument-error":
      res.status(400).json({ message: "Invalid token format." });
      return;
    case "auth/user-disabled":
      res.status(403).json({ message: "User account is disabled." });
      return;
    case "auth/user-not-found":
      res.status(404).json({ message: "User not found." });
      return;
    default:
      res.status(500).json({ message: `Authentication failed: ${(error as Error).message}`});
      return;
    }
  }
};
