const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
    try {
        const { usuario, password } = req.body;
        let adminExistente = await Admin.findOne({ usuario });
        if (adminExistente) return res.status(400).json({ msg: 'El usuario ya existe' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const admin = new Admin({ usuario, password: hashedPassword });
        await admin.save();

        res.status(201).json({ msg: 'Admin creado correctamente' });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: 'Error al registrar' });
    }
};

exports.login = async (req, res) => {
    try {
        const { usuario, password } = req.body;
        const admin = await Admin.findOne({ usuario });
        if (!admin) return res.status(400).json({ msg: 'Credenciales inválidas' });

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) return res.status(400).json({ msg: 'Credenciales inválidas' });

        const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

        res.json({ token, admin: { id: admin._id, usuario: admin.usuario } });
    } catch (error) {
        res.status(500).json({ msg: 'Error en el servidor' });
    }
};