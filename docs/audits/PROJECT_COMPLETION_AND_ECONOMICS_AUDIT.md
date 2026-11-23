# BizPilot AI — аудит завершённости проекта и экономики разработки

**Версия:** 1.0
**Дата:** 2026-11-22
**Файл:** `docs/audits/PROJECT_COMPLETION_AND_ECONOMICS_AUDIT.md`
**Объём:** внутренний аудит проекта (только чтение, анализ и документация)

> **Исторический срез (2026-11-22).** Документ написан до выполнения приёмки
> Phase 1 (2026-11-23) и не содержит её результатов. Актуальные проверки — 271
> unit, 49 integration, 12 E2E, 40 screenshots на изолированном PostgreSQL 16
> (`127.0.0.1:55432`, БД `bizpilot_phase1_test`) — приведены в
> `docs/IMPLEMENTATION_PLAN.md` (§7.5) и `docs/PHASE_1_ACCEPTANCE_PLAN.md`.

---

## 1. Executive Summary

BizPilot AI — MVP SaaS-приложение для управления заявками (Leads), контактами
(Contacts) и задачами (Tasks) с AI-анализом и автоматизацией через n8n/Telegram.

По итогам независимого аудита текущего состояния проекта:

1. **Функциональный scope MVP в значительной части реализован и проверен** на
   локальном PostgreSQL 16, включая AI-провайер (реальный smoke), security,
   automation и UI.
2. **Общий процент готовности (взвешенная оценка) ≈ 80–83%** от согласованного
   MVP scope.
3. **За активные дни 20–21 ноября 2026 потрачено ≈ ¥10.02** (~$1.33) DeepSeek
   через OpenCode (учтённые расходы OpenCode: $1.32629115).
4. **На завершение проекта ориентировочно потребуется ≈ ¥20–40** (~$2.7–5.5) AI API
   бюджета на оставшиеся AI-ориентированные шаги; внешние блокеры (Docker,
   n8n/Telegram runtime, визуальная приёмка, деплой) требуют ресурсов, не AI.

Главный вывод: продукт **функционально драйвован и технически близок к
закрытию**, но финальная готовность к «законченному профессиональному продукту»
замедляется не кодом, а внешними зависимостями и финальной визуальной/продуктовой
приёмкой.

---

## 2. Общая готовность проекта

### 2.1. Метод оценки

Проект разделён на функциональные направления. Каждому присвоен статус:

- `DONE` — реализовано и подтверждено тестами/проверками.
- `PARTIAL` — частично реализовано.
- `NOT DONE` — отсутствует.
- `BLOCKED` — заблокировано внешней зависимостью.

### 2.2. Взвешенная готовность

Веса направлений (сумма = 100) и рассчитанные готовности:

| № | Направление | Вес | Готовность, % | Вклад в общий балл |
|---|---|---:|---:|---:|
| 1 | Auth / роли / безопасность | 10 | 90 | 9.0 |
| 2 | CRM: Leads + Contacts + Tasks + Dashboard | 25 | 88 | 22.0 |
| 3 | AI: analyze / apply / history / draft reply | 20 | 90 | 18.0 |
| 4 | Automation: outbox / HMAC / n8n / Telegram | 15 | 70 | 10.5 |
| 5 | UI/UX Redesign 1.0 | 10 | 80 | 8.0 |
| 6 | Инфраструктура / деплой / ops | 10 | 55 | 5.5 |
| 7 | Тесты / качество / процесс | 10 | 95 | 9.5 |
| | **Итого** | **100** | | **82.5** |

**Общая взвешенная готовность ≈ 82.5% ≈ 83%** по текущему рабочему дереву
(2026-11-22, включая незакоммиченные изменения визуального редизайна).

### 2.3. Три отдельных показателя (не смешваются)

| Показатель | Значение | Смысл |
|---|---:|---|
| Доля реализованного функционала | ≈ 85% | Доля MVP scope, которую код реализует (включая блокирующие внешние шаги, но не включающие несуществующее) |
| Доля протестированного функционала | ≈ 90% (из реализованного) | Доля реализованного функционала с автоматическим подтверждением (unit/integration/E2E/real AI smoke) |
| Доля готового к демонстрации клиенту | ≈ 70–75% | Доля функционала, демонстрируемого сейчас при текущем окружении |

Эти показатели выводятся из разных источников и не должны суммироваться в один
«процент готовности».

---

## 3. Подробная матрица функциональности

| # | Функциональное направление | Требование (ТЗ) | Текущее состояние | Работает? | Частично | Нет | Доказательства | Готовность |
|---|---|---|---|---|---|---|---|---|
| 1 | Auth: login/logout, роли ADMIN/MANAGER/OPERATOR | MVP auth | DONE (локальные проверки) | Да (локальный PG + E2E) | — | — | E2E auth 4/4, unit roles, middleware, auth rate limit | 100% локально |
| 2 | Workspace isolation (write/read/delete) | ТЗ 10, 24.9 | DONE (ministages 0.1/0.2, B1) | Да (unit + integration изол. схема) | — | Аудит целевой БД не запускался | 23 unit + 12 integration + 6 dashboard-isolation; `scripts/audit-workspace-relations.ts` read-only | 95% |
| 3 | Dashboard: KPI, воронка, 14-дневная динамика, previews | ТЗ 24.3, 12.5 | DONE + redesign + preview-блоки | Да (local PG, integration B1) | — | — | Dashboard isolation integration 6 тестов; SQL leads-by-day fix | 90% |
| 4 | Leads CRUD + AI entry | ТЗ 8–9, 24.1–24.9 | DONE | Да (E2E CRM/AI, integration) | — | — | E2E сценарий A/B, API smoke | 92% |
| 5 | Contacts CRUD + дубли + связи | ТЗ 8, 24.1 | DONE | Да | — | — | unit normalize, integration isolation | 90% |
| 6 | Tasks CRUD + overdue | ТЗ 8 | DONE | Да | — | — | unit task rules, E2E task creation | 90% |
| 7 | AI: analyze / apply / history / draft / health | ТЗ 3, 8.3, 24.4–24.5, 24.17 | DONE + реальный провайдер | Да (real smoke PASS 2026-11-20) | Real-AI E2E не запускался | Bundle inspection на клиенте по-прежнему не проводился явно | `pnpm test:ai` PASS, 94→222 unit, E2E mock | 90% |
| 8 | Automation: outbox / HMAC / dedupe / retry / Settings / n8n draft | ТЗ 11, 24.10–24.13 | DONE (код+тесты) / BLOCKED (runtime) | Да (unit/integration/API/UI smoke) | Workflow — draft | n8n/Telegram runtime, Docker runtime | 179→222 unit, integration outbox, `pnpm test:webhook`, CI | 70% |
| 9 | UI/UX Redesign 1.0 (Executive Glass) | — (внутренний стандарт) | DONE (визуальный слой), НЕ закоммичен | Да (typecheck/lint/build/E2E/responsive PASS) | Ожидает визуальной приёмки пользователя | Коммит финальный не выполнен | Playwright 1440/1280/768/375, screenshots в `test-results/visual-redesign` (gitignored) | 80% |
| 10 | Инфраструктура/деплой | ТЗ 15–16 | BLOCKED (Docker локально, CI docker не запускался) | — | — | Docker runtime, деплой, target-DB аудит | DEPLOYMENT/ARCHITECTURE | 55% |
| 11 | Тесты и качество | ТЗ 15, 24.19 | DONE (локальные прогоны) | Да | — | Docker/E2E-real-AI | typecheck/lint/unit/integration/E2E/build/audit/gitleaks | 95% |

Ключевые пробелы:

- **Automation runtime** — BLOCKED (нет n8n/Telegram credentials и Docker).
- **Docker runtime** — BLOCKED (Docker отсутствует локально; CI job `docker`
  создан, но не запускался).
- **Финальная визуальная приёмка** Redesign — ожидает пользователя; изменения
  находятся в working tree (не закоммичены).
- **Target-БД аудит cross-workspace связей** — read-only audit не запускался.

---

## 4. Состояние качества и тестирования

| Проверка | Команда/метод | Результат | Примечание |
|---|---|---|---|
| Typecheck | `pnpm typecheck` | PASS (0 ошибок) | 2026-11-21 |
| Lint | `pnpm lint` | PASS (0 ошибок, 1 warning postcss) | 2026-11-21 |
| Unit | `pnpm test:unit` | PASS, 222 теста / 21 файл | 2026-11-21 (AI schema/prompt/contacts, HMAC, roles, origin, rate limit, automation, API guards) |
| Integration | `pnpm test:integration` | PASS на локальном PostgreSQL; изолированные схемы | real PostgreSQL; 2026-11-21 |
| E2E | `pnpm test:e2e` | PASS, 8 сценариев (Chromium, mock AI) | auth 4, CRM 2, AI 1, responsive 1 |
| Production build | `pnpm build` | PASS, 35 routes | 2026-11-20 |
| Real AI smoke | `pnpm test:ai` | PASS (Yandex AI Studio, `aliceai-llm-flash`) | 2026-11-20; HTTP 200, Zod PASS, contacts verified |
| `pnpm audit --prod` | 2026-11-21 | PASS, 0 известных уязвимостей | zod 4.6.7, deepmerge-ts 8.0.2 |
| Secret scan gitleaks | 0 находок | PASS | 31 коммит + working tree |

Остаточные пробелы качества: реальный AI E2E (не запускался, только smoke),
Docker runtime, n8n/Telegram runtime, CI docker job, финальная визуальная приёмка.

---

## 5. Что сделано 20–21 ноября 2026

### 5.1. 20 ноября 2026 (день интенсивной фиксации)

Ключевые коммиты (рабочий день):

- `8fec27a` — **Automation Stage 4**: outbox (Lead + AutomationEvent в одной
  транзакции, lease, lazy dispatcher), HMAC, `n8n_processed`, retry, API, Settings
  UI, draft workflow, тесты.
- `c91dbcd`…`fef29a5`, `2accc9b`, `3cc5500`, `4d00b94` — AI UI: lead context, history,
  draft reply, AI health, hallucinated contacts filter, API origin allow list, task
  UI relation selects/hydration guard/filters.
- `54f0418`, `9212402`, `4fcc2a1`, `8bda36b`, `2d61178`, `a73c2c9`, `fbecec0`, `63fa33e`,
  `448e6c2`, `984035d`, `9a0fe66`, `9b7ceb0`, `e4b6215`, `b2ca785`, `0e6fed5`, `f0620ed`,
  `6682924`, `06302d4`, `89c29a1`, `821115d` — AI provider real (category/intent/priority,
  limits, contacts), build standalone, fixes (history pagination, redirect, offset,
  SQL camelCase, texts, provider no-build), error envelope, readJsonBody, Alert,
  role deletes, rate limits/origin, seed, Docker, HMAC SQL-only, docs, AI UI render,
  seed idempotent, shadow URL.
- `78b17dd` — refine CRM/dashboard/assistant views; `b652eb4` — extend e2e/integration/unit;
  `1a9d8cb` — CI workflows; `eccbf55` — docs demo/roles/security.
- `6c40e9f`, `7edc8e7` — security ministages 0.1/0.2 + B1 dashboard isolation.

### 5.2. 21 ноября 2026 (закрытие активной фазы)

- `71a5608` — docs: compact agent instructions.
- `eae9ffa` — chore(deps): zod 4.6.7, deepmerge-ts 8.0.2.

### 5.3. Незакоммиченные изменения (working tree, после HEAD)

- **Visual Redesign 1.0**: `app/globals.css`, `tailwind.config.ts`, UI-примитивы
  (`Select`, `Textarea`, `StatusBadge`, `DataPagination`), `components/ai/analysis-result.tsx`,
  layout-компоненты, все переработанные страницы (dashboard, leads, crm, tasks,
  ai-assistant, settings, forms, login). **Git commit не выполнялся** — дизайн-слой
  существует только в working tree.
- `lib/auth/callback.ts` — hardening `safeCallbackUrl` (internal path, decode passes,
  traversal).
- `tests/e2e/ui-responsive.spec.ts` — dashboard preview assertions.
- `postcss.config.mjs` — ESM `export default`.
- Новые untracked файлы: `components/layout/header-context.tsx`,
  `components/ui/{data-pagination,select,status-badge,textarea}.tsx`,
  `lib/utils/{ai-health,initials}.ts`, `tests/unit/ai-health.test.ts`,
  `tests/integration/dashboard-workspace-isolation.integration.test.ts`,
  `repomix-output.xml`.

### 5.4. Итоги двух дней (честная сводка)

- Что существовало до начала активных дней 20–21: базовый MVP (auth/CRUD/AI/automation
  на ранних этапах), часть исправлений и AI-этапов.
- Что было сделано за 20–21: финальные security-гард, расширение тестов, CI, docs,
  visual redesign, hardening, dependency-обновление.
- Что исправлено: error envelope, readJsonBody, history scope, rate limits, origin,
  role checks, dashboard SQL, AI texts/model, build standalone и др.
- Что осталось незавершённым: runtime-приёмки (Docker/n8n/Telegram), визуальная
  приёмка, деплой, финальный commit redesign.

---

## 6. Реальная стоимость разработки за эти дни

### 6.1. Подтверждённые данные OpenCode (20–21 ноября 2026)

- Sessions: 28
- Prompts: 53
- Model steps: 1 972
- Tool calls: 3 099
- Input tokens (платные модели DeepSeek): 1 972 141
- Cache read tokens: 175 104 000
- Output + reasoning tokens: 894 430
- Учтённые расходы OpenCode (DeepSeek, USD): **$1.32629115**

### 6.2. Подтверждённые данные DeepSeek (выгрузка)

| Показатель | Сумма |
|---|---:|
| Общий расход | ¥10.019189 |
| 20 ноября | ¥6.836995 |
| 21 ноября | ¥3.182194 |
| Cache hit | ¥3.713405 |
| Cache miss | ¥2.157604 |
| Output | ¥4.148180 |

### 6.3. Расчёт стоимости

- Курс: ¥10.019189 ≈ $1.32629115 → ≈ 7.55 CNY ≈ 1 USD.
- **Стоимость одного активного дня (DeepSeek, ¥ ≈ $):**
  - 20 ноября: ¥6.836995 ≈ **$0.90**
  - 21 ноября: ¥3.182194 ≈ **$0.42**
- Итого за два дня: **≈ ¥10.02 (≈ $1.33)** — совпадает с учтёнными расходами OpenCode.

### 6.4. Стоимость одного завершённого функционального результата

Определить **достоверно** невозможно: затраты OpenCode/DeepSeek распределены между
сессиями, и один функциональный результат (например, security-ministage) не
соответствует одной модели/промпт-сессии. Оценка только для сводки:

- День 20: security-гарнитуры, AI-этапы, automation — суммарно ≈ ¥6.84.
- День 21: docs/deps — ≈ ¥3.18.

### 6.5. Стоимость прироста готовности за эти два дня

Ориентировочно: прирост ≈ +6…+10 процентных пунктов готовности (security, тесты,
дизайн, docs, deps). При оценке «задача ≈ ¥1» получаем диапазон ≈ ¥6–10 за прирост.

### 6.6. Стоимость одного процента пункта прогресса

**Определить достоверно невозможно.** Стоимость — token-based, а не scope-point-based;
дизайн-слой (redesign) стоил LLM практически нуля, а AI-эпики — десятки тысяч токенов.
Показатель «¥/п.п.» не имеет смысла без декомпозиции scope на задачи.

---

## 7. Эффективность расходов

- **Общие расходы двух дней:** $1.33 (DeepSeek) — очень низкий уровень для двух
  интенсивных дней разработки (28 sessions, 53 prompts, 1972 model steps, 3099 tool calls).
- **Кэширование:** cache hit ¥3.71 против cache miss ¥2.16 — доминирующее использование
  кэша, что снижает стоимость повторных обращений к LLM.
- **Output tokens:** 894 430 — на генерацию ответов/резюме/черновиков.
- **Эффективность:** ~1.97M input tokens → 175.1M cache reads указывает на высокий cache
  hit ratio; затраты на входные токены существенно снижены за счёт кэша.

Вывод: использование AI-агентов за эти два дня было **эффективным по token/cost**,
однако общая сумма $1.33 не позволяет однозначно оценить качество/полноту работы
без учёта non-AI (дизайн, ручные проверки, инфраструктура).

---

## 8. Незавершённые задачи

| # | Задача | Сложность | Объём | Проверки | Ожидаемый AI-расход | Риск итераций |
|---|---|---|---|---|---|---|
| 1 | Docker runtime acceptance (app+postgres+compose) | Низкая | Малый | compose config/build/up/health | ≈ ¥0 | Средний (env) |
| 2 | n8n + Telegram runtime E2E (workflow draft → real) | Высокая | Большой | n8n creds, Docker | ≈ ¥0 | Высокий (credentials/EOL) |
| 3 | CI job `docker` запуск | Низкая | Малый | GitHub Actions | ≈ ¥0 | Низкий |
| 4 | Финальная визуальная приёмка Redesign + commit | Средняя | Средний | screenshots, 4 viewports | ≈ ¥0–1 | Средний (решение пользователя) |
| 5 | Деплой (VPS/production) | Средняя | Средний | deploy checks | ≈ ¥0 | Средний |
| 6 | Аудит целевой БД по cross-workspace связям | Низкая | Малый | read-only script | ≈ ¥0 | Низкий |
| 7 | Приоритизация AI-промптов/качества (при необходимости) | Высокая | Зависит | unit/integration | ≈ ¥2–10 | Средний |

---

## 9. Прогноз оставшегося бюджета

Предполагаемый **AI API бюджет** на завершение (вне инфраструктуры и человеческих
затрат):

- **Экономический сценарий** (максимум дешёвой модели для рутины): ≈ **¥5–8**.
- **Сбалансированный сценарий** (дешёвая рутина + сильная модель для сложных): ≈ **¥10–15**.
- **Качественный сценарий** (приоритет качества/безопасности/надёжности): ≈ **¥15–25**.

**Рекомендуемый ориентир:** суммарно ≈ **¥20** (~$2.7) на оставшиеся AI-ориентированные
шаги. Бюджет в юанях — оценочный, не гарантированный.

---

## 10. Три сценария завершения проекта

### Сценарий 1 — Экономный
- Дальнейшая разработка: максимально дешёвая модель (deepseek-chat) для рутины.
- Фиксируем: Docker acceptance, docs, визуальная приёмка, CI.
- Ожидаемый AI-бюджет: ≈ ¥5–8. Срок: дни.

### Сценарий 2 — Сбалансированный
- Рутина — дешёвая модель; сложные AI-промпты/безопасность — сильная.
- Фиксируем: сценарий 1 + AI-проверки качества.
- Ожидаемый AI-бюджет: ≈ ¥10–15.

### Сценарий 3 — Качественный
- Приоритет качества, безопасности, надёжности: сильные модели, дополнительные
  тесты, реальный AI E2E, полировка UX.
- Ожидаемый AI-бюджет: ≈ ¥15–25.

---

## 11. Основные риски

1. Docker/WSL2 отсутствуют — блокер runtime-приёмки и n8n-профиля.
2. n8n 1.x EOL 2026-12-31 — риск после EOL.
3. Auth.js v5 beta — риск регрессий.
4. In-memory rate limit — не работает между экземплярами.
5. JWT без revocation — ограничение.
6. Single-tenant фактически — full multi-tenancy отложена.
7. Uncommitted changes — риск потери/redeploy-непоследовательности (redesign).
8. Target-БД audit не запускался — исторические cross-workspace связи не проверены.

---

## 12. Рекомендации по дальнейшей разработке

1. Получить Docker Desktop/WSL2 или VPS — закрыть инфраструктурный блок.
2. Получить n8n/Telegram credentials — закрыть runtime E2E.
3. Провести финальную визуальную приёмку Redesign, закоммитить изменения.
4. Запустить CI job `docker`.
5. Провести read-only аудит связей на target-БД.
6. Принять решение по n8n 1.x → 2.x/3.x до EOL 2026-12-31.
7. Провести реальный AI E2E (E2E_REAL_AI) при необходимости.

---

## 13. Финальный ответ

**Сколько процентов BizPilot AI уже готово, сколько юаней мы потратили на измеренный
рабочий цикл и сколько ещё ориентировочно потребуется для получения законченного
профессионального продукта.**

- **Готовность:** ≈ **80–83%** взвешенной по MVP (расчёт: 82.5%). Из них реализовано
  ≈ 85% scope, протестировано ≈ 90% реализованного, готово к демонстрации ≈ 70–75%.
- **Затрачено на измеренный рабочий цикл (20–21.11.2026):** **≈ ¥10.02** DeepSeek
  (≈ $1.33; OpenCode-tracked $1.32629115); день 20 — ≈ ¥6.84, день 21 — ≈ ¥3.18.
- **Ориентировочно нужно на завершение:** **≈ ¥20–40** (~$2.7–5.5) AI API бюджета на
  оставшиеся шаги; внешние блокеры требуют инфраструктуры/ресурсов.

### Финальный вердикт

**BizPilot AI на ~80% готова как технически рабочий MVP.** Функциональность ядра
(auth, CRM, AI, automation code, тесты) реализована. Завершение «профессионального
продукта» блокируется внешними зависимостями и финальной приёмкой, а не отсутствием
функционала.

---

## 14. Источники, изученные при аудите

- `AGENTS.md`, `README.md`
- `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/API.md`,
  `docs/SECURITY.md`, `docs/N8N.md`, `docs/DEPLOYMENT.md`, `docs/DEMO.md`
- Git: `HEAD = eae9ffa` (2026-11-21 00:22), история коммитов, uncommitted diff
- Рабочее дерево: redesign, hardening, tests, docs
- Тесты: `tests/unit`, `tests/integration`, `tests/e2e`
- Код: `app/`, `components/`, `services/`, `lib/`
- Скрипты: `scripts/test-ai.ts`, `scripts/test-webhook.ts`, `scripts/audit-workspace-relations.ts`
- OpenCode / DeepSeek cost exports (20–21.11.2026)

## 15. Оценки с низкой достоверностью

- Абсолютный % готовности (взвешенный показатель) — оценочный, зависит от весов.
- Стоимость одного функционального результата — недостоверна (нельзя однозначно
  отнести токены к задачам).
- Стоимость одного процента прогресса — не применима.
- Оставшийся бюджет в юанях — прогноз, не гарантия.
