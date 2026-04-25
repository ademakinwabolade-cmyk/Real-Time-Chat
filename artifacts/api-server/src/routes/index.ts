import { Router, type IRouter } from "express";
import healthRouter from "./health";
import messagesRouter from "./messages";
import presenceRouter from "./presence";

const router: IRouter = Router();

router.use(healthRouter);
router.use(messagesRouter);
router.use(presenceRouter);

export default router;
