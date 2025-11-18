const { query } = require('../config/database');

// Fonction helper pour formater un aéroport
const formatAirport = (airport, includeDistance = false) => ({
  icao: airport.icao,
  name: airport.name,
  lat: parseFloat(airport.latitude),
  lon: parseFloat(airport.longitude),
  city: airport.city,
  country: airport.country,
  elevation: airport.elevation,
  type: airport.type,
  ...(includeDistance && { distance: parseFloat(airport.distance) })
});

// Requête SQL commune pour la recherche géographique
const buildGeoQuery = (includeDistance = true) => `
  SELECT 
    icao, name, latitude, longitude, city, country, elevation, type
    ${includeDistance ? `, (6371 * acos(cos(radians($1)) * cos(radians(latitude)) * 
      cos(radians(longitude) - radians($2)) + sin(radians($1)) * sin(radians(latitude)))) AS distance` : ''}
  FROM airports
`;

class AirportService {

  /**
   * Trouve l'aéroport le plus proche d'une localisation
   */
  async findNearestAirport(lat, lon, maxDistance = Infinity, types = ['large_airport', 'medium_airport', 'small_airport']) {
    const latRange = maxDistance === Infinity ? 90 : maxDistance / 111;
    const lonRange = maxDistance === Infinity ? 180 : maxDistance / (111 * Math.cos(lat * Math.PI / 180));

    const typeFilter = types.length > 0 ? `AND type = ANY($5)` : '';
    const params = types.length > 0 
      ? [lat, lon, latRange, lonRange, types]
      : [lat, lon, latRange, lonRange];

    const result = await query(
      `${buildGeoQuery()} 
       WHERE latitude BETWEEN $1 - $3 AND $1 + $3 
         AND longitude BETWEEN $2 - $4 AND $2 + $4
         ${typeFilter}
       ORDER BY distance LIMIT 1`,
      params
    );

    if (result.rows.length === 0 || (maxDistance !== Infinity && result.rows[0].distance > maxDistance)) {
      return null;
    }

    return formatAirport(result.rows[0], true);
  }

  /**
   * Trouve les N aéroports les plus proches
   */
  async findNearestAirports(lat, lon, limit = 5, maxDistance = Infinity, types = ['large_airport', 'medium_airport', 'small_airport']) {
    const latRange = maxDistance === Infinity ? 90 : maxDistance / 111;
    const lonRange = maxDistance === Infinity ? 180 : maxDistance / (111 * Math.cos(lat * Math.PI / 180));

    const typeFilter = types.length > 0 ? `AND type = ANY($6)` : '';
    const params = types.length > 0 
      ? [lat, lon, latRange, lonRange, limit, types]
      : [lat, lon, latRange, lonRange, limit];

    const result = await query(
      `${buildGeoQuery()} 
       WHERE latitude BETWEEN $1 - $3 AND $1 + $3 
         AND longitude BETWEEN $2 - $4 AND $2 + $4
         ${typeFilter}
       ORDER BY distance LIMIT $5`,
      params
    );

    return result.rows
      .filter(a => maxDistance === Infinity || parseFloat(a.distance) <= maxDistance)
      .map(a => formatAirport(a, true));
  }

  /**
   * Recherche un aéroport par son code ICAO
   */
  async findByICAO(icao) {
    const result = await query(
      `${buildGeoQuery(false)} WHERE LOWER(icao) = LOWER($1) LIMIT 1`,
      [icao]
    );
    return result.rows.length > 0 ? formatAirport(result.rows[0]) : null;
  }

  /**
   * Recherche des aéroports par nom
   */
  async searchByName(name, limit = 10) {
    const result = await query(
      `${buildGeoQuery(false)} 
       WHERE LOWER(name) LIKE LOWER($1) OR LOWER(city) LIKE LOWER($1)
       ORDER BY CASE WHEN LOWER(name) LIKE LOWER($2) THEN 1 WHEN LOWER(city) LIKE LOWER($2) THEN 2 ELSE 3 END, name
       LIMIT $3`,
      [`%${name}%`, `${name}%`, limit]
    );
    return result.rows.map(a => formatAirport(a));
  }

  /**
   * Vérifie si les données sont chargées
   */
  async isDataLoaded() {
    try {
      const result = await query('SELECT COUNT(*) FROM airports');
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new AirportService();
