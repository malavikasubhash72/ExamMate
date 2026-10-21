import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middleware/authMiddleware';

export const getProgress = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const profile = await prisma.studentProfile.findUnique({
      where: { user_id: userId },
    });

    const syllabi = await prisma.syllabus.findMany({
      where: { user_id: userId },
      include: {
        subjects: {
          include: {
            modules: {
              include: {
                topics: true,
              },
            },
          },
        },
      },
    });

    const processedPdfCount = syllabi.filter((s) => s.status === 'PROCESSED').length;
    let totalSubjectsCount = 0;
    let totalTopics = 0;
    let completedTopicsCount = 0;
    let inProgressTopicsCount = 0;
    let pendingTopicsCount = 0;

    const subjectProgressList: Array<{
      subjectId: string;
      subjectName: string;
      totalTopics: number;
      completedTopics: number;
      percentage: number;
    }> = [];

    for (const syllabus of syllabi) {
      for (const subject of syllabus.subjects) {
        totalSubjectsCount++;
        let subTotal = 0;
        let subCompleted = 0;

        for (const mod of subject.modules) {
          for (const topic of mod.topics) {
            subTotal++;
            totalTopics++;

            if (topic.status === 'COMPLETED') {
              subCompleted++;
              completedTopicsCount++;
            } else if (topic.status === 'IN_PROGRESS') {
              inProgressTopicsCount++;
            } else {
              pendingTopicsCount++;
            }
          }
        }

        const subPercentage = subTotal > 0 ? Math.round((subCompleted / subTotal) * 100) : 0;
        subjectProgressList.push({
          subjectId: subject.id,
          subjectName: subject.name,
          totalTopics: subTotal,
          completedTopics: subCompleted,
          percentage: subPercentage,
        });
      }
    }

    const overallPercentage = totalTopics > 0 ? Math.round((completedTopicsCount / totalTopics) * 100) : 0;

    const totalSessions = await prisma.studySession.count({ where: { user_id: userId } });
    const completedSessions = await prisma.studySession.count({ where: { user_id: userId, status: 'COMPLETED' } });
    const missedSessions = await prisma.studySession.count({ where: { user_id: userId, status: 'MISSED' } });
    const pendingSessions = await prisma.studySession.count({ where: { user_id: userId, status: 'PENDING' } });

    const completedDates = await prisma.studySession.findMany({
      where: { user_id: userId, status: 'COMPLETED' },
      select: { date: true },
      orderBy: { date: 'desc' },
    });

    const uniqueDays = new Set(completedDates.map((d) => new Date(d.date).toISOString().split('T')[0]));
    let streak = 0;
    let checkDate = new Date();
    checkDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < 30; i++) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (uniqueDays.has(dateStr)) {
        streak++;
      } else if (i > 0) {
        break;
      }
      checkDate.setDate(checkDate.getDate() - 1);
    }

    res.json({
      overallPercentage,
      processedPdfCount,
      totalSubjectsCount,
      totalTopics,
      completedTopicsCount,
      inProgressTopicsCount,
      pendingTopicsCount,
      subjectProgress: subjectProgressList,
      sessionStats: {
        totalSessions,
        completedSessions,
        missedSessions,
        pendingSessions,
      },
      streak,
      dailyHours: profile?.daily_study_hours || 3.0,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error calculating progress.' });
  }
};
