import express from 'express';
import { addExtraMem, deleteMember, getGroups, getGrpMessages, newGroup, updateGrp } from '../controllers/groupController.js';
import { protectRoute } from '../middleware/auth.js';
import { sendGrpMsg } from '../controllers/groupController.js';

const groupRouter = express.Router();

groupRouter.post("/new-group", protectRoute, newGroup);
groupRouter.get("/get-groups", protectRoute, getGroups);
groupRouter.post("/send-grpmsg", protectRoute, sendGrpMsg);
groupRouter.get("/get-grpmsg/:groupId", protectRoute, getGrpMessages);
groupRouter.put("/updateGrp/:id", protectRoute, updateGrp);
groupRouter.put("/add-extra-mem", protectRoute, addExtraMem);
groupRouter.delete("/delete-mem/:id", protectRoute, deleteMember);

export default groupRouter;
