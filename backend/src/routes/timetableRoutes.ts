import { Router } from 'express';
import {
  generateTimetable,
  getTimetable,
  markSessionComplete,
  markSessionMissed,
} from '../controllers/timetableController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/generate', authenticateToken, generateTimetable);
router.get('/', authenticateToken, getTimetable);
router.post('/:id/complete', authenticateToken, markSessionComplete);
router.post('/:id/miss', authenticateToken, markSessionMissed);

export default router;
