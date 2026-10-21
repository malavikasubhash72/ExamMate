import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { generateRegularTimetable } from '../services/timetableEngine';
import { detectAndRescheduleMissedSessions } from '../services/reschedulingEngine';

export const generateTimetable = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const result = await generateRegularTimetable(userId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error generating timetable.' });
  }
};

export const getTimetable = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // Run missed session detector on fetch to keep schedule adaptive
    await detectAndRescheduleMissedSessions(userId);

    const { mode, status, startDate, endDate } = req.query;

    const filter: any = { user_id: userId };

    if (mode) filter.mode = String(mode);
    if (status) filter.status = String(status);
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.gte = new Date(String(startDate));
      if (endDate) filter.date.lte = new Date(String(endDate));
    }

    const sessions = await prisma.studySession.findMany({
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
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching timetable.' });
  }
};

export const markSessionComplete = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const session = await prisma.studySession.findFirst({
      where: { id, user_id: userId },
      include: { topic: true },
    });

    if (!session) {
      return res.status(404).json({ message: 'Study session not found.' });
    }

    // Update study session status
    const updatedSession = await prisma.studySession.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });

    // Update topic status to COMPLETED
    await prisma.topic.update({
      where: { id: session.topic_id },
      data: { status: 'COMPLETED' },
    });

    // Record progress
    await prisma.progress.create({
      data: {
        user_id: userId,
        topic_id: session.topic_id,
        status: 'COMPLETED',
        completed_at: new Date(),
      },
    });

    // Create notification
    await prisma.notification.create({
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
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error updating session status.' });
  }
};

export const markSessionMissed = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const session = await prisma.studySession.findFirst({
      where: { id, user_id: userId },
      include: { topic: true },
    });

    if (!session) {
      return res.status(404).json({ message: 'Study session not found.' });
    }

    // Trigger rescheduling engine
    await prisma.studySession.update({
      where: { id },
      data: { status: 'MISSED' },
    });

    const rescheduleResult = await detectAndRescheduleMissedSessions(userId);

    res.json({
      message: 'Session marked as missed and automatically rescheduled.',
      rescheduledCount: rescheduleResult.rescheduledCount,
      rescheduledSessions: rescheduleResult.rescheduledSessions,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error marking session missed.' });
  }
};
