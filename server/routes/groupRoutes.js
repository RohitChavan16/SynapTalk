import express from 'express';
import { getGroups, getGrpMessages, newGroup, updateGrp } from '../controllers/groupController.js';
import { protectRoute } from '../middleware/auth.js';
import { sendGrpMsg } from '../controllers/groupController.js';

const groupRouter = express.Router();

groupRouter.post("/new-group", protectRoute, newGroup);
groupRouter.get("/get-groups", protectRoute, getGroups);
groupRouter.post("/send-grpmsg", protectRoute, sendGrpMsg);
groupRouter.get("/get-grpmsg/:groupId", protectRoute, getGrpMessages);
groupRouter.put("/updateGrp/:id", protectRoute, updateGrp);

export default groupRouter;
