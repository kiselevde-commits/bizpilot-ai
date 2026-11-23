# BizPilot AI — Phase 1 Acceptance Plan

**Версия:** 1.1
**Дата:** 2026-11-23 (прогон), 2026-11-22 (первичная процедура)
**Статус:** процедура приёмки **выполнена 2026-11-23** на физически отдельном
временном кластере PostgreSQL 16 (`127.0.0.1:55432`, БД `bizpilot_phase1_test`).
Все автоматические проверки (шаги 0–11) — PASS; фактическое доказательство в §5.0
и §9. Ручная MANAGER allow/deny проверка (см. §5, шаг 7 и §6) **не выполнялась**,
поэтому полный визуально-ролевой PASS по-прежнему не заявляется.
**Scope:** текущее CRM-ядро (Leads, Contacts, Tasks, Dashboard, AI, automation,
auth/roles, UI) до добавления коммерческого ядра. Коммерческие сущности
(Company, Quote, Order, Payment) в этот план не входят.

Документ описывает воспроизводимую процедуру и приложенный к ней фактический
результат прогона, а не общую готовность продукта. Исторические результаты из
`docs/IMPLEMENTATION_PLAN.md` и `docs/SECURITY.md` не переносятся на текущую
ревизию: ниже приведены только проверки, выполненные в прогоне 2026-11-23.

## 1. Цель и границы

Цель — получить проверяемое доказательство, что текущее дерево:

- проходит unit/typecheck/lint/build;
- применяет все миграции и seed только на отдельной одноразовой БД;
- проходит все 7 integration-файлов и все 5 E2E-спецификаций;
- сохраняет Workspace isolation, включая исторические чужие связи;
- корректно показывает Dashboard previews, порядок и tie-break, UTC-границы
  тренда;
- сохраняет рабочие Dashboard, формы, состояния UI, responsive/mobile;
- подтверждает MANAGER allow/deny пути отдельно: текущие 12 E2E MANAGER не
  покрывают (см. §5, шаг 7 и §6).

Вне scope этого документа:

- реальный n8n + Telegram runtime;
- production deployment и миграция production-данных;
- коммерческое ядро и его схема;
- аудит реальной целевой БД (выполняется отдельно и только по разрешению);
- изменение кода, тестов, конфигов, схемы, миграций, seed.

## 2. Текущие факты окружения (read-only)

Проверки ниже выполнены только чтением состояния среды; к базам данных и
сервисам документ не подключается.

| Факт                               | Значение                           | Следствие                                                             |
| ---------------------------------- | ---------------------------------- | --------------------------------------------------------------------- |
| `docker` в PATH                    | не найден                          | Compose/контейнерная приёмка локально недоступна до установки Docker  |
| `docker-compose` в PATH            | не найден                          | то же                                                                 |
| `psql` в PATH                      | не найден                          | проверки БД выполнять через `docker exec` внутри тестового контейнера |
| `postgres` в PATH                  | не найден                          | локальный сервер не администрируется этими командами                  |
| `wsl.exe`                          | доступен                           | WSL есть, но Docker не установлен                                     |
| Windows-служба `postgresql-x64-16` | существует, статус `Running`       | на машине уже есть PostgreSQL-служба с неизвестными БД и паролями     |
| `prisma/migrations` (tracked)      | 3 миграции + `migration_lock.toml` | ожидаемое число применённых миграций — 3                              |
| PostgreSQL 16 бинарники            | `F:\Program Files\PostgreSQL\16\bin` | `initdb`/`pg_ctl`/`psql`/`createdb` использованы 2026-11-23 для отдельного кластера |
| `.env`                             | существует, не читался             | значения не печатать и не использовать как тестовые                   |

**Защищённые данные.** Существующая служба `postgresql-x64-16` и её базы
считаются защищёнными данными. Нельзя подключаться к ней, определять её базы,
пароли, применять миграции, запускать seed, integration/E2E или
`scripts/audit-workspace-relations.ts` без отдельного подтверждения и
доказанной изоляции. Это не тестовая БД.

**Устаревшее утверждение.** `docs/IMPLEMENTATION_PLAN.md` содержит более старую
запись об отсутствии PostgreSQL-службы. Текущий read-only статус службы
отличается. Документ не редактируется в рамках этой задачи; расхождение
зафиксировано здесь и требует отдельного уточнения плана.

**Посторонний артефакт.** В первичной ревизии в дереве присутствовала локальная
директория `prisma/migrations/postgresql-x64-16` без `migration.sql`. В прогоне
2026-11-23 такая директория отсутствует (`Test-Path` → `False`); в
`prisma/migrations` ровно 3 tracked-миграции и `migration_lock.toml`.

**Существующий Compose — не тестовая БД.** `docker-compose.yml` использует
`postgres:16.16-alpine`, постоянный named volume `bizpilot_pgdata`, порт
`127.0.0.1:5432:5432` и значения `POSTGRES_USER`/`POSTGRES_PASSWORD`/
`POSTGRES_DB`/`DATABASE_URL` из dotenv. Это persistent dev/demo-стек, а не
одноразовая test-marked БД. Его нельзя считать безопасным тестовым окружением
без отдельной физической изоляции. Не использовать его для destructive
integration/E2E и не выполнять `docker compose down -v`.

**CI (справочно, не запускался).** `.github/workflows/ci.yml` содержит jobs
`lint`, `typecheck`, `unit`, `integration` (PostgreSQL service
`bizpilot_test`), `build`, `docker`; `.github/workflows/e2e.yml` —
`workflow_dispatch`, PostgreSQL `bizpilot_e2e_test`, migrations, seed,
Playwright Chromium, artifacts. CI использует отдельные test-имена БД и mock AI,
но workflows в этой ревизии не запускались, поэтому их результат — `NOT RUN`.

## 3. Разрешённые проверки и approval gate

### 3.1. Разрешено локально без отдельного разрешения

Только если не требуется подключение к БД, установка пакетов или изменение
файлов:

- чтение репозитория, `git status`, `git diff`, `git diff --check`,
  `git ls-files`, поиск по коду;
- `pnpm exec prettier --check` строго по новым документам;
- `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm build` — при уже
  установленных зависимостях и без направления на БД;
- `pnpm exec prisma generate` — без подключения к БД.

Даже эти команды не должны читать/печатать `.env` и секреты. `pnpm install`
не относится к безопасным по умолчанию: установка зависимостей требует
отдельного разрешения.

### 3.2. Требует отдельного явного разрешения

- установка Docker/Docker Compose/WSL-компонентов и любых зависимостей;
- создание контейнера, БД, роли или схемы;
- применение миграций (`prisma migrate deploy`, `migrate dev`, `db push`);
- seed;
- все DB integration-тесты (`pnpm test:integration`);
- все E2E-тесты (`pnpm test:e2e`) и запуск сервера с тестовой БД;
- screenshot-прогон, требующий авторизации в БД;
- read-only аудит `scripts/audit-workspace-relations.ts` на любой БД;
- реальный AI-провайдер, n8n, Telegram, платёжные провайдеры;
- удаление/остановка контейнеров, томов или тестовых данных;
- любые действия с существующей службой `postgresql-x64-16`.

### 3.3. Запрещено

- использовать dev/demo/seed/production БД для integration/E2E;
- подключаться к неизвестной локальной службе PostgreSQL;
- `docker compose down -v`, удаление `bizpilot_pgdata` или любых чужих томов;
- `prisma migrate reset`, `db push`, destructive SQL;
- печатать `.env`, URL с паролем, seed-пароль, HMAC/AI-секреты в отчёт;
- выдавать `NOT RUN` или `BLOCKED` за `PASS`.

## 4. Целевая схема изолированной тестовой БД

Тестовая БД создаётся **физически отдельно** от Compose-стека и существующей
службы. В прогоне 2026-11-23 (после явного разрешения пользователя) использован
**отдельный временный кластер PostgreSQL 16**, поднятый напрямую из установленных
бинарников, без Docker:

- кластер `initdb` в `C:\Users\kisel\AppData\Local\Temp\opencode\pg-phase1-test\data`
  (`-U bizpilot_phase1 -A trust --encoding=UTF8 --locale=C`);
- loopback-only порт `127.0.0.1:55432` (`-o "-p 55432 -h 127.0.0.1"`);
- отдельная БД `bizpilot_phase1_test`, отдельная роль `bizpilot_phase1`;
- существующая служба `postgresql-x64-16` на `5432` не затрагивалась, `.env` не
  читался;
- данные жили только в этом одноразовом кластере: после прогона он остановлен
  (`pg_ctl stop -m fast`) и удалён вместе с каталогом;
- schema-only изоляция (`?schema=test_*` в общей БД) **не** использовалась.

Пример формы URL (значение пароля подставляется эфемерно, не печатается):

```text
postgresql://bizpilot_phase1:<ephemeral>@127.0.0.1:55432/bizpilot_phase1_test?schema=public
```

Обязательные переменные окружения для прогона:

```powershell
$env:DATABASE_URL = "<phase1-test-url>"
$env:TEST_DATABASE_URL = $env:DATABASE_URL   # строки должны совпадать точно
$env:NODE_ENV = "test"
$env:SEED_ADMIN_PASSWORD = "<ephemeral-seed-password>"
$env:AUTH_SECRET = "<ephemeral-auth-secret>"
$env:AUTH_URL = "http://localhost:3000"
$env:AUTH_TRUST_HOST = "true"
$env:APP_BASE_URL = "http://localhost:3000"
$env:AI_PROVIDER = "mock"
$env:ALLOW_MOCK_AI = "true"
$env:N8N_WEBHOOK_URL = ""
$env:N8N_WEBHOOK_SECRET = ""
$env:N8N_CALLBACK_SECRET = ""
$env:TELEGRAM_BOT_TOKEN = ""
$env:TELEGRAM_CHAT_ID = ""
```

`SHADOW_DATABASE_URL` для `prisma migrate deploy` не требуется. Если Prisma CLI
потребует его, задать отдельную test-marked shadow-БД (`bizpilot_phase1_test_shadow`)
в том же контейнере; не использовать dev shadow. `prisma migrate dev` в приёмке
не запускать.

### 4.1. Что проверяет guard

`tests/helpers/test-database-guard.ts` (его вызывает
`tests/integration/helpers/enforce-test-database.ts` до импорта Prisma):

- `NODE_ENV=production` запрещён;
- обязательны `TEST_DATABASE_URL` и `DATABASE_URL`;
- строки должны совпадать **точно**;
- протокол только `postgres://`/`postgresql://`;
- host только `localhost`, `127.0.0.1`, `[::1]`, `::1`, CI-alias `postgres`;
- имя БД или schema должно содержать маркер `test`;
- имена с `dev`, `development`, `prod`, `production`, `demo`, `seed`
  отклоняются;
- сообщения об ошибке не содержат URL/пароль.

**Schema-маркер — не отдельная БД.** Guard принимает строку вида
`postgresql://.../bizpilot?schema=test_dashboard`, потому что маркер `test`
найден в имени schema. При этом `prisma migrate deploy` и `db seed` не вызывают
этот guard и работают с фактическим `DATABASE_URL`; такая строка адресует общую
БД `bizpilot`, а не отдельную test-БД. Для этого плана schema-only изоляция
запрещена: требуется отдельная БД `bizpilot_phase1_test` в выделенном
одноразовом контейнере. Guard — дополнительный барьер, не доказательство
физической изоляции.

`playwright.config.ts` дополнительно требует `TEST_DATABASE_URL`, не
переиспользует существующий сервер и запускает собственный webServer с
`DATABASE_URL=TEST_DATABASE_URL` и mock AI. Внешний сервер и `E2E_BASE_URL`
запрещены fail-closed: при заданных `E2E_BASE_URL`/`E2E_EXTERNAL_SERVER_ISOLATED`
конфигурация падает, а base URL и health URL всегда соответствуют одному
собственному серверу Playwright.

Фактическая конфигурация Playwright: webServer
`corepack pnpm dev --port 3000`, health URL `/api/ai/health`,
`reuseExistingServer: false`, env `DATABASE_URL=TEST_DATABASE_URL`,
`AI_PROVIDER=mock`, `ALLOW_MOCK_AI=true`; project `chromium`; локально retries 0,
в CI retries 2; trace/screenshot/video — `retain-on-failure`/`only-on-failure`.
Это означает, что при занятом порту 3000 прогон должен упасть, а не
подключиться к уже запущенному dev-серверу.

### 4.2. Ограничение гарантии

Guard проверяет только строки окружения. Он не связывает `DATABASE_URL` с
контейнером, который слушает порт, и не доказывает, что миграции/seed/тесты
попадут в отдельную физическую БД. `docker exec` видит БД **внутри контейнера**
и его внутренний порт; сам по себе он не доказывает соответствие host
`DATABASE_URL` этому контейнеру.

Поэтому:

- guard — дополнительный барьер, не физическая гарантия;
- schema-маркер не равен отдельной БД (см. §4.1);
- preflight §4.3 — **операторская процедура**, кодом/CLI не enforced: прямой
  `prisma migrate deploy`, `db seed`, `pnpm test:integration` или `pnpm test:e2e`
  после одного URL-guard не считается допустимым и может попасть в shared DB;
- абсолютной технической гарантии сейчас нет; прогон разрешён только при
  (а) proven preflight §4.3 **либо** (б) `verified hardening` — code hardening,
  который approved, implemented и verified безопасными tests/checks (см. §4.4);
  одного approval без implementation/verification недостаточно; если нет ни
  (а), ни (б) — `BLOCKED`;
- перед миграцией/seed/тестами обязателен preflight §4.3 либо эквивалентные
  guarded preflight/identity checks в `verified hardening`; связывание
  container ID/port mapping, фактический `DATABASE_URL` и test target;
- при любом несовпадении или неоднозначности — `BLOCKED`, не продолжать и не
  «исправлять» окружение;
- если точное связывание нельзя доказать доступными разрешёнными инструментами,
  этап остаётся `BLOCKED`.

### 4.3. Preflight связывания (перед шагами 4–7)

Preflight **выполнен 2026-11-23** для прямого (не контейнерного) кластера.
Поскольку порт не публикуется из контейнера, а сам кластер слушает
`127.0.0.1:55432`, проверяются три факта:

1. **Кластер и порт.** `pg_ctl status` подтверждает запущенный процесс именно с
   `-D <temp>\data -p 55432 -h 127.0.0.1`; порт `55432` слушает только он.
2. **Фактический `DATABASE_URL`.** Строка (без печати URL/пароля) адресует
   `127.0.0.1:55432` и БД `bizpilot_phase1_test`, а запрос через Prisma
   возвращает ожидаемые identity-поля.
3. **Test target.** `current_database = bizpilot_phase1_test`,
   `current_user = bizpilot_phase1`; schema-only/shared DB не используются.

Фактические команды прогона (без контейнеров и без вывода URL/пароля):

```powershell
& "F:\Program Files\PostgreSQL\16\bin\pg_ctl.exe" -D "<temp>\data" status
& "F:\Program Files\PostgreSQL\16\bin\psql.exe" -h 127.0.0.1 -p 55432 -U bizpilot_phase1 `
  -d bizpilot_phase1_test -tAc "SELECT current_database(), current_user, inet_server_port();"
```

Prisma-проверка выполнялась тем же identity-скриптом, что и ниже, но с ожиданием
`serverPort = 55432` (кластер слушает 55432 напрямую; внутреннего mapping нет).
Фактический вывод прогона:

```text
{"database":"bizpilot_phase1_test","user":"bizpilot_phase1","serverPort":55432}
bizpilot_phase1_test|bizpilot_phase1|55432
```

Для прямого кластера `serverPort = 55432` ожидаем и корректен; для контейнерного
варианта (`-p 127.0.0.1:55432:5432`) ожидался бы `5432`. Смешивать топологии
нельзя: проверять нужно фактическую. Preflight повторялся перед миграциями, seed,
integration, E2E и визуальным прогоном.

Связывание считается доказанным только при совпадении всех трёх фактов и
отсутствии другого публикатора порта. `docker exec`-проверки сами по себе не
заменяют этот preflight. Если соответствие host `DATABASE_URL` контейнеру
нельзя доказать без дополнительного разрешённого инструмента — оставить этап
`BLOCKED` и не продолжать. Preflight повторяется перед каждым destructive
шагом (миграции, seed, integration, E2E).

### 4.4. Approval gate: code hardening (не реализовано/не verified)

Текущая защита — **операторская процедура**, а не code-enforced инвариант.
Guard пропускает schema-only/shared DB, а Prisma CLI/seed его не вызывают;
поэтому direct run без preflight небезопасен независимо от того, что URL прошёл
guard. Для строгой enforcement нужен отдельный approval gate:

- guard отклоняет schema-only и разрешает только dedicated DB names (не
  schema-маркер в общей БД);
- migrations/seed запускаются только через guarded runner, который выполняет
  preflight/identity checks до команды;
- integration/E2E runner проверяет тот же dedicated target/container до старта;
- hardening подтверждён безопасными tests/checks, не затрагивающими
  dev/demo/seed/production; approval сам по себе не является verification;
- конкретная реализация, тесты и migration/runner changes требуют отдельного
  approval; в этом документе код не меняется.

`verified hardening` = code hardening, который **approved, implemented и
verified безопасными tests/checks**. Один approval без implementation/
verification не даёт права на прогон.

Критерий: прогон разрешён ровно при (а) proven preflight §4.3 **либо** (б)
`verified hardening`. Если нет ни (а), ни (б) — `BLOCKED`. Не заявлять, что
текущий guard уже гарантирует безопасность.

## 5. Процедура приёмки по шагам

Команды ниже — воспроизводимая процедура; в прогоне 2026-11-23 они выполнены,
результаты сведены в §5.0. Окружение каждого шага фиксировалось без секретов.

### 5.0. Фактические результаты прогона 2026-11-23 (изолированный кластер)

Окружение: временный кластер PostgreSQL 16.16 на `127.0.0.1:55432`, БД
`bizpilot_phase1_test`, пользователь `bizpilot_phase1`; `DATABASE_URL` строго
равен `TEST_DATABASE_URL`; `AI_PROVIDER=mock`, `ALLOW_MOCK_AI=true`; основная
служба `5432` и `.env` не использовались. Кластер остановлен и удалён после
прогона.

| Шаг | Команда | Результат |
| --- | --- | --- |
| 0 | `git status --short`, `git rev-parse HEAD` | baseline зафиксирован; чужие uncommitted-изменения сохранены |
| preflight | `pg_ctl status` + `psql` + Prisma identity | `bizpilot_phase1_test` / `bizpilot_phase1` / `55432` — PASS |
| 1 | `pnpm typecheck` | PASS, 0 ошибок |
| 1 | `pnpm lint` | PASS, 0 ошибок и 0 warnings |
| 1 | `pnpm test:unit` | PASS, 271 тест / 26 файлов |
| 2 | `createdb` | PASS, `public` пуста до миграций |
| 3 | guard (`TEST_DATABASE_URL` = `DATABASE_URL`) | PASS; preflight доказан |
| 4 | `pnpm prisma migrate deploy` | PASS, 3/3 миграции, `n8n_processed` создана |
| 5 | `pnpm prisma:seed` ×2 | PASS, идемпотентно: 1/3/10/20/15/2, все Lead/Task `[DEMO]` |
| 6 | `pnpm test:integration` | PASS, 49 тестов / 7 файлов (два последовательных прогона) |
| 7 | `pnpm test:e2e` | PASS, 12/12 сценариев (mock AI, собственный server Playwright) |
| 8 | `pnpm exec tsx scripts/audit-workspace-relations.ts` | PASS, 0 cross-workspace / 0 missing |
| 9 | dashboard integration + `dashboard.spec.ts` | PASS (в составе шагов 6–7) |
| 10 | Playwright visual run, 1440/1280/768/375 | PASS: 40 screenshots, 0 overflow, 0 console errors |
| 11 | `pnpm build` | PASS, 34 app routes + middleware |
| cleanup | `pg_ctl stop -m fast` + удаление temp-каталога | PASS; порт 55432 свободен |

Оговорки прогона:

- первый запуск `pnpm test:integration` (сразу после создания кластера) дал
  1 failed + 5 skipped: три параллельных `Task`-insert получили FK-ошибку, а один
  dashboard-запрос — `Can't reach database server`. Причина не воспроизвелась:
  два следующих прогона подряд — 49/49, данные после них вернулись ровно к seed;
  логи PostgreSQL не содержат `FATAL`/исчерпания соединений. Транзиентный сбой
  окружения; flaky-статус не снят, требуется наблюдение в CI.
- MANAGER allow/deny **не проверялся**: среди 12 E2E сценариев MANAGER не
  используется. Этот пункт остаётся открытым (§5 шаг 7, §6).
- visual-run выполнен в production-режиме (`pnpm start --port 3100`) на чистой
  seeded БД (privacy gate пройден: ровно 1/3/10/20/15/2).

### Шаг 0. Baseline и сохранение пользовательских изменений

```powershell
git status --short
git rev-parse HEAD
git diff --stat
```

PASS: зафиксированы текущая ветка/HEAD и список modified/untracked файлов;
рабочее дерево не очищается, не откатывается и не переупорядочивается.

FAIL: нет baseline, обнаружены незаявленные изменения в ходе приёмки.

### Шаг 1. Статические проверки (без БД)

```powershell
pnpm install --frozen-lockfile   # только если зависимости отсутствуют; approval
pnpm exec prisma generate
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm build
```

PASS:

- install завершён с frozen lockfile (если запускался);
- `prisma generate` без ошибок;
- typecheck — 0 ошибок;
- lint — 0 ошибок; предупреждения перечислены и объяснены; известное
  pre-existing предупреждение `postcss.config.mjs` не считается новым;
- unit — все тесты прошли; фактическое число файлов/тестов записано;
- build — успешно; фактическое число routes записано.

FAIL: любая ошибка, новый warning без объяснения, падение build, попытка
подключиться к БД на этом шаге.

### Шаг 2. Создание одноразовой тестовой БД (approval required)

Выполненный вариант — прямой временный кластер (Docker в окружении нет):

```powershell
& "F:\Program Files\PostgreSQL\16\bin\initdb.exe" -D "$base\data" `
  -U bizpilot_phase1 -A trust --encoding=UTF8 --locale=C
& "F:\Program Files\PostgreSQL\16\bin\pg_ctl.exe" -D "$base\data" -l "$base\pg.log" `
  -o "-p 55432 -h 127.0.0.1" start
& "F:\Program Files\PostgreSQL\16\bin\createdb.exe" -h 127.0.0.1 -p 55432 `
  -U bizpilot_phase1 bizpilot_phase1_test
```

Проверка до миграций: `current_database = bizpilot_phase1_test`,
`current_user = bizpilot_phase1`, `inet_server_port() = 55432` (кластер слушает
55432 напрямую), `public` — 0 таблиц. Контейнерный вариант ниже оставлен как
альтернатива, если появится Docker:

```powershell
docker run -d --name bizpilot-phase1-pg `
  -e POSTGRES_DB=bizpilot_phase1_test `
  -e POSTGRES_USER=bizpilot_phase1 `
  -e POSTGRES_PASSWORD="<ephemeral>" `
  -p 127.0.0.1:55432:5432 `
  postgres:16.16-alpine
```

Дождаться healthcheck:

```powershell
docker exec bizpilot-phase1-pg pg_isready -U bizpilot_phase1 -d bizpilot_phase1_test
```

Проверить контейнер и **published mapping** отдельно от внутреннего SQL:

```powershell
docker inspect --format '{{.Id}} {{.State.Running}}' bizpilot-phase1-pg
docker port bizpilot-phase1-pg 5432/tcp
docker ps --filter "publish=55432" --format '{{.ID}} {{.Names}} {{.Ports}}'
docker exec bizpilot-phase1-pg pg_isready -U bizpilot_phase1 -d bizpilot_phase1_test
docker exec bizpilot-phase1-pg psql -U bizpilot_phase1 -d bizpilot_phase1_test -c "SELECT current_database(), current_user, inet_server_addr(), inet_server_port();"
docker exec bizpilot-phase1-pg psql -U bizpilot_phase1 -d bizpilot_phase1_test -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

PASS:

- контейнер `running`, ID совпадает; published mapping — ровно
  `127.0.0.1:55432` → `5432`; порт 55432 публикует только целевой контейнер;
- внутренний SQL: `current_database = bizpilot_phase1_test`,
  `current_user = bizpilot_phase1`; `inet_server_port()` — `5432` (TCP) или
  `null` (Unix socket только для этого `docker exec`-запроса; для host
  Prisma-check `null` запрещён — см. §4.3); **не** `55432`; публичная схема
  пуста (0 таблиц) до миграций.

Внутренний SQL и `pg_isready` — проверка контейнера, а не доказательство, что
host `DATABASE_URL` ведёт именно в него. Это связывание выполняет preflight
шага 3 (§4.3); без его PASS шаг 4 не запускать.

FAIL/BLOCKED: Docker недоступен, порт занят, mapping не `127.0.0.1:55432`,
порт публикует не только целевой контейнер, имя/пользователь/внутренний порт не
совпали, в БД уже есть таблицы. Не переключаться на существующую службу или
Compose. Не удалять чужие контейнеры/тома.

### Шаг 3. Environment, guard и preflight (approval required)

```powershell
$env:DATABASE_URL = "postgresql://bizpilot_phase1:<ephemeral>@127.0.0.1:55432/bizpilot_phase1_test?schema=public"
$env:TEST_DATABASE_URL = $env:DATABASE_URL
$env:NODE_ENV = "test"
$env:SEED_ADMIN_PASSWORD = "<ephemeral>"
$env:AUTH_SECRET = "<ephemeral>"
$env:APP_BASE_URL = "http://localhost:3000"
$env:AI_PROVIDER = "mock"
$env:ALLOW_MOCK_AI = "true"

pnpm exec vitest run tests/unit/test-database-guard.test.ts
pnpm exec tsx -e "import { assertIsolatedTestDatabase } from './tests/helpers/test-database-guard.ts'; assertIsolatedTestDatabase(); console.log('guard: ok');"
```

Затем обязательно выполнить preflight §4.3: container ID/published mapping,
проверка фактического `DATABASE_URL` через Prisma и test target. Guard сам по
себе не связывает URL с контейнером и не заменяет preflight.

PASS: unit-тест guard проходит; inline-проверка печатает `guard: ok` и не
печатает URL; preflight §4.3 — PASS по всем трём фактам. Повторно выполнить
внутренний SQL из шага 2 как дополнительную проверку контейнера.

FAIL/BLOCKED: guard бросил ошибку, URL не совпал, host/маркер неверны,
preflight неоднозначен или не может быть доказан. Остановиться; не ослаблять
guard, не подменять URL «похожим» и не продолжать миграции/seed/тесты.

### Шаг 4. Миграции (approval required)

Перед командами выполнить preflight §4.3 либо `verified hardening` с guarded
runner и эквивалентными checks. Prisma CLI не вызывает guard из `tests/helpers`,
поэтому preflight/guarded checks — обязательная проверка адреса назначения.
Без proven preflight §4.3 либо `verified hardening` (approved + implemented +
verified, см. §4.4) прямой `prisma migrate deploy` запрещён; одного approval без
implementation/verification недостаточно; если нет ни одного — `BLOCKED`.

```powershell
pnpm exec prisma migrate status
pnpm exec prisma migrate deploy
pnpm exec prisma migrate status
```

Read-only проверка применённых миграций (внутри контейнера; не заменяет
preflight):

```powershell
docker exec bizpilot-phase1-pg psql -U bizpilot_phase1 -d bizpilot_phase1_test -c 'SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at;'
docker exec bizpilot-phase1-pg psql -U bizpilot_phase1 -d bizpilot_phase1_test -c "SELECT to_regclass('n8n_processed') AS n8n_processed;"
```

PASS: применены 3 tracked-миграции, `finished_at` заполнен, failed-миграций нет,
`prisma migrate status` — up to date; `n8n_processed` существует.

FAIL: drift, failed migration, подключение не к той БД. Не запускать
`migrate reset`/`db push` и не «чинить» вручную на dev/seed.

### Шаг 5. Seed (approval required)

Перед командами выполнить preflight §4.3 либо `verified hardening` с guarded
runner; seed не вызывает guard. Без proven preflight либо `verified hardening`
(approved + implemented + verified, см. §4.4) прямой `prisma db seed` запрещён;
одного approval без implementation/verification недостаточно; если нет ни
одного — `BLOCKED`.

```powershell
pnpm exec prisma db seed
pnpm exec prisma db seed   # повторный запуск для проверки идемпотентности
```

Проверить counts без вывода пароля:

```powershell
docker exec bizpilot-phase1-pg psql -U bizpilot_phase1 -d bizpilot_phase1_test -c 'SELECT (SELECT count(*) FROM "Workspace") AS workspaces, (SELECT count(*) FROM "User") AS users, (SELECT count(*) FROM "Contact") AS contacts, (SELECT count(*) FROM "Lead") AS leads, (SELECT count(*) FROM "Task") AS tasks, (SELECT count(*) FROM "Integration") AS integrations;'
```

PASS: `1 / 3 / 10 / 20 / 15 / 2`; все Lead/Task имеют префикс `[DEMO]`;
повторный seed не создаёт дублей; seed завершается ошибкой без
`SEED_ADMIN_PASSWORD`.

FAIL: другие counts, дубли, seed на неправильной БД, пароль попал в лог.

### Шаг 6. Integration-тесты: все 7 файлов (approval required)

Перед запуском выполнить preflight §4.3 либо `verified hardening` с guarded
runner и убедиться, что guard активен. Прямой `pnpm test:integration` после
одного URL-guard без proven preflight либо `verified hardening` недопустим;
одного approval без implementation/verification недостаточно; если нет ни
одного — `BLOCKED`.

```powershell
pnpm test:integration
```

Файлы и статическое число `it()` (фактическое число сверить с выводом):

| Файл                                                                  | `it()` | Что проверяет                                                                                                 |
| --------------------------------------------------------------------- | -----: | ------------------------------------------------------------------------------------------------------------- |
| `tests/integration/ai.integration.test.ts`                            |      8 | AI service Workspace isolation: analyze/generateReply/apply/history/save; provider errors; invalid JSON retry |
| `tests/integration/automation-dispatch.integration.test.ts`           |      6 | Outbox claim `FOR UPDATE SKIP LOCKED`, concurrency, lease, `nextRetryAt`, 24h limit, stale CLAIMED scope      |
| `tests/integration/dashboard-priority-tasks.integration.test.ts`      |      5 | Attention tasks: фильтры, порядок, bound, foreign Workspace, empty                                            |
| `tests/integration/dashboard-workspace-isolation.integration.test.ts` |      8 | KPI, funnel, 14-day trend, previews, foreign names, empty, demo banner, UTC boundary                          |
| `tests/integration/n8n-processed.integration.test.ts`                 |      5 | `INSERT ... ON CONFLICT DO NOTHING`, concurrent claim, stale, FAILED reclaim, no reclaim SENT/CLAIMED         |
| `tests/integration/workspace-isolation.integration.test.ts`           |      5 | Lead get/list/update/delete, Contact/Task list/get isolation                                                  |
| `tests/integration/workspace-read-isolation.integration.test.ts`      |     12 | Foreign relation filtering, delete 409, same-Workspace delete, HTTP JSON                                      |

Итого по статическому подсчёту — 49 тестов. PASS: все 7 файлов выполнены,
все тесты прошли, скипов без объяснения нет, guard активен, БД остаётся
`bizpilot_phase1_test`.

FAIL: любой fail, таймаут, подключение к dev/demo/seed, частичный cleanup,
попытка продолжить после ошибки guard.

### Шаг 7. E2E-тесты: все 5 спецификаций (approval required)

Перед запуском выполнить preflight §4.3 либо `verified hardening` с guarded
runner. Прямой `pnpm test:e2e` после одного URL-guard без proven preflight либо
`verified hardening` недопустим; одного approval без implementation/
verification недостаточно; если нет ни одного — `BLOCKED`.

```powershell
pnpm test:e2e
```

Перед запуском: `TEST_DATABASE_URL` совпадает с `DATABASE_URL`; БД seeded тем
же `SEED_ADMIN_PASSWORD`; `E2E_BASE_URL` не задан (собственный server);
`E2E_REAL_AI` не `true`; `AI_PROVIDER=mock`, `ALLOW_MOCK_AI=true`; порт 3000
свободен. Если на 3000 уже работает dev-сервер, Playwright не переиспользует его
и прогон упадёт — это ожидаемое fail-closed поведение; не обходить guard.

| Спецификация                      | Сценариев | Что автоматизировано                                                                                                  |
| --------------------------------- | --------: | --------------------------------------------------------------------------------------------------------------------- |
| `tests/e2e/auth.spec.ts`          |         4 | Неверный пароль, redirect на login, API 401 envelope, ADMIN login + меню выхода                                       |
| `tests/e2e/crm.spec.ts`           |         2 | Полный CRM flow lead → contact → task; OPERATOR create + 403 delete/automation + permissions state                    |
| `tests/e2e/ai-analysis.spec.ts`   |         1 | Mock AI analyze → explicit apply → history; контакты не сохраняются автоматически; draft не отправляется              |
| `tests/e2e/dashboard.spec.ts`     |         4 | Priority leads order/tie-break/bounded/click; attention tasks filter/order/click; 14 UTC dates; sidebar navigation    |
| `tests/e2e/ui-responsive.spec.ts` |         1 | 6 страниц × 4 viewport: нет horizontal overflow, нет console errors; trend table; mobile nav; pagination; empty state |

Итого 12 сценариев. PASS: 12/12 passed; локально retries = 0; повторный прогон
не выявляет flaky; сервер поднят Playwright с тестовой БД; artifacts
`playwright-report/` и `test-results/` сохранены.

**Пробел MANAGER (не автоматизирован).** Ни один из этих 12 сценариев не
логинится как `MANAGER`: покрыты ADMIN и OPERATOR. Текущие E2E **не**
доказывают MANAGER allow/deny пути. До общего PASS нужен отдельный manual-прогон
или proposed future test (не выдавать за уже существующий):

- MANAGER login → `/dashboard`;
- server/API: MANAGER может удалить Lead своего Workspace (delete разрешён
  `lib/auth/roles.ts`) и читать `/api/automation/events` (200), а не получать
  403 как OPERATOR;
- UI: delete-контрол доступен/разрешён; automation journal доступен;
  integration-admin controls недоступны (ADMIN-only). Если соответствующего
  endpoint/control нет, зафиксировать «не покрыто», а не PASS;
- запрещённые действия MANAGER: integration administration — не должно быть
  доступно; отсутствие 403/скрытия контроля считать FAIL.

Результат MANAGER-проверки прикладывается к evidence; без него общий PASS
недействителен.

FAIL: любой fail, console error, horizontal overflow, переиспользование
внешнего сервера, подключение не к test-БД, реальный AI-вызов.

**E2E создаёт записи и не выполняет полный cleanup.** Поэтому запускать только
на одноразовой БД. Существующий `playwright-report/index.html` не является
визуальной приёмкой и не заменяет screenshots.

### Шаг 8. Workspace isolation, включая чужие связи

Evidence: шаги 6 и 7, плюс при необходимости read-only аудит на тестовой БД
(отдельное разрешение).

PASS-критерии:

- пользователь A не читает, не перечисляет, не меняет и не удаляет записи B;
- чужие `Contact`/`User`/`Lead`/`Task` не попадают в list/get и HTTP JSON;
- to-one чужая связь возвращается как `null`, to-many — отфильтрованный массив;
- `deleteLead` с legacy Task другого Workspace возвращает общий 409 без
  частичных изменений;
- свой Lead удаляется, свои Task отвязываются;
- role checks: OPERATOR DELETE → 403, automation events/status → 403,
  permissions state в UI;
- MANAGER allow/deny: DELETE и automation events разрешены, integration-admin
  запрещён; evidence — отдельный manual/proposed test (см. шаг 7), не текущие
  12 E2E;
- отсутствие чужих имён/email/телефонов в Dashboard payload и JSON.

Полная Workspace isolation **не заявляется** для реальной целевой БД, пока не
выполнен отдельный read-only аудит и не устранены найденные cross-workspace
строки. Аудит на dev/seed/production без разрешения запрещён. Результат аудита
тестовой БД не заменяет аудит целевой БД.

### Шаг 9. Dashboard previews, порядок, tie-break, UTC trend

PASS-критерии:

- `priorityLeads`: `priority DESC, createdAt DESC, id DESC`, максимум 5,
  исключены `CONVERTED`/`REJECTED`; HIGH/URGENT; детерминированный порядок при
  одинаковых ключах;
- `attentionTasks`: `dueDate ASC, priority DESC, createdAt DESC, id DESC`,
  максимум 5; только `TODO`/`IN_PROGRESS`, `HIGH`/`URGENT`, `dueDate != null`;
  просроченные идут первыми, верхней отсечки по сроку нет;
- foreign `contact`/`assignedTo` не раскрываются (null);
- тренд: ровно 14 zero-filled buckets; start inclusive — 13 предыдущих
  UTC-дней + текущий UTC-день; end exclusive — следующая UTC-полночь;
  `make_timestamp(year, month, day, 0, 0, 0)`; без `AT TIME ZONE` и неявного
  `timestamptz`; группировка по UTC wall clock;
- границы проверены: 00:00 и 04:59 первого дня входят; 23:30 предыдущего дня
  не входит; 23:59:59.999 последнего дня входит; ровно следующая UTC-полночь
  не входит; запись другого Workspace в тот же момент не считается.

Evidence: `dashboard-priority-tasks` (5), `dashboard-workspace-isolation` (8),
`dashboard.spec.ts` (4), `ui-responsive.spec.ts` (1).

### Шаг 10. Dashboard, формы, UI, responsive/mobile

Автоматизировано Playwright:

- 6 страниц (`/dashboard`, `/leads`, `/crm`, `/tasks`, `/ai-assistant`,
  `/settings`) на 1440×900, 1280×800, 768×1024, 375×812;
- нет horizontal overflow (`scrollWidth <= clientWidth + 1`);
- нет console errors/page errors;
- trend table доступна, 14 строк, summary;
- mobile drawer открывается и содержит основные ссылки;
- pagination и filter combination на `/leads`;
- empty state и кнопка сброса фильтров.

Не автоматизировано и требует ручной проверки:

- визуальная иерархия, контраст, читаемость, плотность;
- loading/empty/error/success/disabled/permission denied во всех формах;
- понятность ошибок валидации и API;
- confirm dialogs для опасных действий;
- отсутствие «мёртвых» кнопок и фиктивных success-состояний;
- mobile-карточки таблиц, переносы, длинные значения;
- Dashboard previews и переходы в карточки/списки;
- формы create/edit Lead, Contact, Task; login; Settings.

#### 10.1. Воспроизводимая screenshot-процедура

Screenshots не коммитятся в репозиторий (`artifacts/` в `.gitignore`). В прогоне
2026-11-23 они сняты автоматически в `artifacts/visual-review/phase1/`
(40 изображений + `metrics.json`) на production-сервере `pnpm start --port 3100`
с чистой seeded БД. После разрешения:

1. Поднять **отдельный** app-сервер на тестовой БД и свободном порту, например
   `3100`, а не на dev-сервере 3000:

   ```powershell
   $env:DATABASE_URL = "<phase1-test-url>"
   $env:TEST_DATABASE_URL = $env:DATABASE_URL
   $env:SEED_ADMIN_PASSWORD = "<ephemeral>"
   $env:AUTH_SECRET = "<ephemeral>"
   $env:APP_BASE_URL = "http://127.0.0.1:3100"
   $env:AI_PROVIDER = "mock"
   $env:ALLOW_MOCK_AI = "true"
   pnpm dev --port 3100
   ```

2. Выбрать уникальный temp-путь и не перезаписывать существующий файл:

   ```powershell
   $screenshotScript = Join-Path $env:TEMP ("phase1-screenshots-{0}.ts" -f ([guid]::NewGuid().ToString("N")))
   if (Test-Path -LiteralPath $screenshotScript) {
     throw "refusing to overwrite an existing temp file: $screenshotScript"
   }
   $screenshotDir = Join-Path $env:TEMP ("bizpilot-phase1-visual-{0}" -f ([guid]::NewGuid().ToString("N")))
   if (Test-Path -LiteralPath $screenshotDir) {
     throw "refusing to overwrite an existing screenshot directory: $screenshotDir"
   }
   New-Item -ItemType Directory -Path $screenshotDir -ErrorAction Stop | Out-Null
   $screenshotScript
   $screenshotDir
   ```

   Создать Playwright-скрипт **вне репозитория только по этому новому пути**;
   фиксированное имя `%TEMP%\phase1-screenshots.ts` не использовать. Писать
   screenshots только в новый `$screenshotDir`; существующий каталог/артефакты
   не перезаписывать. Автоматическое удаление не предусмотрено; очистка —
   вручную. Скрипт:
   - открывает `http://127.0.0.1:3100/login`;
   - входит как ADMIN, OPERATOR и отдельно MANAGER для permission state;
   - проходит по страницам и viewport;
   - делает `fullPage` screenshots в `$screenshotDir`;
   - собирает console errors.

3. Проверить страницы: `/login` (без сессии), `/dashboard`, `/leads`,
   `/leads/new`, карточка Lead, `/crm`, `/crm/new`, карточка Contact, `/tasks`,
   `/tasks/new`, карточка Task, `/ai-assistant`, `/settings` (ADMIN, MANAGER и
   OPERATOR; отдельно permission state).
4. Viewports: 1440×900, 1280×800, 768×1024, 375×812.
5. Для форм дополнительно снять состояние ошибок валидации и disabled/submit;
   для удаления — confirm dialog; для AI — результат и состояние
   «Применить»/«Применено».
6. Review: Architect/User просматривают screenshots и заполняют checklist.
   Автоматические overflow/console assertions не заменяют визуальный PASS.

PASS: все обязательные страницы сняты, визуальный checklist подписан, нет
overflow/console errors, состояния читаемы и корректны, mobile работает.

FAIL: нет screenshots, снят только dashboard, использован dev/demo-сервер,
есть overflow/console errors, фиктивные success/paid-состояния, «мёртвые»
кнопки.

### Шаг 11. Production build runtime (опционально, approval required)

```powershell
pnpm build
pnpm start --port 3101
```

Проверить `GET http://127.0.0.1:3101/api/ai/health`, login и одну защищённую
страницу на тестовой БД. PASS: health 200, login работает, нет 500. Этот шаг
не заменяет E2E и не выполняется на dev/prod БД.

## 6. Матрица автоматизации

| Проверка                               | Автоматизировано     | Где                                  | Остаётся вручную                                                           |
| -------------------------------------- | -------------------- | ------------------------------------ | -------------------------------------------------------------------------- |
| Auth redirect/401/login + logout menu  | да                   | `auth.spec.ts`                       | тексты ошибок, visual                                                      |
| CRM flow lead → contact → task         | да                   | `crm.spec.ts`                        | удобство формы, валидация                                                  |
| OPERATOR 403 delete/automation         | да                   | `crm.spec.ts`                        | permission state на всех экранах                                           |
| MANAGER allow/deny                     | **нет** в текущих 12 | — (manual/proposed future test)      | да: delete/automation allow, integration deny; общий PASS требует evidence |
| AI mock analyze/apply/history          | да                   | `ai-analysis.spec.ts`                | качество результата, реальный provider                                     |
| Dashboard order/tie-break/bound        | да                   | `dashboard.spec.ts` + integration    | визуальная плотность                                                       |
| 14-day UTC trend                       | да                   | integration + `dashboard.spec.ts`    | подписи/читаемость                                                         |
| Responsive overflow/console/mobile nav | да                   | `ui-responsive.spec.ts`              | визуальный review                                                          |
| Pagination + empty state               | да                   | `ui-responsive.spec.ts`              | остальные фильтры/сортировки                                               |
| Workspace isolation                    | да                   | 3 integration-файла + AI integration | аудит целевой БД                                                           |
| Forms validation/error copy            | частично             | unit/API/E2E косвенно                | да, все формы                                                              |
| Delete confirm dialog                  | частично             | API 403/409                          | да, UI confirm                                                             |
| Settings retry UI                      | нет в текущих 12 E2E | —                                    | да, только при реальном FAILED событии                                     |
| Visual acceptance                      | нет                  | —                                    | да, screenshots + checklist                                                |
| Real n8n/Telegram                      | нет                  | —                                    | BLOCKED, вне scope                                                         |
| Docker Compose runtime                 | нет                  | CI job `docker` (не запускался)      | gated, вне core scope                                                      |

В прогоне 2026-11-23 подтверждённые строки: responsive overflow/console/mobile
nav, pagination/empty state, dashboard order/tie-break, 14-day UTC trend,
workspace isolation (7 integration-файлов + аудит 0 нарушений). Автоматический
screenshot-прогон снят (40 изображений), но **визуальный checklist пользователем
не подписан**, а MANAGER allow/deny не проверялся.

## 7. PASS/FAIL и артефакты

Общий PASS возможен только если:

1. шаги 0–10 выполнены; шаг 11 — если заявлен production runtime;
2. все обязательные проверки — PASS, без необъяснённых skip;
3. integration/E2E выполнены на доказанной одноразовой test-БД;
4. Workspace isolation evidence приложен;
5. screenshots + visual checklist подписаны;
6. нет секретов/PII в логах и артефактах;
7. `git status` показывает только ожидаемые изменения, пользовательские файлы
   не тронуты;
8. MANAGER allow/deny evidence приложен (manual или будущий отдельный test);
   текущие 12 E2E его не заменяют;
9. для каждого destructive шага либо preflight §4.3 proven, либо
   `verified hardening` с эквивалентными guarded preflight/identity checks;
   одного approval без implementation/verification недостаточно; иначе общий
   PASS невозможен;
10. для migration/seed/integration/E2E: proven preflight §4.3 **или**
    `verified hardening` (approved + implemented + verified); если нет ни
    одного — соответствующий прогон `BLOCKED`.

Общий FAIL: любой обязательный тест упал; guard обойдён; использована
dev/demo/seed/production БД; preflight неоднозначен/не выполнен; нет артефактов;
visual acceptance отсутствует; MANAGER evidence отсутствует; тест объявлен PASS
без запуска.

BLOCKED: Docker/БД недоступны, нет разрешения на gated-шаги, нет
`SEED_ADMIN_PASSWORD`/изолированной БД, preflight не может доказать связывание
host `DATABASE_URL` с контейнером, либо отсутствуют и `verified hardening`,
и proven preflight. BLOCKED не равен PASS.

Обязательные артефакты:

- `git status --short`, `git rev-parse HEAD`;
- вывод guard, preflight-проверки адреса и SQL identity БД (без URL/секретов);
- `prisma migrate status` и список миграций;
- counts seed (без пароля);
- `vitest` integration report по 7 файлам;
- `playwright-report/`, `test-results/`, junit (если CI);
- MANAGER allow/deny evidence (manual/proposed future test);
- screenshots в `%TEMP%` (не коммитить) + visual checklist;
- перечень выполненных команд и точных результатов.

## 8. Approval checklist

Разрешения на шаги 2–7, 10 и cleanup были даны пользователем 2026-11-23;
шаг 11 (`pnpm build`) разрешён и выполнен как статическая проверка. MANAGER
allow/deny и подпись visual checklist по-прежнему открыты.

Перед gated-шагами подтвердить отдельно:

- [x] разрешено создать одноразовую БД/роль в отдельном временном кластере;
- [x] разрешено применить миграции;
- [x] разрешено выполнить seed;
- [x] разрешено запустить все 7 integration-файлов;
- [x] разрешено запустить все 5 E2E-спецификаций;
- [x] preflight §4.3 proven для прямого кластера (без контейнера);
- [ ] MANAGER allow/deny проверен отдельно (manual или будущий test);
- [ ] screenshots снят автоматически; **визуальный checklist не подписан**;
- [x] подтверждено, что существующая служба `postgresql-x64-16` и её БД не
      используются;
- [x] подтверждено, что cleanup не затрагивает чужие данные (удалён только
      собственный временный кластер);
- [x] подтверждено, что реальные AI/n8n/Telegram/PSP не вызываются (mock AI).

## 9. Текущий статус

**Автоматическая часть Phase 1: PASS на изолированном кластере (2026-11-23).**
Выполнены typecheck, lint, unit (271/271), integration (49/49), E2E (12/12),
build, миграции/seed (идемпотентно 1/3/10/20/15/2), аудит связей (0
cross-workspace), автоматический visual-прогон (40 screenshots, 0 overflow,
0 console errors). Кластер `127.0.0.1:55432` остановлен и удалён; основная
служба `5432` и `.env` не затрагивались.

**Общий приёмочный PASS не заявляется**, пока:

- MANAGER allow/deny не подтверждён отдельным test/manual-прогоном;
- визуальный checklist не подписан пользователем/Architect;
- реальный n8n + Telegram runtime и Docker Compose остаются `BLOCKED`
  (нет credentials/Docker);
- первый integration-прогон дал транзиентный сбой (не воспроизвёлся; см. §5.0) —
  flaky-риск под наблюдением.

Code hardening (guard rejects schema-only, guarded migration/seed runner) не
реализован; в этом прогоне безопасность обеспечивалась proven preflight §4.3.
Исторические PASS из `docs/IMPLEMENTATION_PLAN.md`/`docs/SECURITY.md` не
переносятся.
