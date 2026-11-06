import Phaser from "phaser";
import { parsePetId } from "@club-kiro/shared";
import { GHOST_HEAD_OFFSET_X, petTextureKey } from "./art";
import { isTyping } from "./settings";

// Shared drawing and input helpers for ghosts in the plaza and in rooms.

export type MoveKeys = Record<"up" | "down" | "left" | "right" | "w" | "a" | "s" | "d", Phaser.Input.Keyboard.Key>;

/** Movement keys without key capture, so typing W/A/S/D in the chat box still types. */
export function moveKeys(scene: Phaser.Scene): MoveKeys {
  const kb = scene.input.keyboard!;
  const K = Phaser.Input.Keyboard.KeyCodes;
  const add = (code: number) => kb.addKey(code, false);
  return {
    up: add(K.UP), down: add(K.DOWN), left: add(K.LEFT), right: add(K.RIGHT),
    w: add(K.W), a: add(K.A), s: add(K.S), d: add(K.D),
  };
}

/** The held direction, or none while the player is typing in a text box. */
export function heldDirection(k: MoveKeys): { dx: number; dy: number } {
  if (isTyping()) return { dx: 0, dy: 0 };
  return {
    dx: (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0),
    dy: (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0),
  };
}

/**
 * Turn a ghost to face the way it is moving. `dx` is how far it still has to
 * travel horizontally; tiny moves keep the current facing. Returns the facing.
 */
export function face(body: Phaser.GameObjects.Image, hat: Phaser.GameObjects.Image, dx: number, facing: number): number {
  // A few pixels of dead zone, so a small correction never spins the ghost round.
  if (Math.abs(dx) < 4) return facing;
  const next = dx > 0 ? 1 : -1;
  if (next !== facing) {
    body.setFlipX(next < 0);
    hat.setFlipX(next < 0);
    hat.x = GHOST_HEAD_OFFSET_X * next;
  }
  return next;
}

export const UI_FONT = "Nunito, 'Segoe UI', sans-serif";
const GLOW_KEY = "soft-glow";

/** A white radial dot, tinted per use, for lantern light, fireflies and fog. */
export function glowTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(GLOW_KEY)) return GLOW_KEY;
  const size = 256;
  const tex = scene.textures.createCanvas(GLOW_KEY, size, size)!;
  const ctx = tex.getContext();
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  // A bell-shaped falloff (roughly Gaussian), so the light has no visible edge or bright core.
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    g.addColorStop(t, `rgba(255,255,255,${Math.exp(-4.5 * t * t) * (1 - t)})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
  return GLOW_KEY;
}

/**
 * Fill the whole screen with the world: zoom until it covers the viewport, and keep
 * the camera inside the world. On a screen shaped like the world you see all of it;
 * on other shapes you see a slice that follows your ghost (see `followMe`).
 */
export function coverCamera(scene: Phaser.Scene, worldW: number, worldH: number) {
  const cam = scene.cameras.main;
  const apply = () => {
    cam.setZoom(Math.max(scene.scale.width / worldW, scene.scale.height / worldH));
    cam.setBounds(0, 0, worldW, worldH);
  };
  apply();
  scene.scale.on("resize", apply);
  scene.events.once("shutdown", () => scene.scale.off("resize", apply));
}

/** Point the camera at your own ghost, easing gently. */
export function followMe(scene: Phaser.Scene, target: Phaser.GameObjects.Container) {
  scene.cameras.main.startFollow(target, true, 0.12, 0.12);
}

/** A rounded pill name tag whose bottom edge sits at `bottomY`. */
export function nameTag(scene: Phaser.Scene, name: string, colour: string, bottomY = -42, outline = false) {
  const text = scene.add
    .text(0, 0, name, { fontFamily: UI_FONT, fontStyle: "bold", fontSize: "14px", color: colour, resolution: 2 })
    .setOrigin(0.5);
  const w = text.width + 20;
  const h = text.height + 6;
  const bg = scene.add.graphics();
  bg.fillStyle(0x120b26, 0.72).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  if (outline) bg.lineStyle(1.5, Phaser.Display.Color.HexStringToColor(colour).color, 0.7).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  return scene.add.container(0, bottomY - h / 2, [bg, text]);
}

/** A soft shadow on the ground under a floating ghost. */
export function groundShadow(scene: Phaser.Scene, y = 40, width = 40): Phaser.GameObjects.Ellipse {
  return scene.add.ellipse(0, y, width, width / 4, 0x000000, 0.28);
}

/** A parchment speech bubble with a tail. Its tail tip sits at the container origin. */
export class Bubble {
  readonly container: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, y: number) {
    this.bg = scene.add.graphics();
    this.text = scene.add
      .text(0, 0, "", {
        fontFamily: UI_FONT,
        fontSize: "15px",
        color: "#2b1d0e",
        align: "center",
        wordWrap: { width: 190 },
        resolution: 2,
      })
      .setOrigin(0.5, 1);
    this.container = scene.add.container(0, y, [this.bg, this.text]).setVisible(false);
  }

  set(text: string) {
    if (!text) {
      this.container.setVisible(false);
      return;
    }
    this.text.setText(text);
    const tail = 8;
    const w = this.text.width + 22;
    const h = this.text.height + 14;
    this.text.setY(-tail - 7);
    this.bg.clear();
    this.bg.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2 + 2, -h - tail + 3, w, h, 12);
    this.bg.fillStyle(0xfbf3df, 1).fillRoundedRect(-w / 2, -h - tail, w, h, 12);
    this.bg.fillTriangle(-7, -tail - 1, 7, -tail - 1, 0, 0);
    this.container.setVisible(true);
  }
}

/**
 * A pet that trails its ghost. It lives outside the ghost's container so it can
 * lag behind and catch up, which reads as following rather than being glued on.
 * Each species moves its own way: bats flap, wisps bob and glow, spiders dangle.
 */
export class Pet {
  private readonly img: Phaser.GameObjects.Image;
  private readonly glow?: Phaser.GameObjects.Image;
  private readonly thread?: Phaser.GameObjects.Graphics;
  private t = Math.random() * 10;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly itemId: string,
    textureKey: string,
    x: number,
    y: number,
    private readonly reducedMotion: boolean,
  ) {
    this.species = parsePetId(itemId)?.species ?? "wisp";
    if (this.species === "wisp") {
      this.glow = scene.add.image(x, y, glowTexture(scene)).setTint(0xffffff).setAlpha(0.18).setScale(0.3).setBlendMode(Phaser.BlendModes.ADD);
    }
    if (this.species === "spider") this.thread = scene.add.graphics();
    this.img = scene.add.image(x, y, textureKey);
  }

  private readonly species: string;

  /** Follow a point beside the ghost's back, a little above it. */
  update(dt: number, ghostX: number, ghostY: number, facing: number, depth: number) {
    this.t += dt;
    const restX = ghostX - facing * 38;
    const restY = ghostY - (this.species === "spider" ? 4 : 30);
    const k = Math.min(1, dt * 4); // slower than the ghost, so it trails
    this.img.x += (restX - this.img.x) * k;
    this.img.y += (restY - this.img.y) * k;
    this.img.setFlipX(facing < 0);

    const still = this.reducedMotion;
    let bob = 0;
    if (this.species === "bat") {
      bob = still ? 0 : Math.sin(this.t * 3) * 6;
      this.img.setScale(1, still ? 1 : 0.7 + Math.abs(Math.sin(this.t * 14)) * 0.3); // wing beats
    } else if (this.species === "wisp") {
      bob = still ? 0 : Math.sin(this.t * 2) * 5;
      this.glow?.setPosition(this.img.x, this.img.y + bob).setAlpha(still ? 0.18 : 0.14 + Math.sin(this.t * 3) * 0.05).setDepth(depth - 1);
    } else {
      bob = still ? 0 : Math.sin(this.t * 1.6) * 8;
    }
    this.img.setDisplayOrigin(this.img.width / 2, this.img.height / 2 - bob).setDepth(depth);
    if (this.thread) {
      // The spider hangs on a silk thread from above.
      this.thread.clear().lineStyle(1, 0xe6dcff, 0.5).lineBetween(this.img.x, this.img.y - 70, this.img.x, this.img.y + bob - 8);
      this.thread.setDepth(depth - 1);
    }
  }

  destroy() {
    this.img.destroy();
    this.glow?.destroy();
    this.thread?.destroy();
  }
}

/** Keep a ghost's pet in line with its synced `pet` field: create, swap or remove. */
export function syncPet(scene: Phaser.Scene, current: Pet | undefined, petId: string, x: number, y: number, reducedMotion: boolean): Pet | undefined {
  if ((current?.itemId ?? "") === petId) return current;
  current?.destroy();
  return petId ? new Pet(scene, petId, petTextureKey(petId), x, y, reducedMotion) : undefined;
}