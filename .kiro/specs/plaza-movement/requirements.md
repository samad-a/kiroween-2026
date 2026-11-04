# Plaza movement: requirements

Phase 1. A ghost floats around the haunted town square.

1. The plaza SHALL render as an SVG background with props (lanterns, a crooked clock tower, a fountain).
2. A ghost SHALL be an SVG body with a float animation, a name tag and one of 6 colours.
3. WHEN the player clicks a point in the plaza, the client SHALL send that point as a target position.
4. WHEN the player presses WASD or the arrow keys, the client SHALL send a target position in that direction.
5. The server SHALL move the ghost toward its target at a fixed speed. The client SHALL NOT set positions.
6. A ghost SHALL NEVER leave the plaza bounds, and SHALL NOT walk through solid props.
7. WHEN the player joins, they SHALL pick a name or use a random-name option. No account is needed.
8. Ghosts SHALL fade in on join.
