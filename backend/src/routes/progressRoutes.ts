import { Router } from 'express';
import { getProgress } from '../controllers/progressController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/', authenticateToken, getProgress);

export default router;
