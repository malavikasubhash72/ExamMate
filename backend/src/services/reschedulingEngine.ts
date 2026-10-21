import { prisma } from '../config/prisma';

export async function detectAndRescheduleMissedSessions(userId: string) {
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find all past sessions for the user that are still marked PENDING
  const overdueSessions = await prisma.studySession.findMany({
    where: {
      user_id: userId,
      status: 'PENDING',
      date: {
        lt: today,
      },
    },
    include: {
      topic: true,
    },
    orderBy: { date: 'asc' },
  });

  if (overdueSessions.length === 0) {
    return {
      rescheduledCount: 0,
      rescheduledSessions: [],
    };
  }

  const rescheduledSessions = [];

  for (const session of overdueSessions) {
    // 1. Mark original session as MISSED
    await prisma.studySession.update({
      where: { id: session.id },
      data: { status: 'MISSED' },
    });

    // 2. Find next available open day starting tomorrow
    const nextSlotDate = new Date(today);
    nextSlotDate.setDate(nextSlotDate.getDate() + 1);

    // Look for a day within next 7 days with fewer than max daily slots
    let candidateDate = new Date(nextSlotDate);
    let foundSlot = false;
    let newStartTime = '16:00';
    let newEndTime = '17:00';

    for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() + dayOffset);

      const existingOnDay = await prisma.studySession.count({
        where: {
          user_id: userId,
          date: checkDate,
          status: { in: ['PENDING', 'RESCHEDULED'] },
        },
      });

      if (existingOnDay < 4) {
        candidateDate = checkDate;
        foundSlot = true;
        // Adjust start/end time based on existing sessions count
        const startHour = 16 + existingOnDay * 1.25;
        const startH = Math.floor(startHour);
        const startM = (startHour % 1) * 60 === 0 ? '00' : '15';
        const endH = startH + 1;

        newStartTime = `${startH.toString().padStart(2, '0')}:${startM}`;
        newEndTime = `${endH.toString().padStart(2, '0')}:${startM}`;
        break;
      }
    }

    if (!foundSlot) {
      candidateDate.setDate(today.getDate() + 8);
    }

    // 3. Create new Rescheduled session
    const newSession = await prisma.studySession.create({
      data: {
        user_id: userId,
        topic_id: session.topic_id,
        date: candidateDate,
        start_time: newStartTime,
        end_time: newEndTime,
        mode: session.mode,
        status: 'PENDING',
        original_session_id: session.original_session_id || session.id,
        rescheduled_from_id: session.id,
      },
      include: {
        topic: true,
      },
    });

    rescheduledSessions.push(newSession);

    // 4. Create notification
    const dateFormatted = candidateDate.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    await prisma.notification.create({
      data: {
        user_id: userId,
        title: 'Session Automatically Rescheduled',
        message: `Your missed session "${session.topic.name}" has been rescheduled to ${dateFormatted} at ${newStartTime}.`,
        type: 'MISSED',
      },
    });
  }

  return {
    rescheduledCount: rescheduledSessions.length,
    rescheduledSessions,
  };
}
