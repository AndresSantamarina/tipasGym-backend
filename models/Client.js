const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    dni: { type: String, required: true, unique: true },
    servicios: {
        gym: { type: Boolean, default: false },
        natacion: { type: Boolean, default: false }
    },
    fechaRegistro: { type: Date, default: Date.now },
    fechaVencimiento: { type: Date },
    activo: { type: Boolean, default: true }
}, { timestamps: true });

clientSchema.pre('save', function(next) {
    if (!this.fechaVencimiento) {
        const fecha = new Date(this.fechaRegistro || Date.now());
        fecha.setDate(fecha.getDate() + 30);
        this.fechaVencimiento = fecha;
    }
    next();
});

module.exports = mongoose.model('Client', clientSchema);