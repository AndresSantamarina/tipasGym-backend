const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    modalidad: { type: String, default: 'No' },
    inicio: { type: Date, default: null },
    duracion: { type: Number, default: 30 },
    vencimiento: { type: Date, default: null },
    precioTotal: { type: Number, default: 0 },
    montoPagado: { type: Number, default: 0 },
    fechaPago: { type: Date, default: null }
}, { _id: false });

const clientSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    dni: { type: String, required: true, unique: true },
    servicios: {
        gym: serviceSchema,
        natacion: serviceSchema,
        kids: serviceSchema,
        profe: serviceSchema
    },
    fechaRegistro: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);