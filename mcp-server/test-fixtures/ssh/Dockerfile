FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssh-server sudo procps iproute2 kmod curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/sh pi \
    && usermod --password '*' pi \
    && install -d -m 700 -o pi -g pi /home/pi/.ssh \
    && mkdir -p /run/sshd /tmp/homelab-e2e \
    && printf 'SSH fixture\n' > /tmp/homelab-e2e/fixture.txt \
    && printf 'pi ALL=(ALL) NOPASSWD: /usr/bin/du\n' > /etc/sudoers.d/pi-e2e \
    && chmod 440 /etc/sudoers.d/pi-e2e \
    && rm -f /etc/ssh/ssh_host_*

COPY entrypoint.sh /usr/local/bin/ssh-fixture
EXPOSE 22
ENTRYPOINT ["sh", "/usr/local/bin/ssh-fixture"]
