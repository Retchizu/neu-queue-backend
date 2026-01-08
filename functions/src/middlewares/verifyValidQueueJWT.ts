import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload, TokenExpiredError } from "jsonwebtoken";
import { firestoreDb } from "../config/firebaseConfig";
import { TokenType } from "../types/token-type";

const SECRET_KEY = process.env.JWT_SECRET;

export const verifyTypedToken = (expectedTypes: TokenType[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];

      if (!token) {
        return res.status(401).json({ message: "Missing or invalid token" });
      }

      if (!SECRET_KEY) {
        throw new Error("Missing SECRET_KEY in environment variables");
      }

      // Check token blacklist
      const invalidTokenDoc = await firestoreDb
        .collection("invalid-token")
        .doc(token)
        .get();

      if (invalidTokenDoc.exists) {
        return res.status(401).json({ message: "Token is already used or invalid" });
        return;
      }

      const decoded = jwt.verify(token, SECRET_KEY) as JwtPayload;

      const allowedTypes: TokenType[] = ["permission", "queue-form", "queue-status"];
      if (!decoded.type || !allowedTypes.includes(decoded.type)) {
        return res.status(403).json({ message: "Unknown or invalid token type" });
      }

      if (expectedTypes && !expectedTypes.includes(decoded.type)) {
        return res.status(403).json({ message: `Token type '${decoded.type}' is not allowed` });
      }


      req.token = token;
      req.id = decoded.id;

      return next();
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        return res.status(401).json({ message: "Token has expired" });
      } else {
        return res.status(500).json({ message: (error as Error).message });
      }
    }
  };
};


export const verifyUsedToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Invalid or missing token" });
    }

    const usedTokenRef = firestoreDb.collection("used-token").doc(token);
    const usedTokenDoc = await usedTokenRef.get();
    if (usedTokenDoc.exists) {
      return res.status(403).json({ message: "Token has already been used" });
    }

    return next();
  } catch (error) {
    return res.status(500).json({ message: (error as Error).message });
  }
};
