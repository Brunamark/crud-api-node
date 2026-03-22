const express = require("express");
const User = require("../models/User");
const database = require("../database/database");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Gerenciamento do perfil do usuário autenticado
 */

router.use(authMiddleware);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Retorna o perfil do usuário autenticado
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil retornado com sucesso
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
 *                     id:        { type: string, example: 'uuid-aqui' }
 *                     email:     { type: string, example: 'joao@email.com' }
 *                     username:  { type: string, example: 'joaosilva' }
 *                     firstName: { type: string, example: 'João' }
 *                     lastName:  { type: string, example: 'Silva' }
 *                     createdAt: { type: string, format: date-time }
 *       401:
 *         description: Token ausente ou inválido
 *       404:
 *         description: Usuário não encontrado
 */
router.get("/", async (req, res) => {
  try {
    const row = await database.get(
      "SELECT id, email, username, firstName, lastName, createdAt FROM users WHERE id = ?",
      [req.user.id],
    );

    if (!row) {
      return res.status(404).json({ success: false, message: "Usuário não encontrado" });
    }

    res.json({ success: true, data: row });
  } catch (error) {
    res.status(500).json({ success: false, message: "Erro interno do servidor" });
  }
});

/**
 * @swagger
 * /api/users:
 *   put:
 *     summary: Atualiza o perfil do usuário autenticado
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: novo@email.com
 *               username:
 *                 type: string
 *                 example: novousername
 *               password:
 *                 type: string
 *                 example: novasenha123
 *                 description: Opcional — só envie se quiser trocar a senha
 *               firstName:
 *                 type: string
 *                 example: João
 *               lastName:
 *                 type: string
 *                 example: Silva
 *     responses:
 *       200:
 *         description: Perfil atualizado com sucesso
 *       400:
 *         description: Email ou username já está em uso
 *       401:
 *         description: Token ausente ou inválido
 *       404:
 *         description: Usuário não encontrado
 */
router.put("/", async (req, res) => {
  try {
    const { email, username, password, firstName, lastName } = req.body;

    const existing = await database.get("SELECT * FROM users WHERE id = ?", [req.user.id]);

    if (!existing) {
      return res.status(404).json({ success: false, message: "Usuário não encontrado" });
    }

    const user = new User({
      ...existing,
      email,
      username,
      firstName,
      lastName,
      password: password || existing.password,
    });

    if (password) {
      await user.hashPassword();
    }

    await database.run(
      `UPDATE users SET email = ?, username = ?, password = ?, firstName = ?, lastName = ? WHERE id = ?`,
      [user.email, user.username, user.password, user.firstName, user.lastName, req.user.id],
    );

    const { password: _, ...updatedUser } = user;
    res.json({ success: true, data: updatedUser });
  } catch (error) {
    if (error.message.includes("UNIQUE constraint failed: users.email")) {
      return res.status(400).json({ success: false, message: "Email já está em uso" });
    }
    if (error.message.includes("UNIQUE constraint failed: users.username")) {
      return res.status(400).json({ success: false, message: "Username já está em uso" });
    }
    res.status(500).json({ success: false, message: "Erro interno do servidor" });
  }
});

/**
 * @swagger
 * /api/users:
 *   delete:
 *     summary: Deleta a conta do usuário autenticado
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usuário deletado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Usuário deletado com sucesso
 *       401:
 *         description: Token ausente ou inválido
 *       404:
 *         description: Usuário não encontrado
 */
router.delete("/", async (req, res) => {
  try {
    const result = await database.run("DELETE FROM users WHERE id = ?", [req.user.id]);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: "Usuário não encontrado" });
    }

    res.json({ success: true, message: "Usuário deletado com sucesso" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Erro interno do servidor" });
  }
});

module.exports = router;