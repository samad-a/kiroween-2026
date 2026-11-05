import Phaser from "phaser";

// Shared drawing helpers for ghosts in the plaza and in rooms.

export const UI_FONT = "Nunito, 'Segoe UI', sans-serif";
const GLOW_KEY = "soft-glow";

/** A white radial dot, tinted per use, for lantern light, fireflies and fog. */
export function glowTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(GLOW_KEY)) return GLOW_KEY;
  const size = 128;
  const tex = scene.textures.createCanvas(GLOW_KEY, size, size)!;
  const ctx = tex.getContext();
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
  return GLOW_KEY;
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
