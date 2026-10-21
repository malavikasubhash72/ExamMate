"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markNotificationAsRead = exports.getNotifications = void 0;
const prisma_1 = require("../config/prisma");
const getNotifications = async (req, res) => {
    try {
        const userId = req.userId;
        const notifications = await prisma_1.prisma.notification.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' },
            take: 50,
        });
        const unreadCount = await prisma_1.prisma.notification.count({
            where: { user_id: userId, is_read: false },
        });
        res.json({
            notifications,
            unreadCount,
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message || 'Error fetching notifications.' });
    }
};
exports.getNotifications = getNotifications;
const markNotificationAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        if (id === 'all') {
            await prisma_1.prisma.notification.updateMany({
                where: { user_id: userId, is_read: false },
                data: { is_read: true },
            });
            return res.json({ message: 'All notifications marked as read.' });
        }
        const notification = await prisma_1.prisma.notification.findFirst({
            where: { id, user_id: userId },
        });
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found.' });
        }
        const updated = await prisma_1.prisma.notification.update({
            where: { id },
            data: { is_read: true },
        });
        res.json({
            message: 'Notification marked as read.',
            notification: updated,
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message || 'Error updating notification.' });
    }
};
exports.markNotificationAsRead = markNotificationAsRead;
