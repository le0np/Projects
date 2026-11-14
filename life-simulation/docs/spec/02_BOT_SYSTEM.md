# DOCUMENT 02: BOT_SYSTEM.md
# BOT SYSTEM SPECIFICATION

## 1. Purpose

Bots are essential for the initial development phase.

They must be full participants in the game, not simple placeholders.

The game must be playable with:
- One human player and several bots.
- Multiple human players and bots.
- Only bots.

Bots should simulate believable human decision-making.

## 2. Bot Architecture

Use a hybrid architecture:

**Primary engine: Rule-based decision making with weighted probabilities.**

Optional future extension: LLM-based decision making.

The core game must not require an external AI API.

This ensures:
- Predictable execution.
- No external API costs.
- Fast decisions.
- Reproducible simulations.
- Easy debugging.

## 3. Bot Personality Model

Each bot receives a personality profile.

Initial personality dimensions, scored from 0 to 100:

| Attribute | Description |
|---|---|
| Empathy | Willingness to help others |
| Honesty | Preference for telling the truth |
| Selfishness | Prioritizing personal benefit |
| Ambition | Desire for success |
| Aggression | Willingness to confront others |
| Trust | Willingness to believe others |
| Impulsiveness | Tendency to act without consideration |
| Risk tolerance | Willingness to accept danger |
| Caution | Preference for safe decisions |
| Loyalty | Commitment to existing relationships |

Personality values should be generated at character creation and remain relatively stable.

## 4. Personality Archetypes

Initial archetypes:

1. The Altruist.
2. The Opportunist.
3. The Ambitious.
4. The Manipulator.
5. The Impulsive.
6. The Cautious.
7. The Skeptic.
8. The Naive.
9. The Authoritarian.
10. The Principled.

Archetypes are starting profiles, not rigid behavior scripts.

Each bot should have a unique combination of personality values.

## 5. Hidden Motives

Bots may receive private objectives.

Examples:
- Protect a friend.
- Advance their career.
- Hide a mistake.
- Avoid responsibility.
- Gain someone's trust.
- Protect their financial interests.
- Get revenge.
- Preserve a relationship.

Motives should influence decisions without completely overriding personality.

## 6. Bot Decision Engine

When a bot receives an event:

1. Read public event information.
2. Read its private information.
3. Read its relationship history.
4. Read its personality profile.
5. Read its active motives.
6. Evaluate available choices.
7. Calculate a utility score for each choice.
8. Apply controlled randomness.
9. Select an action.
10. Submit the decision to the game engine.

Suggested scoring model:

Each choice has attributes:
- Personal benefit.
- Risk.
- Moral alignment.
- Relationship impact.
- Career impact.
- Health impact.
- Compatibility with hidden motives.

The bot calculates a weighted utility score.

Example:

`utility = personalBenefit + personalityAlignment + relationshipImpact + motiveAlignment - perceivedRisk`

Weights depend on the bot's personality.

Use normalized values and configurable weights.

Add controlled randomness so bots with similar personalities do not always make identical choices.

## 7. Bot Memory

Bots must maintain memory of previous interactions.

Memory types:

**Short-term memory**
- Current event.
- Current participants.
- Current decisions.
- Current private information.

**Session memory**
- Previous encounters.
- Promises.
- Betrayals.
- Assistance received.
- Secrets discovered.
- Relationship changes.

**Persistent memory**
- Important historical relationships.
- Previous encounters with recurring characters.
- Long-term reputation.

For MVP, session memory is mandatory. Persistent memory can be introduced in a later phase.

## 8. Bot Fairness

Bots must not access information unavailable to their character.

The bot engine must receive the same information that a human player would receive.

Do not allow bots to read:
- Other players' private information.
- Hidden event conditions.
- Future events.
- Internal outcome calculations.

This is essential for realistic testing.
