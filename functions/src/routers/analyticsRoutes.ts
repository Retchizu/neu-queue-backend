import { Router } from "express";
import { verifyAuthTokenAndDomain } from "../middlewares/verifyAuthTokenAndDomain";
import { verifyRole } from "../middlewares/verifyRole";
import {
  getAverageWaitTime,
  getCompletedThroughput,
} from "../controllers/analyticsController";

// eslint-disable-next-line new-cap
const router: Router = Router();

router.use(verifyAuthTokenAndDomain, verifyRole(["admin", "superAdmin"]));

router.get("/average-wait-time", getAverageWaitTime);
router.get("/completed-throughput", getCompletedThroughput);

export default router;
