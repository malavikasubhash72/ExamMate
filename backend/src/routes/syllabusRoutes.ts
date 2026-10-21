import { Router } from 'express';
import {
  uploadSyllabusFile,
  getSyllabi,
  getSyllabusById,
  processSyllabus,
  deleteSyllabus,
  updateSyllabusStructure,
  getAllSubjects,
  getAllTopics,
  updateSubject,
  updateTopic,
  createTopic,
  deleteTopic,
} from '../controllers/syllabusController';
import { authenticateToken } from '../middleware/authMiddleware';
import { uploadSyllabus } from '../middleware/uploadMiddleware';

const router = Router();

// Upload multiple or single files
router.post('/upload', authenticateToken, uploadSyllabus.array('files', 10), uploadSyllabusFile);
router.get('/', authenticateToken, getSyllabi);

// Aggregated subjects & topics
router.get('/subjects', authenticateToken, getAllSubjects);
router.get('/topics', authenticateToken, getAllTopics);

// Individual syllabus management
router.get('/:id', authenticateToken, getSyllabusById);
router.post('/:id/process', authenticateToken, processSyllabus);
router.put('/:id', authenticateToken, updateSyllabusStructure);
router.delete('/:id', authenticateToken, deleteSyllabus);

// Granular Subject/Topic endpoints
router.put('/subjects/:id', authenticateToken, updateSubject);
router.put('/topics/:id', authenticateToken, updateTopic);
router.post('/topics', authenticateToken, createTopic);
router.delete('/topics/:id', authenticateToken, deleteTopic);

export default router;
