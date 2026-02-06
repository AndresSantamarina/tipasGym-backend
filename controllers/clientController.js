const Client = require('../models/Client');
const AccessLog = require('../models/AccessLog');

exports.createClient = async (req, res) => {
    try {
        const { nombre, dni, servicios } = req.body;
        if (!nombre || !dni) {
            return res.status(400).json({ msg: 'Nombre y DNI son requeridos' });
        }
        const existingClient = await Client.findOne({ dni });
        if (existingClient) {
            return res.status(400).json({ msg: 'El DNI ya está registrado' });
        }

        const newClient = new Client({ nombre, dni, servicios });
        await newClient.save();
        res.status(201).json(newClient);
    } catch (error) {
        console.error("DETALLE DEL ERROR:", error);
        res.status(500).json({ msg: 'Error interno en el servidor' });
    }
};

exports.updateClient = async (req, res) => {
    try {
        const { nombre, servicios } = req.body;
        const client = await Client.findByIdAndUpdate(
            req.params.id,
            { nombre, servicios },
            { new: true }
        );
        if (!client) return res.status(404).json({ msg: 'Cliente no encontrado' });
        res.json(client);
    } catch (error) {
        res.status(500).json({ msg: 'Error al actualizar cliente' });
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
        hoy.setHours(0, 0, 0, 0);

        const total = await Client.countDocuments();
        const vencidos = await Client.countDocuments({ fechaVencimiento: { $lt: new Date() } });
        const activos = total - vencidos;
        const ingresosHoy = await AccessLog.countDocuments({
            fecha: { $gte: hoy }
        });

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
        const client = await Client.findById(id);
        if (!client) return res.status(404).json({ msg: 'Cliente no encontrado' });

        const hoy = new Date();
        let nuevaFecha;

        if (client.fechaVencimiento > hoy) {
            nuevaFecha = new Date(client.fechaVencimiento);
            nuevaFecha.setDate(nuevaFecha.getDate() + 30);
        } else {
            nuevaFecha = new Date();
            nuevaFecha.setDate(nuevaFecha.getDate() + 30);
        }

        client.fechaVencimiento = nuevaFecha;
        client.activo = true;
        await client.save();

        res.json({ msg: 'Suscripción renovada con éxito', client });
    } catch (error) {
        res.status(500).json({ msg: 'Error al renovar' });
    }
};

exports.deleteClient = async (req, res) => {
    try {
        const client = await Client.findByIdAndDelete(req.params.id);

        if (!client) {
            return res.status(404).json({ msg: 'Cliente no encontrado' });
        }

        res.json({ msg: 'Cliente eliminado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error al eliminar el cliente' });
    }
};

exports.clearOldLogs = async (req, res) => {
    try {
        const unaSemanaAtras = new Date();
        unaSemanaAtras.setDate(unaSemanaAtras.getDate() - 7);
        await AccessLog.deleteMany({ fecha: { $lt: unaSemanaAtras } });

        res.json({ msg: 'Historial antiguo limpiado correctamente' });
    } catch (error) {
        res.status(500).json({ msg: 'Error al limpiar historial' });
    }
};