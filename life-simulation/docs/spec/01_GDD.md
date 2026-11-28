# DOCUMENT 01: GDD.md
# GAME DESIGN DOCUMENT

## 1. Game Vision

The game is a short-session multiplayer life simulation in which players experience everyday life situations, interact with other players through predefined choices, and influence each other's lives.

Each player starts by selecting a career.

Players are then matched into a shared game session where they encounter different people and situations.

The game focuses on:
- Everyday human interactions.
- Social relationships.
- Career and personal decisions.
- Hidden information and secrets.
- Unexpected situations.
- Moral dilemmas.
- Cooperation and betrayal.
- Long-term consequences of seemingly insignificant decisions.

Death is possible but is not the primary objective or mandatory ending.

The central gameplay principle:

**Your life is shaped not only by your decisions, but also by decisions other people make about you.**

## 2. Core Design Principles

1. Every session should feel different.
2. Player decisions must have meaningful consequences.
3. Other players must be able to influence your character's life.
4. Everyday situations should be the foundation of gameplay.
5. Dramatic events should emerge naturally, not appear as mandatory scripted twists.
6. Characters should remember previous interactions.
7. Sessions should be short and engaging.
8. Bot players must be capable of participating without human supervision.
9. The game should remain interesting even when all participants are bots.
10. The game must not depend on a large online population to function.

## 3. Game Session

Target duration: 5-10 minutes.

Initial recommended configuration:
- 4-8 participants per session.
- Human players and bots can participate together.
- Bots fill empty player slots.
- Each player selects a career.
- Events are dynamically selected based on player context.
- The number of events is variable.
- There is no mandatory event sequence.

A session is a compressed life experience rather than a traditional survival match.

The game can end because:
- The session reaches its time limit.
- A predefined narrative condition is reached.
- A critical event resolves the current story.
- All remaining active characters reach an ending condition.

Individual players can die before the session ends. Their story is recorded and they can view the rest of the session in spectator mode.

Do not force every session to end with death.

## 4. Lobby

The lobby is the central meeting place before a session.

Features:
- Player profile.
- Avatar.
- Selected career.
- Player statistics.
- Previous life summaries.
- Find Match button.
- Matchmaking status.
- Online player count.

The lobby should support matchmaking with both human players and bots.

When the human player population is low, bots should fill the available slots.

The system should support fully automated bot-only sessions.

## 5. Career System

Careers influence available choices, knowledge and capabilities.

Initial careers:

| Career | Main abilities |
|---|---|
| Doctor | Medical knowledge and diagnosis |
| Police Officer | Conflict management and security |
| Engineer | Technical problem solving |
| Teacher | Communication and mentoring |
| Mechanic | Vehicles and machinery |
| Lawyer | Legal knowledge and negotiation |
| Psychologist | Emotional intelligence |
| Journalist | Information gathering |
| Entrepreneur | Business and financial decisions |
| Civilian | General-purpose choices |

Each career should have:
- Two or three passive abilities.
- One or two special choices.
- Specific event compatibility.
- Strengths and weaknesses.

No career should be universally superior.

Careers should create interesting dependencies between players.

Example:

A doctor can recognize symptoms that other players cannot interpret. An engineer can repair equipment that a doctor cannot. A lawyer can recognize legal consequences that other characters might overlook.

## 6. Character Attributes

Each character has a collection of attributes.

Suggested attributes:

- Health.
- Mental condition.
- Financial status.
- Reputation.
- Career status.
- Relationships.
- Trust.
- Stress.

Attributes should only be implemented when they contribute to gameplay.

Avoid unnecessary simulation complexity.

## 7. Player Relationships

The system tracks relationships between players.

Possible relationship types:
- Stranger.
- Acquaintance.
- Friend.
- Colleague.
- Partner.
- Family member.
- Rival.
- Enemy.

Relationships can change through decisions.

Players should remember previous interactions.

Example:

Player A helps Player B find a job.

Later, Player B becomes Player A's manager.

Player B can choose to reward A, ignore A or retaliate against A.

This relationship history should influence future event generation.

## 8. Player Interaction

There is no free-text chat in the initial game version.

All interaction happens through predefined choices.

Choices should represent different attitudes and strategies:
- Help.
- Refuse.
- Negotiate.
- Lie.
- Tell the truth.
- Ignore.
- Threaten.
- Apologize.
- Take responsibility.
- Avoid responsibility.
- Take a risk.
- Sacrifice something.

The available choices depend on the event, career, character attributes and private information.

Players should not always know the consequences of their choices.

## 9. Session Endings

Possible outcomes include:

- Survived.
- Successful career advancement.
- Financial success or failure.
- Relationship success or failure.
- Illness.
- Injury.
- Legal consequences.
- Imprisonment.
- Death.
- Saving another player.
- Personal sacrifice.

Death should be meaningful, not random punishment.

After each session, show a Life Recap containing:
- Session duration.
- Number of events.
- Important decisions.
- Relationships created or lost.
- Important consequences.
- Other players who influenced the character.
- Final outcome.

## 10. Replayability

Replayability must come from:
- Different combinations of careers.
- Different player personalities.
- Hidden information.
- Variable event selection.
- Relationship history.
- Delayed consequences.
- Different event outcomes.
- Different combinations of players.

Avoid repeating the same fixed narrative structure.
