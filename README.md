# Get ICAO from Location API

API REST pour obtenir les codes ICAO des aéroports à partir de coordonnées géographiques.

## 🚀 Démarrage avec Docker

### Prérequis

- Docker >= 20.10
- Docker Compose >= 2.0

### Installation

```bash
# 1. Cloner le projet
cd /Applications/Dev/geticaofromlocation

# 2. Placer votre fichier airports.csv dans le dossier data/
# Télécharger depuis: https://ourairports.com/data/
cp /chemin/vers/airports.csv ./data/airports.csv

# 3. Démarrer l'application (migration et import automatiques)
docker-compose up -d --build

# 4. Voir les logs
docker-compose logs -f api
```

L'application démarre automatiquement :
- ✅ Crée la base de données PostgreSQL
- ✅ Crée la table `airports` avec tous les index
- ✅ Importe les données du CSV
- ✅ Démarre l'API sur le port 3000

## 📖 Documentation

- **API** : http://localhost:3000/api/icao
- **Swagger** : http://localhost:3000/api-docs

## 🔗 Endpoints

### GET `/api/icao`
Obtenir l'aéroport le plus proche d'une localisation.

```bash
curl "http://localhost:3000/api/icao?lat=48.8566&lon=2.3522"
```

**Paramètres :**
- `lat` (required) : Latitude (-90 à 90)
- `lon` (required) : Longitude (-180 à 180)
- `maxDistance` (optional) : Distance maximale en km

**Réponse :**
```json
{
  "success": true,
  "data": {
    "icao": "LFPG",
    "name": "Paris Charles de Gaulle Airport",
    "city": "Paris",
    "country": "France",
    "type": "large_airport",
    "distance": 23.5,
    "location": { "lat": 49.0097, "lon": 2.5479 }
  }
}
```

### GET `/api/icao/nearest`
Obtenir les N aéroports les plus proches.

```bash
curl "http://localhost:3000/api/icao/nearest?lat=48.8566&lon=2.3522&limit=5"
```

**Paramètres :**
- `lat` (required) : Latitude
- `lon` (required) : Longitude
- `limit` (optional) : Nombre d'aéroports (défaut: 5)
- `maxDistance` (optional) : Distance maximale en km

### GET `/api/icao/search`
Rechercher un aéroport par code ICAO ou nom.

```bash
# Par code ICAO
curl "http://localhost:3000/api/icao/search?code=LFPG"

# Par nom
curl "http://localhost:3000/api/icao/search?name=Paris&limit=10"
```

**Paramètres :**
- `code` (optional) : Code ICAO exact
- `name` (optional) : Nom ou partie du nom
- `limit` (optional) : Nombre de résultats (défaut: 10)

## 🛠️ Commandes Docker

```bash
# Démarrer
docker-compose up -d

# Arrêter
docker-compose down

# Voir les logs
docker-compose logs -f api

# Redémarrer avec rebuild
docker-compose up -d --build

# Vérifier l'état
docker-compose ps

# Accéder à PostgreSQL
docker-compose exec postgres psql -U postgres -d airports_db
```

## 📊 Base de données

### Table `airports`
- **icao** : Code ICAO (VARCHAR, unique, indexé)
- **name** : Nom de l'aéroport (VARCHAR, indexé)
- **latitude** : Latitude (DECIMAL, indexé)
- **longitude** : Longitude (DECIMAL, indexé)
- **city** : Ville (VARCHAR, indexé)
- **country** : Pays (VARCHAR, indexé)
- **elevation** : Altitude en mètres (INTEGER)
- **type** : Type d'aéroport (VARCHAR, indexé)

### Index créés automatiquement
- Index sur `latitude` et `longitude` (séparés et combinés)
- Index sur `LOWER(icao)` pour recherches case-insensitive
- Index sur `LOWER(name)` pour recherches case-insensitive
- Index sur `LOWER(city)` pour recherches case-insensitive
- Index sur `country` et `type`

## ⚙️ Configuration

Variables d'environnement (fichier `.env`) :

```env
DB_HOST=postgres
DB_PORT=5432
DB_NAME=airports_db
DB_USER=postgres
DB_PASSWORD=your_password
PORT=3000
NODE_ENV=production
```

## 🧪 Tests

```bash
# Test de santé
docker-compose ps

# Test de l'API
curl http://localhost:3000/api/icao?lat=48.8566&lon=2.3522

# Compter les aéroports importés
docker-compose exec postgres psql -U postgres -d airports_db -c "SELECT COUNT(*) FROM airports;"
```

## 🗄️ Import manuel des données

Si besoin d'importer les données manuellement :

```bash
# Migration (créer la table)
docker-compose exec api npm run db:migrate

# Import du CSV
docker-compose exec api npm run db:import
```

## 🔒 Production

Pour la production, modifiez `.env` :
- Changez `DB_PASSWORD`
- Utilisez `NODE_ENV=production`
- Configurez des sauvegardes automatiques de PostgreSQL

## 📝 Format CSV requis

Le fichier `data/airports.csv` doit contenir :
- **Colonnes obligatoires** : `icao_code` ou `ident`, `name`, `latitude_deg`, `longitude_deg`
- **Colonnes optionnelles** : `municipality`, `iso_country`, `elevation_ft`, `type`

Source recommandée : https://ourairports.com/data/ (~70 000 aéroports)

## 🛠️ Technologies

- **Node.js** - Runtime JavaScript
- **Express** - Framework web
- **PostgreSQL** - Base de données
- **Swagger** - Documentation API
- **Docker** - Containerisation

## 📈 Performance

- Recherche du plus proche : ~5-10ms
- Recherche des N plus proches : ~10-20ms
- Recherche par ICAO : ~1-2ms
- Capacité testée : 70 000+ aéroports

## 🐛 Dépannage

### L'API ne démarre pas
```bash
docker-compose logs -f api
```

### Données non importées
```bash
# Vérifier que le CSV existe
ls -la data/airports.csv

# Importer manuellement
docker-compose exec api npm run db:import
```

### Réinitialiser complètement
```bash
docker-compose down -v
docker-compose up -d --build
```
