const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    dni: { type: String, required: true, unique: true },
    servicios: {
        gym: {
            type: String,
            enum: ['No', '3 Días', '5 Días'],
            default: 'No'
        },
        natacion: {
            type: String,
            enum: ['No', '2 Días', '3 Días'],
            default: 'No'
        }
    },
    fechaRegistro: { type: Date, default: Date.now },
    fechaVencimiento: { type: Date },
    activo: { type: Boolean, default: true }
}, { timestamps: true });

clientSchema.pre('save', function (next) {
    if (!this.fechaVencimiento) {
        const fecha = new Date(this.fechaRegistro || Date.now());
        fecha.setDate(fecha.getDate() + 30);
        this.fechaVencimiento = fecha;
    }
    next();
});

module.exports = mongoose.model('Client', clientSchema);