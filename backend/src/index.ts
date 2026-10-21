import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

import authRoutes from './routes/authRoutes';
import profileRoutes from './routes/profileRoutes';
import syllabusRoutes from './routes/syllabusRoutes';
import timetableRoutes from './routes/timetableRoutes';
import examRoutes from './routes/examRoutes';
import progressRoutes from './routes/progressRoutes';
import notificationRoutes from './routes/notificationRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS setup
// CORS setup
app.use(
  cors({
    origin: [
      'https://exammate-frontend3.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000'
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'ExamMate Backend API', timestamp: new Date().toISOString() });
});

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/syllabus', syllabusRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/notifications', notificationRoutes);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('API Error:', err);
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || 'An internal server error occurred.',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 ExamMate Backend server running at http://localhost:${PORT}`);
});
