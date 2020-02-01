const dotenv = require('dotenv');
dotenv.config();

module.exports = {
    telegram: {
        token: process.env.TELEGRAM_BOT_TOKEN,
        webhook: {
            heroku: {
                port: process.env.TELEGRAM_BOT_HEROKU_PORT,
                appName: process.env.TELEGRAM_BOT_HEROKU_APP_NAME,
                url: `https://${process.env.TELEGRAM_BOT_HEROKU_APP_NAME}.herokuapp.com:${process.env.TELEGRAM_BOT_HEROKU_PORT}/bot${process.env.TELEGRAM_BOT_TOKEN}`
            }
        }
    },
    firebase: {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        measurementId: process.env.FIREBASE_MEASUREMENT_ID
    }
};