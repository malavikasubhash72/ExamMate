"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const syllabusController_1 = require("../controllers/syllabusController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const uploadMiddleware_1 = require("../middleware/uploadMiddleware");
const router = (0, express_1.Router)();
// Upload multiple or single files
router.post('/upload', authMiddleware_1.authenticateToken, uploadMiddleware_1.uploadSyllabus.array('files', 10), syllabusController_1.uploadSyllabusFile);
router.get('/', authMiddleware_1.authenticateToken, syllabusController_1.getSyllabi);
// Aggregated subjects & topics
router.get('/subjects', authMiddleware_1.authenticateToken, syllabusController_1.getAllSubjects);
router.get('/topics', authMiddleware_1.authenticateToken, syllabusController_1.getAllTopics);
// Individual syllabus management
router.get('/:id', authMiddleware_1.authenticateToken, syllabusController_1.getSyllabusById);
router.post('/:id/process', authMiddleware_1.authenticateToken, syllabusController_1.processSyllabus);
router.put('/:id', authMiddleware_1.authenticateToken, syllabusController_1.updateSyllabusStructure);
router.delete('/:id', authMiddleware_1.authenticateToken, syllabusController_1.deleteSyllabus);
// Granular Subject/Topic endpoints
router.put('/subjects/:id', authMiddleware_1.authenticateToken, syllabusController_1.updateSubject);
router.put('/topics/:id', authMiddleware_1.authenticateToken, syllabusController_1.updateTopic);
router.post('/topics', authMiddleware_1.authenticateToken, syllabusController_1.createTopic);
router.delete('/topics/:id', authMiddleware_1.authenticateToken, syllabusController_1.deleteTopic);
exports.default = router;
