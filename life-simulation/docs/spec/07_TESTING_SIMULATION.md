# DOCUMENT 07: TESTING_SIMULATION.md

## 1. Simulation Mode

Create a dedicated developer-only simulation mode.

It must allow:
- Starting a session with 2-8 bots.
- Selecting bot personalities.
- Selecting careers.
- Configuring session duration.
- Running multiple sessions automatically.
- Saving complete event logs.
- Replaying sessions.

## 2. Simulation Statistics

Track:

- Average session duration.
- Events per session.
- Death rate.
- Most frequent choices.
- Most frequent outcomes.
- Career performance.
- Bot personality behavior.
- Event repetition rate.
- Follow-up event activation.
- Unresolved events.
- Invalid event selections.

## 3. Automated Tests

Test:
- Every career.
- Every event.
- Every choice.
- Every possible outcome.
- Event chains.
- Conflicting consequences.
- Simultaneous decisions.
- Player disconnections.
- Bot-only sessions.
- Mixed sessions.
- Session timeouts.
- Character death.

## 4. Replay and Debugging

Every simulation should produce a chronological log.

Example:

Session: TEST-001

00:00 - Session initialized.

00:12 - Event: Coworker Needs Help.

00:18 - Bot A selected: Protect coworker.

00:19 - Bot B selected: Tell the truth.

00:20 - Event resolved.

00:21 - Relationship updated.

01:10 - Follow-up event activated.

The replay system should make it possible to reconstruct a session from recorded decisions and event versions.

## 5. Balancing Goals

Initial targets:

- Session duration: 5-10 minutes.
- No mandatory death.
- No single career dominates.
- No personality always selects the same choice.
- No event sequence is mandatory.
- Choices produce understandable consequences.
- Event chains remain logically consistent.
- Bot-only sessions are playable and coherent.

These targets should be adjusted based on simulation and human testing.
