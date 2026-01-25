import { Request, Response } from "express";
import { auth, firestoreDb } from "@/config/firebaseConfig";
import { Timestamp } from "firebase-admin/firestore";

export const getAdminAuthDetails = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                message: "Unauthorized request",
            });
            return;
        }

        const userRecord = await auth.getUser(req.user.uid);

        // Convert Firebase Auth metadata to Timestamps
        const createdAt = Timestamp.fromMillis(Date.parse(userRecord.metadata.creationTime));
        const updatedAt = userRecord.metadata.lastRefreshTime
            ? Timestamp.fromMillis(Date.parse(userRecord.metadata.lastRefreshTime))
            : createdAt;

        res.status(200).json({
            user: {
                uid: userRecord.uid,
                displayName: userRecord.displayName || null,
                email: userRecord.email || null,
                createdAt: createdAt,
                updatedAt: updatedAt,
            },
        });
    } catch (error) {
        res.status(500).json({
            message: `Server error: ${(error as Error).message}`,
        });
    }
};

export const getCashierAuthDetails = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                message: "Unauthorized request",
            });
            return;
        }

        const userRecord = await auth.getUser(req.user.uid);

        // Fetch cashier data from Firestore to get stationId, createdAt, and updatedAt
        const cashierDoc = await firestoreDb.collection("cashiers").doc(req.user.uid).get();
        const cashierData = cashierDoc.exists ? cashierDoc.data() : null;

        // Use Timestamps from Firestore if available, otherwise fall back to Auth metadata
        const createdAt = cashierData?.createdAt instanceof Timestamp
            ? cashierData.createdAt
            : Timestamp.fromMillis(Date.parse(userRecord.metadata.creationTime));

        const updatedAt = cashierData?.updatedAt instanceof Timestamp
            ? cashierData.updatedAt
            : (userRecord.metadata.lastRefreshTime
                ? Timestamp.fromMillis(Date.parse(userRecord.metadata.lastRefreshTime))
                : createdAt);

        res.status(200).json({
            user: {
                uid: userRecord.uid,
                displayName: userRecord.displayName || null,
                email: userRecord.email || null,
                stationId: cashierData?.stationId || null,
                createdAt: createdAt,
                updatedAt: updatedAt,
            },
        });
    } catch (error) {
        res.status(500).json({
            message: `Server error: ${(error as Error).message}`,
        });
    }
};
