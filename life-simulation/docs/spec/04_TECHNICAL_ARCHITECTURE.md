# DOCUMENT 04: TECHNICAL_ARCHITECTURE.md

## 1. Recommended Stack

Frontend:
- Next.js.
- React.
- TypeScript.

Backend:
- Node.js.
- TypeScript.
- NestJS or Fastify.

Realtime:
- Socket.IO or an equivalent WebSocket solution.

Database:
- PostgreSQL.

Optional infrastructure:
- Redis for matchmaking and distributed session coordination when scaling requires it.

Testing:
- Vitest or Jest.
- Playwright for browser testing.

## 2. Architecture Principles

Use a modular monolith for the MVP.

Do not start with microservices.

Separate the following modules:

1. Authentication.
2. Player Management.
3. Lobby.
4. Matchmaking.
5. Session Management.
6. Career System.
7. Character State.
8. Event Engine.
9. Decision Engine.
10. Consequence Engine.
11. Bot Engine.
12. Statistics.
13. Simulation and Testing.

## 3. Server-Authoritative Game Engine

The backend must control all important game logic.

The client only:
- Displays current events.
- Displays available choices.
- Sends player decisions.
- Receives updated state.

The server:
- Selects events.
- Controls timers.
- Validates choices.
- Processes bot decisions.
- Calculates outcomes.
- Updates character state.
- Stores event history.

Never trust client-side outcome calculations.

## 4. Game Session Lifecycle

Suggested states:

- WAITING.
- MATCHMAKING.
- INITIALIZING.
- ACTIVE.
- RESOLVING.
- COMPLETED.
- CANCELLED.

The server must guarantee that every decision is processed at most once.

Use transaction-safe state transitions.

## 5. Multiplayer Synchronization

Use WebSockets for:
- Lobby updates.
- Matchmaking status.
- Event notifications.
- Decision submissions.
- Event resolution.
- Session completion.

Support reconnecting players.

If a player disconnects, use a configurable timeout and default decision policy.

## 6. Bot Integration

Bots must use the same decision submission interface as human players.

The event engine must not need to know whether a decision comes from a human or bot.

This keeps gameplay consistent and makes testing easier.

## 7. Scalability

Start with a single backend deployment.

Keep session state isolated and organized by session ID.

Redis should be introduced only when necessary for distributed matchmaking or session coordination.

Avoid unnecessary infrastructure in the MVP.
