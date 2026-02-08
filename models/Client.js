const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    dni: { type: String, required: true, unique: true },
    servicios: {
        gym: {
            modalidad: {
                type: String,
                enum: ['No', '3 Días', '5 Días'],
                default: 'No'
            },
            vencimiento: { type: Date, default: null }
        },
        natacion: {
            modalidad: {
                type: String,
                enum: ['No', '2 Días', '3 Días'],
                default: 'No'
            },
            vencimiento: { type: Date, default: null }
        }
    },
    fechaRegistro: { type: Date, default: Date.now },
}, { timestamps: true });

clientSchema.pre('save', async function () {
    const doc = this;

    if (!doc.servicios) doc.servicios = {};
    if (!doc.servicios.gym) doc.servicios.gym = { modalidad: 'No' };
    if (!doc.servicios.natacion) doc.servicios.natacion = { modalidad: 'No' };

    const hoy = new Date();
    const enUnMes = new Date();
    enUnMes.setDate(hoy.getDate() + 30);

    if (doc.isNew) {
        if (doc.servicios.gym.modalidad !== 'No' && !doc.servicios.gym.vencimiento) {
            doc.servicios.gym.vencimiento = enUnMes;
        }
        if (doc.servicios.natacion.modalidad !== 'No' && !doc.servicios.natacion.vencimiento) {
            doc.servicios.natacion.vencimiento = enUnMes;
        }
    }
});

module.exports = mongoose.model('Client', clientSchema);