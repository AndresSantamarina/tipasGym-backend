const Client = require('../models/Client');

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

        res.json({
            nombre: client.nombre,
            vence: client.fechaVencimiento,
            status: esValido ? 'ACTIVO' : 'VENCIDO',
            servicios: client.servicios
        });
    } catch (error) {
        res.status(500).json({ msg: 'Error en el servidor' });
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