Ran it locally using Docker (MongoDB) + npm run dev

Fixed empty cart bug in PlaceOrderScreen — commit 048e3b7

ADRs 0001–0003 (docs/adr/) were created with Claude Sonnet. ADRs 0004–0006 were created with Claude Opus.

## RAG Stack

For this exercise I used Qdrant as the vector database and BAAI/bge-m3 as the embedding model, as shown in the video. The goal was to understand the basic principle of building a RAG system rather than going deep into every detail, since time is always limited.

The most difficult part for me is that I still do not fully understand how to test a RAG system and how to debug and improve it when the retrieval quality is not good enough. The lecture mentioned some techniques like trying different models or varying the chunk size, which I found interesting. I would like to explore this topic further but need more time to practice.

## Qdrant RAG Test Queries (BAAI/bge-m3, collection: project-docs, top 3)

### Q1: Какая БД используется в proshop_mern и почему именно она?

| # | Score | Source | Section |
|---|-------|--------|---------|
| 1 | 0.6449 | best-practices.md | 1. Introduction: Why proshop_mern Is Deprecated |
| 2 | 0.6448 | architecture.md | 1. System Overview |
| 3 | 0.6349 | feature-flags-spec.md | Feature Flags in This Project |

Note: `adrs/adr-001-mongodb-vs-postgres.md` (the most relevant doc) did not appear in top 3. Likely cause: Russian query vs English docs — consider querying in English or filtering by `category: "adr"`.

---

### Q2: Какие фичи зависят от payment_stripe_v3?

| # | Score | Source | Section |
|---|-------|--------|---------|
| 1 | 0.6888 | adrs/adr-004-paypal-vs-stripe.md | Stripe |
| 2 | 0.6585 | adrs/adr-004-paypal-vs-stripe.md | Migration Path |
| 3 | 0.6222 | adrs/adr-004-paypal-vs-stripe.md | Current Assessment (April 2026) |

Note: `payment_stripe_v3` does not exist in the knowledge base. All results from the same file — expected behavior for an unknown flag. Project uses PayPal, not Stripe.

---

### Q3: Что случилось во время последнего incident с checkout?

| # | Score | Source | Section |
|---|-------|--------|---------|
| 1 | 0.6226 | runbooks/incident-response.md | Customer Communication (If >5 min downtime) |
| 2 | 0.6180 | runbooks/incident-response.md | Timeline |
| 3 | — | — | — |

Note: Query returned runbook template instead of actual incident files (`incidents/`). Fix: add `category: "incident"` filter to query.

## M3

### Search-docs MCP

Все три запроса выполнены через `search_project_docs` MCP (BAAI/bge-m3, collection: `project-docs`, top_k=5).

---

#### Q1: Какая БД используется и почему?

**Запрос:** `which database is used in proshop_mern and why was it chosen`

| # | Score | Source | Section | Фрагмент |
|---|-------|--------|---------|----------|
| 1 | 0.6171 | feature-flags-spec.md | Feature Flags in This Project | "...a full-stack e-commerce application built with MongoDB, Express, React, and Node.js..." |
| 2 | 0.6098 | architecture.md | 1. System Overview | "ProShop is a full-stack e-commerce web application built with the MERN stack (MongoDB, Express, React, Node)..." |
| 3 | 0.6067 | best-practices.md | 1. Introduction: Why proshop_mern Is Deprecated | "The original proshop_mern fork was built circa 2020–2022 with React 17..." |
| 4 | 0.5909 | adrs/adr-001-mongodb-vs-postgres.md | Context | "Before the first commit, the team needed to select a database... The two primary candidates were MongoDB and PostgreSQL. The team had more prior experience..." |
| 5 | 0.5737 | glossary.md | — | "ProShop MERN E-Commerce Glossary..." |

**Ответ:** Используется **MongoDB** (через Mongoose). Решение зафиксировано в ADR-001: команда рассматривала MongoDB и PostgreSQL, выбор пал на MongoDB из-за большего опыта команды и гибкой документной модели, хорошо подходящей для каталога товаров с переменными атрибутами и встроенными отзывами (reviews как subdocument array).

> Примечание: самый релевантный чанк — `adrs/adr-001-mongodb-vs-postgres.md` — оказался только на 4-м месте (score 0.5909). Чанки с упоминанием аббревиатуры MERN (без явного обоснования выбора) получили более высокие оценки. При следующем прогоне имеет смысл добавить фильтр `category: "adr"` или переформулировать запрос: `"ADR database decision MongoDB PostgreSQL"`.

---

#### Q2: Какие фичи зависят от payment_stripe_v3?

**Запрос:** `payment_stripe_v3 feature dependencies`

| # | Score | Source | Section | Фрагмент |
|---|-------|--------|---------|----------|
| 1 | 0.6633 | adrs/adr-004-paypal-vs-stripe.md | Migration Path | "If migrating to Stripe in the future, the changes required: 1. Install stripe (backend)..." |
| 2 | 0.6326 | features/payments.md | Зависимости | "Зависит от: PayPal SDK (Feature 1), Auth (token для PUT), Order state..." |
| 3 | 0.6105 | adrs/adr-004-paypal-vs-stripe.md | Stripe | "Stripe is now the team's preferred payment processor for new projects..." |
| 4 | 0.5906 | feature-flags-spec.md | Payments | "paypal_express_buttons — PayPal Express Checkout Buttons. Default state: Enabled (100%)..." |
| 5 | 0.5875 | features/payments.md | Зависимости | "Зависит от: Order model fields isPaid, paidAt, paymentResult..." |

**Ответ:** Флага `payment_stripe_v3` **не существует** в проекте. Проект использует PayPal, а не Stripe. Stripe упоминается только в ADR-004 как предпочтительный вариант для будущей миграции — с описанием того, что нужно будет изменить (установить `stripe` на бэкенде, `@stripe/react-stripe-js` на фронтенде, создать Payment Intent и т.д.), но эта миграция не реализована.

---

#### Q3: Что случилось во время последнего инцидента с checkout?

**Запрос:** `incident checkout what happened root cause`

| # | Score | Source | Section | Фрагмент |
|---|-------|--------|---------|----------|
| 1 | 0.6042 | runbooks/incident-response.md | Customer Communication | "...brief service interruption from 14:22 UTC to 14:32 UTC..." |
| 2 | 0.5957 | runbooks/incident-response.md | Timeline | "14:20 — Monitoring alert: Payment API returns 401 Unauthorized; 14:22 — Customer reports: Can't checkout..." |
| 3 | 0.5822 | runbooks/incident-response.md | Impact | "10 minutes of checkout failures. ~150 orders delayed. 5 social media complaints." |
| 4 | 0.5774 | incidents/i-001-paypal-double-charge.md | Summary | "A subset of orders placed via PayPal were being marked as paid twice..." |
| 5 | 0.5733 | runbooks/incident-response.md | Declare the Incident | "curl -i https://proshop-prod.herokuapp.com/health..." |

**Ответ:** Последний инцидент с checkout — **INC-2024-042 (2024-04-15)**. PayPal API начал возвращать `401 Unauthorized` из-за истёкших credentials. Checkout был недоступен 10 минут (14:22–14:32 UTC), ~150 заказов задержано (потери выручки нет — заказы повторно оформлены после восстановления). Root cause: истечение срока действия PayPal API credentials без автоматического алерта об этом заранее.

> Примечание: все 4 релевантных чанка принадлежат `runbooks/incident-response.md` (постмортем встроен в runbook), а не отдельному файлу инцидента. Для более точного поиска конкретных инцидентов стоит добавить фильтр `category: "incident"` или искать по ID: `"INC-2024-042"`.

---

### End-to-end

Задача: найти фичу `payment_stripe_v3` через search-docs MCP, проверить статус через feature-flags MCP, при необходимости перевести в Testing 25%.

---

#### Tool call 1 — search-docs MCP

**Запрос:** `payment_stripe_v3 feature purpose dependencies` (top_k=5)

| # | Score | Source | Section | Фрагмент |
|---|-------|--------|---------|----------|
| 1 | 0.6288 | adrs/adr-004-paypal-vs-stripe.md | Migration Path | "If migrating to Stripe in the future, the changes required: 1. Install stripe (backend)..." |
| 2 | 0.6125 | features/payments.md | Зависимости | "Зависит от: PayPal SDK (Feature 1), Auth (token для PUT), Order state..." |
| 3 | 0.5932 | adrs/adr-004-paypal-vs-stripe.md | Stripe | "Stripe is now the team's preferred payment processor for new projects..." |
| 4 | 0.5737 | features/payments.md | Зависимости | "Зависит от: Order model fields isPaid, paidAt, paymentResult..." |
| 5 | 0.5693 | feature-flags-spec.md | Payments | "paypal_express_buttons — PayPal Express Checkout Buttons. Default state: Enabled (100%)..." |

**Вывод:** Ни один чанк не содержит флага `payment_stripe_v3`. Docs знают о Stripe только как о плане будущей миграции (ADR-004), но не как о существующем feature flag.

---

#### Tool call 2 — feature-flags MCP: get_feature_info

**Запрос:** `get_feature_info("payment_stripe_v3")`

```json
{
  "error": "FEATURE_NOT_FOUND",
  "message": "No feature with ID 'payment_stripe_v3' exists in features.json.",
  "feature_id": "payment_stripe_v3"
}
```

Флага с таким ID не существует.

---

#### Tool call 3 — feature-flags MCP: list_features

Запрошен полный список флагов для поиска ближайшего аналога. Из 25 флагов платёжные:

| feature_id | name | status | traffic |
|---|---|---|---|
| `paypal_express_buttons` | PayPal Express Checkout Buttons | Enabled | 100% |
| `apple_pay` | Apple Pay / Web Payments API | Disabled | 0% |
| `stripe_alternative` | Stripe as Alternative Payment Processor | Testing | 5% |

Ближайший аналог — **`stripe_alternative`**.

---

#### Tool call 4 — feature-flags MCP: get_feature_info + search-docs (параллельно)

**get_feature_info("stripe_alternative"):**

```json
{
  "feature_id": "stripe_alternative",
  "name": "Stripe as Alternative Payment Processor",
  "description": "Enables the Stripe payment method option that is currently commented out in PaymentScreen.js. Adds a Stripe checkout backend route to orderController and handles webhooks for async payment confirmation. Acts as a fallback when PayPal is unavailable and provides credit card tokenization independent of PayPal.",
  "status": "Testing",
  "traffic_percentage": 5,
  "last_modified": "2026-04-05",
  "targeted_segments": ["beta_users"],
  "rollout_strategy": "canary"
}
```

**search-docs: `stripe_alternative feature flag purpose dependencies`** — не вернул специфичных чанков для этого флага; лучший результат (0.6006) — общая документация по полям feature-flags-spec.md.

---

#### Итог по условию задачи

Условие: «если в статусе Disabled и все зависимости не в Disabled → перевести в Testing, установить трафик 25%».

- `payment_stripe_v3` **не существует** — ни в feature flags, ни в документации.
- Ближайший аналог `stripe_alternative` уже находится в **Testing** (5%), не в Disabled.
- Условие перевода **не выполняется** — изменения не вносились.

---

#### Цитата из документации (зачем нужна фича)

Из `adrs/adr-004-paypal-vs-stripe.md`, секция **Stripe**:

> *"Stripe is now the team's preferred payment processor for new projects. Key advantages over PayPal: **Test mode is a faithful replica of production.** Stripe test mode uses the same code paths, same webhooks, same error codes as production."*

И из описания флага `stripe_alternative` (feature-flags MCP):

> *"Acts as a fallback when PayPal is unavailable and provides credit card tokenization independent of PayPal."*

Фича нужна как резервный платёжный метод на случай недоступности PayPal и для независимой токенизации карт — проблема, зафиксированная в INC-2024-042, когда PayPal вернул 401 и checkout был недоступен 10 минут.

---

## MCP Configuration: Wrong Location Issue

Initially placed the MCP server definitions inside `.claude/settings.json` under `mcpServers`. The servers did not appear in Claude Code and the tools were not available. After some investigation, the correct location for project-level MCP configuration in Claude Code is a separate `.mcp.json` file at the project root — not inside `.claude/settings.json`.

Moving the configuration to `.mcp.json` resolved the issue and the tools became available immediately on reconnect.
