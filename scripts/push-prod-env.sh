#!/bin/sh
# Pushes .env.production.local to Vercel production and the database URL to
# GitHub Actions. Prints names only, never values.
set -eu
cd "$(dirname "$0")/.."
while IFS='=' read -r name value; do
  [ -z "$name" ] && continue
  vercel env rm "$name" production --yes --scope jubayer-al-mamuns-projects >/dev/null 2>&1 || true
  printf '%s' "$value" | vercel env add "$name" production --scope jubayer-al-mamuns-projects >/dev/null 2>&1
  echo "vercel: $name"
done < .env.production.local
grep '^DATABASE_URL=' .env.production.local | cut -d= -f2- | tr -d '\n' | gh secret set PRODUCTION_DATABASE_URL
echo "github: PRODUCTION_DATABASE_URL"
