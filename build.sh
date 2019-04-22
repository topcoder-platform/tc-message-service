#!/bin/bash
set -eo pipefail

TAG="tc-message-service:latest"
docker build -t $TAG .

# Copies "node_modules" from the created image, if necessary for caching.
docker create --name app $TAG

if [ -d node_modules ]
then
  # If "node_modules" directory already exists, we should compare
  # "package-lock.json" from the code and from the container to decide,
  # whether we need to re-cache, and thus to copy "node_modules" from
  # the Docker container.
  mv package-lock.json old-package-lock.json
  docker cp app:/usr/src/app/package-lock.json package-lock.json
 # docker cp .env app:/opt/app/
  set +eo pipefail
  UPDATE_CACHE=$(cmp package-lock.json old-package-lock.json)
  set -eo pipefail
else
  # If "node_modules" does not exist, then cache must be created.
  UPDATE_CACHE=1
fi

if [ "$UPDATE_CACHE" == 1 ]
then
  docker cp app:/usr/src/app/node_modules .
fi
