#!/bin/sh
echo "Starting Budibase with CLUSTER_MODE=$CLUSTER_MODE"
if [ -z "$CLUSTER_MODE" ]; then
  echo "Running: yarn run:docker"
  yarn run:docker
else
  echo "Running: yarn run:docker:cluster"
  yarn run:docker:cluster
fi