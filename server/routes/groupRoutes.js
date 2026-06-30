import express from 'express';
import { addExtraMem, deleteMember, getGroups, getGrpMessages, getLatestGrpMsg, newGroup, updateGrp, sendGrpMsg, startMigration, markReady, verifyMigration, activateE2EE, rollbackE2EE, forcePlaintext, transferOwnership, markGroupSeen } from '../controllers/groupController.js';
import { protectRoute } from '../middleware/auth.js';

const groupRouter = express.Router();

groupRouter.post("/new-group", protectRoute, newGroup);
groupRouter.get("/get-groups", protectRoute, getGroups);
groupRouter.get("/latest-grpmsg", protectRoute, getLatestGrpMsg);
groupRouter.post("/send-grpmsg", protectRoute, sendGrpMsg);
groupRouter.get("/get-grpmsg/:groupId", protectRoute, getGrpMessages);
groupRouter.put("/updateGrp/:id", protectRoute, updateGrp);
groupRouter.put("/add-extra-mem", protectRoute, addExtraMem);
groupRouter.post("/mark-seen/:id", protectRoute, markGroupSeen);
groupRouter.delete("/delete-mem/:id", protectRoute, deleteMember);

// Migration State Machine Routes
groupRouter.post("/:id/start-migration", protectRoute, startMigration);
groupRouter.post("/:id/mark-ready", protectRoute, markReady);
groupRouter.post("/:id/verify-migration", protectRoute, verifyMigration);
groupRouter.post("/:id/activate-e2ee", protectRoute, activateE2EE);
groupRouter.post("/:id/rollback-e2ee", protectRoute, rollbackE2EE);
groupRouter.post("/:id/force-plaintext", protectRoute, forcePlaintext);
groupRouter.post("/:id/transfer-owner", protectRoute, transferOwnership);

export default groupRouter;
