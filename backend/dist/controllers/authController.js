"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../config/prisma");
const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET environment variable is required');
    }
    return secret;
};
const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({
                message: 'Name, email, and password are required.',
            });
        }
        if (password.length < 6) {
            return res.status(400).json({
                message: 'Password must be at least 6 characters long.',
            });
        }
        const existingUser = await prisma_1.prisma.user.findUnique({
            where: { email },
        });
        if (existingUser) {
            return res.status(400).json({
                message: 'An account with this email already exists.',
            });
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        const password_hash = await bcryptjs_1.default.hash(password, salt);
        const user = await prisma_1.prisma.user.create({
            data: {
                name,
                email,
                password_hash,
            },
        });
        // Create the default student profile.
        await prisma_1.prisma.studentProfile.create({
            data: {
                user_id: user.id,
                qualification: 'Undergraduate',
                course: 'General Studies',
                daily_study_hours: 3.0,
            },
        });
        const secret = getJwtSecret();
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, secret, { expiresIn: '7d' });
        return res.status(201).json({
            message: 'Registration successful.',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
        });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : 'Server error during registration.';
        return res.status(500).json({
            message,
        });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                message: 'Email and password are required.',
            });
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { email },
            include: { profile: true },
        });
        if (!user) {
            return res.status(401).json({
                message: 'Invalid email or password.',
            });
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({
                message: 'Invalid email or password.',
            });
        }
        const secret = getJwtSecret();
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, secret, { expiresIn: '7d' });
        return res.json({
            message: 'Login successful.',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                profile: user.profile,
            },
        });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : 'Server error during login.';
        return res.status(500).json({
            message,
        });
    }
};
exports.login = login;
const getMe = async (req, res) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.userId },
            select: {
                id: true,
                name: true,
                email: true,
                created_at: true,
                profile: true,
            },
        });
        if (!user) {
            return res.status(404).json({
                message: 'User not found.',
            });
        }
        return res.json({ user });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : 'Server error.';
        return res.status(500).json({
            message,
        });
    }
};
exports.getMe = getMe;
