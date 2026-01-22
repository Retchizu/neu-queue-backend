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

        const existingRole = existingUser.customClaims?.role;

        if (existingRole === "cashier" && role !== "cashier") {
            const countersSnapshot = await firestoreDb
                .collection("counters")
                .where("cashierUid", "==", userId)
                .get();

            const assignedCounters = await Promise.all(
                countersSnapshot.docs.map(async (counterDoc) => {
                    const counterData = counterDoc.data();
                    const stationDoc = await firestoreDb
                        .collection("stations")
                        .doc(counterData.stationId)
                        .get();

                    return {
                        counterId: counterDoc.id,
                        counterNumber: counterData.number,
                        stationName: stationDoc.exists
                            ? stationDoc.data()?.name
                            : "Unknown Station",
                    };
                })
            );

            const activeAssignment =
                assignedCounters.length > 0 ? assignedCounters[0] : null;

            if (activeAssignment) {
                res.status(409).json({
                    message:
                        "This cashier is assigned to station " +
                        `'${activeAssignment.stationName}', ` +
                        `counter: ${activeAssignment.counterNumber}. ` +
                        "Remove them from the station before changing roles.",
                });
                return;
            }
        }

        await auth.setCustomUserClaims(userId, { role: role });
        await auth.revokeRefreshTokens(userId);

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

        const userRef = firestoreDb.collection("users").doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            res.status(404).json({
                message: "User data not found in database",
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

        const userRef = firestoreDb.collection("users").doc(userId);
        const userDoc = await userRef.get();
        const userData = userDoc.exists ? userDoc.data() : null;

        res.status(200).json({
            data: {
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

        const usersSnapshot = await firestoreDb.collection("users").get();
        const usersDataMap = new Map(
            usersSnapshot.docs.map((doc) => [doc.id, doc.data()])
        );

        const countersSnapshot = await firestoreDb
            .collection("counters")
            .where("cashierUid", "!=", null)
            .get();

        const assignedCashierIds = new Set(
            countersSnapshot.docs
                .map((doc) => doc.data().cashierUid)
                .filter((uid) => uid !== null)
        );

        const availableCashiers = cashierEmployees
            .filter((cashier) => {
                const userData = usersDataMap.get(cashier.uid);
                return userData && !assignedCashierIds.has(cashier.uid);
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
            data: activityLogs,
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
                data: [],
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
