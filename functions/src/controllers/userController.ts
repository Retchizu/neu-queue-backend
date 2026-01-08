import {Request, Response} from "express";
import { neuQueueAppRoles } from "../utils/roles";
import { auth, realtimeDb } from "../config/firebaseConfig";

export const verifyAccountInformation = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized request" });
    }

    const userRecord = await auth.getUserByEmail(req.user.email as string);

    if (!userRecord) {
      return res.status(404).json({ message: "User not found" });
    }

    const userRole: string | undefined = req.user.role;

    if (!userRole || !neuQueueAppRoles.includes(userRole.trim())) {
      await auth.setCustomUserClaims(req.user.uid, { role: "pending" });
      const userRef = realtimeDb.ref(`users/${req.user.uid}`);
      await userRef.set({
        role: "pending",
      });

      req.user.role = "pending";
      return res.status(202).json({ message: "Your request is pending. Wait for admin approval.", user: req.user });
    }

    return res.status(200).json({ user: req.user });
  } catch (error) {
    return res.status(500).json({ message: `Server error: ${(error as Error).message}` });
  }
};
