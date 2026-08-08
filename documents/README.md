---
title: MOFSL Client Onboarding Code Guide
tags:
  - client-onboarding
  - documentation
  - code-guide
---

# MOFSL Client Onboarding Code Guide

This directory explains the application as it is currently implemented. The guides use the project source code as the authority for runtime behavior and the Obsidian notes under `Projects/Client Onboarding Register` as business context.

## Reading order

1. [Architecture and request flow](01-architecture-and-request-flow.md)
2. [Backend code walkthrough](02-backend-code-walkthrough.md)
3. [Frontend code walkthrough](03-frontend-code-walkthrough.md)
4. [Status handling reference](04-status-handling-reference.md)
5. [Database and calculations](05-database-and-calculations.md)

> [!important]
> “Intended workflow” and “enforced behavior” are different. The application maps every status to a stage, but it does not currently enforce a transition graph such as Stage 1 → Stage 2 → Stage 3.

## Source map

| Area | Source |
| --- | --- |
| Browser shell | `frontend/index.html` |
| Browser styling | `frontend/styles.css` |
| Browser behavior | `frontend/app.ts` |
| Generated browser bundle | `frontend/dist/app.js` — do not edit directly |
| HTTP API | `backend/router.py` |
| Application/persistence service | `backend/services.py` |
| Pure business rules | `backend/domain.py` |
| Role policies | `backend/policies.py` |
| Server startup | `backend/server.py` |
| Database definition | `sql/schema.sql` |
| Tests | `backend/test_server.py` |

