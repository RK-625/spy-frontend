/**
 * RTC (relative-to-center) camera.
 *
 * Cancels the huge shared world offset before scale so float precision holds
 * when cam and content sit far from the origin (large world spreads).
 *
 * World → screen:
 *   screenX = (worldX - camX) * zoom + viewportWidth  / 2
 *   screenY = (worldY - camY) * zoom + viewportHeight / 2
 *
 * Inverse (screen → world) uses the same RTC algebra so pan/zoom stay well-defined.
 *
 * Camera state lives outside Pixi; never pan/zoom via container.scale.
 * No min/max zoom clamps — literal infinite zoom (float is the wall).
 */

export type RtcCameraState = {
  camX: number;
  camY: number;
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
};

export type ScreenPoint = { x: number; y: number };
export type WorldPoint = { x: number; y: number };

function isUsableZoom(zoom: number): boolean {
  return Number.isFinite(zoom) && zoom !== 0;
}

/** Mutable camera for pan / zoom-at-point / look-at. */
export class RtcCamera {
  camX = 0;
  camY = 0;
  zoom = 1;
  viewportWidth = 0;
  viewportHeight = 0;

  setViewport(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  /**
   * Project world → screen: (world - cam) * zoom + vp/2
   * If zoom is 0 or non-finite, returns viewport center (avoids NaN).
   */
  worldToScreen(world: WorldPoint): ScreenPoint {
    const z = this.zoom;
    if (!isUsableZoom(z)) {
      return {
        x: this.viewportWidth / 2,
        y: this.viewportHeight / 2,
      };
    }
    const wx = Number.isFinite(world.x) ? world.x : 0;
    const wy = Number.isFinite(world.y) ? world.y : 0;
    return {
      x: (wx - this.camX) * z + this.viewportWidth / 2,
      y: (wy - this.camY) * z + this.viewportHeight / 2,
    };
  }

  /**
   * Inverse project screen → world: (screen - vp/2) / zoom + cam
   * If zoom is 0 or non-finite, returns current cam (avoids NaN).
   */
  screenToWorld(screen: ScreenPoint): WorldPoint {
    const z = this.zoom;
    if (!isUsableZoom(z)) {
      return { x: this.camX, y: this.camY };
    }
    const sx = Number.isFinite(screen.x) ? screen.x : 0;
    const sy = Number.isFinite(screen.y) ? screen.y : 0;
    return {
      x: (sx - this.viewportWidth / 2) / z + this.camX,
      y: (sy - this.viewportHeight / 2) / z + this.camY,
    };
  }

  /**
   * Screen delta pan: dragging mouse by (dx, dy) screen pixels moves camera by
   * (-dx / zoom, -dy / zoom) in world units so content tracks pointer.
   */
  panByScreen(dx: number, dy: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const z = this.zoom;
    if (!isUsableZoom(z)) return;
    this.camX -= dx / z;
    this.camY -= dy / z;
  }

  /**
   * Zoom relative to screen focal point (screenX, screenY). World under pointer
   * stays fixed after multiplying zoom by `factor`.
   * Rejects non-finite factor, zero/non-finite resulting zoom; leaves state.
   * No min/max clamps.
   */
  zoomAt(screenX: number, screenY: number, factor: number): void {
    if (
      !Number.isFinite(screenX) ||
      !Number.isFinite(screenY) ||
      !Number.isFinite(factor) ||
      factor === 0
    ) {
      return;
    }
    const prevZoom = this.zoom;
    if (!isUsableZoom(prevZoom)) return;

    const nextZoom = prevZoom * factor;
    if (!isUsableZoom(nextZoom)) return;

    // World under cursor before zoom change (RTC inverse)
    const world = this.screenToWorld({ x: screenX, y: screenY });

    this.zoom = nextZoom;

    // Keep that world point at the same screen pixel (RTC formula)
    this.camX = world.x - (screenX - this.viewportWidth / 2) / nextZoom;
    this.camY = world.y - (screenY - this.viewportHeight / 2) / nextZoom;
  }

  /** Center the camera on a world point (e.g. cluster jump). */
  lookAt(worldX: number, worldY: number): void {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return;
    this.camX = worldX;
    this.camY = worldY;
  }
}

export function createRtcCamera(
  partial?: Partial<RtcCameraState>
): RtcCamera {
  const camera = new RtcCamera();
  if (partial?.camX !== undefined) camera.camX = partial.camX;
  if (partial?.camY !== undefined) camera.camY = partial.camY;
  if (partial?.zoom !== undefined) camera.zoom = partial.zoom;
  if (partial?.viewportWidth !== undefined) {
    camera.viewportWidth = partial.viewportWidth;
  }
  if (partial?.viewportHeight !== undefined) {
    camera.viewportHeight = partial.viewportHeight;
  }
  return camera;
}
