import { Router } from "express";
import { verifyAuthTokenAndDomain } from "../middlewares/verifyAuthTokenAndDomain";
import { verifyRole } from "../middlewares/verifyRole";
import {
    addCounter,
    deleteCounter,
    enterCounter,
    getCounters,
    updateCounter,
    exitCounter,
} from "../controllers/counterControllers";

// eslint-disable-next-line new-cap
const router: Router = Router();

router.use(verifyAuthTokenAndDomain);

router.post("/counters", verifyRole(["admin", "superAdmin"]), addCounter);
router.get("/counters", verifyRole(["admin", "superAdmin"]), getCounters);
router.delete("/counters/:counterId", verifyRole(["admin", "superAdmin"]), deleteCounter);
router.put("/counters/:counterId", verifyRole(["admin", "superAdmin"]), updateCounter);
router.post("/counters/:counterId/enter", verifyRole(["cashier"]), enterCounter);
router.post("/counters/:counterId/exit", verifyRole(["cashier"]), exitCounter);


export default router;
