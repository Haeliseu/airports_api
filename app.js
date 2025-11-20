require('dotenv').config();
const express = require('express');
const logger = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const checkDatabaseConnection = require('./config/loadAirports');
const indexRouter = require('./routes/index');

const app = express();

// Vérifier la connexion à la base de données au démarrage
checkDatabaseConnection().catch(err => {
  console.error('Erreur lors de la vérification de la base de données:', err);
});

// Middleware essentiels uniquement
app.use(logger('dev'));
app.use(express.json());

// Swagger Configuration
const swaggerSpecs = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Get ICAO from Location API',
      version: '1.0.0',
      description: 'API pour obtenir les codes ICAO à partir d\'une localisation'
    },
    servers: [{ url: '/', description: 'Serveur de développement' }]
  },
  apis: ['./routes/*.js']
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
app.use('/', indexRouter);

// Gestionnaires d'erreurs
app.use((req, res) => res.status(404).json({ success: false, message: 'Route non trouvée' }));
app.use((err, req, res, next) => res.status(err.status || 500).json({
  success: false,
  message: err.message,
  ...(process.env.NODE_ENV === 'development' && { error: err })
}));

module.exports = app;
