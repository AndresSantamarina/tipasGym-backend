require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db.js');

const app = express();

app.use(cors());
app.use(express.json());

connectDB();

app.get('/', (req, res) => res.send('API del Gym funcionando 🚀'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));