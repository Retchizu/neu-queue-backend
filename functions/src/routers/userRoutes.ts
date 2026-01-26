import { Router } from "express";
import { verifyAuthTokenAndDomain } from "../middlewares/verifyAuthTokenAndDomain";
import { getAdminAuthDetails, getCashierAuthDetails, getInformationAuthDetails } from "../controllers/userController";
import { verifyRole } from "@/middlewares/verifyRole";

// eslint-disable-next-line new-cap
const router: Router = Router();

router.get("/admin/me", verifyAuthTokenAndDomain, verifyRole(["superAdmin", "admin"]), getAdminAuthDetails);
router.get("/cashier/me", verifyAuthTokenAndDomain, verifyRole(["cashier"]), getCashierAuthDetails);
router.get("/information/me", verifyAuthTokenAndDomain, verifyRole(["information"]), getInformationAuthDetails);


export default router;
