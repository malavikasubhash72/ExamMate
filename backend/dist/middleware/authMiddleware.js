"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({
            message: 'Authentication required. No token provided.',
        });
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        return res.status(500).json({
            message: 'Server authentication configuration error.',
        });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        req.userId = decoded.userId;
        return next();
    }
    catch (error) {
        return res.status(403).json({
            message: 'Invalid or expired token.',
        });
    }
};
exports.authenticateToken = authenticateToken;
