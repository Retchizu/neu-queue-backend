import { Router } from "express";
import { verifyAuthTokenAndDomain } from "../middlewares/verifyAuthTokenAndDomain";
import { getCurrentAuthDetails } from "../controllers/userController";
import { verifyRole } from "@/middlewares/verifyRole";

// eslint-disable-next-line new-cap
const router: Router = Router();

router.get("/admin/me", verifyAuthTokenAndDomain, verifyRole(["admin"]), getCurrentAuthDetails);
router.get("/cashier/me", verifyAuthTokenAndDomain, verifyRole(["cashier"]), getCurrentAuthDetails);


export default router;
