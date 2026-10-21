import { Router } from 'express';
import { getNotifications, markNotificationAsRead } from '../controllers/notificationController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/', authenticateToken, getNotifications);
router.put('/:id/read', authenticateToken, markNotificationAsRead);

export default router;
