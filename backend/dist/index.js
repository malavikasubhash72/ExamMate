"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const profileRoutes_1 = __importDefault(require("./routes/profileRoutes"));
const syllabusRoutes_1 = __importDefault(require("./routes/syllabusRoutes"));
const timetableRoutes_1 = __importDefault(require("./routes/timetableRoutes"));
const examRoutes_1 = __importDefault(require("./routes/examRoutes"));
const progressRoutes_1 = __importDefault(require("./routes/progressRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// CORS setup
app.use((0, cors_1.default)({
    origin: '*',
    credentials: true,
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Serve uploaded files statically
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', app: 'ExamMate Backend API', timestamp: new Date().toISOString() });
});
// Register API Routes
app.use('/api/auth', authRoutes_1.default);
app.use('/api/profile', profileRoutes_1.default);
app.use('/api/syllabus', syllabusRoutes_1.default);
app.use('/api/timetable', timetableRoutes_1.default);
app.use('/api/exams', examRoutes_1.default);
app.use('/api/progress', progressRoutes_1.default);
app.use('/api/notifications', notificationRoutes_1.default);
// Global Error Handler
app.use((err, _req, res, _next) => {
    console.error('API Error:', err);
    const status = err.status || 500;
    res.status(status).json({
        message: err.message || 'An internal server error occurred.',
    });
});
app.listen(PORT, () => {
    console.log(`🚀 ExamMate Backend server running at http://localhost:${PORT}`);
});
