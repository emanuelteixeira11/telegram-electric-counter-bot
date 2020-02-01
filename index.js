const config = require('./config');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cheerio = require('cheerio');
const firebase = require('firebase/app');
const firebaseDatabase = require('firebase/database');

// const app = firebase.initializeApp(config.firebase);
// const db = app.database();
// const bot = new TelegramBot(config.telegramToken, { polling: true });