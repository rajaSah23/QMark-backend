const { default: mongoose } = require("mongoose");
const MCQ = require("../db/model/MCQModel");
const QuizAttempt = require("../db/model/QuizAttempt");
const Quiz = require("../db/model/Quiz");
const Activity = require("../db/model/Activity");
const User = require("../db/model/User");
const CustomError = require("../utility/CustomError");

const performanceService = {
    /**
     * Get daily activity stats for a user within a date range
     */
    getDailyActivityStats: async (userId, startDate, endDate) => {
        if (!userId) throw new CustomError(400, "User ID is required");

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Get activity records for the date range
        const activities = await Activity.find({
            user: new mongoose.Types.ObjectId(userId),
            date: { $gte: start, $lte: end }
        }).sort({ date: 1 });

        return activities.map(activity => ({
            date: activity.date.toISOString().split('T')[0],
            questionsAdded: activity.questionsAdded || 0,
            practiceSessions: activity.practiceSessions || 0,
            revisionsSessions: activity.revisionsSessions || 0,
            totalActivity: activity.totalActivity || 0
        }));
    },

    /**
     * Get user's streak record
     */
    getStreakRecord: async (userId) => {
        if (!userId) throw new CustomError(400, "User ID is required");

        // Get all activities for the user in reverse chronological order
        const activities = await Activity.find({
            user: new mongoose.Types.ObjectId(userId)
        })
            .sort({ date: -1 })
            .limit(365); // Check last 365 days

        if (activities.length === 0) {
            return {
                currentStreak: 0,
                longestStreak: 0,
                lastActivityDate: null
            };
        }

        // Calculate current streak
        let currentStreak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < activities.length; i++) {
            const activityDate = new Date(activities[i].date);
            activityDate.setHours(0, 0, 0, 0);

            const expectedDate = new Date(today);
            expectedDate.setDate(expectedDate.getDate() - i);

            if (
                activities[i].totalActivity > 0 &&
                activityDate.getTime() === expectedDate.getTime()
            ) {
                currentStreak++;
            } else if (i === 0 && activityDate.getTime() !== expectedDate.getTime()) {
                // No activity today, but check from yesterday
                break;
            } else {
                break;
            }
        }

        // Calculate longest streak
        let longestStreak = 0;
        let tempStreak = 0;

        for (const activity of activities) {
            if (activity.totalActivity > 0) {
                tempStreak++;
                longestStreak = Math.max(longestStreak, tempStreak);
            } else {
                tempStreak = 0;
            }
        }

        return {
            currentStreak,
            longestStreak,
            lastActivityDate: activities[0]?.date || null
        };
    },

    /**
     * Get quiz performance stats for a user within a date range
     */
    getQuizPerformanceStats: async (userId, startDate, endDate) => {
        if (!userId) throw new CustomError(400, "User ID is required");

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Get all quiz attempts in the date range
        const attempts = await QuizAttempt.find({
            user: new mongoose.Types.ObjectId(userId),
            createdAt: { $gte: start, $lte: end }
        })
            .populate('quiz', 'title')
            .sort({ createdAt: -1 });

        return attempts.map(attempt => ({
            _id: attempt._id,
            quizTitle: attempt.quiz?.title || 'Untitled Quiz',
            score: attempt.score,
            totalQuestions: attempt.totalQuestions,
            percentage: Math.round((attempt.score / attempt.totalQuestions) * 100),
            timeTaken: attempt.timeTaken,
            date: attempt.createdAt.toISOString().split('T')[0]
        }));
    },

    /**
     * Get subject-wise performance
     */
    getSubjectWisePerformance: async (userId, startDate, endDate) => {
        if (!userId) throw new CustomError(400, "User ID is required");

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Get all attempts with populated data
        const attempts = await QuizAttempt.find({
            user: new mongoose.Types.ObjectId(userId),
            createdAt: { $gte: start, $lte: end }
        })
            .populate({
                path: 'answers.question',
                select: 'subject correctAnswer'
            })
            .exec();

        // Group by subject
        const subjectMap = {};

        for (const attempt of attempts) {
            for (const answer of attempt.answers) {
                if (answer.question && answer.question.subject) {
                    const subjectId = answer.question.subject._id.toString();
                    const subjectName = answer.question.subject.name || 'Unknown';

                    if (!subjectMap[subjectId]) {
                        subjectMap[subjectId] = {
                            subject: subjectName,
                            quizzesTaken: new Set(),
                            correctAnswers: 0,
                            totalAnswers: 0,
                            scores: []
                        };
                    }

                    subjectMap[subjectId].quizzesTaken.add(attempt.quiz.toString());
                    subjectMap[subjectId].totalAnswers++;
                    if (answer.isCorrect) {
                        subjectMap[subjectId].correctAnswers++;
                    }
                }
            }
        }

        // For each attempt, get the subjects and add score
        for (const attempt of attempts) {
            const attemptScore = (attempt.score / attempt.totalQuestions) * 100;

            const subjects = new Set();
            for (const answer of attempt.answers) {
                if (answer.question && answer.question.subject) {
                    subjects.add(answer.question.subject._id.toString());
                }
            }

            for (const subjectId of subjects) {
                if (subjectMap[subjectId]) {
                    subjectMap[subjectId].scores.push(attemptScore);
                }
            }
        }

        return Object.values(subjectMap).map(data => ({
            subject: data.subject,
            quizzesTaken: data.quizzesTaken.size,
            correctAnswers: data.correctAnswers,
            totalAnswers: data.totalAnswers,
            averageScore: data.scores.length > 0
                ? Math.round(
                    data.scores.reduce((a, b) => a + b, 0) / data.scores.length
                )
                : 0,
            bestScore: data.scores.length > 0
                ? Math.max(...data.scores)
                : 0,
            accuracy: data.totalAnswers > 0
                ? Math.round((data.correctAnswers / data.totalAnswers) * 100)
                : 0
        }));
    },

    /**
     * Get difficulty-wise performance
     */
    getDifficultyWisePerformance: async (userId, startDate, endDate) => {
        if (!userId) throw new CustomError(400, "User ID is required");

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Get all attempts with populated question data
        const attempts = await QuizAttempt.find({
            user: new mongoose.Types.ObjectId(userId),
            createdAt: { $gte: start, $lte: end }
        })
            .populate({
                path: 'answers.question',
                select: 'difficulty correctAnswer'
            })
            .exec();

        // Group by difficulty
        const difficultyMap = {
            Easy: { questionsSolved: 0, correctAnswers: 0, scores: [] },
            Medium: { questionsSolved: 0, correctAnswers: 0, scores: [] },
            Hard: { questionsSolved: 0, correctAnswers: 0, scores: [] }
        };

        for (const attempt of attempts) {
            const attemptScore = (attempt.score / attempt.totalQuestions) * 100;

            for (const answer of attempt.answers) {
                if (answer.question) {
                    const difficulty = answer.question.difficulty
                        ? answer.question.difficulty.charAt(0).toUpperCase() +
                        answer.question.difficulty.slice(1)
                        : 'Easy';

                    if (difficultyMap[difficulty]) {
                        difficultyMap[difficulty].questionsSolved++;
                        if (answer.isCorrect) {
                            difficultyMap[difficulty].correctAnswers++;
                        }
                        difficultyMap[difficulty].scores.push(attemptScore);
                    }
                }
            }
        }

        return Object.entries(difficultyMap).map(([difficulty, data]) => ({
            difficulty,
            questionsSolved: data.questionsSolved,
            correctAnswers: data.correctAnswers,
            averageScore: data.scores.length > 0
                ? Math.round(
                    data.scores.reduce((a, b) => a + b, 0) / data.scores.length
                )
                : 0,
            accuracy: data.questionsSolved > 0
                ? Math.round((data.correctAnswers / data.questionsSolved) * 100)
                : 0
        }));
    },

    /**
     * Get overall performance summary
     */
    getPerformanceSummary: async (userId) => {
        if (!userId) throw new CustomError(400, "User ID is required");

        // Get all quiz attempts
        const attempts = await QuizAttempt.find({
            user: new mongoose.Types.ObjectId(userId)
        });

        // Get all MCQ created by user
        const questionCount = await MCQ.countDocuments({
            user: new mongoose.Types.ObjectId(userId),
            status: true
        });

        // Calculate metrics
        const totalQuestionsSolved = attempts.reduce((sum, attempt) => {
            return sum + attempt.answers.length;
        }, 0);

        const correctAnswers = attempts.reduce((sum, attempt) => {
            return sum + attempt.answers.filter(a => a.isCorrect).length;
        }, 0);

        const totalScore = attempts.reduce((sum, attempt) => sum + attempt.score, 0);
        const totalQuestionCount = attempts.reduce(
            (sum, attempt) => sum + attempt.totalQuestions,
            0
        );

        const accuracyRate = totalQuestionsSolved > 0
            ? Math.round((correctAnswers / totalQuestionsSolved) * 100)
            : 0;

        const averageScore = attempts.length > 0
            ? Math.round((totalScore / totalQuestionCount) * 100)
            : 0;

        const timeSpentMinutes = attempts.reduce((sum, attempt) => {
            return sum + (attempt.timeTaken || 0);
        }, 0) / 60;

        return {
            totalQuestionsSolved,
            quizzesCompleted: attempts.length,
            questionsCreated: questionCount,
            accuracyRate,
            averageScore,
            timeSpentMinutes: Math.round(timeSpentMinutes)
        };
    }
};

module.exports = performanceService;
