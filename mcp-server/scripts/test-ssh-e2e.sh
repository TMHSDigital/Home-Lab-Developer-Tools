#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
command -v docker >/dev/null || { echo 'Docker is required for the SSH fixture tests.' >&2; exit 1; }
fixture_dir=$(mktemp -d)
container_id=
cleanup() {
  if [[ -n "$container_id" ]]; then
    docker rm -f "$container_id" >/dev/null 2>&1 || true
  fi
  rm -rf "$fixture_dir"
}
trap cleanup EXIT

ssh-keygen -q -t ed25519 -N '' -f "$fixture_dir/id_ed25519"
docker build -t homelab-ssh-e2e:test test-fixtures/ssh
container_id=$(docker run --detach --rm --publish 127.0.0.1::22 \
  --mount "type=bind,source=$fixture_dir/id_ed25519.pub,target=/run/fixture_authorized_keys,readonly" \
  homelab-ssh-e2e:test)
endpoint=$(docker port "$container_id" 22/tcp)
port=${endpoint##*:}

ready=false
for attempt in {1..30}; do
  if ssh -F /dev/null -i "$fixture_dir/id_ed25519" -p "$port" \
    -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=1 -o ConnectionAttempts=1 \
    -o StrictHostKeyChecking=accept-new -o "UserKnownHostsFile=$fixture_dir/known_hosts" \
    pi@127.0.0.1 true >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  docker logs "$container_id"
  echo 'The SSH fixture did not become ready.' >&2
  exit 1
fi

# Isolate the fixture from any configured home-lab hosts or SSH agent.
HOMELAB_TEST_SSH=true HOMELAB_TEST_PI='' HOMELAB_NODES='' HOMELAB_DRY_RUN=false \
HOMELAB_PI_HOST=127.0.0.1 HOMELAB_PI_PORT="$port" HOMELAB_PI_USER=pi \
HOMELAB_PI_KEY_PATH="$fixture_dir/id_ed25519" SSH_AUTH_SOCK='' \
  npm test -- src/tools/__tests__/ssh-e2e.test.ts
