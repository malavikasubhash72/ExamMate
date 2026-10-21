"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfile = exports.getProfile = void 0;
const prisma_1 = require("../config/prisma");
const getProfile = async (req, res) => {
    try {
        const profile = await prisma_1.prisma.studentProfile.findUnique({
            where: { user_id: req.userId },
        });
        if (!profile) {
            return res.status(404).json({ message: 'Profile not found.' });
        }
        res.json({ profile });
    }
    catch (error) {
        res.status(500).json({ message: error.message || 'Server error fetching profile.' });
    }
};
exports.getProfile = getProfile;
const updateProfile = async (req, res) => {
    try {
        const { qualification, course, institution, daily_study_hours } = req.body;
        const updatedProfile = await prisma_1.prisma.studentProfile.upsert({
            where: { user_id: req.userId },
            update: {
                qualification,
                course,
                institution,
                daily_study_hours: daily_study_hours ? parseFloat(daily_study_hours) : undefined,
            },
            create: {
                user_id: req.userId,
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
    }
    catch (error) {
        res.status(500).json({ message: error.message || 'Server error updating profile.' });
    }
};
exports.updateProfile = updateProfile;
