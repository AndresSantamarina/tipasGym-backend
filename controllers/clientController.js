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
        console.error("ERROR AL CREAR CLIENTE:", error);
        res.status(500).json({ msg: error.message || 'Error interno en el servidor' });
    }
};

exports.updateClient = async (req, res) => {
    try {
        const clientOriginal = await Client.findById(req.params.id);
        if (!clientOriginal) return res.status(404).json({ msg: 'Cliente no encontrado' });

        if (req.body.servicios) {
            const serviciosNuevos = req.body.servicios;
            const serviciosViejos = clientOriginal.servicios;
            const calcularVencimiento = () => {
                const fecha = new Date();
                fecha.setDate(fecha.getDate() + 30);
                return fecha;
            };

            if (serviciosNuevos.gym) {
                if (serviciosViejos.gym.modalidad === "No" && serviciosNuevos.gym.modalidad !== "No") {
                    serviciosNuevos.gym.vencimiento = calcularVencimiento();
                } else {
                    serviciosNuevos.gym.vencimiento = serviciosViejos.gym.vencimiento;
                }
            }

            if (serviciosNuevos.natacion) {
                if (serviciosViejos.natacion.modalidad === "No" && serviciosNuevos.natacion.modalidad !== "No") {
                    serviciosNuevos.natacion.vencimiento = calcularVencimiento();
                } else {
                    serviciosNuevos.natacion.vencimiento = serviciosViejos.natacion.vencimiento;
                }
            }
        }

        const client = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(client);
    } catch (error) {
        console.log(error);
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
        if (!client) return res.status(404).json({ msg: 'Socio no encontrado' });

        const hoy = new Date();
        const gymActivo = client.servicios.gym.modalidad !== 'No' &&
            client.servicios.gym.vencimiento &&
            new Date(client.servicios.gym.vencimiento) > hoy;
        const nataActiva = client.servicios.natacion.modalidad !== 'No' &&
            client.servicios.natacion.vencimiento &&
            new Date(client.servicios.natacion.vencimiento) > hoy;

        let statusGlobal = "VENCIDO";
        if (gymActivo && nataActiva) statusGlobal = "ACTIVO TOTAL";
        else if (gymActivo && client.servicios.natacion.modalidad === 'No') statusGlobal = "SOLO GYM";
        else if (nataActiva && client.servicios.gym.modalidad === 'No') statusGlobal = "SOLO NATACIÓN";
        else if (gymActivo || nataActiva) statusGlobal = "ACTIVO PARCIAL";

        const statusLog = `${gymActivo ? 'GYM OK' : 'GYM X'} / ${nataActiva ? 'NATA OK' : 'NATA X'}`;
        const newLog = new AccessLog({
            nombre: client.nombre,
            dni: client.dni,
            statusAlIngresar: statusLog,
            fecha: new Date()
        });
        await newLog.save();

        res.json({
            nombre: client.nombre,
            statusGlobal: statusGlobal,
            servicios: {
                gym: {
                    modalidad: client.servicios.gym.modalidad,
                    vencimiento: client.servicios.gym.vencimiento,
                    activo: gymActivo
                },
                natacion: {
                    modalidad: client.servicios.natacion.modalidad,
                    vencimiento: client.servicios.natacion.vencimiento,
                    activo: nataActiva
                }
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error en el servidor' });
    }
};

exports.getHistory = async (req, res) => {
    try {
        const logs = await AccessLog.aggregate([
            { $sort: { fecha: -1 } },
            { $limit: 100 },
            {
                $lookup: {
                    from: "clients",
                    localField: "dni",
                    foreignField: "dni",
                    as: "clientDetails"
                }
            },
            { $unwind: "$clientDetails" }
        ]);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ msg: 'Error al obtener el historial' });
    }
};

exports.getStats = async (req, res) => {
    try {
        const hoy = new Date();
        const inicioDia = new Date();
        inicioDia.setHours(0, 0, 0, 0);

        const totalClients = await Client.find();

        let activosGym = 0;
        let activosNatacion = 0;
        let totalActivos = 0;
        let totalVencidos = 0;
        let todosPagos = 0;
        let deudaParcial = 0;
        let deudaTotal = 0;

        totalClients.forEach(c => {
            const tieneGym = c.servicios.gym.modalidad !== 'No';
            const tieneNata = c.servicios.natacion.modalidad !== 'No';
            const gymActivo = tieneGym && c.servicios.gym.vencimiento && new Date(c.servicios.gym.vencimiento) > hoy;
            const nataActiva = tieneNata && c.servicios.natacion.vencimiento && new Date(c.servicios.natacion.vencimiento) > hoy;

            if (gymActivo) activosGym++;
            if (nataActiva) activosNatacion++;

            const numContratados = (tieneGym ? 1 : 0) + (tieneNata ? 1 : 0);
            const numActivos = (gymActivo ? 1 : 0) + (nataActiva ? 1 : 0);

            if (numContratados > 0) {
                if (numActivos === numContratados) {
                    totalActivos++;
                }
                if (numActivos < numContratados) {
                    totalVencidos++;
                }
                if (numActivos === numContratados) {
                    todosPagos++;
                } else if (numActivos > 0) {
                    deudaParcial++;
                } else {
                    deudaTotal++;
                }
            }
        });

        const ingresosHoy = await AccessLog.countDocuments({ fecha: { $gte: inicioDia } });

        res.json({
            total: totalClients.length,
            activos: totalActivos,
            vencidos: totalVencidos,
            activosGym,
            activosNatacion,
            ingresosHoy,
            semaforo: {
                verde: todosPagos,
                amarillo: deudaParcial,
                rojo: deudaTotal,
                pVerde: totalClients.length > 0 ? Math.round((todosPagos / totalClients.length) * 100) : 0,
                pAmarillo: totalClients.length > 0 ? Math.round((deudaParcial / totalClients.length) * 100) : 0,
                pRojo: totalClients.length > 0 ? Math.round((deudaTotal / totalClients.length) * 100) : 0,
            }
        });
    } catch (error) {
        res.status(500).json({ msg: 'Error al obtener estadísticas' });
    }
};

exports.renewSubscription = async (req, res) => {
    try {
        const { id } = req.params;
        const { servicio } = req.body;
        const client = await Client.findById(id);
        if (!client) return res.status(404).json({ msg: 'Cliente no encontrado' });
        if (!servicio || (servicio !== 'gym' && servicio !== 'natacion')) {
            return res.status(400).json({ msg: 'Servicio inválido' });
        }

        const hoy = new Date();
        const currentVencimiento = client.servicios[servicio].vencimiento;

        let nuevaFecha;
        if (currentVencimiento && new Date(currentVencimiento) > hoy) {
            nuevaFecha = new Date(currentVencimiento);
            nuevaFecha.setDate(nuevaFecha.getDate() + 30);
        } else {
            nuevaFecha = new Date();
            nuevaFecha.setDate(nuevaFecha.getDate() + 30);
        }

        client.servicios[servicio].vencimiento = nuevaFecha;
        if (client.servicios[servicio].modalidad === 'No') {
            client.servicios[servicio].modalidad = (servicio === 'gym') ? '3 Días' : '2 Días';
        }
        client.markModified('servicios');

        await client.save();

        res.json({
            msg: `Servicio ${servicio.toUpperCase()} renovado con éxito hasta el ${nuevaFecha.toLocaleDateString()}`,
            client
        });
    } catch (error) {
        console.error("Error al renovar:", error);
        res.status(500).json({ msg: 'Error al procesar la renovación' });
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