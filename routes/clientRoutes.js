const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const auth = require('../middleware/authMiddleware');

router.get('/history', auth, clientController.getHistory)
router.delete('/history/clean', auth, clientController.clearOldLogs)
router.get('/stats', auth, clientController.getStats);
router.post('/', auth, clientController.createClient);
router.get('/', auth, clientController.getClients);
router.put('/:id', auth, clientController.updateClient);
router.delete('/:id', auth, clientController.deleteClient);
router.put('/renew/:id', auth, clientController.renewSubscription);

router.get('/check/:dni', clientController.checkIn);

module.exports = router;