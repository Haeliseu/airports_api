const { Pool } = require('pg');
require('dotenv').config();

// Configuration du pool de connexions PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'airports_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20, // Nombre maximum de clients dans le pool
  idleTimeoutMillis: 30000, // Temps avant qu'un client inactif soit fermé
  connectionTimeoutMillis: 2000, // Temps d'attente pour une connexion
});

// Gestionnaire d'erreurs du pool
pool.on('error', (err, client) => {
  console.error('Erreur inattendue sur le client PostgreSQL inactif', err);
  process.exit(-1);
});

// Test de la connexion
pool.on('connect', () => {
  console.log('✓ Connexion à PostgreSQL établie');
});

/**
 * Exécute une requête SQL
 * @param {string} text - Requête SQL
 * @param {Array} params - Paramètres de la requête
 * @returns {Promise<Object>} Résultat de la requête
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Requête SQL exécutée:', { text, duration, rows: res.rowCount });
    }
    
    return res;
  } catch (error) {
    console.error('Erreur SQL:', error.message);
    throw error;
  }
}

/**
 * Obtient un client du pool pour des transactions
 * @returns {Promise<Object>} Client PostgreSQL
 */
async function getClient(options) {
    return await pool.connect(options);
}

/**
 * Teste la connexion à la base de données
 * @returns {Promise<boolean>} True si la connexion fonctionne
 */
async function testConnection() {
  try {
    const result = await query('SELECT NOW()');
    console.log('✅ Connexion à la base de données réussie:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('❌ Échec de la connexion à la base de données:', error.message);
    return false;
  }
}

/**
 * Ferme toutes les connexions du pool
 */
async function closePool() {
  await pool.end();
  console.log('✓ Pool de connexions PostgreSQL fermé');
}

module.exports = {
  query,
  getClient,
  pool,
  testConnection,
  closePool
};

