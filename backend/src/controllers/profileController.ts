import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middleware/authMiddleware';

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { user_id: req.userId },
    });

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found.' });
    }

    res.json({ profile });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error fetching profile.' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { qualification, course, institution, daily_study_hours } = req.body;

    const updatedProfile = await prisma.studentProfile.upsert({
      where: { user_id: req.userId! },
      update: {
        qualification,
        course,
        institution,
        daily_study_hours: daily_study_hours ? parseFloat(daily_study_hours) : undefined,
      },
      create: {
        user_id: req.userId!,
        qualification: qualification || 'Undergraduate',
        course: course || 'General Studies',
        institution,
        daily_study_hours: daily_study_hours ? parseFloat(daily_study_hours) : 3.0,
      },
    });

    res.json({
      message: 'Profile updated successfully.',
      profile: updatedProfile,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error updating profile.' });
  }
};
