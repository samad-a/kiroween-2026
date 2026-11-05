import { defineRoom, defineServer } from "colyseus";
import { HAUNTED_ROOM, PLAZA_ROOM } from "@club-kiro/shared";
import { PlazaRoom } from "./PlazaRoom.js";
import { HauntedRoom } from "./HauntedRoom.js";

export function createServer() {
  return defineServer({
    rooms: {
      [PLAZA_ROOM]: defineRoom(PlazaRoom),
      [HAUNTED_ROOM]: defineRoom(HauntedRoom),
    },
  });
}
