#!/usr/bin/env bash
# ============================================================================
# docker-smoke-test.sh: CHECKS THE DOCKER IMAGE ACTUALLY WORKS
#
# Run by GitHub on every push (and by anyone with Docker):
#   bash scripts/docker-smoke-test.sh
# It builds the image, starts it with a password and a fresh data disk, and
# checks: the health check, the password lock, the website, signing up,
# saving a record, and that the record (and the login) are still there after
# the container is restarted.
# Everything it creates is removed at the end.
# ============================================================================

set -euo pipefail

IMAGE=vinyl-tracker:smoke
NAME=vinyl-smoke
VOLUME=vinyl-smoke-data
PASSWORD=smoke-test-password
URL=http://localhost:3000
# Where curl keeps the login cookie between requests, like a browser would.
COOKIES=$(mktemp)

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker volume rm "$VOLUME" >/dev/null 2>&1 || true
  rm -f "$COOKIES"
}
trap cleanup EXIT
cleanup

fail() {
  echo "FAILED: $1"
  docker logs "$NAME" || true
  exit 1
}

start() {
  docker run -d --name "$NAME" -p 3000:3000 -v "$VOLUME:/data" \
    -e APP_PASSWORD="$PASSWORD" "$IMAGE" >/dev/null
  for _ in $(seq 1 30); do
    if curl -fs "$URL/api/health" >/dev/null; then return 0; fi
    sleep 1
  done
  fail "the app did not start"
}

echo "Building the image..."
docker build -t "$IMAGE" .

echo "Starting it..."
start

echo "Checking the password lock..."
status=$(curl -s -o /dev/null -w '%{http_code}' "$URL/api/records")
[ "$status" = "401" ] || fail "expected 401 without the password, got $status"
status=$(curl -s -o /dev/null -w '%{http_code}' -u "me:wrong-password" "$URL/api/records")
[ "$status" = "401" ] || fail "expected 401 with a wrong password, got $status"

echo "Checking the website is delivered..."
# (Saved to a variable first: piping curl into "grep -q" can fail at random.)
page=$(curl -fs -u "me:$PASSWORD" "$URL/records/1") || fail "the website was not served"
grep -q '<div id="root">' <<<"$page" || fail "the website was not served"

echo "Creating an account..."
curl -fs -u "me:$PASSWORD" -c "$COOKIES" -H 'Content-Type: application/json' \
  -d '{"username":"smoke_tester","password":"smoke-test-account"}' "$URL/api/auth/signup" >/dev/null \
  || fail "could not create an account"

echo "Saving a record..."
curl -fs -u "me:$PASSWORD" -b "$COOKIES" -H 'Content-Type: application/json' \
  -d '{"title":"Smoke Test Album","artists":["Smoke Tester"]}' "$URL/api/records" >/dev/null \
  || fail "could not save a record"

echo "Restarting the container..."
docker restart "$NAME" >/dev/null
for _ in $(seq 1 30); do curl -fs "$URL/api/health" >/dev/null && break; sleep 1; done

echo "Checking the record survived the restart..."
records=$(curl -fs -u "me:$PASSWORD" -b "$COOKIES" "$URL/api/records") || fail "could not list records"
grep -q 'Smoke Test Album' <<<"$records" \
  || fail "the record was lost after a restart (is the data disk working?)"

echo "Checking Docker reports the app as healthy..."
for _ in $(seq 1 40); do
  health=$(docker inspect --format '{{.State.Health.Status}}' "$NAME")
  [ "$health" = "healthy" ] && break
  sleep 2
done
[ "$health" = "healthy" ] || fail "Docker health check says: $health"

echo "All Docker checks passed."
