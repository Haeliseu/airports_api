#!/bin/sh
set -e

echo "🐳 Initialisation de l'application..."
echo ""

# Fonction pour attendre PostgreSQL
wait_for_postgres() {
  echo "⏳ Attente de PostgreSQL..."
  local max_attempts=30
  local attempt=0
  
  until nc -z postgres 5432; do
    attempt=$((attempt + 1))
    if [ $attempt -ge $max_attempts ]; then
      echo "❌ Impossible de se connecter à PostgreSQL après $max_attempts tentatives"
      exit 1
    fi
    echo "   Tentative $attempt/$max_attempts..."
    sleep 2
  done
  
  # Attendre que PostgreSQL accepte les connexions
  sleep 2
  echo "✅ PostgreSQL est prêt!"
}

# Fonction pour vérifier la connexion à la base
check_database_connection() {
  echo ""
  echo "🔍 Vérification de la connexion à la base de données..."
  
  if PGPASSWORD=$DB_PASSWORD psql -h postgres -U $DB_USER -d $DB_NAME -c "SELECT 1" > /dev/null 2>&1; then
    echo "✅ Connexion à la base de données réussie"
    return 0
  else
    echo "❌ Impossible de se connecter à la base de données"
    return 1
  fi
}

# Fonction pour créer la table
migrate_database() {
  echo ""
  echo "📋 Migration de la base de données..."
  
  # Vérifier si la table existe
  TABLE_EXISTS=$(PGPASSWORD=$DB_PASSWORD psql -h postgres -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'airports');" 2>/dev/null || echo "f")
  
  if [ "$TABLE_EXISTS" = "f" ]; then
    echo "   Création de la table airports..."
    npm run db:migrate
    echo "✅ Table airports créée avec succès"
  else
    echo "✅ Table airports déjà existante"
  fi
}

# Fonction pour importer les données
import_data() {
  echo ""
  echo "📊 Vérification des données..."
  
  # Compter les aéroports existants
  COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h postgres -U $DB_USER -d $DB_NAME -tAc "SELECT COUNT(*) FROM airports;" 2>/dev/null || echo "0")
  
  if [ "$COUNT" = "0" ]; then
    echo "   Aucune donnée trouvée dans la table"
    
    # Vérifier si le fichier CSV existe
    if [ -f "/app/data/airports.csv" ]; then
      echo "   Import des données depuis airports.csv..."
      npm run db:import
      
      # Vérifier l'import
      NEW_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h postgres -U $DB_USER -d $DB_NAME -tAc "SELECT COUNT(*) FROM airports;" 2>/dev/null || echo "0")
      echo "✅ Import terminé - $NEW_COUNT aéroports importés"
    else
      echo "⚠️  Fichier airports.csv non trouvé dans /app/data/"
      echo "⚠️  Lancez 'docker-compose exec api npm run db:import' après avoir ajouté le fichier"
    fi
  else
    echo "✅ Données déjà présentes - $COUNT aéroports dans la base"
  fi
}

# ÉTAPE 1 : Attendre PostgreSQL
wait_for_postgres

# ÉTAPE 2 : Vérifier la connexion
if ! check_database_connection; then
  echo "❌ Échec de la connexion - abandon"
  exit 1
fi

# ÉTAPE 3 : Migration (OBLIGATOIRE avant démarrage)
migrate_database

# ÉTAPE 4 : Import des données (si nécessaire)
import_data

# ÉTAPE 5 : Démarrage du serveur
echo ""
echo "🚀 Démarrage du serveur Node.js..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exec npm start

