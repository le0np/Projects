# DOCUMENT 03: EVENT_SYSTEM.md
# DYNAMIC EVENT ENGINE

## 1. Purpose

The event system is the core of the game.

It must generate different life experiences without relying on a fixed sequence of events.

The system should combine authored event templates with contextual rules and player history.

Do not generate unrestricted random stories.

Events must remain logically consistent.

## 2. Event Categories

Initial categories:

- Everyday.
- Social.
- Career.
- Relationships.
- Family.
- Financial.
- Health.
- Critical.
- Hidden.
- Consequence.

## 3. Event Structure

Every event must contain:

- Unique ID.
- Title.
- Description.
- Category.
- Required participants.
- Optional career requirements.
- Public information.
- Private information per participant.
- Activation conditions.
- Available choices.
- Resolution rules.
- Consequences.
- Possible follow-up events.
- Cooldown and repetition restrictions.

## 4. Modular Event Model

An event can combine:

Location + Relationship + Situation + Hidden Information + Choices + Consequences.

Example:

Location: Office.

Relationship: Coworker.

Situation: Coworker made a serious mistake.

Hidden information: The coworker has already blamed another employee.

Choices:
- Protect the coworker.
- Tell the truth.
- Refuse involvement.
- Negotiate a deal.

Consequences:
- Career impact.
- Relationship changes.
- Reputation changes.
- Possible follow-up events.

## 5. Dynamic Event Selection

The engine selects events based on:

- Player careers.
- Character attributes.
- Current relationships.
- Previous events.
- Existing consequences.
- Session history.
- Event compatibility.
- Event frequency limits.

Use a weighted event selection system.

Avoid selecting events that:
- Contradict previous story facts.
- Require unavailable participants.
- Repeat too frequently.
- Have already been resolved.
- Are incompatible with current player states.

## 6. Event Chains

Events can create future events.

Example:

Event 1: Player A helps Player B get a job.

Event 2: Player B receives a promotion.

Event 3: Player B becomes A's manager.

Event 4: A makes a mistake.

Event 5: B must decide whether to protect A.

The system must store causal links between events.

A consequence can be immediate or delayed.

## 7. Twists

Twists are optional event modifications.

They can:
- Reveal hidden information.
- Introduce a new participant.
- Change the meaning of an earlier decision.
- Activate an old consequence.
- Introduce a conflict.
- Create a new opportunity.

A twist should be logically connected to the current narrative.

There is no mandatory twist stage.

## 8. Event Timing

The session should last approximately 5-10 minutes.

Events should have configurable response deadlines.

The event engine should control the pacing dynamically.

Suggested starting values:
- Simple decision: 10-20 seconds.
- Multi-player decision: 15-30 seconds.
- Important decision: 20-40 seconds.

These are initial tuning parameters, not fixed rules.

Do not artificially generate unnecessary events just to fill the session duration.

## 9. Initial Event Library

Create an initial library of at least 50 authored events.

Prioritize quality and logical consequences over quantity.

Suggested initial distribution:

- 10 Everyday.
- 10 Social.
- 8 Career.
- 6 Relationships.
- 5 Financial.
- 5 Health.
- 6 Critical.

Events should support multiple outcomes and possible connections.

## 10. Event Data Format

Use structured, versioned event definitions.

Example conceptual JSON:

```json
{
  "id": "office_coworker_mistake_001",
  "category": "career",
  "title": "A Coworker Needs Help",
  "duration_seconds": 30,
  "participants": {
    "min": 2,
    "max": 3
  },
  "requirements": {
    "careers": ["employee", "manager"]
  },
  "public_description": "A coworker asks you to confirm his version of an incident.",
  "private_information": {
    "requester": "You know you made the mistake.",
    "witness": "You saw what actually happened."
  },
  "choices": [
    {
      "id": "protect",
      "label": "Protect your coworker",
      "effects": {
        "relationship": 10,
        "reputation": -5
      }
    },
    {
      "id": "truth",
      "label": "Tell the truth",
      "effects": {
        "relationship": -10,
        "reputation": 10
      }
    }
  ],
  "follow_up_events": [
    "office_promotion_001",
    "office_conflict_002"
  ]
}
```

The production schema should support more complex conditional outcomes, private choice visibility and multiple participant decisions.

## 11. Content Management

Event content must be separate from application code.

Adding a new event should not require changing the core game engine.

Include validation for:
- Missing choices.
- Invalid conditions.
- Broken follow-up references.
- Impossible participant requirements.
- Conflicting outcomes.
