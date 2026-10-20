#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")"
test -f .env || { echo 'Missing .env with production secrets' >&2; exit 1; }
for network in proxy telezalupa-screenshoter_default; do
  docker network inspect "$network" >/dev/null
done
for volume in telezalupa-screenshoter_postgres_data telezalupa-screenshoter_screenshoter_data; do
  docker volume inspect "$volume" >/dev/null
done
compose() { docker compose --env-file .env --env-file deployment.env -f docker-compose.production.yml "$@"; }
compose config --quiet
for image in $(compose config --images); do docker image inspect "$image" >/dev/null; done
compose up -d --no-build --pull never --wait --wait-timeout 180 "$@"
