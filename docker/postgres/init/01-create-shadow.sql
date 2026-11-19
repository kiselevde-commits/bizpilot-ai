-- Creates the dedicated Prisma shadow database used for local migrations.
-- Runs only when the Postgres data volume is initialized for the first time.
-- Keep the name in sync with SHADOW_DATABASE_URL in .env.example / .env.docker.example.
CREATE DATABASE bizpilot_shadow;
