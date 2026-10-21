import { prisma } from '../config/prisma';

export async function generateRegularTimetable(userId: string) {
  // 1. Get user profile for daily study hours
  const profile = await prisma.studentProfile.findUnique({
    where: { user_id: userId },
  });

  const dailyHours = profile?.daily_study_hours || 3.0;
  const sessionsPerDay = Math.max(1, Math.min(6, Math.floor(dailyHours)));

  // 2. Fetch all user syllabi & subjects
  const userSyllabi = await prisma.syllabus.findMany({
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

  // Group pending topics by subject for balanced round-robin scheduling
  const subjectTopicQueues: Array<Array<{ id: string; name: string; subjectName: string }>> = [];

  for (const syllabus of userSyllabi) {
    for (const subject of syllabus.subjects) {
      const subPending: Array<{ id: string; name: string; subjectName: string }> = [];
      for (const mod of subject.modules) {
        for (const topic of mod.topics) {
          if (topic.status !== 'COMPLETED') {
            subPending.push({
              id: topic.id,
              name: topic.name,
              subjectName: subject.name,
            });
          }
        }
      }
      if (subPending.length > 0) {
        subjectTopicQueues.push(subPending);
      }
    }
  }

  // Interleave topics round-robin across subjects
  const interleavedPendingTopics: Array<{ id: string; name: string; subjectName: string }> = [];
  let queueIdx = 0;
  let hasMore = subjectTopicQueues.length > 0;

  const pointers = new Array(subjectTopicQueues.length).fill(0);

  while (hasMore) {
    hasMore = false;
    for (let q = 0; q < subjectTopicQueues.length; q++) {
      const queue = subjectTopicQueues[q];
      const p = pointers[q];
      if (p < queue.length) {
        interleavedPendingTopics.push(queue[p]);
        pointers[q] = p + 1;
        if (pointers[q] < queue.length) {
          hasMore = true;
        }
      }
    }
  }

  if (interleavedPendingTopics.length === 0) {
    return {
      message: 'No pending topics found in syllabus.',
      count: 0,
    };
  }

  // 3. Clear existing future PENDING REGULAR sessions
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.studySession.deleteMany({
    where: {
      user_id: userId,
      mode: 'REGULAR',
      status: 'PENDING',
      date: {
        gte: today,
      },
    },
  });

  const defaultSlotTimes = [
    { start: '16:00', end: '17:00' },
    { start: '17:15', end: '18:15' },
    { start: '18:30', end: '19:30' },
    { start: '19:45', end: '20:45' },
    { start: '21:00', end: '22:00' },
    { start: '22:15', end: '23:15' },
  ];

  const newSessions: any[] = [];
  let topicIndex = 0;
  const daysToSchedule = 14;

  for (let dayOffset = 0; dayOffset < daysToSchedule; dayOffset++) {
    const sessionDate = new Date();
    sessionDate.setDate(today.getDate() + dayOffset);
    sessionDate.setHours(0, 0, 0, 0);

    for (let slot = 0; slot < sessionsPerDay; slot++) {
      if (interleavedPendingTopics.length === 0) break;

      const topic = interleavedPendingTopics[topicIndex % interleavedPendingTopics.length];
      topicIndex++;

      const slotTime = defaultSlotTimes[slot % defaultSlotTimes.length];

      newSessions.push({
        user_id: userId,
        topic_id: topic.id,
        date: sessionDate,
        start_time: slotTime.start,
        end_time: slotTime.end,
        mode: 'REGULAR',
        status: 'PENDING',
      });
    }
  }

  await prisma.studySession.createMany({
    data: newSessions,
  });

  await prisma.notification.create({
    data: {
      user_id: userId,
      title: 'Multi-Subject Timetable Generated',
      message: `Generated ${newSessions.length} sessions across ${subjectTopicQueues.length} subject(s) based on ${dailyHours} daily study hours.`,
      type: 'INFO',
    },
  });

  return {
    message: 'Regular timetable generated successfully.',
    count: newSessions.length,
  };
}
