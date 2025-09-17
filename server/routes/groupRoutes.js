import express from 'express';
import { getGroups, newGroup } from '../controllers/groupController.js';
import { protectRoute } from '../middleware/auth.js';

const groupRouter = express.Router();

groupRouter.post("/new-group", protectRoute, newGroup);
groupRouter.get("/get-groups", protectRoute, getGroups);

export default groupRouter;
