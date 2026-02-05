const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const auth = require('../middleware/authMiddleware'); // Importamos el portero

// Rutas protegidas (Requieren Token)
router.post('/', auth, clientController.createClient);
router.get('/', auth, clientController.getClients);
router.put('/renew/:id', auth, clientController.renewSubscription);
router.get('/history', auth, clientController.getHistory)
router.get('/stats', auth, clientController.getStats);

// Ruta pública (El totem o tablet de entrada)
router.get('/check/:dni', clientController.checkIn);

module.exports = router;