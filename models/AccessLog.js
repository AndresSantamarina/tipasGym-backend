const mongoose = require('mongoose');

const accessLogSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    dni: { type: String, required: true },
    fecha: { type: Date, default: Date.now },
    statusAlIngresar: { type: String, required: true }, // 'ACTIVO' o 'VENCIDO'
}, { timestamps: true });

module.exports = mongoose.model('AccessLog', accessLogSchema);