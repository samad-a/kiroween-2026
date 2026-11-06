# Graveyard Dash: requirements (approved Nov 6, with changes)

A short multiplayer race. One to four ghosts queue at a gate in the plaza, are taken to a separate race track together, and race past obstacles and boosts to the finish. Coins by finishing place.

**Decisions from review:** racers move noticeably faster than in the plaza; boost areas and blockers are the core of the fun; solo runs pay some coins, just fewer; each player has a personal best time per track; the track is picked at random from several.

## User stories and acceptance criteria

### 1. Queue at the gate
As a player, I want to join a race from the plaza without menus.
1. WHEN a ghost stands on the Dash Gate in the plaza THEN the client SHALL offer "Join the race".
2. WHEN a player joins THEN the server SHALL add them to the queue for that gate and show everyone in it the queue (names, count of 4).
3. WHEN the queue has 2 or more players THEN the server SHALL start a 10-second countdown; WHEN it reaches 4 THEN the race SHALL start at once.
4. WHEN a player walks off the gate or leaves THEN the server SHALL remove them from the queue.
5. A solo player SHALL be able to start a run at once by pressing "Race alone". Solo runs pay fewer coins.

### 2. Race on a separate track
1. WHEN a race starts THEN every queued player SHALL leave the plaza and join a new race room together.
2. The track SHALL be longer than one screen (about 4 screens wide) and the camera SHALL follow the player.
5. Each race SHALL use one of several tracks, picked at random by the server; every racer gets the same one.
6. Racers SHALL move noticeably faster than ghosts in the plaza (about 1.7x).
3. The race SHALL start with a 3-2-1 countdown during which nobody can move.
4. The server SHALL own all positions, as in the plaza (clients send direction intents only).

### 3. Obstacles and boosts
1. Tombstones SHALL block movement.
2. Mud patches SHALL halve speed while a ghost is on them.
3. Swinging crypt gates SHALL open and close on a timer and block while closed.
4. Wisps SHALL give a short speed boost (about 1.5x for 2 seconds) and respawn after a few seconds.
5. A shortcut through the crypt SHALL be faster but sit behind a gate.
6. Obstacle and boost layout SHALL be the same for everyone in a race (server-defined).

### 4. Finish and rewards
1. WHEN a ghost crosses the finish line THEN the server SHALL record their place and time.
2. The race SHALL end when everyone has finished, or 20 seconds after the first finisher, or after 3 minutes total.
3. Coins SHALL be paid by place in races of 2 or more (1st 20, 2nd 12, 3rd 8, 4th 5). A solo finish SHALL pay 5. Beating your personal best SHALL pay 5 more.
6. The server SHALL keep each player's fastest finish per track, and the results card SHALL show it and mark a new record.
4. WHEN the race ends THEN players SHALL see a results card, then return to the plaza by the gate.
5. The Caretaker SHALL announce the winner in the plaza.

### 5. Safety and fairness
1. A client SHALL NOT be able to move faster than the speed limit (plus active boost); the server SHALL clamp.
2. Leaving mid-race SHALL forfeit, with no coins.
3. Chat during the race SHALL go through the Caretaker as everywhere else.
4. Reduced motion SHALL remove screen shake and swinging animations but keep gates' open/closed state readable.

## Out of scope
- More than one track, lap counts, items you can throw at other players, spectators, leaderboards across sessions.
