/**
 * Script d'import des données CSV vers PostgreSQL
 * Usage: npm run db:import
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { query, getClient, testConnection, closePool } = require('../config/database');

const CSV_PATH = path.join(__dirname, '../data/airports.csv');

async function importCSV() {
  console.log('🔄 Démarrage de l\'import CSV...\n');

  try {
    // Test de connexion
    console.log('1️⃣  Test de la connexion à la base de données...');
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Impossible de se connecter à la base de données');
    }

    // Vérifier que le fichier CSV existe
    console.log('\n2️⃣  Vérification du fichier CSV...');
    if (!fs.existsSync(CSV_PATH)) {
      throw new Error(`Fichier CSV non trouvé: ${CSV_PATH}`);
    }
    console.log(`✓ Fichier trouvé: ${CSV_PATH}`);

    // Vider la table existante (optionnel - commenter si vous voulez garder les données)
    console.log('\n3️⃣  Nettoyage de la table airports...');
    await query('TRUNCATE TABLE airports RESTART IDENTITY CASCADE');
    console.log('✓ Table vidée');

    // Import des données
    console.log('\n4️⃣  Import des données...');
    
    const airports = [];
    let errorCount = 0;
    let lineNumber = 0;

    // Lire le CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(CSV_PATH)
        .pipe(csv())
        .on('data', (row) => {
          lineNumber++;
          
          // Adapter selon le format du CSV OurAirports
          // Format: id,ident,type,name,latitude_deg,longitude_deg,elevation_ft,continent,iso_country,iso_region,municipality,scheduled_service,icao_code,iata_code,gps_code,local_code,home_link,wikipedia_link,keywords
          const airport = {
            // Priorité: icao_code, puis ident, puis gps_code
            icao: row.icao_code || row.ident || row.gps_code || row.icao || row.ICAO,
            name: row.name || row.NAME || '',
            // Coordonnées en degrés décimaux
            latitude: parseFloat(row.latitude_deg || row.latitude || row.lat || row.LAT),
            longitude: parseFloat(row.longitude_deg || row.longitude || row.lon || row.LON),
            // Ville
            city: row.municipality || row.city || row.CITY || '',
            // Pays (code ISO)
            country: row.iso_country || row.country || row.COUNTRY || '',
            // Altitude en pieds convertie en mètres
            elevation: row.elevation_ft ? Math.round(parseFloat(row.elevation_ft) * 0.3048) : null,
            // Type d'aéroport
            type: row.type || row.TYPE || 'airport'
          };

          // Valider les données essentielles
          if (!airport.icao || isNaN(airport.latitude) || isNaN(airport.longitude)) {
            errorCount++;
            if (errorCount <= 5) {
              console.warn(`⚠️  Ligne ${lineNumber} ignorée (données invalides):`, airport);
            }
            return;
          }

          airports.push(airport);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(`\n✓ ${airports.length} aéroports lus depuis le CSV`);
    if (errorCount > 0) {
      console.log(`⚠️  ${errorCount} lignes ignorées (données invalides)`);
    }

    // Insertion en batch pour de meilleures performances
    console.log('\n5️⃣  Insertion dans la base de données...');
    
    const client = await getClient();
    let insertedCount = 0;
    let duplicateCount = 0;
    
    try {
      await client.query('BEGIN');

      const insertSQL = `
        INSERT INTO airports (icao, name, latitude, longitude, city, country, elevation, type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (icao) DO UPDATE SET
          name = EXCLUDED.name,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          city = EXCLUDED.city,
          country = EXCLUDED.country,
          elevation = EXCLUDED.elevation,
          type = EXCLUDED.type,
          updated_at = CURRENT_TIMESTAMP
      `;

      // Insérer par batch de 100
      const batchSize = 100;
      for (let i = 0; i < airports.length; i += batchSize) {
        const batch = airports.slice(i, i + batchSize);
        
        for (const airport of batch) {
          try {
            await client.query(insertSQL, [
              airport.icao,
              airport.name,
              airport.latitude,
              airport.longitude,
              airport.city,
              airport.country,
              airport.elevation,
              airport.type
            ]);
            insertedCount++;
          } catch (err) {
            if (err.code === '23505') { // Code pour violation de contrainte unique
              duplicateCount++;
            } else {
              console.error(`Erreur lors de l'insertion de ${airport.icao}:`, err.message);
            }
          }
        }

        // Afficher la progression
        const progress = Math.min(i + batchSize, airports.length);
        process.stdout.write(`\r  Progression: ${progress}/${airports.length} (${Math.round(progress / airports.length * 100)}%)`);
      }

      await client.query('COMMIT');
      console.log('\n✓ Insertion terminée');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // Statistiques finales
    console.log('\n6️⃣  Statistiques:');
    const count = await query('SELECT COUNT(*) FROM airports');
    console.log(`  - Total dans la base: ${count.rows[0].count}`);
    console.log(`  - Insérés: ${insertedCount}`);
    if (duplicateCount > 0) {
      console.log(`  - Doublons ignorés: ${duplicateCount}`);
    }

    // Quelques exemples
    console.log('\n7️⃣  Exemples d\'aéroports importés:');
    const samples = await query('SELECT icao, name, city, country FROM airports LIMIT 5');
    samples.rows.forEach(row => {
      console.log(`  - ${row.icao}: ${row.name} (${row.city || 'N/A'}, ${row.country || 'N/A'})`);
    });

    console.log('\n✅ Import terminé avec succès!');
    console.log('💡 Vous pouvez maintenant démarrer l\'API avec "npm start"');

  } catch (error) {
    console.error('\n❌ Erreur lors de l\'import:', error.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// Exécution
importCSV();

