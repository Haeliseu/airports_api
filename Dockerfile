# Utiliser l'image officielle Node.js LTS
FROM node:18-alpine

# Installer les outils nécessaires (PostgreSQL client et netcat)
RUN apk add --no-cache postgresql-client netcat-openbsd

# Créer le répertoire de l'application
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances de production uniquement
RUN npm ci --only=production

# Copier le reste de l'application
COPY . .

# Copier et rendre exécutable le script d'entrypoint
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Créer un utilisateur non-root pour exécuter l'application
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app && \
    chmod +x /app/docker-entrypoint.sh

# Utiliser l'utilisateur non-root
USER nodejs

# Exposer le port de l'application
EXPOSE 3000

# Variable d'environnement par défaut
ENV NODE_ENV=production

# Point d'entrée avec migration automatique
ENTRYPOINT ["/bin/sh", "/app/docker-entrypoint.sh"]

