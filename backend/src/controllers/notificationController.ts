import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middleware/authMiddleware';

export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const notifications = await prisma.notification.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: { user_id: userId, is_read: false },
    });

    res.json({
      notifications,
      unreadCount,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching notifications.' });
  }
};

export const markNotificationAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    if (id === 'all') {
      await prisma.notification.updateMany({
        where: { user_id: userId, is_read: false },
        data: { is_read: true },
      });

      return res.json({ message: 'All notifications marked as read.' });
    }

    const notification = await prisma.notification.findFirst({
      where: { id, user_id: userId },
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { is_read: true },
    });

    res.json({
      message: 'Notification marked as read.',
      notification: updated,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error updating notification.' });
  }
};
