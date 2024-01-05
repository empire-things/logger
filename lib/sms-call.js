import twilio from "twilio";
import "dotenv/config";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

export function sendSms(text, number) {
    client.messages
        .create({
            body: text,
            from: "+14088271182",
            to: number,
        })
        .then((message) => console.log(message.sid));
}

export function sendCall(text, number) {
    client.calls
        .create({
            twiml: `<Response><Say language="fr-FR">${text}</Say></Response>`,
            from: "+14088271182",
            to: number,
        })
        .then((call) => console.log(call.sid));
}
