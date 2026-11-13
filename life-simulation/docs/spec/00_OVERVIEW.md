# PROJECT: LIFE SIMULATION
## Game Development Package v1.0

> Izvorna specifikacija vlasnika projekta, preuzeta doslovno. Ovo je izvor istine za projekt.
> Pregled, uočene nedosljednosti i plan implementacije su u [`../IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md).

**Project type:** Browser-based multiplayer social life simulation  
**Genre:** Multiplayer social simulation / interactive storytelling  
**Target session duration:** 5-10 minutes  
**Initial development mode:** Bot-only simulation  
**Interaction:** Predefined choices and event-based interactions  
**Primary language:** English for code and technical identifiers; Croatian documentation can be used during development.

Documents:

1. [01_GDD.md](01_GDD.md) — Game Design Document
2. [02_BOT_SYSTEM.md](02_BOT_SYSTEM.md) — Bot System Specification
3. [03_EVENT_SYSTEM.md](03_EVENT_SYSTEM.md) — Dynamic Event Engine
4. [04_TECHNICAL_ARCHITECTURE.md](04_TECHNICAL_ARCHITECTURE.md)
5. [05_DATABASE_SCHEMA.md](05_DATABASE_SCHEMA.md)
6. [06_MVP_ROADMAP.md](06_MVP_ROADMAP.md)
7. [07_TESTING_SIMULATION.md](07_TESTING_SIMULATION.md)

---

# GLOBAL DEVELOPMENT RULES

1. Build a modular architecture.
2. Keep event content separate from game logic.
3. Keep bot logic separate from the event engine.
4. Use TypeScript throughout the application.
5. Use server-authoritative game state.
6. Do not require external AI APIs for core gameplay.
7. Do not implement free-text chat in the MVP.
8. Do not force a fixed event sequence.
9. Do not force death as a session ending.
10. Do not overengineer the initial version.
11. Write automated tests for critical game mechanics.
12. Document all important architectural decisions.

---

# FINAL ACCEPTANCE CRITERIA

The MVP is considered functionally complete when:

- A player can register and enter the lobby.
- A player can select a career.
- Matchmaking can create a session with bots.
- A session can run with bots only.
- Events are dynamically selected.
- Players receive different private information.
- Bots make personality-driven decisions.
- Choices produce immediate and delayed consequences.
- Previous events can influence future events.
- Sessions can end in different ways.
- Death is possible but not mandatory.
- Life Recap is generated.
- Complete session logs can be inspected.
- The application works in a modern desktop and mobile browser.

END OF PROJECT SPECIFICATION.
