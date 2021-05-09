const sgMail = require('@sendgrid/mail');
const config = require('./config');
const moment = require('moment');
moment.locale('pt');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

module.exports.sendMonthlyPositionEmail = (guest, type = 'all') => {
    let payload = undefined;
    if(type === 'electricity') {
        payload = resolveElectricityTemplate(guest);
    } else if(type === 'water') {
        payload = resolveWaterTemplate(guest);
    }
    
    let promises = [];
    guest.email.forEach(guestEmail => {
        let email = {
            to: guestEmail,
            subject: payload.subject,
            html: payload.body
        }

        promises.push(sendEmail(email));
    });

    return Promise.all(promises);
};

resolveElectricityTemplate = (guest) => {
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
    
    return {
        subject : subject,
        body: bodyHTML
    }
}

resolveWaterTemplate = (guest) => {
    let month = moment(guest.toReport.createdAt).format('MMMM');
    let subject = `Contagem de Agua - ${guest.name} - ${month}`;
    let bodyHTML = `<p>Boa tarde ${guest.name},</p>
    <p>Segue abaixo a contagem da Luz para o mês de ${month} (de ${moment(guest.lastReported.createdAt).format('YYYY-MM-DD')} a ${moment(guest.toReport.createdAt).format('YYYY-MM-DD')}).</p>
    <p>Foram registados <strong>${guest.toReport.total} M3</strong> no valor de <strong>${guest.toReport.totalAmount}€</strong>.</p>
    <p>Qualquer duvida está a vontade.</p>

    <h4>Ultimos ${guest.positions.length} consumos:</h4>
    <table style="width:100%">
        <tr>
            <th>Contador (M3)</th>
            <th>Contagem do Mês (kWh)</th>
            <th>Total (€)</th>
            <th>Data da Contagem (€)</th>
        </tr>
        ${formatTable(guest.positionsWater)}
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
    
    return {
        subject : subject,
        body: bodyHTML
    }
}

formatTable = (positions) => {
    let table = '';
    positions.forEach(position => {
        table += `<tr><td>${position.currentPosition}</td><td>${position.total}</td><td>${position.totalAmount}</td><td>${moment(position.createdAt).format('DD MMMM, YYYY')}</td></tr>`;
    });
    return table;
};

sendEmail = (email) => {
    let promise = new Promise((resolve, reject) => {
        email.from = config.email.from;
        email.cc = config.email.cc;

        console.debug(`Sending email to: ${email.to}`);

        sgMail.send(email).then((resp) => {
            resolve(resp);
        }).catch(error => {
            reject(error);
        });;
    });
    return promise;
};