import Phaser from "phaser";
import { MESSAGE, OBSTACLES, PLAZA_HEIGHT, PLAZA_WIDTH, keysToTarget } from "@club-kiro/shared";
import {
  LANTERNS,
  SEANCE_CANDLES,
  caretakerSvg,
  ghostTextureKey,
  ghostTextures,
  hatTextureKey,
  hatTextures,
  plazaSvg,
  svgUrl,
  vignetteSvg,
} from "../art";
import { Bubble, coverCamera, face, followMe, glowTexture, groundShadow, heldDirection, moveKeys, nameTag, type MoveKeys } from "../ghostParts";
import { GHOST_HEAD_OFFSET_X } from "../art";
import { sendMove, type GhostView, type PlazaRoom } from "../net";
import { reduceMotion } from "../settings";

/** How quickly a rendered ghost catches up to its synced position (per second). */
const SMOOTHING = 12;
/** Minimum gap between keyboard move messages. */
const KEY_SEND_MS = 100;

const FOUNTAIN = OBSTACLES[0]!;
const FOUNTAIN_X = FOUNTAIN.x + FOUNTAIN.width / 2;
const FOUNTAIN_Y = FOUNTAIN.y + FOUNTAIN.height / 2;

/** Friendly tips the Caretaker offers now and then. Purely client-side flavour. */
const CARETAKER_TIPS = [
  "Float to the fountain to fish for coins, little one.",
  "Click another ghost to drop in on their room.",
  "The shop has hats. A ghost should look their best.",
  "Kind words keep the lanterns bright.",
];
const TIP_EVERY_MS = 40_000;
/** Long enough to read: a base plus time per word. */
const bubbleMs = (text: string) => 3000 + text.split(/\s+/).length * 300;

interface GhostSprite {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  hat: Phaser.GameObjects.Image;
  shownHat: string;
  bubble: Bubble;
  shownBubble: string;
  facing: number;
}

export class PlazaScene extends Phaser.Scene {
  private room!: PlazaRoom;
  private readonly sprites = new Map<string, GhostSprite>();
  private keys!: MoveKeys;
  private lastKeySend = 0;
  private wasKeyMoving = false;
  private reducedMotion = reduceMotion();
  private hauntingOverlay!: Phaser.GameObjects.Rectangle;
  private hauntingGlows: Phaser.GameObjects.Image[] = [];
  private onVisit?: (ownerPlayerId: number, name: string) => void;
  private caretaker!: Phaser.GameObjects.Container;
  private caretakerBody!: Phaser.GameObjects.Image;
  private caretakerBubble!: Bubble;
  private caretakerAngle = 0.6;
  private bubbleTimer?: Phaser.Time.TimerEvent;
  private greeted = false;
  private wasHaunting = false;

  constructor() {
    super("plaza");
  }

  private onTalk?: () => void;

  init(data: { room: PlazaRoom; onVisit?: (ownerPlayerId: number, name: string) => void; onTalk?: () => void }) {
    this.room = data.room;
    this.onVisit = data.onVisit;
    this.onTalk = data.onTalk;
  }

  preload() {
    this.load.svg("plaza", svgUrl(plazaSvg()), { width: PLAZA_WIDTH, height: PLAZA_HEIGHT });
    this.load.svg("vignette", svgUrl(vignetteSvg()), { width: PLAZA_WIDTH, height: PLAZA_HEIGHT });
    this.load.svg("caretaker", svgUrl(caretakerSvg()), { width: 104, height: 112 });
    for (const t of ghostTextures) this.load.svg(t.key, t.url, { width: 64, height: 72 });
    for (const t of hatTextures) this.load.svg(t.key, t.url, { width: 48, height: 44 });
  }

  create() {
    // Drawn 2px oversize so linear filtering never bleeds a light line along the edges.
    this.add.image(-1, -1, "plaza").setOrigin(0, 0).setDisplaySize(PLAZA_WIDTH + 2, PLAZA_HEIGHT + 2);
    this.addLanternGlows();
    this.addAmbience();
    this.addCaretaker();
    this.add.image(-1, -1, "vignette").setOrigin(0, 0).setDisplaySize(PLAZA_WIDTH + 2, PLAZA_HEIGHT + 2).setDepth(150000);
    this.addHauntingOverlay();

    // Ignore plaza clicks that start on a DOM overlay (e.g. the chat input),
    // or on another ghost (that click offers a room visit instead of walking).
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const el = document.elementFromPoint(pointer.x, pointer.y);
      if (el && el.closest("#dock, #hud, #room-controls, .dialog")) return;
      if (this.input.hitTestPointer(pointer).length > 0) return; // clicked a ghost
      sendMove(this.room, { x: pointer.worldX, y: pointer.worldY });
    });

    this.keys = moveKeys(this);
    coverCamera(this, PLAZA_WIDTH, PLAZA_HEIGHT);

    this.time.addEvent({
      delay: TIP_EVERY_MS,
      loop: true,
      // No unprompted tips mid-conversation.
      callback: () => !this.caretakerTalking && this.caretakerSay(Phaser.Utils.Array.GetRandom(CARETAKER_TIPS)),
    });

    this.room.onLeave(() => this.scene.pause());
  }

  update(time: number, deltaMs: number) {
    this.syncSprites(deltaMs / 1000);
    this.handleKeys(time);
    this.syncHaunting();
    this.driftCaretaker(deltaMs / 1000);
  }

  // --- The Caretaker: a visible, client-side NPC that greets and gives tips ---

  private addCaretaker() {
    const glow = this.add.image(0, 0, glowTexture(this)).setTint(0x7fe0c8).setAlpha(0.18).setScale(0.8).setBlendMode(Phaser.BlendModes.ADD);
    const body = this.add.image(0, 0, "caretaker");
    this.caretakerBody = body;
    // Click the Caretaker to talk. Being interactive also stops the click walking you there.
    body.setInteractive({ useHandCursor: true });
    body.on("pointerup", () => this.onTalk?.());
    const tag = nameTag(this, "The Caretaker", "#7fe0c8", -60, true);
    this.caretakerBubble = new Bubble(this, -78);
    this.caretaker = this.add.container(0, 0, [groundShadow(this, 58, 56), glow, body, tag, this.caretakerBubble.container]);
    this.placeCaretaker();
    if (!this.reducedMotion) {
      this.tweens.add({ targets: [body, glow], y: "-=8", duration: 1800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  }

  /** A slow loop around the fountain; stays put under reduced motion. */
  private placeCaretaker() {
    const a = this.caretakerAngle;
    this.caretaker.setPosition(FOUNTAIN_X + Math.cos(a) * 330, FOUNTAIN_Y + 40 + Math.sin(a) * 180);
    this.caretaker.setDepth(this.caretaker.y);
  }

  private caretakerTalking = false;

  /** While you're talking to it, the Caretaker stays put so its bubble stays readable. */
  setCaretakerTalking(on: boolean) {
    this.caretakerTalking = on;
  }

  private driftCaretaker(dt: number) {
    if (this.reducedMotion || this.caretakerTalking) return;
    this.caretakerAngle += dt * 0.045;
    this.placeCaretaker();
    // Moving round the loop, x changes as -sin(angle): face that way.
    this.caretakerBody.setFlipX(Math.sin(this.caretakerAngle) > 0);
  }

  /** Show a line in the Caretaker's speech bubble for a few seconds. */
  caretakerSay(text: string) {
    this.caretakerBubble.set(text);
    this.bubbleTimer?.remove();
    this.bubbleTimer = this.time.delayedCall(bubbleMs(text), () => this.caretakerBubble.set(""));
  }

  // --- Ambience ---

  private addLanternGlows() {
    const key = glowTexture(this);
    for (const l of LANTERNS) {
      // A warm pool of light on the ground, then the lamp's own glow.
      this.add.image(l.x, l.y + 90, key).setTint(0xffc46b).setAlpha(0.16).setScale(1.1, 0.35).setBlendMode(Phaser.BlendModes.ADD);
      const glow = this.add.image(l.x, l.y - 12, key).setTint(0xffc46b).setAlpha(0.3).setScale(0.75).setBlendMode(Phaser.BlendModes.ADD);
      if (this.reducedMotion) continue;
      // A slow, small breathing rather than a flicker: real lamps don't pulse hard.
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.26, to: 0.34 },
        duration: 1800 + Math.random() * 1400,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
    // Little candle flames around the séance circle.
    for (const c of SEANCE_CANDLES) {
      this.add.image(c.x, c.y - 20, key).setTint(0xffb84d).setAlpha(0.22).setScale(0.18).setBlendMode(Phaser.BlendModes.ADD);
    }
    // The fountain water glows softly too.
    this.add.image(FOUNTAIN_X, FOUNTAIN_Y + 18, key).setTint(0x7fe0c8).setAlpha(0.14).setScale(1.1, 0.55).setBlendMode(Phaser.BlendModes.ADD);
  }

  /** Drifting fog banks and fireflies. Static fog only under reduced motion. */
  private addAmbience() {
    const key = glowTexture(this);
    for (let i = 0; i < 4; i++) {
      const fog = this.add
        .image(150 + i * 320, 260 + (i % 2) * 300, key)
        .setTint(0xb9a7ff)
        .setAlpha(0.05)
        .setScale(4, 1)
        .setDepth(90000);
      if (!this.reducedMotion) {
        this.tweens.add({ targets: fog, x: fog.x + 220, duration: 26000 + i * 6000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
    }
    if (this.reducedMotion) return;
    for (let i = 0; i < 16; i++) {
      const fly = this.add
        .image(Phaser.Math.Between(40, PLAZA_WIDTH - 40), Phaser.Math.Between(180, PLAZA_HEIGHT - 40), key)
        .setTint(0xfff2a8)
        .setScale(0.06)
        .setAlpha(0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(90001);
      this.tweens.add({
        targets: fly,
        x: fly.x + Phaser.Math.Between(-80, 80),
        y: fly.y + Phaser.Math.Between(-60, 60),
        duration: Phaser.Math.Between(4000, 8000),
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      this.tweens.add({
        targets: fly,
        alpha: { from: 0, to: 0.9 },
        duration: Phaser.Math.Between(900, 2000),
        delay: Phaser.Math.Between(0, 3000),
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private addHauntingOverlay() {
    // A deep indigo veil over the whole plaza, invisible until a haunting begins.
    this.hauntingOverlay = this.add
      .rectangle(0, 0, PLAZA_WIDTH, PLAZA_HEIGHT, 0x0a0620, 0)
      .setOrigin(0, 0)
      .setDepth(200000);
    // Extra lantern glow that only appears during a haunting.
    const key = glowTexture(this);
    for (const l of LANTERNS) {
      this.hauntingGlows.push(
        this.add.image(l.x, l.y - 12, key).setTint(0xffcf7a).setAlpha(0).setScale(1).setBlendMode(Phaser.BlendModes.ADD).setDepth(200001),
      );
    }
  }

  private syncHaunting() {
    const on = this.room.state.haunting === true;
    if (on && !this.wasHaunting) this.caretakerSay("The midnight haunting begins! Glow bright, everyone.");
    this.wasHaunting = on;
    const targetVeil = on ? 0.45 : 0;
    const targetGlow = on ? 0.6 : 0;
    // Ease toward the target so the lighting change is gentle (instant under reduced motion).
    const step = this.reducedMotion ? 1 : 0.04;
    this.hauntingOverlay.alpha += (targetVeil - this.hauntingOverlay.alpha) * step;
    for (const g of this.hauntingGlows) g.alpha += (targetGlow - g.alpha) * step;
  }

  // --- Ghosts ---

  /** Create, move and remove sprites so they match the server state. */
  private syncSprites(dt: number) {
    const seen = new Set<string>();
    this.room.state.ghosts?.forEach((ghost, id) => {
      seen.add(id);
      const sprite = this.sprites.get(id) ?? this.spawnSprite(id, ghost);
      const c = sprite.container;
      const k = Math.min(1, dt * SMOOTHING);
      sprite.facing = face(sprite.body, sprite.hat, ghost.x - c.x, sprite.facing);
      c.x += (ghost.x - c.x) * k;
      c.y += (ghost.y - c.y) * k;
      c.setDepth(c.y); // ghosts lower on screen draw in front
      this.updateBubble(sprite, ghost.bubble);
      this.updateHat(sprite, ghost.hat);
      if (!this.greeted && id === this.room.sessionId) {
        this.greeted = true;
        this.caretakerSay(`Welcome to the town, ${ghost.name}. Make yourself at home.`);
      }
    });
    for (const [id, sprite] of this.sprites) {
      if (seen.has(id)) continue;
      this.sprites.delete(id);
      // Leave effect: dissolve — fade out while drifting up and shrinking.
      if (this.reducedMotion) {
        sprite.container.destroy();
      } else {
        this.tweens.add({
          targets: sprite.container,
          alpha: 0,
          y: sprite.container.y - 30,
          scale: 0.5,
          duration: 450,
          ease: "Sine.easeIn",
          onComplete: () => sprite.container.destroy(),
        });
      }
    }
  }

  private spawnSprite(id: string, ghost: GhostView): GhostSprite {
    const body = this.add.image(0, 0, ghostTextureKey(ghost.colour));
    const isMe = id === this.room.sessionId;

    // Click another ghost to offer a visit to their room. A tiny drag tolerance
    // keeps a click-to-walk on empty floor from also triggering a visit.
    if (!isMe && this.onVisit) {
      body.setInteractive({ useHandCursor: true });
      let downAt = { x: 0, y: 0 };
      body.on("pointerdown", (p: Phaser.Input.Pointer) => (downAt = { x: p.x, y: p.y }));
      body.on("pointerup", (p: Phaser.Input.Pointer) => {
        if (Math.hypot(p.x - downAt.x, p.y - downAt.y) > 8) return; // was a drag, not a click
        const g = this.room.state.ghosts?.get(id);
        const ownerId = g?.ownerId ? Number(g.ownerId) : NaN;
        if (Number.isFinite(ownerId) && ownerId > 0) this.onVisit!(ownerId, g?.name ?? "A ghost");
      });
    }
    const label = nameTag(this, ghost.name, isMe ? "#ffcf7a" : "#f4f1ff", -44, isMe);
    const bubble = new Bubble(this, -72);
    // Hat sits just above the ghost body; texture set in updateHat.
    const hat = this.add.image(GHOST_HEAD_OFFSET_X, -30, hatTextureKey("hat-witch")).setVisible(false);

    const container = this.add.container(ghost.x, ghost.y, [groundShadow(this), body, hat, label, bubble.container]).setAlpha(0);

    // Join effect: a small puff — fade and pop in from slightly small.
    if (this.reducedMotion) {
      container.setAlpha(1);
    } else {
      container.setScale(0.6);
      this.tweens.add({ targets: container, alpha: 1, duration: 500 });
      this.tweens.add({ targets: container, scale: 1, duration: 500, ease: "Back.easeOut" });
      // Body and hat bob together so the hat stays on.
      this.tweens.add({ targets: [body, hat], y: "-=6", duration: 1200, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    const sprite: GhostSprite = { container, body, hat, shownHat: "", bubble, shownBubble: "", facing: 1 };
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

  private updateBubble(sprite: GhostSprite, text: string) {
    if (text === sprite.shownBubble) return;
    sprite.shownBubble = text;
    sprite.bubble.set(text);
  }

  private handleKeys(time: number) {
    const { dx, dy } = heldDirection(this.keys);
    const me = this.room.state.ghosts?.get(this.room.sessionId);
    if (!me) return;

    if (dx !== 0 || dy !== 0) {
      if (time - this.lastKeySend >= KEY_SEND_MS) {
        sendMove(this.room, keysToTarget({ x: me.x, y: me.y }, dx, dy));
        this.lastKeySend = time;
      }
      this.wasKeyMoving = true;
    } else if (this.wasKeyMoving) {
      // Keys released: stop where we are instead of drifting to the look-ahead target.
      this.room.send(MESSAGE.stop);
      this.wasKeyMoving = false;
    }
  }
}
