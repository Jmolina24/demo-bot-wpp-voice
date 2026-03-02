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

app.get('/', (req, res) => {
  res.json("API de encuesta por voz con Twilio");
});


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
  console.log("Realizando Preguntas llamada...");
  const { step, phone } = req.query;
  const currentStep = parseInt(step, 10);
  const twiml = new twilio.twiml.VoiceResponse();

  if (currentStep < survey.questions.length) {
    const gather = twiml.gather({
      input: 'speech',
      action: `/answer?step=${currentStep}&phone=${phone}`,
      method: 'POST',
      timeout: 5,
      language: 'es-ES'               // <-- idioma para reconocimiento
    });

    // habla en español; se puede omitir voice o usar una voz española
    gather.say(
      {
        // voice: 'Polly.Miguel',     // opcional, elegir una voz española
        language: 'es-ES'
      },
      survey.questions[currentStep]
    );
  } else {
    twiml.say(
      {
        // voice: 'Polly.Miguel',
        language: 'es-ES'
      },
      'Gracias por completar la encuesta.'
    );
    twiml.hangup();
  }
    console.log("Encuesta completada:", phone);
    console.log("Respuestas:", sessions[phone]?.answers);
  res.type('text/xml').send(twiml.toString());
});


// app.post('/question', (req, res) => {
//    console.log("Realizando Preguntas llamada...");
//   const { step, phone } = req.query;
//   const currentStep = parseInt(step);

//   const twiml = new twilio.twiml.VoiceResponse();

//   if (currentStep < survey.questions.length) {

//     const gather = twiml.gather({
//       input: 'speech',
//       action: `/answer?step=${currentStep}&phone=${phone}`,
//       method: 'POST',
//       timeout: 5,
//       language: 'es-MX'
//     });

//     gather.say(
//       {
//         voice: 'Polly.Lupe',
//         language: 'es-MX'
//       },
//       survey.questions[currentStep]
//     );

//   } else {

//     twiml.say(
//       {
//         voice: 'Polly.Lupe',
//         language: 'es-MX'
//       },
//       "Gracias por completar la encuesta."
//     );

//     twiml.hangup();

//     console.log("Encuesta completada:", phone);
//     console.log("Respuestas:", sessions[phone]?.answers);

//     delete sessions[phone];
//   }

//   res.type('text/xml');
//   res.send(twiml.toString());
// });

/////////////////////////////////////////////////
// RECIBIR RESPUESTA
/////////////////////////////////////////////////

app.post('/answer', (req, res) => {
  console.log("Recibiendo Respuesta llamada...");
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


const PORT = process.env.PORT || 3000;

app.listen(process.env.PORT, () => {
  console.log(  ` !! Servidor corriendo en puerto   ${process.env.PORT}  !!!` );
});