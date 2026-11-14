# DOCUMENT 05: DATABASE_SCHEMA.md

Use PostgreSQL.

Suggested entities:

## Users
- id
- username
- email
- password_hash
- created_at

## PlayerProfiles
- id
- user_id
- avatar
- statistics
- reputation
- created_at

## Careers
- id
- name
- description
- abilities
- strengths
- weaknesses

## Characters
- id
- session_id
- user_id (nullable for bots)
- career_id
- character_state
- personality
- is_bot
- status

## BotProfiles
- id
- character_id
- archetype
- personality_attributes
- hidden_motives
- decision_parameters

## Sessions
- id
- status
- started_at
- ended_at
- configuration
- current_event_id

## SessionParticipants
- id
- session_id
- character_id
- joined_at
- final_status

## Events
- id
- event_key
- version
- category
- definition
- enabled

## SessionEvents
- id
- session_id
- event_id
- event_state
- started_at
- resolved_at
- parent_event_id

## EventParticipants
- id
- session_event_id
- character_id
- private_information
- participant_status

## Decisions
- id
- session_event_id
- character_id
- selected_choice
- submitted_at

## Consequences
- id
- character_id
- source_event_id
- consequence_type
- consequence_data
- activation_condition
- created_at
- resolved_at

## Relationships
- id
- session_id
- character_a_id
- character_b_id
- relationship_type
- relationship_score
- history

## CharacterHistory
- id
- character_id
- event_type
- event_data
- created_at

## SessionResults
- id
- session_id
- character_id
- final_outcome
- score
- life_duration
- recap_data

## Database Principles

- Use UUID identifiers.
- Add indexes for frequently queried session and participant fields.
- Use transactions for decision resolution.
- Preserve historical event data.
- Keep private information separate from public session state.
- Version event definitions.
- Avoid storing unnecessary duplicate data.
- Support deterministic simulation and replay.

This schema is a logical starting point. Refine normalization, indexes, constraints and migrations during implementation.
