const express = require('express');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const database = require('../database/database');
const { validate } = require('../middleware/validation');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Registro e login de usuários
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registrar novo usuário
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, username, password, firstName, lastName]
 *             properties:
 *               email:
 *                 type: string
 *                 example: joao@email.com
 *               username:
 *                 type: string
 *                 example: joaosilva
 *                 description: Entre 3 e 30 caracteres, apenas letras e números
 *               password:
 *                 type: string
 *                 example: senha123
 *                 description: Mínimo 6 caracteres
 *               firstName:
 *                 type: string
 *                 example: João
 *               lastName:
 *                 type: string
 *                 example: Silva
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                       description: Token JWT para usar nas rotas protegidas
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:        { type: string, example: uuid-aqui }
 *                         email:     { type: string, example: joao@email.com }
 *                         username:  { type: string, example: joaosilva }
 *                         firstName: { type: string, example: João }
 *                         lastName:  { type: string, example: Silva }
 *                         createdAt: { type: string, format: date-time }
 *       409:
 *         description: Email ou username já existe
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 message: { type: string, example: Email ou username já existe }
 *       400:
 *         description: Dados inválidos (campos faltando ou fora do formato)
 */
router.post('/register', validate('register'), async (req, res) => {
    try {
        const { email, username, password, firstName, lastName } = req.body;

        const existingUser = await database.get(
            'SELECT * FROM users WHERE email = ? OR username = ?',
            [email, username]
        );

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Email ou username já existe'
            });
        }

        const userData = { id: uuidv4(), email, username, password, firstName, lastName };
        const user = new User(userData);
        await user.hashPassword();

        await database.run(
            'INSERT INTO users (id, email, username, password, firstName, lastName) VALUES (?, ?, ?, ?, ?, ?)',
            [user.id, user.email, user.username, user.password, user.firstName, user.lastName]
        );

        const token = user.generateToken();

        res.status(201).json({
            success: true,
            message: 'Usuário criado com sucesso',
            data: { user: user.toJSON(), token }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login com email ou username
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier, password]
 *             properties:
 *               identifier:
 *                 type: string
 *                 example: joaosilva
 *                 description: Pode ser o email ou o username
 *               password:
 *                 type: string
 *                 example: senha123
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                       description: Token JWT — copie e cole no botão Authorize do Swagger
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:        { type: string, example: uuid-aqui }
 *                         email:     { type: string, example: joao@email.com }
 *                         username:  { type: string, example: joaosilva }
 *                         firstName: { type: string, example: João }
 *                         lastName:  { type: string, example: Silva }
 *                         createdAt: { type: string, format: date-time }
 *       401:
 *         description: Credenciais inválidas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 message: { type: string, example: Credenciais inválidas }
 *       400:
 *         description: Dados inválidos (campos faltando)
 */
router.post('/login', validate('login'), async (req, res) => {
    try {
        const { identifier, password } = req.body;

        const userData = await database.get(
            'SELECT * FROM users WHERE email = ? OR username = ?',
            [identifier, identifier]
        );

        if (!userData) {
            return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
        }

        const user = new User(userData);
        const isValidPassword = await user.comparePassword(password);

        if (!isValidPassword) {
            return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
        }

        const token = user.generateToken();

        res.json({
            success: true,
            message: 'Login realizado com sucesso',
            data: { user: user.toJSON(), token }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

module.exports = router;