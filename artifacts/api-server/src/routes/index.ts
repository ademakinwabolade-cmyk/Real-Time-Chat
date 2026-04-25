import { Router, type IRouter } from "express";
import healthRouter from "./health";
import messagesRouter from "./messages";
import presenceRouter from "./presence";
import usersRouter from "./users";
import dmsRouter from "./dms";
import meRouter from "./me";
import voiceRouter from "./voice";
import statusesRouter from "./statuses";

const router: IRouter = Router();

router.use(healthRouter);
router.use(messagesRouter);
router.use(presenceRouter);
router.use(usersRouter);
router.use(dmsRouter);
router.use(meRouter);
router.use(voiceRouter);
router.use(statusesRouter);

export default router;
