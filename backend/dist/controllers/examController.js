"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateExamPrepMode = exports.deleteExam = exports.updateExam = exports.getExams = exports.createExam = void 0;
const prisma_1 = require("../config/prisma");
const examPrepEngine_1 = require("../services/examPrepEngine");
const createExam = async (req, res) => {
    try {
        const { subject_id, exam_date } = req.body;
        const userId = req.userId;
        if (!subject_id || !exam_date) {
            return res.status(400).json({ message: 'Subject and Exam Date are required.' });
        }
        const subject = await prisma_1.prisma.subject.findFirst({
            where: {
                id: subject_id,
                syllabus: { user_id: userId },
            },
        });
        if (!subject) {
            return res.status(404).json({ message: 'Selected subject not found in your syllabus.' });
        }
        // Check duplicate exam
        const existingExam = await prisma_1.prisma.exam.findFirst({
            where: {
                user_id: userId,
                subject_id,
                exam_date: new Date(exam_date),
            },
        });
        if (existingExam) {
            return res.status(400).json({ message: 'An exam for this subject on this date already exists.' });
        }
        const exam = await prisma_1.prisma.exam.create({
            data: {
                user_id: userId,
                subject_id,
                exam_date: new Date(exam_date),
            },
            include: {
                subject: true,
            },
        });
        // Auto-generate Exam Prep Timetable
        await (0, examPrepEngine_1.generateExamPrepTimetable)(userId, exam.id);
        res.status(201).json({
            message: 'Exam scheduled successfully and Exam Prep timetable generated.',
            exam,
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message || 'Error creating exam.' });
    }
};
exports.createExam = createExam;
const getExams = async (req, res) => {
    try {
        const exams = await prisma_1.prisma.exam.findMany({
            where: { user_id: req.userId },
            include: {
                subject: {
                    include: {
                        modules: {
                            include: {
                                topics: true,
                            },
                        },
                    },
                },
            },
            orderBy: { exam_date: 'asc' },
        });
        res.json({ exams });
    }
    catch (error) {
        res.status(500).json({ message: error.message || 'Error fetching exams.' });
    }
};
exports.getExams = getExams;
const updateExam = async (req, res) => {
    try {
        const { id } = req.params;
        const { exam_date } = req.body;
        const userId = req.userId;
        const existingExam = await prisma_1.prisma.exam.findFirst({
            where: { id, user_id: userId },
        });
        if (!existingExam) {
            return res.status(404).json({ message: 'Exam not found.' });
        }
        const exam = await prisma_1.prisma.exam.update({
            where: { id },
            data: {
                exam_date: new Date(exam_date),
            },
            include: { subject: true },
        });
        // Regenerate Exam Prep Timetable
        await (0, examPrepEngine_1.generateExamPrepTimetable)(userId, exam.id);
        res.json({
            message: 'Exam date updated successfully.',
            exam,
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message || 'Error updating exam.' });
    }
};
exports.updateExam = updateExam;
const deleteExam = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const existingExam = await prisma_1.prisma.exam.findFirst({
            where: { id, user_id: userId },
        });
        if (!existingExam) {
            return res.status(404).json({ message: 'Exam not found.' });
        }
        await prisma_1.prisma.exam.delete({ where: { id } });
        res.json({ message: 'Exam deleted successfully.' });
    }
    catch (error) {
        res.status(500).json({ message: error.message || 'Error deleting exam.' });
    }
};
exports.deleteExam = deleteExam;
const generateExamPrepMode = async (req, res) => {
    try {
        const userId = req.userId;
        const { exam_id } = req.body;
        const result = await (0, examPrepEngine_1.generateExamPrepTimetable)(userId, exam_id);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ message: error.message || 'Error generating exam preparation schedule.' });
    }
};
exports.generateExamPrepMode = generateExamPrepMode;
