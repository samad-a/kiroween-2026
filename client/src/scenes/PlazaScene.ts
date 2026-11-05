import Phaser from "phaser";
import { PLAZA_HEIGHT, PLAZA_WIDTH, keysToTarget } from "@club-kiro/shared";
import { LANTERNS, ghostTextureKey, ghostTextures, hatTextureKey, hatTextures, plazaSvg, svgUrl } from "../art";
import { sendMove, type GhostView, type PlazaRoom } from "../net";
import { reduceMotion } from "../settings";

/** How quickly a rendered ghost catches up to its synced position (per second). */
const SMOOTHING = 12;
/** Minimum gap between keyboard move messages. */
const KEY_SEND_MS = 100;

interface GhostSprite {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  hat: Phaser.GameObjects.Image;
  shownHat: string;
  bubble: Phaser.GameObjects.Container;
  bubbleText: Phaser.GameObjects.Text;
  shownBubble: string;
}

export class PlazaScene extends Phaser.Scene {
  private room!: PlazaRoom;
  private readonly sprites = new Map<string, GhostSprite>();
  private keys!: Record<"up" | "down" | "left" | "right" | "w" | "a" | "s" | "d", Phaser.Input.Keyboard.Key>;
  private lastKeySend = 0;
  private wasKeyMoving = false;
  private reducedMotion = reduceMotion();
  private hauntingOverlay!: Phaser.GameObjects.Rectangle;
  private hauntingGlows: Phaser.GameObjects.Arc[] = [];

  constructor() {
    super("plaza");
  }

  init(data: { room: PlazaRoom }) {
    this.room = data.room;
  }

  preload() {
    this.load.svg("plaza", svgUrl(plazaSvg()), { width: PLAZA_WIDTH, height: PLAZA_HEIGHT });
    for (const t of ghostTextures) this.load.svg(t.key, t.url, { width: 64, height: 72 });
    for (const t of hatTextures) this.load.svg(t.key, t.url, { width: 48, height: 44 });
  }

  create() {
    this.add.image(0, 0, "plaza").setOrigin(0, 0);
    this.addLanternGlows();
    this.addHauntingOverlay();

    // Ignore plaza clicks that start on a DOM overlay (e.g. the chat input).
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const el = document.elementFromPoint(pointer.x, pointer.y);
      if (el && el.closest("#chat")) return;
      sendMove(this.room, { x: pointer.worldX, y: pointer.worldY });
    });

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: kb.addKey(K.UP), down: kb.addKey(K.DOWN), left: kb.addKey(K.LEFT), right: kb.addKey(K.RIGHT),
      w: kb.addKey(K.W), a: kb.addKey(K.A), s: kb.addKey(K.S), d: kb.addKey(K.D),
    };

    this.room.onLeave(() => this.scene.pause());
  }

  update(time: number, deltaMs: number) {
    this.syncSprites(deltaMs / 1000);
    this.handleKeys(time);
    this.syncHaunting();
  }

  private addHauntingOverlay() {
    // A deep indigo veil over the whole plaza, invisible until a haunting begins.
    this.hauntingOverlay = this.add
      .rectangle(0, 0, PLAZA_WIDTH, PLAZA_HEIGHT, 0x0a0620, 0)
      .setOrigin(0, 0)
      .setDepth(200000);
    // Extra lantern glow that only appears during a haunting.
    for (const l of LANTERNS) {
      this.hauntingGlows.push(
        this.add.circle(l.x, l.y - 12, 64, 0xffcf7a, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(200001),
      );
    }
  }

  private syncHaunting() {
    const on = this.room.state.haunting === true;
    const targetVeil = on ? 0.45 : 0;
    const targetGlow = on ? 0.3 : 0;
    // Ease toward the target so the lighting change is gentle (instant under reduced motion).
    const step = this.reducedMotion ? 1 : 0.04;
    this.hauntingOverlay.alpha += (targetVeil - this.hauntingOverlay.alpha) * step;
    for (const g of this.hauntingGlows) g.alpha += (targetGlow - g.alpha) * step;
  }

  /** Create, move and remove sprites so they match the server state. */
  private syncSprites(dt: number) {
    const seen = new Set<string>();
    this.room.state.ghosts?.forEach((ghost, id) => {
      seen.add(id);
      const sprite = this.sprites.get(id) ?? this.spawnSprite(id, ghost);
      const c = sprite.container;
      const k = Math.min(1, dt * SMOOTHING);
      c.x += (ghost.x - c.x) * k;
      c.y += (ghost.y - c.y) * k;
      c.setDepth(c.y); // ghosts lower on screen draw in front
      this.updateBubble(sprite, ghost.bubble);
      this.updateHat(sprite, ghost.hat);
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
    const label = this.add
      .text(0, -50, ghost.name, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "16px",
        color: isMe ? "#ffcf7a" : "#f4f1ff",
        backgroundColor: "rgba(15,10,34,0.75)",
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5, 1);
    const bubbleText = this.add
      .text(0, 0, "", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "15px",
        color: "#2b1d0e",
        backgroundColor: "#f3e6c8",
        padding: { x: 8, y: 5 },
        align: "center",
        wordWrap: { width: 180 },
      })
      .setOrigin(0.5, 1);
    const bubble = this.add.container(0, -64, [bubbleText]).setVisible(false);
    // Hat sits just above the ghost body; texture set in updateHat.
    const hat = this.add.image(0, -30, hatTextureKey("hat-witch")).setVisible(false);

    const container = this.add.container(ghost.x, ghost.y, [body, hat, label, bubble]).setAlpha(0);

    // Join effect: a small puff — fade and pop in from slightly small.
    if (this.reducedMotion) {
      container.setAlpha(1);
    } else {
      container.setScale(0.6);
      this.tweens.add({ targets: container, alpha: 1, duration: 500 });
      this.tweens.add({ targets: container, scale: 1, duration: 500, ease: "Back.easeOut" });
    }
    if (!this.reducedMotion) {
      this.tweens.add({ targets: body, y: -6, duration: 1200, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    const sprite: GhostSprite = { container, body, hat, shownHat: "", bubble, bubbleText, shownBubble: "" };
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
    if (text) {
      sprite.bubbleText.setText(text);
      sprite.bubble.setVisible(true).setDepth(100000);
    } else {
      sprite.bubble.setVisible(false);
    }
  }

  private handleKeys(time: number) {
    const k = this.keys;
    const dx = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    const dy = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
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
      sendMove(this.room, { x: me.x, y: me.y });
      this.wasKeyMoving = false;
    }
  }

  private addLanternGlows() {
    for (const l of LANTERNS) {
      const glow = this.add.circle(l.x, l.y - 12, 46, 0xffcf7a, 0.18).setBlendMode(Phaser.BlendModes.ADD);
      if (this.reducedMotion) continue;
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.12, to: 0.26 },
        duration: 700 + Math.random() * 600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }
}
