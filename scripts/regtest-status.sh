#!/usr/bin/env bash
set -euo pipefail
COMPOSE="docker compose -f deploy/regtest/docker-compose.yml"
$COMPOSE ps
