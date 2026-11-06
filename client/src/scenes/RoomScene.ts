import Phaser from "phaser";
import { ROOM_HEIGHT, ROOM_WALK_TOP, ROOM_WIDTH, keysToTarget } from "@club-kiro/shared";
import {
  decorTextureKey,
  decorTextures,
  ghostTextureKey,
  ghostTextures,
  hatTextureKey,
  hatTextures,
  FIREPLACE,
  roomSvg,
  svgUrl,
  vignetteSvg,
} from "../art";
import { face, glowTexture, groundShadow, heldDirection, moveKeys, nameTag, type MoveKeys } from "../ghostParts";
import { GHOST_HEAD_OFFSET_X } from "../art";
import { moveItem, placeItem, removeItem, type GhostView, type HauntedRoomClient, type RoomItemView } from "../net";
import { coverCamera, followMe } from "../ghostParts";

const clampToRoom = (x: number, y: number): [number, number] => [
  Phaser.Math.Clamp(x, 0, ROOM_WIDTH),
  Phaser.Math.Clamp(y, 0, ROOM_HEIGHT),
];
import { reduceMotion } from "../settings";

const SMOOTHING = 12;
const KEY_SEND_MS = 100;

interface GhostSprite {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  hat: Phaser.GameObjects.Image;
  shownHat: string;
  facing: number;
}

/** A personal haunted room. The owner can drag decorations; visitors just walk. */
export class RoomScene extends Phaser.Scene {
  private room!: HauntedRoomClient;
  private isOwner = false;
  private readonly sprites = new Map<string, GhostSprite>();
  private readonly itemSprites: Phaser.GameObjects.Image[] = [];
  private keys!: MoveKeys;
  private lastKeySend = 0;
  private wasKeyMoving = false;
  private reducedMotion = reduceMotion();

  constructor() {
    super("room");
  }

  init(data: { room: HauntedRoomClient; isOwner: boolean }) {
    this.room = data.room;
    this.isOwner = data.isOwner;
  }

  preload() {
    this.load.svg("room-bg", svgUrl(roomSvg()), { width: ROOM_WIDTH, height: ROOM_HEIGHT });
    this.load.svg("vignette", svgUrl(vignetteSvg()), { width: ROOM_WIDTH, height: ROOM_HEIGHT });
    for (const t of ghostTextures) this.load.svg(t.key, t.url, { width: 64, height: 72 });
    for (const t of hatTextures) this.load.svg(t.key, t.url, { width: 48, height: 44 });
    for (const t of decorTextures) this.load.svg(t.key, t.url, { width: 120, height: 96 });
  }

  create() {
    // Drawn 2px oversize so linear filtering never bleeds a light line along the edges.
    this.add.image(-1, -1, "room-bg").setOrigin(0, 0).setDisplaySize(ROOM_WIDTH + 2, ROOM_HEIGHT + 2);
    this.add.image(-1, -1, "vignette").setOrigin(0, 0).setDisplaySize(ROOM_WIDTH + 2, ROOM_HEIGHT + 2).setDepth(150000);
    // Firelight: a low, wide warm wash in front of the hearth, plus a small core in the opening.
    // It flickers by tiny random amounts (steady under reduced motion), not a big regular pulse.
    const key = glowTexture(this);
    const wash = this.add.image(FIREPLACE.x, FIREPLACE.y + 30, key).setTint(0xff9a4a).setAlpha(0.18).setScale(1.9, 0.7).setBlendMode(Phaser.BlendModes.ADD);
    const core = this.add.image(FIREPLACE.x, FIREPLACE.y + 4, key).setTint(0xffb35c).setAlpha(0.28).setScale(0.55).setBlendMode(Phaser.BlendModes.ADD);
    if (!this.reducedMotion) {
      this.time.addEvent({
        delay: 120,
        loop: true,
        callback: () => {
          const f = 0.9 + Math.random() * 0.2;
          wash.setAlpha(0.18 * f);
          core.setAlpha(0.28 * f);
        },
      });
    }

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.placing) this.placing.img.setPosition(...clampToRoom(pointer.worldX, pointer.worldY));
    });
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      // In place mode, this click drops the decoration right here.
      if (this.placing) {
        const [x, y] = clampToRoom(pointer.worldX, pointer.worldY);
        placeItem(this.room, this.placing.itemId, Math.round(x), Math.round(y));
        this.cancelPlacing();
        return;
      }
      // Grabbing a decoration drags it; it should not also walk the ghost there.
      if (this.input.hitTestPointer(pointer).length > 0) return;
      this.room.send("move", { x: pointer.worldX, y: pointer.worldY });
    });
    this.input.keyboard!.on("keydown-ESC", () => this.cancelPlacing());

    this.keys = moveKeys(this);
    coverCamera(this, ROOM_WIDTH, ROOM_HEIGHT);
  }

  private placing?: { img: Phaser.GameObjects.Image; itemId: string };

  /** Attach a decoration to the pointer; the next click in the room places it there. */
  startPlacing(itemId: string) {
    this.cancelPlacing();
    const p = this.input.activePointer;
    const [x, y] = clampToRoom(p.worldX || ROOM_WIDTH / 2, p.worldY || ROOM_HEIGHT / 2);
    const img = this.add.image(x, y, decorTextureKey(itemId)).setAlpha(0.75).setDepth(300000);
    this.placing = { img, itemId };
  }

  cancelPlacing() {
    this.placing?.img.destroy();
    this.placing = undefined;
  }

  update(time: number, deltaMs: number) {
    this.syncGhosts(deltaMs / 1000);
    this.syncItems();
    this.handleKeys(time);
  }

  private syncGhosts(dt: number) {
    const seen = new Set<string>();
    this.room.state.ghosts?.forEach((ghost, id) => {
      seen.add(id);
      const sprite = this.sprites.get(id) ?? this.spawnGhost(id, ghost);
      const c = sprite.container;
      const k = Math.min(1, dt * SMOOTHING);
      sprite.facing = face(sprite.body, sprite.hat, ghost.x - c.x, sprite.facing);
      c.x += (ghost.x - c.x) * k;
      c.y += (ghost.y - c.y) * k;
      c.setDepth(1000 + c.y);
      this.updateHat(sprite, ghost.hat);
    });
    for (const [id, sprite] of this.sprites) {
      if (seen.has(id)) continue;
      this.sprites.delete(id);
      sprite.container.destroy();
    }
  }

  private spawnGhost(id: string, ghost: GhostView): GhostSprite {
    const body = this.add.image(0, 0, ghostTextureKey(ghost.colour));
    const isMe = id === this.room.sessionId;
    const label = nameTag(this, ghost.name, isMe ? "#ffcf7a" : "#f4f1ff", -44, isMe);
    const hat = this.add.image(GHOST_HEAD_OFFSET_X, -30, hatTextureKey("hat-witch")).setVisible(false);
    const container = this.add.container(ghost.x, ghost.y, [groundShadow(this), body, hat, label]).setAlpha(0);
    this.tweens.add({ targets: container, alpha: 1, duration: this.reducedMotion ? 0 : 500 });
    if (!this.reducedMotion) {
      this.tweens.add({ targets: [body, hat], y: "-=6", duration: 1200, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    const sprite: GhostSprite = { container, body, hat, shownHat: "", facing: 1 };
    if (isMe) followMe(this, container);
    this.updateHat(sprite, ghost.hat);
    this.sprites.set(id, sprite);
    return sprite;
  }

  private updateHat(sprite: GhostSprite, hatId: string) {
    if (hatId === sprite.shownHat) return;
    sprite.shownHat = hatId;
    if (hatId && this.textures.exists(hatTextureKey(hatId))) {
      sprite.hat.setTexture(hatTextureKey(hatId)).setVisible(true);
    } else {
      sprite.hat.setVisible(false);
    }
  }

  /** Rebuild decoration sprites from synced state. Items change rarely, so a full rebuild is fine. */
  private syncItems() {
    const items = this.room.state.items;
    if (this.itemSprites.length === items.length && this.itemSprites.every((s, i) => this.matches(s, items[i]!))) {
      return;
    }
    for (const s of this.itemSprites) s.destroy();
    this.itemSprites.length = 0;
    items.forEach((item, index) => {
      const img = this.add.image(item.x, item.y, decorTextureKey(item.itemId)).setDepth(item.y);
      img.setData("itemId", item.itemId);
      img.setData("x", item.x);
      img.setData("y", item.y);
      if (this.isOwner) this.makeDraggable(img, index);
      this.itemSprites.push(img);
    });
  }

  private matches(sprite: Phaser.GameObjects.Image, item: RoomItemView): boolean {
    return sprite.getData("itemId") === item.itemId && sprite.getData("x") === item.x && sprite.getData("y") === item.y;
  }

  private makeDraggable(img: Phaser.GameObjects.Image, index: number) {
    img.setInteractive({ draggable: true, useHandCursor: true });
    this.input.setDraggable(img);
    img.on("drag", (_p: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      img.setPosition(...clampToRoom(dragX, dragY)); // anywhere in the room, never off its edge
    });
    img.on("dragend", () => {
      moveItem(this.room, index, Math.round(img.x), Math.round(img.y));
    });
    // Double-click removes the decoration.
    let lastDown = 0;
    img.on("pointerdown", () => {
      const now = Date.now();
      if (now - lastDown < 350) removeItem(this.room, index);
      lastDown = now;
    });
  }

  private handleKeys(time: number) {
    const { dx, dy } = heldDirection(this.keys);
    const me = this.room.state.ghosts?.get(this.room.sessionId);
    if (!me) return;
    if (dx !== 0 || dy !== 0) {
      if (time - this.lastKeySend >= KEY_SEND_MS) {
        this.room.send("move", keysToTarget({ x: me.x, y: me.y }, dx, dy, ROOM_WALK_TOP));
        this.lastKeySend = time;
      }
      this.wasKeyMoving = true;
    } else if (this.wasKeyMoving) {
      this.room.send("stop");
      this.wasKeyMoving = false;
    }
  }
}
