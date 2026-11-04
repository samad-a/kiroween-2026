import { defineRoom, defineServer } from "colyseus";
import { PLAZA_ROOM } from "@club-kiro/shared";
import { PlazaRoom } from "./PlazaRoom.js";

export function createServer() {
  return defineServer({
    rooms: {
      [PLAZA_ROOM]: defineRoom(PlazaRoom),
    },
  });
}
