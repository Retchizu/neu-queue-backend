import { Router } from "express";
import { verifyAuthTokenAndDomain } from "../middlewares/verifyAuthTokenAndDomain";
import { getCurrentAuthDetails } from "../controllers/userController";

// eslint-disable-next-line new-cap
const router: Router = Router();

router.get("/current", verifyAuthTokenAndDomain, getCurrentAuthDetails);


export default router;
