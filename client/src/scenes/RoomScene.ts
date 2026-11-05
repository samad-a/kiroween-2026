import Phaser from "phaser";
import { ROOM_HEIGHT, ROOM_WIDTH, keysToTarget } from "@club-kiro/shared";
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
import { glowTexture, groundShadow, nameTag } from "../ghostParts";
import { moveItem, removeItem, type GhostView, type HauntedRoomClient, type RoomItemView } from "../net";
import { reduceMotion } from "../settings";

const SMOOTHING = 12;
const KEY_SEND_MS = 100;

interface GhostSprite {
  container: Phaser.GameObjects.Container;
  hat: Phaser.GameObjects.Image;
  shownHat: string;
}

/** A personal haunted room. The owner can drag decorations; visitors just walk. */
export class RoomScene extends Phaser.Scene {
  private room!: HauntedRoomClient;
  private isOwner = false;
  private readonly sprites = new Map<string, GhostSprite>();
  private readonly itemSprites: Phaser.GameObjects.Image[] = [];
  private keys!: Record<"up" | "down" | "left" | "right" | "w" | "a" | "s" | "d", Phaser.Input.Keyboard.Key>;
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
    this.add.image(0, 0, "room-bg").setOrigin(0, 0);
    this.add.image(0, 0, "vignette").setOrigin(0, 0).setDepth(150000);
    // Firelight that flickers gently (steady under reduced motion).
    const fire = this.add
      .image(FIREPLACE.x, FIREPLACE.y, glowTexture(this))
      .setTint(0xff9a3c)
      .setAlpha(0.45)
      .setScale(2.6)
      .setBlendMode(Phaser.BlendModes.ADD);
    if (!this.reducedMotion) {
      this.tweens.add({ targets: fire, alpha: { from: 0.32, to: 0.55 }, scale: { from: 2.5, to: 2.75 }, duration: 380, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const el = document.elementFromPoint(pointer.x, pointer.y);
      if (el && el.closest("#chat, #room-editor, #hud")) return;
      this.room.send("move", { x: pointer.worldX, y: pointer.worldY });
    });

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: kb.addKey(K.UP), down: kb.addKey(K.DOWN), left: kb.addKey(K.LEFT), right: kb.addKey(K.RIGHT),
      w: kb.addKey(K.W), a: kb.addKey(K.A), s: kb.addKey(K.S), d: kb.addKey(K.D),
    };
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
    const hat = this.add.image(0, -30, hatTextureKey("hat-witch")).setVisible(false);
    const container = this.add.container(ghost.x, ghost.y, [groundShadow(this), body, hat, label]).setAlpha(0);
    this.tweens.add({ targets: container, alpha: 1, duration: this.reducedMotion ? 0 : 500 });
    if (!this.reducedMotion) {
      this.tweens.add({ targets: [body, hat], y: "-=6", duration: 1200, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    const sprite: GhostSprite = { container, hat, shownHat: "" };
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
      img.setPosition(dragX, dragY);
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
    const k = this.keys;
    const dx = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    const dy = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
    const me = this.room.state.ghosts?.get(this.room.sessionId);
    if (!me) return;
    if (dx !== 0 || dy !== 0) {
      if (time - this.lastKeySend >= KEY_SEND_MS) {
        this.room.send("move", keysToTarget({ x: me.x, y: me.y }, dx, dy));
        this.lastKeySend = time;
      }
      this.wasKeyMoving = true;
    } else if (this.wasKeyMoving) {
      this.room.send("move", { x: me.x, y: me.y });
      this.wasKeyMoving = false;
    }
  }
}
