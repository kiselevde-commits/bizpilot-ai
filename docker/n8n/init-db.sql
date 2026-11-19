-- Idempotent PostgreSQL bootstrap for the optional n8n automation profile.
--
-- Run as a PostgreSQL superuser or the database owner, connected to the
-- application database (PGDATABASE). The Docker Compose service `n8n-db-init`
-- invokes this file automatically before n8n starts.
--
-- Required psql variables:
--   app_db, n8n_db, n8n_user, n8n_password, dedupe_user, dedupe_password
--
-- The script creates:
--   * n8n_app     - owns the separate n8n database, no access to the CRM database
--   * n8n_dedupe  - can connect to the CRM database, USAGE on schema public and
--                   SELECT/INSERT/UPDATE only on n8n_processed
-- It never grants superuser, CREATEDB or CREATEROLE.

SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE',
  :'n8n_user',
  :'n8n_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'n8n_user')
\gexec

SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE',
  :'dedupe_user',
  :'dedupe_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'dedupe_user')
\gexec

SELECT format('CREATE DATABASE %I OWNER %I', :'n8n_db', :'n8n_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'n8n_db')
\gexec

-- The n8n application role must not connect to the CRM database at all.
SELECT format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', :'app_db')
\gexec

-- The n8n database is private to n8n_app.
SELECT format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', :'n8n_db')
\gexec

SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'app_db', :'dedupe_user')
\gexec

SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'n8n_db', :'n8n_user')
\gexec

SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'dedupe_user')
\gexec

-- The table is created by Prisma migrations. Grant only when it exists.
SELECT format(
  'REVOKE ALL ON TABLE public.n8n_processed FROM %I',
  :'dedupe_user'
)
WHERE EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'n8n_processed'
)
\gexec

SELECT format(
  'GRANT SELECT, INSERT, UPDATE ON TABLE public.n8n_processed TO %I',
  :'dedupe_user'
)
WHERE EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'n8n_processed'
)
\gexec
