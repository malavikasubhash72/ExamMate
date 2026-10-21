import { Router } from 'express';
import {
  createExam,
  getExams,
  updateExam,
  deleteExam,
  generateExamPrepMode,
} from '../controllers/examController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/', authenticateToken, createExam);
router.get('/', authenticateToken, getExams);
router.put('/:id', authenticateToken, updateExam);
router.delete('/:id', authenticateToken, deleteExam);
router.post('/prep-mode/generate', authenticateToken, generateExamPrepMode);

export default router;
