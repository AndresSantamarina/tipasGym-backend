const Client = require('../models/Client');
const AccessLog = require('../models/AccessLog');

const normalizarFecha = (fechaStr) => {
    if (!fechaStr) return new Date();
    const fecha = new Date(fechaStr);
    fecha.setHours(fecha.getHours() + 12);
    return fecha;
};

exports.createClient = async (req, res) => {
    try {
        const { nombre, dni, servicios } = req.body;
        if (!nombre || !dni) return res.status(400).json({ msg: 'Nombre y DNI son requeridos' });

        const existingClient = await Client.findOne({ dni });
        if (existingClient) return res.status(400).json({ msg: 'El DNI ya está registrado' });

        const hoy = new Date();
        Object.keys(servicios).forEach(key => {
            if (servicios[key].modalidad !== "No") {
                const s = servicios[key];
                const fechaInicio = s.inicio ? new Date(s.inicio) : new Date();
                const diasDuracion = Number(s.duracion) || 30;

                s.inicio = normalizarFecha(fechaInicio);
                s.duracion = diasDuracion;
                s.fechaPago = new Date();

                const venc = new Date(fechaInicio);
                venc.setDate(venc.getDate() + diasDuracion);
                s.vencimiento = normalizarFecha(venc);
            }
        });

        const newClient = new Client({ nombre, dni, servicios });
        await newClient.save();
        res.status(201).json(newClient);
    } catch (error) {
        res.status(500).json({ msg: error.message });
    }
};

exports.updateClient = async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);
        if (!client) return res.status(404).json({ msg: 'Socio no encontrado' });

        const { nombre, dni, servicios } = req.body;
        const hoy = new Date();

        if (nombre) client.nombre = nombre;
        if (dni) client.dni = dni;

        if (servicios) {
            ['gym', 'natacion', 'kids', 'profe'].forEach(key => {
                const sN = servicios[key];
                const sV = client.servicios[key];

                if (sN) {
                    if (sN.modalidad !== "No") {
                        if (Number(sN.montoPagado) > Number(sV.montoPagado || 0)) {
                            sV.fechaPago = new Date();
                        }

                        const fechaInicio = normalizarFecha(sN.inicio || sV.inicio);
                        const diasDuracion = Number(sN.duracion) || Number(sV.duracion) || 30;

                        sV.modalidad = sN.modalidad;
                        sV.precioTotal = Number(sN.precioTotal);
                        sV.montoPagado = Number(sN.montoPagado);
                        sV.inicio = fechaInicio;
                        sV.duracion = diasDuracion;

                        const v = new Date(fechaInicio);
                        v.setDate(v.getDate() + diasDuracion);
                        sV.vencimiento = v;
                    } else {
                        sV.modalidad = "No";
                        sV.inicio = null;
                        sV.vencimiento = null;
                        sV.fechaPago = null;
                        sV.precioTotal = 0;
                        sV.montoPagado = 0;
                        sV.duracion = 30;
                    }
                }
            });
        }

        client.markModified('servicios');
        await client.save();

        res.json(client);
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error al actualizar' });
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
        const hoy = new Date();
        const client = await Client.findOne({ dni });
        if (!client) return res.status(404).json({ msg: 'Socio no encontrado' });

        const serviciosKeys = ['gym', 'natacion', 'kids', 'profe'];
        let resultados = {};
        let tieneVencido = false;
        let tieneParcial = false;
        let tieneActivo = false;

        serviciosKeys.forEach(key => {
            const s = client.servicios[key];
            if (s && s.modalidad !== 'No') {
                const fechaVencimiento = new Date(s.vencimiento);
                const esVigente = fechaVencimiento > hoy;
                const debeDinero = (s.precioTotal || 0) > (s.montoPagado || 0);

                let estado = "";
                if (esVigente && !debeDinero) {
                    estado = 'ACTIVO';
                    tieneActivo = true;
                } else if (esVigente && debeDinero) {
                    estado = 'DEUDA PARCIAL';
                    tieneParcial = true;
                } else {
                    estado = 'DEUDA TOTAL';
                    tieneVencido = true;
                }

                resultados[key] = {
                    ...s.toObject(),
                    estado: estado
                };
            }
        });

        let statusGlobal = "VENCIDO";
        if (tieneVencido) statusGlobal = "VENCIDO";
        else if (tieneParcial) statusGlobal = "ACTIVO PARCIAL";
        else if (tieneActivo) statusGlobal = "ACTIVO TOTAL";

        await AccessLog.create({
            nombre: client.nombre,
            dni: client.dni,
            statusAlIngresar: statusGlobal,
            fecha: hoy
        });

        res.json({
            nombre: client.nombre,
            statusGlobal,
            servicios: resultados
        });
    } catch (error) {
        res.status(500).json({ msg: 'Error en el servidor' });
    }
};

exports.getHistory = async (req, res) => {
    try {
        const logs = await AccessLog.aggregate([
            { $sort: { fecha: -1 } },
            { $limit: 150 },
            {
                $lookup: {
                    from: "clients",
                    localField: "dni",
                    foreignField: "dni",
                    as: "clientDetails"
                }
            },
            { $unwind: "$clientDetails" },
            {
                $project: {
                    nombre: 1,
                    dni: 1,
                    fecha: 1,
                    statusAlIngresar: 1,
                    servicios: "$clientDetails.servicios"
                }
            }
        ]);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ msg: 'Error al obtener el historial' });
    }
};

exports.getStats = async (req, res) => {
    try {
        const hoy = new Date();
        const inicioDia = new Date(new Date().setHours(0, 0, 0, 0));
        const totalClients = await Client.find();

        let stats = {
            total: totalClients.length,
            activos: 0,
            activosGym: 0,
            activosNatacion: 0,
            activosKids: 0,
            activosProfe: 0,
            cuotasParciales: 0,
            totalVencidos: 0,
            montoTotalACobrar: 0,
            verde: 0,
            amarillo: 0,
            rojo: 0
        };

        const serviciosKeys = ['gym', 'natacion', 'kids', 'profe'];

        totalClients.forEach(c => {
            serviciosKeys.forEach(key => {
                const s = c.servicios[key];

                if (s && s.modalidad !== 'No') {
                    const fechaVencimiento = new Date(s.vencimiento);
                    const fechaInicio = new Date(s.inicio);
                    const esVigentePorFecha = fechaVencimiento > hoy;
                    const debeDinero = (s.precioTotal || 0) > (s.montoPagado || 0);
                    const fechaLimiteGracia = new Date(fechaInicio);
                    fechaLimiteGracia.setDate(fechaLimiteGracia.getDate() + 12);
                    const estaEnGracia = hoy <= fechaLimiteGracia;

                    if (key === 'gym') stats.activosGym++;
                    if (key === 'natacion') stats.activosNatacion++;
                    if (key === 'kids') stats.activosKids++;
                    if (key === 'profe') stats.activosProfe++;

                    if (debeDinero) {
                        stats.montoTotalACobrar += (s.precioTotal - s.montoPagado);
                    }

                    if (esVigentePorFecha && !debeDinero) {
                        stats.activos++;
                        stats.verde++;
                    } else if (esVigentePorFecha && debeDinero && estaEnGracia) {
                        stats.cuotasParciales++;
                        stats.amarillo++;
                    } else {
                        stats.totalVencidos++;
                        stats.rojo++;
                    }
                }
            });
        });

        const ingresosHoy = await AccessLog.countDocuments({ fecha: { $gte: inicioDia } });
        const totalCuotas = stats.verde + stats.amarillo + stats.rojo;

        res.json({
            ...stats,
            ingresosHoy,
            montoPendiente: stats.montoTotalACobrar,
            semaforo: {
                verde: stats.verde,
                amarillo: stats.amarillo,
                rojo: stats.rojo,
                pVerde: totalCuotas > 0 ? Math.round((stats.verde / totalCuotas) * 100) : 0,
                pAmarillo: totalCuotas > 0 ? Math.round((stats.amarillo / totalCuotas) * 100) : 0,
                pRojo: totalCuotas > 0 ? Math.round((stats.rojo / totalCuotas) * 100) : 0,
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error al obtener estadísticas' });
    }
};

exports.renewSubscription = async (req, res) => {
    try {
        const { id } = req.params;
        const { servicio, montoPagado, precioTotal, inicio, duracion } = req.body;
        const client = await Client.findById(id);
        const s = client.servicios[servicio];

        const nuevaFechaInicio = inicio ? new Date(inicio) : new Date();
        const dias = Number(duracion) || 30;

        s.inicio = normalizarFecha(nuevaFechaInicio);
        s.montoPagado = montoPagado;
        s.precioTotal = precioTotal;
        s.fechaPago = new Date();

        const venc = new Date(nuevaFechaInicio);
        venc.setDate(venc.getDate() + dias);
        s.vencimiento = normalizarFecha(venc);

        client.markModified('servicios');
        await client.save();
        res.json({ msg: 'Suscripción renovada', client });
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