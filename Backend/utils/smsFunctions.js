const client = require('twilio')(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN)
const sendSMS = (message, to)=> {
    client.messages
  .create({
    to: `+91${to}`,
    body: message,
  })
  .then(message => console.log(message.sid));
}

module.exports = sendSMS