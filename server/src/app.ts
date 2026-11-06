import { defineRoom, defineServer } from "colyseus";
import { AREAS, HAUNTED_ROOM, PLAZA_ROOM } from "@club-kiro/shared";
import { PlazaRoom } from "./PlazaRoom.js";
import { HauntedRoom } from "./HauntedRoom.js";

export function createServer() {
  return defineServer({
    rooms: {
      [PLAZA_ROOM]: defineRoom(PlazaRoom),
      // The other public areas run the same room code with their own map.
      [AREAS.lighthouse.room]: defineRoom(PlazaRoom, { area: "lighthouse" }),
      [AREAS.crypt.room]: defineRoom(PlazaRoom, { area: "crypt" }),
      [HAUNTED_ROOM]: defineRoom(HauntedRoom),
    },
  });
}
