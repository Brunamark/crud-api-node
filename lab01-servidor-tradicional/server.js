const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');

const config      = require('./config/database');
const swaggerSpec = require('./config/swagger');
const database    = require('./database/database');
const authRoutes  = require('./routes/auth');
const taskRoutes  = require('./routes/tasks');
const userRoutes  = require('./routes/users');

/**
 * Servidor de Aplicação Tradicional
 * 
 * Implementa arquitetura cliente-servidor conforme Coulouris et al. (2012):
 * - Centralização do estado da aplicação
 * - Comunicação Request-Reply via HTTP
 * - Processamento síncrono das requisições
 */

const app = express();

// helmet com contentSecurityPolicy desabilitado
// O Swagger UI carrega CSS e JS inline — o CSP padrão do helmet bloqueia isso
app.use(helmet({ contentSecurityPolicy: false }));
app.use(rateLimit(config.rateLimit));
app.use(cors());

// Parsing de dados
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Logging de requisições
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Swagger UI — disponível em http://localhost:3000/api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rota raiz
app.get('/', (req, res) => {
    res.json({
        service: 'Task Management API',
        version: '1.0.0',
        architecture: 'Traditional Client-Server',
        docs: 'http://localhost:3000/api-docs',
        endpoints: {
            auth:  ['POST /api/auth/register', 'POST /api/auth/login'],
            users: ['GET /api/users', 'PUT /api/users', 'DELETE /api/users'],
            tasks: ['GET /api/tasks', 'POST /api/tasks', 'GET /api/tasks/:id', 'PUT /api/tasks/:id', 'DELETE /api/tasks/:id', 'GET /api/tasks/stats/summary']
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// API Routes
app.use('/api/auth',  authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint não encontrado'
    });
});

// Error handler global
app.use((error, req, res, next) => {
    console.error('Erro:', error);
    res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
    });
});

// Inicialização
async function startServer() {
    try {
        await database.init();
        
        app.listen(config.port, () => {
            console.log('🚀 =================================');
            console.log(`🚀 Servidor:  http://localhost:${config.port}`);
            console.log(`🚀 Swagger:   http://localhost:${config.port}/api-docs`);
            console.log(`🚀 Health:    http://localhost:${config.port}/health`);
            console.log('🚀 =================================');
        });
    } catch (error) {
        console.error('❌ Falha na inicialização:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    startServer();
}

module.exports = app;