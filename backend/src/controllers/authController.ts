
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middleware/authMiddleware';

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  return secret;
};

export const register = async (req: Request, res: Response) => {
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

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        message: 'An account with this email already exists.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password_hash,
      },
    });

    // Create the default student profile.
    await prisma.studentProfile.create({
      data: {
        user_id: user.id,
        qualification: 'Undergraduate',
        course: 'General Studies',
        daily_study_hours: 3.0,
      },
    });

    const secret = getJwtSecret();

    const token = jwt.sign(
      { userId: user.id },
      secret,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Registration successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Server error during registration.';

    return res.status(500).json({
      message,
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!isMatch) {
      return res.status(401).json({
        message: 'Invalid email or password.',
      });
    }

    const secret = getJwtSecret();

    const token = jwt.sign(
      { userId: user.id },
      secret,
      { expiresIn: '7d' }
    );

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
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Server error during login.';

    return res.status(500).json({
      message,
    });
  }
};

export const getMe = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = await prisma.user.findUnique({
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
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Server error.';

    return res.status(500).json({
      message,
    });
  }
};