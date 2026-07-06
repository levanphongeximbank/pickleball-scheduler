FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY scripts/broadcast-relay.mjs ./scripts/broadcast-relay.mjs

ENV BROADCAST_RELAY_HOST=0.0.0.0
ENV BROADCAST_RELAY_PORT=8787
EXPOSE 8787

CMD ["node", "scripts/broadcast-relay.mjs"]
