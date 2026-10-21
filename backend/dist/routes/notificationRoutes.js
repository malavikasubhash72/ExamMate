"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notificationController_1 = require("../controllers/notificationController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.get('/', authMiddleware_1.authenticateToken, notificationController_1.getNotifications);
router.put('/:id/read', authMiddleware_1.authenticateToken, notificationController_1.markNotificationAsRead);
exports.default = router;
