const express = require('express');
const router = express.Router();
const airportService = require('../services/airportService');

// Middleware de validation des coordonnées (réutilisable)
const validateCoordinates = (req, res, next) => {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ success: false, message: 'Les paramètres lat et lon sont requis' });
  }

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);

  if (isNaN(latitude) || isNaN(longitude)) {
    return res.status(400).json({ success: false, message: 'Les paramètres lat et lon doivent être des nombres valides' });
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ success: false, message: 'Coordonnées invalides (lat: -90 à 90, lon: -180 à 180)' });
  }

  req.coordinates = { latitude, longitude };
  next();
};

// Middleware de vérification des données (réutilisable)
const checkDataLoaded = async (req, res, next) => {
  if (!(await airportService.isDataLoaded())) {
    return res.status(503).json({
      success: false,
      message: 'Aucune donnée d\'aéroport dans la base. Exécutez: npm run db:migrate && npm run db:import'
    });
  }
  next();
};

// Helper pour formater la réponse d'un aéroport
const formatAirportResponse = (airport) => ({
  icao: airport.icao,
  name: airport.name,
  city: airport.city,
  country: airport.country,
  type: airport.type,
  distance: Math.round(airport.distance * 10) / 10,
  location: { lat: airport.lat, lon: airport.lon }
});

/**
 * @swagger
 * /icao:
 *   get:
 *     summary: Obtenir le code ICAO de l'aéroport le plus proche
 *     description: Recherche l'aéroport le plus proche d'une localisation donnée
 *     tags: [ICAO]
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         description: Latitude de la localisation
 *         schema:
 *           type: number
 *           format: float
 *           minimum: -90
 *           maximum: 90
 *         example: 48.8566
 *       - in: query
 *         name: lon
 *         required: true
 *         description: Longitude de la localisation
 *         schema:
 *           type: number
 *           format: float
 *           minimum: -180
 *           maximum: 180
 *         example: 2.3522
 *       - in: query
 *         name: maxDistance
 *         required: false
 *         description: Distance maximale de recherche en km
 *         schema:
 *           type: number
 *           format: float
 *         example: 100
 *       - in: query
 *         name: type
 *         required: false
 *         description: Types d'aéroports à inclure (par défaut large, medium, small airports)
 *         schema:
 *           type: string
 *           enum: [large_airport, medium_airport, small_airport, heliport, seaplane_base, balloonport, closed, all]
 *         example: large_airport
 *     responses:
 *       200:
 *         description: Aéroport trouvé avec succès
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
 *                     icao:
 *                       type: string
 *                       example: LFPG
 *                     name:
 *                       type: string
 *                       example: Charles de Gaulle International Airport
 *       400:
 *         description: Paramètres manquants ou invalides
 *       404:
 *         description: Aucun aéroport trouvé
 *       503:
 *         description: Données non chargées
 */
router.get('/icao', checkDataLoaded, validateCoordinates, async (req, res) => {
  try {
    const { latitude, longitude } = req.coordinates;
    const maxDist = req.query.maxDistance ? parseFloat(req.query.maxDistance) : Infinity;
    
    // Gestion du paramètre type
    let types = ['large_airport', 'medium_airport', 'small_airport'];
    if (req.query.type) {
      if (req.query.type === 'all') {
        types = [];
      } else {
        types = [req.query.type];
      }
    }

    const airport = await airportService.findNearestAirport(latitude, longitude, maxDist, types);

    if (!airport) {
      return res.status(404).json({
        success: false,
        message: req.query.maxDistance
          ? `Aucun aéroport trouvé dans un rayon de ${req.query.maxDistance} km`
          : 'Aucun aéroport trouvé à proximité'
      });
    }

    res.json({ 
      success: true, 
      data: {
        icao: airport.icao,
        name: airport.name
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur lors de la recherche', error: error.message });
  }
});

/**
 * @swagger
 * /icao/nearest:
 *   get:
 *     summary: Obtenir les N aéroports les plus proches
 *     description: Retourne une liste des aéroports les plus proches d'une localisation
 *     tags: [ICAO]
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         description: Latitude de la localisation
 *         schema:
 *           type: number
 *           format: float
 *         example: 48.8566
 *       - in: query
 *         name: lon
 *         required: true
 *         description: Longitude de la localisation
 *         schema:
 *           type: number
 *           format: float
 *         example: 2.3522
 *       - in: query
 *         name: limit
 *         required: false
 *         description: Nombre d'aéroports à retourner
 *         schema:
 *           type: integer
 *           default: 5
 *         example: 10
 *       - in: query
 *         name: maxDistance
 *         required: false
 *         description: Distance maximale en km
 *         schema:
 *           type: number
 *           format: float
 *         example: 100
 *       - in: query
 *         name: type
 *         required: false
 *         description: Types d'aéroports à inclure (par défaut large, medium, small airports)
 *         schema:
 *           type: string
 *           enum: [large_airport, medium_airport, small_airport, heliport, seaplane_base, balloonport, closed, all]
 *         example: large_airport
 *     responses:
 *       200:
 *         description: Liste des aéroports
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Paramètres invalides
 *       503:
 *         description: Données non chargées
 */
router.get('/icao/nearest', checkDataLoaded, validateCoordinates, async (req, res) => {
  try {
    const { latitude, longitude } = req.coordinates;
    const limit = req.query.limit ? parseInt(req.query.limit) : 5;
    const maxDist = req.query.maxDistance ? parseFloat(req.query.maxDistance) : Infinity;
    
    // Gestion du paramètre type
    let types = ['large_airport', 'medium_airport', 'small_airport'];
    if (req.query.type) {
      if (req.query.type === 'all') {
        types = [];
      } else {
        types = [req.query.type];
      }
    }

    const airports = await airportService.findNearestAirports(latitude, longitude, limit, maxDist, types);

    res.json({
      success: true,
      count: airports.length,
      data: airports.map(formatAirportResponse)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur lors de la recherche' });
  }
});

/**
 * @swagger
 * /icao/search:
 *   get:
 *     summary: Rechercher un aéroport par code ICAO ou nom
 *     description: Recherche par code ICAO exact ou par nom/ville (recherche partielle)
 *     tags: [ICAO]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: false
 *         description: Code ICAO de l'aéroport (ex LFPG)
 *         schema:
 *           type: string
 *         example: LFPG
 *       - in: query
 *         name: name
 *         required: false
 *         description: Nom ou ville de l'aéroport (recherche partielle)
 *         schema:
 *           type: string
 *         example: Paris
 *       - in: query
 *         name: limit
 *         required: false
 *         description: Nombre maximum de résultats (pour recherche par nom)
 *         schema:
 *           type: integer
 *           default: 10
 *         example: 5
 *     responses:
 *       200:
 *         description: Résultats de la recherche
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Paramètres manquants (code ou name requis)
 *       404:
 *         description: Aucun résultat trouvé
 *       503:
 *         description: Données non chargées
 */
router.get('/icao/search', checkDataLoaded, async (req, res) => {
  try {
    const { code, name, limit } = req.query;

    if (!code && !name) {
      return res.status(400).json({ success: false, message: 'Le paramètre code ou name est requis' });
    }

    if (code) {
      const airport = await airportService.findByICAO(code);
      if (!airport) {
        return res.status(404).json({ success: false, message: `Aucun aéroport trouvé avec le code ICAO: ${code}` });
      }
      return res.json({ success: true, data: { ...airport, location: { lat: airport.lat, lon: airport.lon } } });
    }

    const airports = await airportService.searchByName(name, limit ? parseInt(limit) : 10);
    if (airports.length === 0) {
      return res.status(404).json({ success: false, message: `Aucun aéroport trouvé pour: ${name}` });
    }

    res.json({
      success: true,
      count: airports.length,
      data: airports.map(a => ({ ...a, location: { lat: a.lat, lon: a.lon } }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur lors de la recherche' });
  }
});

module.exports = router;
