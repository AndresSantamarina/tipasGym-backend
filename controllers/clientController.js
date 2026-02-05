const Client = require('../models/Client');
const AccessLog = require('../models/AccessLog'); // Importa el nuevo modelo

exports.createClient = async (req, res) => {
    try {
        const { nombre, dni, servicios } = req.body;
        const existingClient = await Client.findOne({ dni });
        if (existingClient) {
            return res.status(400).json({ msg: 'El DNI ya está registrado' });
        }

        const newClient = new Client({ nombre, dni, servicios });
        await newClient.save();
        res.status(201).json(newClient);
    } catch (error) {
        res.status(500).json({ msg: 'Error al crear cliente', error });
    }
};

exports.getClients = async (req, res) => {
    try {
        const clients = await Client.find().sort({ createdAt: -1 });
        res.json(clients);
    } catch (error) {
        res.status(500).json({ msg: 'Error al obtener clientes' });
    }
};

exports.checkIn = async (req, res) => {
    try {
        const { dni } = req.params;
        const client = await Client.findOne({ dni });

        if (!client) {
            return res.status(404).json({ msg: 'Cliente no encontrado' });
        }

        const hoy = new Date();
        const esValido = client.fechaVencimiento > hoy;
        const status = esValido ? 'ACTIVO' : 'VENCIDO';

        // NUEVO: Guardar el ingreso en el historial
        await AccessLog.create({
            nombre: client.nombre,
            dni: client.dni,
            statusAlIngresar: status
        });

        res.json({
            nombre: client.nombre,
            vence: client.fechaVencimiento,
            status: status,
            servicios: client.servicios
        });
    } catch (error) {
        res.status(500).json({ msg: 'Error en el servidor' });
    }
};

// NUEVO: Obtener todos los logs (para el admin)
exports.getHistory = async (req, res) => {
    try {
        const logs = await AccessLog.find().sort({ fecha: -1 }).limit(100);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ msg: 'Error al obtener el historial' });
    }
};

exports.getStats = async (req, res) => {
    try {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0); // Inicio del día de hoy

        // 1. Conteo de clientes por estado
        const total = await Client.countDocuments();
        const vencidos = await Client.countDocuments({ fechaVencimiento: { $lt: new Date() } });
        const activos = total - vencidos;

        // 2. Ingresos de hoy (desde el AccessLog)
        const ingresosHoy = await AccessLog.countDocuments({
            fecha: { $gte: hoy }
        });

        // 3. Porcentaje de morosidad/vencidos
        const porcentajeVencidos = total > 0 ? ((vencidos / total) * 100).toFixed(1) : 0;

        res.json({
            total,
            activos,
            vencidos,
            ingresosHoy,
            porcentajeVencidos
        });
    } catch (error) {
        res.status(500).json({ msg: 'Error al obtener estadísticas' });
    }
};

exports.renewSubscription = async (req, res) => {
    try {
        const { id } = req.params;
        const nuevaFechaVencimiento = new Date();
        nuevaFechaVencimiento.setDate(nuevaFechaVencimiento.getDate() + 30);

        const client = await Client.findByIdAndUpdate(
            id,
            { fechaVencimiento: nuevaFechaVencimiento, activo: true },
            { new: true }
        );

        res.json({ msg: 'Suscripción renovada', client });
    } catch (error) {
        res.status(500).json({ msg: 'Error al renovar' });
    }
};