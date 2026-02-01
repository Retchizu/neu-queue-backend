import { Request, Response, NextFunction } from "express";
import { firestoreDb } from "../config/firebaseConfig";
import { SessionType } from "../types/token-type";

export const verifyCustomerSession = (sessionType: SessionType) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const qrId = req.body.qrId || req.query.qrId;
            if (!qrId) {
                res.status(400).json({ message: "qrId is required" });
                return;
            }
            const customerSessionRef = firestoreDb
                .collection("customer-sessions")
                .doc(qrId as string);
            const customerSessionSnapshot = await customerSessionRef.get();

            if (!customerSessionSnapshot.exists) {
                res.status(404).json({ message: "Qr Id not found" });
                return;
            }
            const customerSession = customerSessionSnapshot.data()!;

            if (customerSession.type !== sessionType) {
                res.status(403).json({ message: "No Access Allowed" });
                return;
            }
            const expiresAt = customerSession.expiresAt;
            if (!expiresAt || Date.now() > expiresAt) {
                res.status(401).json({
                    message: "Unauthorized Access. Scan the qr code again.",
                });
                return;
            }

            if (customerSession.used) {
                res.status(403).json({
                    message: "Session has already been used. Please scan a new QR code.",
                });
                return;
            }
            next();
            return;
        } catch (error) {
            res.status(500).json({ message: `${(error as Error).message}` });
            return;
        }
    };
};
