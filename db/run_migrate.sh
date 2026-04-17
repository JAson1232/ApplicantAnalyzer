#!/bin/sh
export PGPASSWORD=$POSTGRES_PASSWORD
export PGUSER=$POSTGRES_USER
export PGDATABASE=$POSTGRES_DB
export PGHOST=127.0.0.1
psql -f /tmp/migrate.sql
