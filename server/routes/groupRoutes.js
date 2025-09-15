import express from 'express';
import { newGroup } from '../controllers/groupController.js';

const groupRouter = express.Router();

groupRouter.post("/new-group", newGroup);

export default groupRouter;
