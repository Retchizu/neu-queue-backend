import { Request, Response } from "express";
import { auth, firestoreDb } from "@/config/firebaseConfig";
import { recordLog } from "@/utils/recordLog";
import { ActionType } from "@/types/activity-log";
import { Blacklist } from "@/types/blacklist";
import { blockEmailSchema } from "@/zod-schemas/blockEmail";
import { assignRoleSchema } from "@/zod-schemas/assign-role-schema";
import { assignCashierSchema } from "@/zod-schemas/assign-cashier-schema";
import { ZodError } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { FirebaseAuthError } from "firebase-admin/auth";

export const getPendingUsers = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                message: "Unauthorized request",
            });
            return;
        }

        const userList = await auth.listUsers();

        const pendingUsers = userList.users
            .filter(
                (user) =>
                    user.customClaims?.role === "pending" &&
                    user.uid !== req.user?.uid
            )
            .map((user) => ({
                id: user.uid,
                uid: user.uid,
                email: user.email,
                name: user.displayName,
                role: user.customClaims?.role,
                createdAt: user.metadata.creationTime,
            }));

        res.status(200).json({
            pendingUsers,
        });
        return;
    } catch (error) {
        res.status(500).json({
            message: (error as Error).message,
        });
        return;
    }
};

export const getEmployees = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                message: "Unauthorized request",
            });
            return;
        }

        const limit = Number(req.query.limit) || 10;
        const cursor = req.query.cursor as string | undefined;

        // Firebase Auth maxResults can be up to 1000
        // We fetch a larger batch to account for filtering
        const maxResults = Math.min(Math.max(limit * 3, 100), 1000);

        const userList = cursor
            ? await auth.listUsers(maxResults, cursor)
            : await auth.listUsers(maxResults);

        const allowedRolesToGet =
            req.user.role === "superAdmin"
                ? ["admin", "cashier", "information"]
                : ["cashier", "information"];

        const employees = userList.users
            .filter(
                (user) =>
                    user.customClaims?.role &&
                    allowedRolesToGet.includes(user.customClaims.role) &&
                    user.uid !== req.user!.uid
            )
            .slice(0, limit)
            .map((user) => ({
                id: user.uid,
                uid: user.uid,
                email: user.email,
                name: user.displayName,
                role: user.customClaims?.role,
                createdAt: user.metadata.creationTime,
            }));

        // Determine if there are more pages
        // If we got fewer results than requested after filtering, we might need to fetch more
        // For simplicity, we'll use Firebase Auth's pageToken if available
        const nextCursor =
            userList.pageToken && employees.length === limit
                ? userList.pageToken
                : null;

        res.status(200).json({
            employees,
            nextCursor,
        });
        return;
    } catch (error) {
        res.status(500).json({
            message: (error as Error).message,
        });
        return;
    }
};

export const assignUserRole = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                message: "Unauthorized request",
            });
            return;
        }

        const parsedBody = assignRoleSchema.parse(req.body);
        const { userId, role } = parsedBody;

        const validRolesForAdmin = ["cashier", "information", "pending"];
        const validRolesForSuperAdmin = [
            "admin",
            "cashier",
            "information",
            "superAdmin",
            "pending",
        ];

        const requesterRole = req.user.role;

        if (
            (requesterRole === "admin" && !validRolesForAdmin.includes(role)) ||
            (requesterRole === "superAdmin" &&
                !validRolesForSuperAdmin.includes(role))
        ) {
            res.status(403).json({
                message: "Unauthorized to assign this role",
            });
            return;
        }

        let existingUser;
        try {
            existingUser = await auth.getUser(userId);
        } catch (error) {
            res.status(404).json({
                message: "User not found",
            });
            return;
        }

        // Check if user exists in cashiers collection
        const cashierRef = firestoreDb.collection("cashiers").doc(userId);
        const cashierDoc = await cashierRef.get();

        // Get the current role of the target user
        const currentUserRole = existingUser.customClaims?.role;

        if (cashierDoc.exists && role !== "cashier") {
            const cashierData = cashierDoc.data();
            const stationId = cashierData?.stationId || cashierData?.station;

            if (stationId) {
                const stationDoc = await firestoreDb
                    .collection("stations")
                    .doc(stationId)
                    .get();

                const stationName = stationDoc.exists
                    ? stationDoc.data()?.name
                    : "Unknown Station";

                res.status(409).json({
                    message:
                        "This cashier is assigned to station " +
                        `'${stationName}'. ` +
                        "Remove them from the station before changing roles.",
                });
                return;
            }
        }

        // Remove from cashiers collection if the user's current role is cashier and changing to a different role
        if (currentUserRole === "cashier" && role !== "cashier") {
            if (cashierDoc.exists) {
                await cashierRef.delete();
            }
        }

        await auth.setCustomUserClaims(userId, { role: role });
        await auth.revokeRefreshTokens(userId);

        // Create cashier document if role is being changed to "cashier"
        if (role === "cashier" && !cashierDoc.exists) {
            await cashierRef.set({
                uid: existingUser.uid,
                email: existingUser.email,
                displayName: existingUser.displayName,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });
        }

        const receiver = existingUser;
        const displayName = receiver.displayName;

        await recordLog(
            req.user.uid,
            ActionType.ASSIGN_ROLE,
            `Changed role of ${displayName} to ${role}`
        );

        res.status(200).json({
            data: {
                userId: userId,
                role: role,
                updatedAt: new Date().toISOString(),
            },
        });
        return;
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({
                message: error.errors.map((err) => err.message).join(", "),
            });
            return;
        } else {
            console.error(error);
            res.status(500).json({
                message: (error as Error).message,
            });
            return;
        }
    }
};

export const assignCashier = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                message: "Unauthorized request",
            });
            return;
        }

        const parsedBody = assignCashierSchema.parse(req.body);
        const { userId, stationId } = parsedBody;

        let userRecord;
        try {
            userRecord = await auth.getUser(userId);
        } catch (error) {
            res.status(404).json({
                message: "User not found",
            });
            return;
        }

        if (userRecord.customClaims?.role !== "cashier") {
            res.status(400).json({
                message:
                    "User must have cashier role to be assigned to a station",
            });
            return;
        }

        const stationDoc = await firestoreDb
            .collection("stations")
            .doc(stationId)
            .get();

        if (!stationDoc.exists) {
            res.status(404).json({
                message: "Station not found",
            });
            return;
        }

        const userRef = firestoreDb.collection("cashiers").doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            res.status(404).json({
                message: "Cashier not found in database",
            });
            return;
        }

        await userRef.update({
            station: stationId,
            updatedAt: FieldValue.serverTimestamp(),
        });

        const stationData = stationDoc.data();
        const cashierDisplayName = userRecord.displayName;

        await recordLog(
            req.user.uid,
            ActionType.ASSIGN_CASHIER,
            `Assigned cashier ${cashierDisplayName} to station ${stationData?.name}`
        );

        res.status(200).json({
            data: {
                userId: userId,
                stationId: stationId,
                updatedAt: new Date().toISOString(),
            },
        });
        return;
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({
                message: error.errors.map((err) => err.message).join(", "),
            });
            return;
        } else {
            console.error(error);
            res.status(500).json({
                message: (error as Error).message,
            });
            return;
        }
    }
};

export const unassignCashier = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                message: "Unauthorized request",
            });
            return;
        }

        const { userId } = req.body;

        if (!userId) {
            res.status(400).json({
                message: "User ID is required",
            });
            return;
        }

        let userRecord;
        try {
            userRecord = await auth.getUser(userId);
        } catch (error) {
            res.status(404).json({
                message: "User not found",
            });
            return;
        }

        if (userRecord.customClaims?.role !== "cashier") {
            res.status(400).json({
                message: "User must have cashier role to be unassigned",
            });
            return;
        }

        const userRef = firestoreDb.collection("cashiers").doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            res.status(404).json({
                message: "Cashier not found in database",
            });
            return;
        }

        const cashierData = userDoc.data();
        const stationId = cashierData?.stationId || cashierData?.station;

        if (!stationId) {
            res.status(400).json({
                message: "Cashier is not assigned to any station",
            });
            return;
        }

        // Get station name for logging
        const stationDoc = await firestoreDb
            .collection("stations")
            .doc(stationId)
            .get();
        const stationName = stationDoc.exists
            ? stationDoc.data()?.name
            : "Unknown Station";

        // Remove station field
        await userRef.update({
            stationId: null,
            updatedAt: FieldValue.serverTimestamp(),
        });

        const cashierDisplayName = userRecord.displayName;

        await recordLog(
            req.user.uid,
            ActionType.UNASSIGN_CASHIER,
            `Unassigned cashier ${cashierDisplayName} from station ${stationName}`
        );

        res.status(200).json({
            data: {
                userId: userId,
            },
        });
        return;
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: (error as Error).message,
        });
        return;
    }
};

export const getUserData = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                message: "Unauthorized request",
            });
            return;
        }

        const { userId } = req.params;

        if (!userId) {
            res.status(400).json({
                message: "User ID is required",
            });
            return;
        }

        const userRecord = await auth.getUser(userId);

        const userRef = firestoreDb.collection("cashiers").doc(userId);
        const userDoc = await userRef.get();
        const userData = userDoc.exists ? userDoc.data() : null;

        res.status(200).json({
            user: {
                id: userRecord.uid,
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
                role: userRecord.customClaims?.role,
                assignedStationId: userData?.station || null,
                assignedCounterId: userData?.counterId || null,
                createdAt: userRecord.metadata.creationTime,
                lastSignInTime: userRecord.metadata.lastSignInTime,
            },
        });
        return;
    } catch (error) {
        if ((error as FirebaseAuthError).code === "auth/user-not-found") {
            res.status(404).json({
                message: "User not found",
            });
            return;
        }
        res.status(500).json({
            message: (error as Error).message,
        });
        return;
    }
};

export const getAvailableCashierEmployees = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                message: "Unauthorized request",
            });
            return;
        }

        const userList = await auth.listUsers();

        const cashierEmployees = userList.users.filter(
            (user) => user.customClaims?.role === "cashier"
        );

        const usersSnapshot = await firestoreDb.collection("cashiers").get();
        const usersDataMap = new Map(
            usersSnapshot.docs.map((doc) => [doc.id, doc.data()])
        );

        const availableCashiers = cashierEmployees
            .filter((cashier) => {
                const userData = usersDataMap.get(cashier.uid);
                return userData && !userData.station;
            })
            .map((cashier) => {
                const userData = usersDataMap.get(cashier.uid);
                return {
                    id: cashier.uid,
                    uid: cashier.uid,
                    email: cashier.email,
                    name: cashier.displayName,
                    role: cashier.customClaims?.role,
                    stationId: userData?.station || null,
                    createdAt: cashier.metadata.creationTime,
                };
            });

        res.status(200).json({
            data: availableCashiers,
        });
        return;
    } catch (error) {
        res.status(500).json({
            message: (error as Error).message,
        });
        return;
    }
};

export const getCashiersByStation = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                message: "Unauthorized request",
            });
            return;
        }

        const { stationId } = req.params;

        if (!stationId) {
            res.status(400).json({
                message: "Station ID is required",
            });
            return;
        }

        // Verify station exists
        const stationDoc = await firestoreDb
            .collection("stations")
            .doc(stationId)
            .get();

        if (!stationDoc.exists) {
            res.status(404).json({
                message: "Station not found",
            });
            return;
        }

        // Query cashiers assigned to this station
        const cashiersSnapshot = await firestoreDb
            .collection("cashiers")
            .where("station", "==", stationId)
            .get();

        // Get full user details from Firebase Auth for each cashier
        const cashierPromises = cashiersSnapshot.docs.map(async (doc) => {
            try {
                const cashierData = doc.data();
                const userRecord = await auth.getUser(doc.id);

                return {
                    id: doc.id,
                    uid: doc.id,
                    email: userRecord.email,
                    name: userRecord.displayName,
                    role: userRecord.customClaims?.role,
                    stationId: cashierData.station || null,
                    counterId: cashierData.counterId || null,
                    createdAt: userRecord.metadata.creationTime,
                    lastSignInTime: userRecord.metadata.lastSignInTime,
                };
            } catch (error) {
                console.error(`Error fetching user ${doc.id}:`, error);
                return null;
            }
        });

        const cashiers = (await Promise.all(cashierPromises)).filter(
            (cashier) => cashier !== null
        );

        res.status(200).json({
            cashiers,
        });
        return;
    } catch (error) {
        res.status(500).json({
            message: (error as Error).message,
        });
        return;
    }
};

export const getActivityLogs = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                message: "Unauthorized request",
            });
            return;
        }

        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            res.status(400).json({
                message: "Missing startDate or endDate query parameters",
            });
            return;
        }

        const startTimestamp = new Date(startDate as string).getTime();
        const endTimestamp = new Date(endDate as string).getTime();

        if (isNaN(startTimestamp) || isNaN(endTimestamp)) {
            res.status(400).json({
                message: "Invalid date format. Use ISO date strings.",
            });
            return;
        }

        const activityRef = firestoreDb
            .collection("activity-log")
            .where("timestamp", ">=", startTimestamp)
            .where("timestamp", "<=", endTimestamp)
            .orderBy("timestamp", "desc");

        const activitiesSnapshot = await activityRef.get();

        const activityLogs = activitiesSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        res.status(200).json({
            activityLogs,
        });
        return;
    } catch (error) {
        res.status(500).json({
            message: (error as Error).message,
        });
        return;
    }
};

export const blockCustomerEmail = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                message: "Unauthorized request",
            });
            return;
        }

        const parsedBody = blockEmailSchema.parse(req.body);
        const { email, reason } = parsedBody;

        const blacklistSnapshot = await firestoreDb
            .collection("blacklist")
            .where("email", "==", email.toLowerCase())
            .get();

        if (!blacklistSnapshot.empty) {
            res.status(409).json({
                message: "Email is already blacklisted.",
            });
            return;
        }

        await firestoreDb.collection("blacklist").add({
            email: email.toLowerCase(),
            reason,
            blockedAt: FieldValue.serverTimestamp(),
            blockedBy: req.user.uid,
        });

        const adminUser = await auth.getUser(req.user.uid);
        const displayName = adminUser.displayName;

        await recordLog(
            req.user.uid,
            ActionType.BLOCK_EMAIL,
            `${displayName} blocks ${email} for ${reason}`
        );

        res.status(200).json({
            message: "Email successfully blacklisted.",
        });
        return;
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({
                message: error.errors.map((err) => err.message).join(", "),
            });
            return;
        } else {
            res.status(500).json({
                message: (error as Error).message,
            });
            return;
        }
    }
};

export const getBlacklistedEmails = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                message: "Unauthorized request",
            });
            return;
        }

        const blacklistSnapshot = await firestoreDb
            .collection("blacklist")
            .orderBy("blockedAt", "desc")
            .get();

        if (blacklistSnapshot.empty) {
            res.status(200).json({
                blacklistedEmails: [],
            });
            return;
        }

        const blacklistedEmails: Blacklist[] = blacklistSnapshot.docs.map(
            (doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    email: data.email,
                    reason: data.reason,
                    blockedAt: data.blockedAt,
                    blockedBy: data.blockedBy,
                };
            }
        );

        res.status(200).json({
            blacklistedEmails,
        });
        return;
    } catch (error) {
        res.status(500).json({
            message: (error as Error).message,
        });
        return;
    }
};

export const removeBlacklistedEmail = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                message: "Unauthorized request",
            });
            return;
        }

        const { email } = req.params;

        if (!email) {
            res.status(400).json({
                message: "Email is required",
            });
            return;
        }

        const blacklistedEmailSnapshot = await firestoreDb
            .collection("blacklist")
            .where("email", "==", email.toLowerCase())
            .get();

        if (blacklistedEmailSnapshot.empty) {
            res.status(404).json({
                message: "Email not found in blacklist",
            });
            return;
        }

        const blacklistDoc = blacklistedEmailSnapshot.docs[0];
        await blacklistDoc.ref.delete();

        const adminUser = await auth.getUser(req.user.uid);
        const displayName = adminUser.displayName;

        await recordLog(
            req.user.uid,
            ActionType.UNBLOCK_EMAIL,
            `${displayName} unblocks ${email}`
        );

        res.status(200).json({
            message: "Email removed from blacklist.",
        });
        return;
    } catch (error) {
        res.status(500).json({
            message: (error as Error).message,
        });
        return;
    }
};
