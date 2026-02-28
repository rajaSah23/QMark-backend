const Activity = require("../db/model/Activity");
const { default: mongoose } = require("mongoose");

const activityService = {
    /**
     * Log activity for a user
     */
    logActivity: async (userId, activityType, count = 1) => {
        try {
            const userId_obj = new mongoose.Types.ObjectId(userId);
            
            // Get today's date at midnight
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Find or create activity for today
            let activity = await Activity.findOne({
                user: userId_obj,
                date: today
            });

            if (!activity) {
                activity = new Activity({
                    user: userId_obj,
                    date: today,
                    questionsAdded: 0,
                    practiceSessions: 0,
                    revisionsSessions: 0
                });
            }

            // Update the appropriate field based on activity type
            switch (activityType) {
                case 'QUESTION_ADDED':
                    activity.questionsAdded = (activity.questionsAdded || 0) + count;
                    break;
                case 'QUESTION_UPDATED':
                    activity.questionsAdded = (activity.questionsAdded || 0) + count;
                    break;
                case 'PRACTICE_SESSION':
                    activity.practiceSessions = (activity.practiceSessions || 0) + count;
                    activity.practiceAttempts = (activity.practiceAttempts || 0) + count;
                    break;
                case 'REVISION_SESSION':
                    activity.revisionsSessions = (activity.revisionsSessions || 0) + count;
                    activity.revisionsAttempts = (activity.revisionsAttempts || 0) + count;
                    break;
                case 'QUIZ_ATTEMPT':
                    activity.practiceSessions = (activity.practiceSessions || 0) + count;
                    activity.practiceAttempts = (activity.practiceAttempts || 0) + count;
                    break;
                default:
                    break;
            }

            // Recalculate total activity
            activity.totalActivity =
                (activity.questionsAdded || 0) +
                (activity.practiceSessions || 0) +
                (activity.revisionsSessions || 0);

            await activity.save();
            return activity;
        } catch (error) {
            console.error("Error logging activity:", error);
            // Don't throw error - activity tracking should not break the main flow
            return null;
        }
    },

    /**
     * Get activity for a specific date
     */
    getActivityByDate: async (userId, date) => {
        try {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);

            const activity = await Activity.findOne({
                user: new mongoose.Types.ObjectId(userId),
                date: startDate
            });

            return activity;
        } catch (error) {
            console.error("Error getting activity:", error);
            return null;
        }
    },

    /**
     * Batch log activities
     */
    logActivities: async (userId, activities) => {
        try {
            for (const activity of activities) {
                await activityService.logActivity(userId, activity.type, activity.count);
            }
            return true;
        } catch (error) {
            console.error("Error batch logging activities:", error);
            return false;
        }
    }
};

module.exports = activityService;
