const config = require('./config');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cheerio = require('cheerio');
const firebase = require('firebase/app');
const firebaseDatabase = require('firebase/database');

// const app = firebase.initializeApp(config.firebase);
// const db = app.database();
// const bot = new TelegramBot(config.telegramToken, { polling: true });

console.log(JSON.stringify(config));
console.log(`PORT: ${process.env.PORT}`);

const bot = new TelegramBot(config.telegram.token, {
    webHook: {
        port: config.telegram.webhook.heroku.port
    }
});

bot.setWebHook(config.telegram.webhook.heroku.url);

bot.on('message', function onMessage(msg) {
    bot.sendMessage(msg.chat.id, 'I am alive on Heroku!');
});

