require('dotenv').config();

module.exports = {
    telegramToken: process.env.TELEGRAM_BOT_TOKEN,
    tmdbApiKey: process.env.TMDB_API_KEY,
    adminUserId: process.env.ADMIN_USER_ID ? parseInt(process.env.ADMIN_USER_ID) : null,
    whitelistEnabled: process.env.WHITELIST_ENABLED === 'true',
    dbPath: process.env.DB_PATH || './src/database/cineslime.db'
};
