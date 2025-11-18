const airportService = require('../services/airportService');
const { testConnection, query } = require('./database');

/**
 * Vérifie la connexion à la base de données et les données au démarrage
 */
async function checkDatabaseConnection() {
  try {
    console.log('🔄 Vérification de la connexion à la base de données...');
    
    // Test de connexion
    const connected = await testConnection();
    if (!connected) {
      console.error('❌ Impossible de se connecter à la base de données PostgreSQL');
      console.error('💡 Vérifiez votre fichier .env et que PostgreSQL est démarré');
      return false;
    }

    // Vérifier si des données sont présentes
    const dataLoaded = await airportService.isDataLoaded();
    
    if (!dataLoaded) {
      console.warn('⚠️  Aucun aéroport dans la base de données');
      console.warn('💡 Exécutez: npm run db:migrate && npm run db:import');
      return false;
    }

    // Compter les aéroports
    const result = await query('SELECT COUNT(*) FROM airports');
    const count = parseInt(result.rows[0].count);
    console.log(`✅ Base de données connectée - ${count} aéroports disponibles`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification de la base de données:', error.message);
    return false;
  }
}

module.exports = checkDatabaseConnection;

