import { Router } from "express";
import { verifyAuthTokenAndDomain } from "@/middlewares/verifyAuthTokenAndDomain";
import { verifyRole } from "@/middlewares/verifyRole";
import {
  assignUserRole,
  assignCashier,
  blockCustomerEmail,
  getActivityLogs,
  getAvailableCashierEmployees,
  getBlacklistedEmails,
  getEmployees,
  getPendingUsers,
  getUserData,
  removeBlacklistedEmail,
} from "@/controllers/adminController";

// eslint-disable-next-line new-cap
const router: Router = Router();
router.use(verifyAuthTokenAndDomain, verifyRole(["admin", "superAdmin"]));

// User management routes
router.get("/pending-users", getPendingUsers);
router.get("/employees", getEmployees);
router.post("/assign-role", assignUserRole);
router.post("/assign-cashier", assignCashier);
router.get("/users/:userId", getUserData);
router.get("/available-cashiers", getAvailableCashierEmployees);

// Activity routes
router.get("/activity-logs", getActivityLogs);

// Blacklist management routes
router.get("/blacklist", getBlacklistedEmails);
router.post("/blacklist", blockCustomerEmail);
router.delete("/blacklist/:email", removeBlacklistedEmail);

export default router;
