require("dotenv").config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const client = require("twilio")(accountSid, authToken);

function sendSms(text, number) {
    client.messages
        .create({
            body: text,
            from: "+14088271182",
            to: number,
        })
        .then((message) => console.log(message.sid));
}

function sendCall(text, number) {
    client.calls
        .create({
            twiml: `<Response><Say language="fr-FR">${text}</Say></Response>`,
            from: "+14088271182",
            to: number,
        })
        .then((call) => console.log(call.sid));
}

module.exports = {
    sendSms,
    sendCall,
};
