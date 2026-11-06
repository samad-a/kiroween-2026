import Phaser from "phaser";
import {
  BOOST_MS,
  GHOST_FOOT_OFFSET,
  TRACK_HEIGHT,
  WISP_RESPAWN_MS,
  batAt,
  gateOpen,
  isDashMapId,
  track,
  type Track,
} from "@club-kiro/shared";
import {
  dashProps,
  dashTileCount,
  dashTileSvg,
  ghostTextureKey,
  ghostTextures,
  hatTextureKey,
  hatTextures,
  petTextureKey,
  petTextures,
  svgUrl,
  GHOST_HEAD_OFFSET_X,
} from "../art";
import { coverCamera, face, followMe, glowTexture, groundShadow, heldDirection, moveKeys, nameTag, syncPet, type MoveKeys, type Pet } from "../ghostParts";
import { sendDashIntent, type DashRoomClient, type RacerView } from "../net";
import { reduceMotion } from "../settings";

const SMOOTHING = 14;

interface RacerSprite {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  hat: Phaser.GameObjects.Image;
  trail: Phaser.GameObjects.Image;
  shownHat: string;
  facing: number;
  pet?: Pet;
}

/** What the HUD needs each frame. */
export interface DashHud {
  clock: number;
  phase: string;
  /** 0..1 along the track, per racer, and which one is you. */
  progress: { id: string; name: string; at: number; me: boolean; place: number }[];
  boosted: boolean;
  stunned: boolean;
}

export class DashScene extends Phaser.Scene {
  private room!: DashRoomClient;
  private t!: Track;
  private onHud?: (hud: DashHud) => void;
  private readonly racers = new Map<string, RacerSprite>();
  private keys!: MoveKeys;
  private lastSent = "";
  private reducedMotion = reduceMotion();
  private gatesGfx!: Phaser.GameObjects.Graphics[];
  private bats: Phaser.GameObjects.Image[] = [];
  private wisps: { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image }[] = [];
  /** Race clock, smoothed between server ticks. */
  private clock = 0;
  private lastServerClock = Number.NaN;

  constructor() {
    super("dash");
  }

  init(data: { room: DashRoomClient; onHud?: (hud: DashHud) => void }) {
    this.room = data.room;
    this.onHud = data.onHud;
    const map = this.room.state.map;
    this.t = track(isDashMapId(map) ? map : "lane");
  }

  preload() {
    for (let i = 0; i < dashTileCount(this.t); i++) this.load.svg(`dash-tile-${this.t.id}-${i}`, svgUrl(dashTileSvg(this.t, i)), { width: 1200, height: TRACK_HEIGHT });
    for (const p of dashProps(this.t)) this.load.svg(p.key, svgUrl(p.svg), { width: p.w, height: p.h });
    for (const t of ghostTextures) this.load.svg(t.key, t.url, { width: 64, height: 72 });
    for (const t of hatTextures) this.load.svg(t.key, t.url, { width: 48, height: 44 });
    for (const t of petTextures) this.load.svg(t.key, t.url);
  }

  create() {
    for (let i = 0; i < dashTileCount(this.t); i++) this.add.image(i * 1200 - 1, 0, `dash-tile-${this.t.id}-${i}`).setOrigin(0, 0).setDisplaySize(1202, TRACK_HEIGHT);
    for (const p of dashProps(this.t)) this.add.image(p.x, p.y, p.key).setOrigin(0, 0).setDepth(p.depth);
    this.addWalls();
    this.addWisps();
    this.addBats();
    this.addFinishArch();

    // Click or tap ahead to head there; hold keys to steer. Releasing keys stops you.
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const el = document.elementFromPoint(p.x, p.y);
      if (el && el.closest("#dock, #hud, #room-controls, .dialog, #dash-hud")) return;
      this.lastSent = "";
      sendDashIntent(this.room, { x: p.worldX, y: p.worldY });
    });
    this.keys = moveKeys(this);
    coverCamera(this, this.t.length, TRACK_HEIGHT);
  }

  private addWalls() {
    const g = this.add.graphics();
    for (const w of this.t.walls) {
      g.setDepth(w.y + w.height);
      // Crypt wall: dark stone with a lighter cap, rising above its footprint.
      g.fillStyle(0x4e4284, 1).fillRoundedRect(w.x - 4, w.y - 70, w.width + 8, w.height + 70, 6);
      g.fillStyle(0x6a5c9e, 1).fillRoundedRect(w.x - 8, w.y - 80, w.width + 16, 14, 6);
    }
    // Gates redraw each frame (open or shut); one Graphics per gate so each sorts on its own.
    this.gatesGfx = this.t.gates.map((gt) => this.add.graphics().setDepth(gt.y + gt.height));
  }

  private addWisps() {
    const key = glowTexture(this);
    this.wisps = this.t.wisps.map((w) => ({
      glow: this.add.image(w.x, w.y, key).setTint(0x7fe0c8).setAlpha(0.35).setScale(0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(w.y + 60),
      img: this.add.image(w.x, w.y, petTextureKey("pet-wisp-frost")).setScale(1.1).setDepth(w.y + 61),
    }));
  }

  private addBats() {
    this.bats = this.t.bats.map((b) => this.add.image(b.x, b.y0, petTextureKey("pet-bat-plum")).setScale(1.5));
  }

  private addFinishArch() {
    const x = this.t.finishX + 7;
    const g = this.add.graphics().setDepth(TRACK_HEIGHT);
    g.fillStyle(0x1d1733, 1).fillRect(x - 4, 150, 8, 520).fillRect(x + 24, 150, 8, 520);
    this.add
      .text(x + 14, 136, "FINISH", { fontFamily: "Fredoka, Nunito, sans-serif", fontSize: "26px", color: "#ffb84d", stroke: "#1d1733", strokeThickness: 6, resolution: 2 })
      .setOrigin(0.5, 1)
      .setDepth(TRACK_HEIGHT + 1);
  }

  update(time: number, deltaMs: number) {
    const dt = deltaMs / 1000;
    // Smooth the race clock between server updates so gates and bats move fluidly.
    const server = this.room.state.clock ?? 0;
    if (server !== this.lastServerClock) {
      this.lastServerClock = server;
      if (Math.abs(server - this.clock) > 120) this.clock = server; // big drift: snap
    }
    this.clock += deltaMs;
    if (this.clock > server + 120) this.clock = server + 120;
    const ms = this.clock;

    this.drawGates(ms);
    this.t.bats.forEach((b, i) => {
      const p = batAt(b, Math.max(0, ms));
      this.bats[i]!.setPosition(p.x, p.y).setDepth(p.y + 40);
      if (!this.reducedMotion) this.bats[i]!.setScale(1.5, 1.05 + Math.abs(Math.sin(time / 60)) * 0.45);
    });
    this.wisps.forEach((w, i) => {
      const taken = this.room.state.wisps[i] ?? 0;
      const here = taken === 0 || ms - taken >= WISP_RESPAWN_MS;
      const bob = this.reducedMotion ? 0 : Math.sin(time / 300 + i) * 5;
      w.img.setVisible(here).setY(this.t.wisps[i]!.y + bob);
      w.glow.setVisible(here).setY(this.t.wisps[i]!.y + bob);
    });

    this.syncRacers(dt, ms, time);
    this.steer();
  }

  private drawGates(ms: number) {
    this.t.gates.forEach((gt, i) => {
      const g = this.gatesGfx[i]!;
      const open = gateOpen(gt, Math.max(0, ms));
      g.clear();
      if (open) {
        // Open: bars lifted into the lintel, a green lamp.
        g.fillStyle(0x2b2348, 1).fillRect(gt.x - 2, gt.y - 82, gt.width + 4, 14);
        g.fillStyle(0x7fe0c8, 1).fillCircle(gt.x + gt.width / 2, gt.y - 92, 6);
      } else {
        // Shut: iron bars down, a red lamp.
        g.fillStyle(0x1d1733, 1);
        for (let k = 0; k < 4; k++) g.fillRect(gt.x + 2 + k * 6, gt.y - 70, 3, gt.height + 70);
        g.fillRect(gt.x - 2, gt.y - 74, gt.width + 4, 8);
        g.fillStyle(0xff8a8a, 1).fillCircle(gt.x + gt.width / 2, gt.y - 92, 6);
      }
    });
  }

  private syncRacers(dt: number, ms: number, time: number) {
    const seen = new Set<string>();
    const progress: DashHud["progress"] = [];
    let mine: RacerView | undefined;
    this.room.state.racers?.forEach((r, id) => {
      seen.add(id);
      const sprite = this.racers.get(id) ?? this.spawnRacer(id, r);
      const c = sprite.container;
      const k = Math.min(1, dt * SMOOTHING);
      sprite.facing = face(sprite.body, sprite.hat, r.x - c.x, sprite.facing);
      c.x += (r.x - c.x) * k;
      c.y += (r.y - c.y) * k;
      c.setDepth(c.y + GHOST_FOOT_OFFSET);
      const boosted = ms < r.boostUntil;
      const stunned = ms < r.stunUntil;
      sprite.trail.setVisible(boosted).setAlpha(boosted ? 0.35 + 0.15 * Math.sin(time / 50) : 0);
      sprite.body.setAngle(stunned && !this.reducedMotion ? Math.sin(time / 30) * 14 : 0);
      sprite.pet = syncPet(this, sprite.pet, r.pet ?? "", c.x, c.y, this.reducedMotion);
      sprite.pet?.update(dt, c.x, c.y, sprite.facing, c.y + GHOST_FOOT_OFFSET - 0.5);
      if (id === this.room.sessionId) mine = r;
      progress.push({ id, name: r.name, at: Math.min(1, Math.max(0, (r.x - 140) / (this.t.finishX - 140))), me: id === this.room.sessionId, place: r.place });
    });
    for (const [id, s] of this.racers) {
      if (seen.has(id)) continue;
      s.pet?.destroy();
      s.container.destroy();
      this.racers.delete(id);
    }
    this.onHud?.({
      clock: ms,
      phase: this.room.state.phase,
      progress,
      boosted: !!mine && ms < mine.boostUntil && mine.boostUntil - ms <= BOOST_MS,
      stunned: !!mine && ms < mine.stunUntil,
    });
  }

  private spawnRacer(id: string, r: RacerView): RacerSprite {
    const isMe = id === this.room.sessionId;
    const body = this.add.image(0, 0, ghostTextureKey(r.colour));
    const hat = this.add.image(GHOST_HEAD_OFFSET_X, -30, hatTextureKey(r.hat || "hat-witch")).setVisible(!!r.hat);
    const trail = this.add.image(-26, 6, glowTexture(this)).setTint(0x7fe0c8).setScale(0.55, 0.3).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    const label = nameTag(this, r.name, isMe ? "#ffcf7a" : "#f4f1ff", -44, isMe);
    const container = this.add.container(r.x, r.y, [trail, groundShadow(this), body, hat, label]);
    if (!this.reducedMotion) this.tweens.add({ targets: [body, hat], y: "-=4", duration: 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    if (isMe) followMe(this, container);
    const sprite: RacerSprite = { container, body, hat, trail, shownHat: r.hat, facing: 1 };
    this.racers.set(id, sprite);
    return sprite;
  }

  /** Send the held direction when it changes (releasing sends 0,0, which stops you). */
  private steer() {
    const { dx, dy } = heldDirection(this.keys);
    const key = `${dx},${dy}`;
    if (key === this.lastSent) return;
    if (dx === 0 && dy === 0 && this.lastSent === "") return; // a click target is active; keep it
    this.lastSent = key;
    sendDashIntent(this.room, { dx, dy });
  }
}
