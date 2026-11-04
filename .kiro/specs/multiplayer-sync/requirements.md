# Multiplayer sync: requirements

Phase 1. Many players share one plaza via Colyseus.

1. A plaza room SHALL hold up to 20 ghosts.
2. IF the plaza is full, the server SHALL open a second copy and place the new player there.
3. The server SHALL own all ghost state (position, name, colour). Clients SHALL only send intents.
4. WHEN a player joins or leaves, all other clients SHALL see the ghost appear or disappear.
5. Clients SHALL interpolate other ghosts' positions so movement looks smooth.
6. After any sequence of moves, every client SHALL converge to the same state as the server.
7. Message types SHALL be defined once in `shared/`.

Done when: two browser tabs show two ghosts moving smoothly in the same plaza.
