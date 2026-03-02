require('dotenv').config();
const express = require('express');
const twilio = require('twilio');

const app = express();
app.use(express.urlencoded({ extended: false }));

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Encuesta dinámica en memoria
const survey = {
  id: "encuesta1",
  questions: [
    "Del uno al cinco, ¿cómo calificas nuestro servicio?",
    "¿Recomendarías la empresa? Responde sí o no.",
    "¿Volverías a comprar con nosotros? Responde sí o no."
  ]
};

// Almacenamiento temporal en memoria
const sessions = {}; 
// sessions = {
//   "+573001234567": { answers: [] }
// }

/////////////////////////////////////////////////
// INICIAR LLAMADA
/////////////////////////////////////////////////

app.get('/call', async (req, res) => {
  const { phone } = req.query;

  if (!phone) {
    return res.status(400).send("Número requerido");
  }

  sessions[phone] = { answers: [] };

  await client.calls.create({
    url: `${process.env.BASE_URL}/question?step=0&phone=${phone}`,
    to: phone,
    from: process.env.TWILIO_PHONE_NUMBER,
    method: 'POST'
  });

  res.send("Llamada iniciada");
});

/////////////////////////////////////////////////
// HACER PREGUNTA
/////////////////////////////////////////////////

app.post('/question', (req, res) => {
  const { step, phone } = req.query;
  const currentStep = parseInt(step);

  const twiml = new twilio.twiml.VoiceResponse();

  if (currentStep < survey.questions.length) {
    twiml.gather({
      input: 'speech',
      action: `/answer?step=${currentStep}&phone=${phone}`,
      method: 'POST',
      timeout: 5
    }).say(survey.questions[currentStep]);
  } else {
    twiml.say("Gracias por completar la encuesta.");
    twiml.hangup();

    console.log("Encuesta completada:", phone);
    console.log("Respuestas:", sessions[phone]?.answers);

    delete sessions[phone]; // limpiar memoria
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

/////////////////////////////////////////////////
// RECIBIR RESPUESTA
/////////////////////////////////////////////////

app.post('/answer', (req, res) => {
  const { step, phone } = req.query;
  const speech = req.body.SpeechResult || '';

  if (!sessions[phone]) {
    sessions[phone] = { answers: [] };
  }

  sessions[phone].answers.push(speech);

  const nextStep = parseInt(step) + 1;

  const twiml = new twilio.twiml.VoiceResponse();
  twiml.redirect(`/question?step=${nextStep}&phone=${phone}`);

  res.type('text/xml');
  res.send(twiml.toString());
});

app.listen(3000, () => {
  console.log("Servidor corriendo en puerto 3000");
});