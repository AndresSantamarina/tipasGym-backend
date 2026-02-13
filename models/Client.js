const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    modalidad: { type: String, default: 'No' },
    inicio: { type: Date, default: null },
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

clientSchema.pre('save', function () {
    const hoy = new Date();
    const serviciosKeys = ['gym', 'natacion', 'kids', 'profe'];

    serviciosKeys.forEach(key => {
        const s = this.servicios[key];
        if (s && s.modalidad !== 'No' && !s.inicio) {
            s.inicio = hoy;
            s.fechaPago = hoy;
            const v = new Date();
            v.setDate(hoy.getDate() + 30);
            s.vencimiento = v;
        }
    });
});

module.exports = mongoose.model('Client', clientSchema);