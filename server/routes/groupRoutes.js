import express from 'express';
import { newGroup } from '../controllers/groupController.js';
import { protectRoute } from '../middleware/auth.js';

const groupRouter = express.Router();

groupRouter.post("/new-group", protectRoute, newGroup);

export default groupRouter;
