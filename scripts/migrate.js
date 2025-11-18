/**
 * Script de migration pour créer la table airports
 * Usage: npm run db:migrate
 */

require('dotenv').config();
const { query, testConnection, closePool } = require('../config/database');

const createTableSQL = `
CREATE TABLE IF NOT EXISTS airports (
  id SERIAL PRIMARY KEY,
  icao VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  city VARCHAR(100),
  country VARCHAR(100),
  elevation INTEGER,
  type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index BTREE pour les recherches par plage de coordonnées (requis pour WHERE latitude BETWEEN)
CREATE INDEX IF NOT EXISTS idx_airports_latitude ON airports (latitude);
CREATE INDEX IF NOT EXISTS idx_airports_longitude ON airports (longitude);

-- Index composite pour les recherches géographiques combinées (optimisation des requêtes de distance)
CREATE INDEX IF NOT EXISTS idx_airports_lat_lon ON airports (latitude, longitude);

-- Index unique pour les recherches par code ICAO (LOWER pour case-insensitive)
CREATE INDEX IF NOT EXISTS idx_airports_icao_lower ON airports (LOWER(icao));

-- Index pour les recherches par nom (LOWER pour case-insensitive)
CREATE INDEX IF NOT EXISTS idx_airports_name_lower ON airports (LOWER(name));

-- Index pour les recherches par ville (LOWER pour case-insensitive)
CREATE INDEX IF NOT EXISTS idx_airports_city_lower ON airports (LOWER(city));

-- Index pour les recherches par pays
CREATE INDEX IF NOT EXISTS idx_airports_country ON airports (country);

-- Index pour les recherches par type d'aéroport
CREATE INDEX IF NOT EXISTS idx_airports_type ON airports (type);
`;

async function migrate() {
  console.log('🔄 Démarrage de la migration...\n');

  try {
    // Test de connexion
    console.log('1️⃣  Test de la connexion à la base de données...');
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Impossible de se connecter à la base de données');
    }

    // Création de la table
    console.log('\n2️⃣  Création de la table airports et des index...');
    await query(createTableSQL);
    console.log('✅ Table airports créée avec succès');

    // Vérification
    console.log('\n3️⃣  Vérification de la table...');
    const result = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'airports'
      ORDER BY ordinal_position
    `);
    
    console.log('\nColonnes de la table airports:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    // Statistiques
    const count = await query('SELECT COUNT(*) FROM airports');
    console.log(`\n📊 Nombre d'aéroports dans la base: ${count.rows[0].count}`);

    console.log('\n✅ Migration terminée avec succès!');
    console.log('\n💡 Prochaine étape: Importez vos données avec "npm run db:import"');
    
  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// Exécution
migrate();

