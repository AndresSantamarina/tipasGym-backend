const Client = require('../models/Client');
const AccessLog = require('../models/AccessLog');

const calcularVencimiento = (desde = new Date()) => {
    const fecha = new Date(desde);
    fecha.setDate(fecha.getDate() + 30);
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
                servicios[key].inicio = hoy;
                servicios[key].vencimiento = calcularVencimiento(hoy);
                servicios[key].fechaPago = hoy;
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
                    if (sN.modalidad !== "No" && sV.modalidad === "No") {
                        sV.modalidad = sN.modalidad;
                        sV.precioTotal = sN.precioTotal;
                        sV.montoPagado = sN.montoPagado;
                        sV.inicio = hoy;
                        sV.fechaPago = hoy;
                        const v = new Date();
                        v.setDate(hoy.getDate() + 30);
                        sV.vencimiento = v;
                    }
                    else if (sN.modalidad !== "No") {
                        const pagoNuevo = Number(sN.montoPagado);
                        const pagoViejo = Number(sV.montoPagado || 0);

                        if (pagoNuevo > pagoViejo) {
                            sV.fechaPago = hoy;
                        }

                        sV.modalidad = sN.modalidad;
                        sV.precioTotal = sN.precioTotal;
                        sV.montoPagado = sN.montoPagado;
                    }
                    else {
                        sV.modalidad = "No";
                        sV.inicio = null;
                        sV.vencimiento = null;
                        sV.fechaPago = null;
                        sV.precioTotal = 0;
                        sV.montoPagado = 0;
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

// const calcularEstadoServicio = (servicio) => {
//     if (servicio.modalidad === 'No') return 'OFF';

//     const hoy = new Date();
//     const vencimiento = new Date(servicio.vencimiento);
//     const inicio = new Date(servicio.inicio);
//     const fechaLimiteGracia = new Date(inicio);
//     fechaLimiteGracia.setDate(fechaLimiteGracia.getDate() + 12);

//     const pagoCompleto = servicio.montoPagado >= servicio.precioTotal;
//     if (hoy > vencimiento) return 'DEUDA TOTAL';

//     if (pagoCompleto) return 'ACTIVO';

//     if (hoy <= fechaLimiteGracia) return 'DEUDA PARCIAL';

//     return 'DEUDA TOTAL';
// };

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
        const { servicio, montoPagado, precioTotal } = req.body;
        const client = await Client.findById(id);

        const hoy = new Date();
        const s = client.servicios[servicio];

        let nuevaFechaInicio = (s.vencimiento && s.vencimiento > hoy) ? new Date(s.vencimiento) : hoy;
        let nuevaFechaVencimiento = new Date(nuevaFechaInicio);
        nuevaFechaVencimiento.setDate(nuevaFechaVencimiento.getDate() + 30);

        s.inicio = nuevaFechaInicio;
        s.vencimiento = nuevaFechaVencimiento;
        s.montoPagado = montoPagado;
        s.precioTotal = precioTotal;
        s.fechaPago = hoy;

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