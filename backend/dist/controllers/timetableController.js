"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markSessionMissed = exports.markSessionComplete = exports.getTimetable = exports.generateTimetable = void 0;
const prisma_1 = require("../config/prisma");
const timetableEngine_1 = require("../services/timetableEngine");
const reschedulingEngine_1 = require("../services/reschedulingEngine");
const generateTimetable = async (req, res) => {
    try {
        const userId = req.userId;
        const result = await (0, timetableEngine_1.generateRegularTimetable)(userId);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ message: error.message || 'Error generating timetable.' });
    }
};
exports.generateTimetable = generateTimetable;
const getTimetable = async (req, res) => {
    try {
        const userId = req.userId;
        // Run missed session detector on fetch to keep schedule adaptive
        await (0, reschedulingEngine_1.detectAndRescheduleMissedSessions)(userId);
        const { mode, status, startDate, endDate } = req.query;
        const filter = { user_id: userId };
        if (mode)
            filter.mode = String(mode);
        if (status)
            filter.status = String(status);
        if (startDate || endDate) {
            filter.date = {};
            if (startDate)
                filter.date.gte = new Date(String(startDate));
            if (endDate)
                filter.date.lte = new Date(String(endDate));
        }
        const sessions = await prisma_1.prisma.studySession.findMany({
            where: filter,
            include: {
                topic: {
                    include: {
                        module: {
                            include: {
                                subject: true,
                            },
                        },
                    },
                },
                originalSession: true,
            },
            orderBy: [{ date: 'asc' }, { start_time: 'asc' }],
        });
        res.json({ sessions });
    }
    catch (error) {
        res.status(500).json({ message: error.message || 'Error fetching timetable.' });
    }
};
exports.getTimetable = getTimetable;
const markSessionComplete = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const session = await prisma_1.prisma.studySession.findFirst({
            where: { id, user_id: userId },
            include: { topic: true },
        });
        if (!session) {
            return res.status(404).json({ message: 'Study session not found.' });
        }
        // Update study session status
        const updatedSession = await prisma_1.prisma.studySession.update({
            where: { id },
            data: { status: 'COMPLETED' },
        });
        // Update topic status to COMPLETED
        await prisma_1.prisma.topic.update({
            where: { id: session.topic_id },
            data: { status: 'COMPLETED' },
        });
        // Record progress
        await prisma_1.prisma.progress.create({
            data: {
                user_id: userId,
                topic_id: session.topic_id,
                status: 'COMPLETED',
                completed_at: new Date(),
            },
        });
        // Create notification
        await prisma_1.prisma.notification.create({
            data: {
                user_id: userId,
                title: 'Session Completed! 🎉',
                message: `Great job! You completed "${session.topic.name}". Progress updated.`,
                type: 'INFO',
            },
        });
        res.json({
            message: 'Session marked as completed.',
            session: updatedSession,
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message || 'Error updating session status.' });
    }
};
exports.markSessionComplete = markSessionComplete;
const markSessionMissed = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const session = await prisma_1.prisma.studySession.findFirst({
            where: { id, user_id: userId },
            include: { topic: true },
        });
        if (!session) {
            return res.status(404).json({ message: 'Study session not found.' });
        }
        // Trigger rescheduling engine
        await prisma_1.prisma.studySession.update({
            where: { id },
            data: { status: 'MISSED' },
        });
        const rescheduleResult = await (0, reschedulingEngine_1.detectAndRescheduleMissedSessions)(userId);
        res.json({
            message: 'Session marked as missed and automatically rescheduled.',
            rescheduledCount: rescheduleResult.rescheduledCount,
            rescheduledSessions: rescheduleResult.rescheduledSessions,
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message || 'Error marking session missed.' });
    }
};
exports.markSessionMissed = markSessionMissed;
