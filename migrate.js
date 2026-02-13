// const mongoose = require('mongoose');
// const Client = require('./models/Client');
// require('dotenv').config();

// const migrateData = async () => {
//     try {
//         await mongoose.connect(process.env.MONGO_URI);
//         console.log("Conectado a la DB para migración...");

//         const clientes = await Client.find({});
//         let actualizados = 0;

//         for (let client of clientes) {
//             let modificado = false;

//             const serviciosKeys = ['gym', 'natacion', 'kids', 'profe'];

//             serviciosKeys.forEach(key => {
//                 if (!client.servicios[key]) {
//                     client.servicios[key] = { modalidad: "No" };
//                     modificado = true;
//                 }

//                 if (client.servicios[key].precioTotal === undefined) {
//                     client.servicios[key].precioTotal = 0;
//                     modificado = true;
//                 }
//                 if (client.servicios[key].montoPagado === undefined) {
//                     client.servicios[key].montoPagado = 0;
//                     modificado = true;
//                 }
//                 if (client.servicios[key].fechaPago === undefined) {
//                     client.servicios[key].fechaPago = null;
//                     modificado = true;
//                 }

//                 if (client.servicios[key].inicio === undefined) client.servicios[key].inicio = null;
//                 if (client.servicios[key].vencimiento === undefined) client.servicios[key].vencimiento = null;
//             });

//             if (modificado) {
//                 client.markModified('servicios');
//                 await client.save();
//                 actualizados++;
//             }
//         }

//         console.log(`Migración terminada. Se normalizaron ${actualizados} clientes.`);
//         process.exit(0);
//     } catch (error) {
//         console.error("Error en la migración:", error);
//         process.exit(1);
//     }
// };

// migrateData();