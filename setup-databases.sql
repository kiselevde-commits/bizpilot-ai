-- Создание роли bizpilot (не суперпользователь)
CREATE ROLE bizpilot LOGIN PASSWORD 'PLACEHOLDER_PASSWORD';

-- Создание базы bizpilot с владельцем bizpilot
CREATE DATABASE bizpilot OWNER bizpilot ENCODING 'UTF8';

-- Создание shadow базы для Prisma migrate dev
CREATE DATABASE bizpilot_shadow OWNER bizpilot ENCODING 'UTF8';

-- Права на схему public в обеих базах
\c bizpilot
GRANT ALL ON SCHEMA public TO bizpilot;
GRANT CREATE ON SCHEMA public TO bizpilot;

\c bizpilot_shadow
GRANT ALL ON SCHEMA public TO bizpilot;
GRANT CREATE ON SCHEMA public TO bizpilot;

-- Возврат к postgres
\c postgres
