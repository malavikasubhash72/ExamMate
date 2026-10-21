import { prisma } from '../config/prisma';

export async function generateExamPrepTimetable(userId: string, examId?: string) {
  // 1. Fetch relevant exam or all upcoming exams within 14 days
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const upcomingExams = await prisma.exam.findMany({
    where: {
      user_id: userId,
      ...(examId ? { id: examId } : {}),
      exam_date: {
        gte: now,
      },
    },
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

  if (upcomingExams.length === 0) {
    return {
      message: 'No upcoming exams found to prepare for.',
      count: 0,
    };
  }

  let totalSessionsCreated = 0;

  for (const exam of upcomingExams) {
    const examDate = new Date(exam.exam_date);
    examDate.setHours(0, 0, 0, 0);

    // Calculate days remaining until exam
    const diffTime = examDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Clear existing PENDING EXAM_PREP sessions for this exam subject from today up to exam date
    const examTopics = exam.subject.modules.flatMap((m) => m.topics);
    const examTopicIds = examTopics.map((t) => t.id);

    await prisma.studySession.deleteMany({
      where: {
        user_id: userId,
        mode: 'EXAM_PREP',
        status: 'PENDING',
        topic_id: { in: examTopicIds },
        date: {
          gte: now,
          lte: examDate,
        },
      },
    });

    // Schedule prep sessions starting from today or 7 days prior, up to the day before exam
    const startPrepDate = new Date(now);
    const endPrepDate = new Date(examDate);
    endPrepDate.setDate(endPrepDate.getDate() - 1); // Up to day before exam

    const newPrepSessions: any[] = [];
    let prepDate = new Date(startPrepDate);

    let topicIdx = 0;
    while (prepDate <= endPrepDate) {
      // Create 2 intensive prep slots per day for exam subject
      const dateCopy = new Date(prepDate);
      
      const topicToReview = examTopics[topicIdx % examTopics.length];
      topicIdx++;

      // Session 1: Topic Revision
      newPrepSessions.push({
        user_id: userId,
        topic_id: topicToReview ? topicToReview.id : examTopicIds[0],
        date: dateCopy,
        start_time: '14:00',
        end_time: '15:30',
        mode: 'EXAM_PREP',
        status: 'PENDING',
      });

      // Session 2: Practice / Problem Solving
      newPrepSessions.push({
        user_id: userId,
        topic_id: topicToReview ? topicToReview.id : examTopicIds[0],
        date: dateCopy,
        start_time: '20:00',
        end_time: '21:30',
        mode: 'EXAM_PREP',
        status: 'PENDING',
      });

      prepDate.setDate(prepDate.getDate() + 1);
    }

    if (newPrepSessions.length > 0) {
      await prisma.studySession.createMany({
        data: newPrepSessions,
      });

      totalSessionsCreated += newPrepSessions.length;

      // Notification
      await prisma.notification.create({
        data: {
          user_id: userId,
          title: `Exam Preparation Active: ${exam.subject.name}`,
          message: `Exam Prep Mode generated ${newPrepSessions.length} intensive revision sessions leading up to your exam on ${examDate.toLocaleDateString()}.`,
          type: 'EXAM',
        },
      });
    }
  }

  return {
    message: 'Exam preparation timetable generated successfully.',
    count: totalSessionsCreated,
  };
}
