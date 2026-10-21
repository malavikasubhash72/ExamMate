import { Router } from 'express';
import { getProfile, updateProfile } from '../controllers/profileController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/', authenticateToken, getProfile);
router.put('/', authenticateToken, updateProfile);

export default router;
