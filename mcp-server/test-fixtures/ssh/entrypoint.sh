#!/bin/sh
set -eu

# The runner mounts only a disposable public key, never its private key.
install -m 600 -o pi -g pi /run/fixture_authorized_keys /home/pi/.ssh/authorized_keys
ssh-keygen -A
exec /usr/sbin/sshd -D -e \
  -o PasswordAuthentication=no \
  -o KbdInteractiveAuthentication=no \
  -o UsePAM=no \
  -o PermitRootLogin=no
