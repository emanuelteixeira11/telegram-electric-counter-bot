const config = require('./config');
const email = require('./email');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cheerio = require('cheerio');
const appFB = require('firebase/app');
const databaseFB = require('firebase/database');
const moment = require('moment');

const initBot = () => {
    let bot;
    if (config.nodeEnv === 'prod') {
        bot = new TelegramBot(config.telegram.token, {
            webHook: {
                port: config.telegram.webhook.heroku.port
            }
        });
        bot.setWebHook(config.telegram.webhook.heroku.url);
    }
    else {
        bot = new TelegramBot(config.telegram.token, {
            polling: true
        });
    }
    return bot;
}
const initFirebaseDB = () => {
    return appFB.initializeApp(config.firebase).database();
}
const getApartments = () => {
    return firebaseDB.ref('apartments').once('value');
}

const isAuthorized = (userId) => {
    let promise = new Promise((resolve, reject) => {
        firebaseDB.ref(`users/${userId}`).once('value').then((isAuthorized) => {
            resolve(isAuthorized.val() || { isAuthorized: false });
        }).catch((error) => {
            reject(error);
        });
    });
    return promise;
}

const authorizeUser = (userId, userName) => {
    let promise = new Promise((resolve, reject) => {
        firebaseDB.ref(`users/${userId}`).set({
            userName: userName || 'null',
            isAuthorized: true,
            activationDate: moment.now()
        }).then(() => {
            resolve();
        }).catch((error) => {
            reject(error);
        });
    });
    return promise;
}

const getApartmentById = (apartmentId) => {
    let promise = new Promise((resolve, reject) => {
        firebaseDB.ref(`apartments/${apartmentId}`).once('value').then((apartmentData) => {
            resolve(apartmentData.val());
        }).catch((error) => {
            reject(error);
        });
    });
    return promise;
}

const setApartmentById = (apartmentId, apartment) => {
    let promise = new Promise((resolve, reject) => {
        firebaseDB.ref(`apartments/${apartmentId}`).set(apartment)
            .then(() => {
                resolve();
            }).catch((error) => {
                reject(error);
            });
    });
    return promise;
}

const getActiveGuestsByApartment = () => {
    let promise = new Promise((resolve, reject) => {
        firebaseDB.ref('guests').once('value').then((guestsData) => {
            let guests = guestsData.val();
            let guestsMap = new Map();
            Object.keys(guests)
                .filter(guestKey => guests[guestKey].active)
                .map(guestKey => {
                    guests[guestKey].id = guestKey;
                    return guests[guestKey];
                })
                .forEach(guest => {
                    guestsMap.set(guest.apartment, guest);
                });
            resolve(guestsMap);
        }).catch((error) => {
            reject(error);
        });
    });
    return promise;
}

const getGuestById = (guestId) => {
    let promise = new Promise((resolve, reject) => {
        firebaseDB.ref(`guests/${guestId}`).once('value').then((guestData) => {
            resolve(guestData.val());
        }).catch((error) => {
            reject(error);
        });
    });
    return promise;
}

const getLatestGuestPositionById = (guestId, nMaxPos) => {
    let promise = new Promise((resolve, reject) => {
        getGuestById(guestId).then(guest => {
            guest.id = guestId;
            if(guest.positions != undefined) {
                let positions = Object.keys(guest.positions)
                .sort((a, b) => guest.positions[b].createdAt - guest.positions[a].createdAt)
                .map(key => {
                    let pos = guest.positions[key]
                    pos.id = key;
                    return pos;
                })
                .splice(0, nMaxPos);
                guest.positions = positions;
            } else {
                guest.positions = [];
            }
            if(guest.positions_water !== undefined) {
                let positionsWater = Object.keys(guest.positions_water)
                .sort((a, b) => guest.positions_water[b].createdAt - guest.positions_water[a].createdAt)
                .map(key => {
                    let pos = guest.positions_water[key]
                    pos.id = key;
                    return pos;
                })
                .splice(0, nMaxPos);
                guest.positionsWater = positionsWater;
            } else {
                guest.positionsWater = [];
            }
            resolve(guest);
        }).catch(error => reject(error));
    });
    return promise;
};

const pushGuestPosition = (guestId, position) => {
    let positionKey = moment.now();
    let promise = new Promise((resolve, reject) => {
        firebaseDB.ref(`guests/${guestId}/positions/${positionKey}`).set(position).
            then(() => {
                resolve(positionKey);
            }).catch((error) => {
                reject(error);
            });
    });
    return promise;
}

const pushGuestWaterPosition = (guestId, position) => {
    let positionKey = moment.now();
    let promise = new Promise((resolve, reject) => {
        firebaseDB.ref(`guests/${guestId}/positions_water/${positionKey}`).set(position).
            then(() => {
                resolve(positionKey);
            }).catch((error) => {
                reject(error);
            });
    });
    return promise;
}

const bot = initBot();
const firebaseDB = initFirebaseDB();

const escapeMarkDown = (string) => {
    return string.replace(/[.\-_*#+?!^${}()|[\]\\]/g, '\\$&');
};

const apartmentsInfoHandler = (msg) => {
    bot.answerCallbackQuery(msg.id)
        .then(() => {
            getApartments().then((data) => {
                let apartments = data.val();
                getActiveGuestsByApartment().then(guestsMap => {
                    let textMsg = '💡💡 *Informação atualizada dos apartamentos\\:* 💡💡\n\n'
                    Object.keys(apartments)
                        .filter((key) => apartments[key].active)
                        .forEach((key) => {
                            let apartment = apartments[key];
                            textMsg += `_${apartment.description}_\n`;
                            textMsg += escapeMarkDown(`Ultima contagem Luz: ${apartment.currentPosition.lastUpdate.electricity.current} kWh (${apartment.currentPosition.lastUpdate.electricity.amount}€)`) + '\n';
                            textMsg += escapeMarkDown(`Ultima contagem Agua: ${apartment.currentPosition.lastUpdate.water.current} M3 (${apartment.currentPosition.lastUpdate.water.amount}€)`) + '\n';
                            textMsg += escapeMarkDown(`Data da ultima contagem: ${moment(apartment.changedAt).format('YYYY-MM-DD')}\n`);
                            if (guestsMap.has(key)) {
                                let guest = guestsMap.get(key);
                                textMsg += `Inquilino: ${guest.name}\n`;
                                textMsg += `Desde: ${escapeMarkDown(guest.since)}\n\n`;
                            }
                            else {
                                textMsg += `__Apartamento sem inquilino__ \n\n`;
                            }
                        });

                    bot.sendMessage(msg.from.id, textMsg, {
                        parse_mode: "MarkdownV2"
                    });
                });
            });
        }).catch((error) => {
            console.log("erro");
        });
}

const addPositionHandler = (msg) => {

    if (msg.data.match(/\/add\_position guest\:/) !== null) {
        let startIndex = msg.data.indexOf('guest:') + 6;
        let endIndex = msg.data.indexOf(' ', startIndex);
        endIndex = endIndex < 0 ? msg.data.length : endIndex;
        let guestId = msg.data.substring(startIndex, endIndex);

        getGuestById(guestId).then(guest => {

            getApartmentById(guest.apartment).then(apartment => {
                let textMsg = `Enviar a contagem para o *${apartment.description}* do *${guest.name}*\\:\n`;
                textMsg += `Contagem atual: ${apartment.currentPosition.kWh} kWh\n\n`;
                bot.sendMessage(msg.from.id, textMsg, {
                    parse_mode: "MarkdownV2",
                    reply_markup: {
                        force_reply: true
                    }
                }).then(sent => {
                    bot.onReplyToMessage(sent.chat.id, sent.message_id, (msg) => {
                        let updatedPosition = Number(msg.text);
                        if (!isNaN(updatedPosition)) {
                            if (updatedPosition > apartment.currentPosition.kWh) {
                                let diff = updatedPosition - apartment.currentPosition.kWh;
                                let totalAmount = Math.round(diff * apartment.price.kWh).toFixed(2);
                                let startDate = apartment.changedAt;
                                let endDate = moment.now();

                                pushGuestPosition(guestId, {
                                    currentPosition: updatedPosition,
                                    lastPosition: apartment.currentPosition.kWh,
                                    price: apartment.price,
                                    totalAmount: totalAmount,
                                    total: diff,
                                    createdAt: endDate,
                                    createdBy: {
                                        userId: sent.chat.id,
                                        userName: sent.chat.username
                                    },
                                    previous: apartment.currentPosition.lastUpdate.electricity.positionId
                                }).then(positionKey => {
                                    apartment.currentPosition.lastUpdate.electricity = {
                                        guestId: guestId,
                                        positionId: positionKey,
                                        amount: totalAmount,
                                        current: diff,
                                        total: updatedPosition
                                    };
                                    apartment.currentPosition.kWh = updatedPosition;
                                    apartment.changedAt = endDate;
                                    apartment.changedBy = {
                                        userId: sent.chat.id,
                                        userName: sent.chat.username,
                                        action: 'new_entry_electricity'
                                    };

                                    setApartmentById(guest.apartment, apartment).then(() => {
                                        let textMsg = `*Contagem efetuada com sucesso\\!*\n\n`;
                                        textMsg += `_${apartment.description}_\n`;
                                        textMsg += `_${guest.name}_\n`;
                                        textMsg += `_De ${escapeMarkDown(moment(startDate).format('YYYY-MM-DD'))} a ${escapeMarkDown(moment(endDate).format('YYYY-MM-DD'))}_\n\n`;
                                        textMsg += `kWh : ${diff} kWh\n`;
                                        textMsg += `Total a pagar : ${escapeMarkDown(totalAmount.toString())} €\n\n`;
                                        textMsg += `*Enviar email\\?*\n\n`;

                                        bot.sendMessage(sent.chat.id, textMsg, {
                                            parse_mode: "MarkdownV2",
                                            reply_to_message_id: msg.message_id,
                                            reply_markup: {
                                                inline_keyboard: [
                                                    [
                                                        {
                                                            text: 'sim 👌',
                                                            callback_data: `/send_email guest:${guestId} position:${positionKey} type:electricity`
                                                        },
                                                        {
                                                            text: 'não 👎',
                                                            callback_data: "/discard"
                                                        }
                                                    ]
                                                ]
                                            }
                                        });
                                    });
                                });

                            }
                            else {
                                bot.sendMessage(sent.chat.id, escapeMarkDown("A contagem enviada é inferior à ultima contagem efetuada! Repete o processo de novo."), {
                                    parse_mode: "MarkdownV2"
                                });
                            }
                        }
                        else {
                            bot.sendMessage(sent.chat.id, escapeMarkDown("A contagem enviada não é um número! Repete o processo de novo."), {
                                parse_mode: "MarkdownV2"
                            });
                        }
                    });
                });

            });
        });
    }
    else {
        bot.answerCallbackQuery(msg.id)
            .then(() => {
                let inline_keyboard = [];
                getActiveGuestsByApartment().then((guestsMap => {
                    guestsMap.forEach((guest) => {
                        inline_keyboard.push([{
                            text: guest.name,
                            callback_data: `/add_position guest:${guest.id}`
                        }]);
                    });

                    bot.sendMessage(msg.from.id, 'Escolhe o inquilino do qual queres adicionar uma contagem\\:', {
                        parse_mode: "MarkdownV2",
                        reply_markup: {
                            inline_keyboard: inline_keyboard
                        }
                    });
                }));
            }).catch((error) => {
                console.log("erro");
            });
    }
}

const addWaterPositionHandler = (msg) => {

    if (msg.data.match(/\/add\_water\_position guest\:/) !== null) {
        let startIndex = msg.data.indexOf('guest:') + 6;
        let endIndex = msg.data.indexOf(' ', startIndex);
        endIndex = endIndex < 0 ? msg.data.length : endIndex;
        let guestId = msg.data.substring(startIndex, endIndex);

        getGuestById(guestId).then(guest => {

            getApartmentById(guest.apartment).then(apartment => {
                let textMsg = `Enviar a contagem de agua para o *${apartment.description}* do *${guest.name}*\\:\n`;
                textMsg += `Contagem atual: ${apartment.currentPosition.m3} m3\n\n`;
                bot.sendMessage(msg.from.id, textMsg, {
                    parse_mode: "MarkdownV2",
                    reply_markup: {
                        force_reply: true
                    }
                }).then(sent => {
                    bot.onReplyToMessage(sent.chat.id, sent.message_id, (msg) => {
                        let updatedPosition = Number(msg.text);
                        if (!isNaN(updatedPosition)) {
                            if (updatedPosition > apartment.currentPosition.m3) {
                                let diff = updatedPosition - apartment.currentPosition.m3;
                                let totalAmount = Math.round(diff * apartment.price.m3).toFixed(2);
                                let startDate = apartment.changedAt;
                                let endDate = moment.now();

                                pushGuestWaterPosition(guestId, {
                                    currentPosition: updatedPosition,
                                    lastPosition: apartment.currentPosition.m3,
                                    price: apartment.price.m3,
                                    totalAmount: totalAmount,
                                    total: diff,
                                    createdAt: endDate,
                                    createdBy: {
                                        userId: sent.chat.id,
                                        userName: sent.chat.username
                                    },
                                    previous: apartment.currentPosition.lastUpdate.water.positionId
                                }).then(positionKey => {
                                    apartment.currentPosition.m3 = updatedPosition;
                                    apartment.currentPosition.lastUpdate.water = {
                                        guestId: guestId,
                                        positionId: positionKey,
                                        amount: totalAmount,
                                        current: diff,
                                        total: updatedPosition
                                    };
                                    apartment.changedAt = endDate;
                                    apartment.changedBy = {
                                        userId: sent.chat.id,
                                        userName: sent.chat.username,
                                        action: 'new_entry_water'
                                    };

                                    setApartmentById(guest.apartment, apartment).then(() => {
                                        let textMsg = `*Contagem efetuada com sucesso\\!*\n\n`;
                                        textMsg += `_${apartment.description}_\n`;
                                        textMsg += `_${guest.name}_\n`;
                                        textMsg += `_De ${escapeMarkDown(moment(startDate).format('YYYY-MM-DD'))} a ${escapeMarkDown(moment(endDate).format('YYYY-MM-DD'))}_\n\n`;
                                        textMsg += `M3 : ${diff} m3\n`;
                                        textMsg += `Total a pagar : ${escapeMarkDown(totalAmount.toString())} €\n\n`;
                                        textMsg += `*Enviar email\\?*\n\n`;

                                        bot.sendMessage(sent.chat.id, textMsg, {
                                            parse_mode: "MarkdownV2",
                                            reply_to_message_id: msg.message_id,
                                            reply_markup: {
                                                inline_keyboard: [
                                                    [
                                                        {
                                                            text: 'sim 👌',
                                                            callback_data: `/send_email guest:${guestId} position:${positionKey} type:water`
                                                        },
                                                        {
                                                            text: 'não 👎',
                                                            callback_data: "/discard"
                                                        }
                                                    ]
                                                ]
                                            }
                                        });
                                    });
                                });

                            }
                            else {
                                bot.sendMessage(sent.chat.id, escapeMarkDown("A contagem enviada é inferior à ultima contagem efetuada! Repete o processo de novo."), {
                                    parse_mode: "MarkdownV2"
                                });
                            }
                        }
                        else {
                            bot.sendMessage(sent.chat.id, escapeMarkDown("A contagem enviada não é um número! Repete o processo de novo."), {
                                parse_mode: "MarkdownV2"
                            });
                        }
                    });
                });

            });
        });
    }
    else {
        bot.answerCallbackQuery(msg.id)
            .then(() => {
                let inline_keyboard = [];
                getActiveGuestsByApartment().then((guestsMap => {
                    guestsMap.forEach((guest) => {
                        inline_keyboard.push([{
                            text: guest.name,
                            callback_data: `/add_water_position guest:${guest.id}`
                        }]);
                    });

                    bot.sendMessage(msg.from.id, 'Escolhe o inquilino do qual queres adicionar uma contagem\\:', {
                        parse_mode: "MarkdownV2",
                        reply_markup: {
                            inline_keyboard: inline_keyboard
                        }
                    });
                }));
            }).catch((error) => {
                console.log("erro");
            });
    }
}

const sendEmailHandler = (msg) => {

    if (msg.data.match(/\/send\_email guest\:(.+) position\:(.+) type\:(.+)/) !== null) {
        let startIndex = msg.data.indexOf('guest:') + 6;
        let endIndex = msg.data.indexOf(' ', startIndex);
        endIndex = endIndex < 0 ? msg.data.length : endIndex;
        let guestId = msg.data.substring(startIndex, endIndex);

        startIndex = msg.data.indexOf('position:', endIndex) + 9;
        endIndex = msg.data.indexOf(' ', startIndex);
        endIndex = endIndex < 0 ? msg.data.length : endIndex;
        let positionId = msg.data.substring(startIndex, endIndex);

        startIndex = msg.data.indexOf('type:', endIndex) + 5;
        endIndex = msg.data.indexOf(' ', startIndex);
        endIndex = endIndex < 0 ? msg.data.length : endIndex;
        let type = msg.data.substring(startIndex, endIndex);

        getLatestGuestPositionById(guestId, 10).then((guest) => {
            getApartmentById(guest.apartment).then((apartment) => {
                let queue = [];
                if(type === 'electricity') {
                    let toReport = guest.positions.find(pos => pos.id == positionId);
                    queue.push({
                        toReport: toReport,
                        lastReported: guest.positions.find(pos => pos.id == toReport.previous),
                        type: 'electricity'
                    });
                } else if(type === 'water') {
                    let toReport = guest.positionsWater.find(pos => pos.id == positionId);
                    queue.push({
                        toReport: toReport,
                        lastReported: guest.positionsWater.find(pos => pos.id == toReport.previous),
                        type: 'water'
                    });
                } else if(type === 'all') {
                    if(guest.positionsWater !== undefined && guest.positionsWater.length > 0) {
                        let toReport = guest.positionsWater.find(pos => pos.id == positionId);
                        console.log(JSON.stringify(toReport));
                        queue.push({
                            toReport: toReport,
                            lastReported: guest.positionsWater.find(pos => pos.id == toReport.previous),
                            type: 'water'
                        });
                    }
                    if(guest.positions !== undefined && guest.positions.length > 0) {
                        let toReport = guest.positions.find(pos => pos.id == positionId);
                        queue.push({
                            toReport: toReport,
                            lastReported: guest.positions.find(pos => pos.id == toReport.previous),
                            type: 'electricity'
                        });
                    }
                }

                queue.forEach(payload => {
                    guest.apartment = apartment;
                    guest.toReport = payload.toReport;
                    guest.lastReported = payload.lastReported;
                    email.sendMonthlyPositionEmail(guest, payload.type).then((resp) => {
                        console.log(`email sent sucessfully!`);
                        bot.sendMessage(msg.message.chat.id, 'Email enviado com sucesso 😎', { parse_mode: 'Markdown', reply_to_message_id: msg.message.message_id });
                    }).catch(error => {
                        console.error(`error sending email: ${JSON.stringify(error)}`);
                        bot.sendMessage(msg.message.chat.id, 'Erro ao enviar o email 🤕', { parse_mode: 'Markdown', reply_to_message_id: msg.message.message_id });
                    });
                });
            });
        });
    } else if(msg.data.match(/\/resend\_email/) !== null){
        bot.answerCallbackQuery(msg.id)
        .then(() => {
            let inline_keyboard = [];
            let promises = [];

            getActiveGuestsByApartment().then((guestsMap => {
                guestsMap.forEach((guest) => {
                    promises.push(getLatestGuestPositionById(guest.id, 1));                
                });

                Promise.all(promises).then(guests => {
                    guests.forEach(guest => {
                        let position = guest.positions[0].id;
                        inline_keyboard.push([{
                            text: guest.name,
                            callback_data: `/send_email guest:${guest.id} position:${position} type:all`
                        }]);
                    })

                    bot.sendMessage(msg.from.id, 'Escolhe o inquilino para o qual queres reenviar o ultimo email\\:', {
                        parse_mode: "MarkdownV2",
                        reply_markup: {
                            inline_keyboard: inline_keyboard
                        }
                    });
                });

                
            }));
        }).catch((error) => {
            console.log("erro");
        });
    }
}

const defaultHandler = (msg) => {
    bot.answerCallbackQuery(msg.id)
        .then(() => {
        });
}

bot.on('message', function onMessage(msg) {

    isAuthorized(msg.chat.id).then((user) => {
        if (user.isAuthorized || msg.hasOwnProperty('reply_to_message')) {
            if (msg.hasOwnProperty('reply_to_message')) {
                return;
            }
            bot.sendMessage(
                msg.chat.id,
                'Olá\\. Sou o teu assistente para a gestão do teu condominio particular\\! Escolhe uma das seguintes opções\\:',
                {
                    parse_mode: "MarkdownV2", reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: 'Ver informações dos Apartamentos 🔎',
                                    callback_data: '/apartments_info'
                                }
                            ],
                            [
                                {
                                    text: 'Adicionar nova contagem de Luz 📝',
                                    callback_data: '/add_position'

                                }
                            ],
                            [
                                {
                                    text: 'Adicionar nova contagem de Agua 📝',
                                    callback_data: '/add_water_position'

                                }
                            ],
                            [
                                {
                                    text: 'Reenviar email 📨',
                                    callback_data: '/resend_email'

                                }
                            ]
                            /*,
                            [
                                {
                                    text: 'Alterar uma contagem ❌',
                                    callback_data: '/update_position'
                                }
                            ]*/
                        ]
                    }
                });
        }
        else {
            bot.sendMessage(msg.chat.id, '*Não está autorizado a aceder a este bot*\\!\n\nEnvia o codigo de acesso\\:\n', {
                parse_mode: "MarkdownV2",
                reply_markup: {
                    force_reply: true
                }
            }).then(sent => {
                bot.onReplyToMessage(sent.chat.id, sent.message_id, (msg) => {
                    if (msg.text == config.botSecretCode) {
                        authorizeUser(msg.chat.id, msg.chat.username).then(() => {
                            bot.sendMessage(msg.chat.id, 'Código correto 🤗 \n\n Utiliza o comando *\\/ver* para visualizar todas as opções', { parse_mode: "MarkdownV2", reply_to_message_id: msg.message_id });
                        });
                    }
                    else {
                        bot.sendMessage(msg.chat.id, 'Código errado 😳', { parse_mode: "MarkdownV2", reply_to_message_id: msg.message_id });
                    }
                });
            });
        }
    });
});

bot.on("callback_query", (callbackQuery) => {
    bot.editMessageText(callbackQuery.message.text, {
        chat_id: callbackQuery.from.id,
        message_id: callbackQuery.message.message_id,
        reply_markup: null
    });

    let callBackHandler;

    if (callbackQuery.data.startsWith('/apartments_info')) {
        callBackHandler = apartmentsInfoHandler;
    }
    else if (callbackQuery.data.startsWith('/add_position')) {
        callBackHandler = addPositionHandler;
    }
    else if (callbackQuery.data.startsWith('/add_water_position')) {
        callBackHandler = addWaterPositionHandler;
    }
    else if (callbackQuery.data.startsWith('/send_email')) {
        callBackHandler = sendEmailHandler;
    }
    else if (callbackQuery.data.startsWith('/resend_email')) {
        callBackHandler = sendEmailHandler;
    }
    else {
        callBackHandler = defaultHandler;
    }
    callBackHandler(callbackQuery);
});
