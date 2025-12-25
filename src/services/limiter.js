const rateLimitMap = new Map();

/**
 * Checks if a user is rate limited.
 * @param {number} userId - The Telegram User ID.
 * @param {number} limit - Max requests allowed.
 * @param {number} windowMs - Time window in milliseconds.
 * @returns {boolean} - True if rate limited, false otherwise.
 */
function isRateLimited(userId, limit = 5, windowMs = 60000) {
    const now = Date.now();
    const userRecord = rateLimitMap.get(userId);

    if (!userRecord) {
        rateLimitMap.set(userId, { count: 1, startTime: now });
        return false;
    }

    if (now - userRecord.startTime > windowMs) {
        // Window passed, reset
        userRecord.count = 1;
        userRecord.startTime = now;
        return false;
    }

    userRecord.count += 1;
    if (userRecord.count > limit) {
        return true;
    }

    return false;
}

module.exports = {
    isRateLimited
};
