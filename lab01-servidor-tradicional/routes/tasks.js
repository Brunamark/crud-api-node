const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Task = require('../models/Task');
const database = require('../database/database');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Tasks
 *   description: CRUD de tarefas do usuário autenticado
 */

router.use(authMiddleware);

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: Lista as tarefas do usuário autenticado
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: completed
 *         schema:
 *           type: boolean
 *         description: Filtrar por status (true = concluídas, false = pendentes)
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Filtrar por prioridade
 *     responses:
 *       200:
 *         description: Lista retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:          { type: string, example: uuid-aqui }
 *                       title:       { type: string, example: Estudar Node.js }
 *                       description: { type: string, example: Ler capítulo 3 }
 *                       completed:   { type: boolean, example: false }
 *                       priority:    { type: string, example: medium }
 *                       userId:      { type: string, example: uuid-do-usuario }
 *                       createdAt:   { type: string, format: date-time }
 *       401:
 *         description: Token ausente ou inválido
 */
router.get('/', async (req, res) => {
    try {
        const { completed, priority } = req.query;
        let sql = 'SELECT * FROM tasks WHERE userId = ?';
        const params = [req.user.id];

        if (completed !== undefined) {
            sql += ' AND completed = ?';
            params.push(completed === 'true' ? 1 : 0);
        }
        
        if (priority) {
            sql += ' AND priority = ?';
            params.push(priority);
        }

        sql += ' ORDER BY createdAt DESC';

        const rows = await database.all(sql, params);
        const tasks = rows.map(row => new Task({...row, completed: row.completed === 1}));

        res.json({ success: true, data: tasks.map(task => task.toJSON()) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

/**
 * @swagger
 * /api/tasks:
 *   post:
 *     summary: Cria uma nova tarefa
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Estudar Node.js
 *                 description: Entre 1 e 200 caracteres
 *               description:
 *                 type: string
 *                 example: Ler capítulo 3 do livro
 *                 description: Opcional, máximo 1000 caracteres
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 default: medium
 *     responses:
 *       201:
 *         description: Tarefa criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:          { type: string, example: uuid-aqui }
 *                     title:       { type: string, example: Estudar Node.js }
 *                     description: { type: string, example: Ler capítulo 3 }
 *                     completed:   { type: boolean, example: false }
 *                     priority:    { type: string, example: medium }
 *                     userId:      { type: string, example: uuid-do-usuario }
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Token ausente ou inválido
 */
router.post('/', validate('task'), async (req, res) => {
    try {
        const taskData = { id: uuidv4(), ...req.body, userId: req.user.id };
        const task = new Task(taskData);
        const validation = task.validate();
        
        if (!validation.isValid) {
            return res.status(400).json({ success: false, message: 'Dados inválidos', errors: validation.errors });
        }

        await database.run(
            'INSERT INTO tasks (id, title, description, priority, userId) VALUES (?, ?, ?, ?, ?)',
            [task.id, task.title, task.description, task.priority, task.userId]
        );

        res.status(201).json({ success: true, message: 'Tarefa criada com sucesso', data: task.toJSON() });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

/**
 * @swagger
 * /api/tasks/stats/summary:
 *   get:
 *     summary: Retorna estatísticas das tarefas do usuário
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas retornadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:          { type: integer, example: 10 }
 *                     completed:      { type: integer, example: 7 }
 *                     pending:        { type: integer, example: 3 }
 *                     completionRate: { type: string, example: '70.00' }
 *       401:
 *         description: Token ausente ou inválido
 */
// IMPORTANTE: deve vir ANTES de /:id
// Se ficar depois, o Express interpreta "stats" como um :id e nunca chega aqui
router.get('/stats/summary', async (req, res) => {
    try {
        const stats = await database.get(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as pending
            FROM tasks WHERE userId = ?
        `, [req.user.id]);

        res.json({
            success: true,
            data: {
                ...stats,
                completionRate: stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(2) : 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

/**
 * @swagger
 * /api/tasks/{id}:
 *   get:
 *     summary: Busca uma tarefa pelo ID
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: UUID da tarefa
 *     responses:
 *       200:
 *         description: Tarefa retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:          { type: string, example: uuid-aqui }
 *                     title:       { type: string, example: Estudar Node.js }
 *                     description: { type: string, example: Ler capítulo 3 }
 *                     completed:   { type: boolean, example: false }
 *                     priority:    { type: string, example: medium }
 *                     userId:      { type: string, example: uuid-do-usuario }
 *                     createdAt:   { type: string, format: date-time }
 *       401:
 *         description: Token ausente ou inválido
 *       404:
 *         description: Tarefa não encontrada
 */
router.get('/:id', async (req, res) => {
    try {
        const row = await database.get(
            'SELECT * FROM tasks WHERE id = ? AND userId = ?',
            [req.params.id, req.user.id]
        );

        if (!row) {
            return res.status(404).json({ success: false, message: 'Tarefa não encontrada' });
        }

        const task = new Task({...row, completed: row.completed === 1});
        res.json({ success: true, data: task.toJSON() });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

/**
 * @swagger
 * /api/tasks/{id}:
 *   put:
 *     summary: Atualiza uma tarefa
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: UUID da tarefa
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:       { type: string, example: Estudar Node.js }
 *               description: { type: string, example: Ler capítulo 3 }
 *               completed:   { type: boolean, example: true }
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *     responses:
 *       200:
 *         description: Tarefa atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:          { type: string, example: uuid-aqui }
 *                     title:       { type: string, example: Estudar Node.js }
 *                     completed:   { type: boolean, example: true }
 *                     priority:    { type: string, example: high }
 *       401:
 *         description: Token ausente ou inválido
 *       404:
 *         description: Tarefa não encontrada
 */
router.put('/:id', async (req, res) => {
    try {
        const { title, description, completed, priority } = req.body;
        
        const result = await database.run(
            'UPDATE tasks SET title = ?, description = ?, completed = ?, priority = ? WHERE id = ? AND userId = ?',
            [title, description, completed ? 1 : 0, priority, req.params.id, req.user.id]
        );

        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: 'Tarefa não encontrada' });
        }

        const updatedRow = await database.get(
            'SELECT * FROM tasks WHERE id = ? AND userId = ?',
            [req.params.id, req.user.id]
        );

        const task = new Task({...updatedRow, completed: updatedRow.completed === 1});
        res.json({ success: true, message: 'Tarefa atualizada com sucesso', data: task.toJSON() });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

/**
 * @swagger
 * /api/tasks/{id}:
 *   delete:
 *     summary: Deleta uma tarefa
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: UUID da tarefa
 *     responses:
 *       200:
 *         description: Tarefa deletada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Tarefa deletada com sucesso }
 *       401:
 *         description: Token ausente ou inválido
 *       404:
 *         description: Tarefa não encontrada
 */
router.delete('/:id', async (req, res) => {
    try {
        const result = await database.run(
            'DELETE FROM tasks WHERE id = ? AND userId = ?',
            [req.params.id, req.user.id]
        );

        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: 'Tarefa não encontrada' });
        }

        res.json({ success: true, message: 'Tarefa deletada com sucesso' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

module.exports = router;