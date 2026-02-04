const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    usuario: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

module.exports = mongoose.model('Admin', adminSchema);