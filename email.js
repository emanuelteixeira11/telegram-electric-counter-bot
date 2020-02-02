const sgMail = require('@sendgrid/mail');
const config = require('./config');
const moment = require('moment');
moment.locale('pt');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

module.exports.sendMonthlyPositionEmail = (guest) => {
    let month = moment(guest.toReport.createdAt).format('MMMM');
    let subject = `Contagem de Luz - ${guest.name} - ${month}`;
    let bodyHTML = `<p>Boa tarde ${guest.name},</p>
    <p>Segue abaixo a contagem da Luz para o mês de ${month} (de ${moment(guest.lastReported.createdAt).format('YYYY-MM-DD')} a ${moment(guest.toReport.createdAt).format('YYYY-MM-DD')}).</p>
    <p>Foram registados <strong>${guest.toReport.totalKWh} kWh</strong> no valor de <strong>${guest.toReport.totalAmount}€</strong>.</p>
    <p>Qualquer duvida está a vontade.</p>

    <h4>Ultimos ${guest.positions.length} consumos:</h4>
    <table style="width:100%">
        <tr>
            <th>Contador (kWh)</th>
            <th>Contagem do Mês (kWh)</th>
            <th>Total (€)</th>
            <th>Data da Contagem (€)</th>
        </tr>
        ${formatTable(guest.positions)}
    </table>

    <p>Obrigado,</p>
    <small>*Email enviado automaticamente*</small>
    
    <style>
        th, td {border-bottom: 1px solid #ddd;}
        tr:hover {background-color: #f5f5f5;}
        th { background-color: #4CAF50;color: white;}
        tr { text-align: center; }
    </style>
    `;

    let email = {
        to: guest.email.join(';'),
        subject: subject,
        html: bodyHTML
    }
    sendEmail(email);
};

formatTable = (positions) => {
    let table = '';
    positions.forEach(position => {
        table += `<tr><td>${position.currentKWhPosition}</td><td>${position.totalKWh}</td><td>${position.totalAmount}</td><td>${moment(position.createdAt).format('DD MMMM, YYYY')}</td></tr>`;
    });
    return table;
};

sendEmail = (email) => {
    email.from = config.email.from;
    email.cc = config.email.cc;
    //email.replyTo = config.email.replyTo;
    sgMail.send(email).then((resp) => {
    }).catch(error => {
        console.log(error);
    });;
};