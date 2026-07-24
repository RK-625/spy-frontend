/**
 * RTC (relative-to-center) camera.
 *
 * Cancels the huge shared world offset before scale so float precision holds
 * when cam and content sit far from the origin (e.g. FA2 clusters at 1e17).
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
    const zoom = this.zoom;
    if (!isUsableZoom(zoom)) {
      return {
        x: this.viewportWidth / 2,
        y: this.viewportHeight / 2,
      };
    }
    return {
      x: (world.x - this.camX) * zoom + this.viewportWidth / 2,
      y: (world.y - this.camY) * zoom + this.viewportHeight / 2,
    };
  }

  /**
   * Inverse: screen → world (RTC algebra).
   * If zoom is 0 or non-finite, returns camera center.
   */
  screenToWorld(screen: ScreenPoint): WorldPoint {
    const zoom = this.zoom;
    if (!isUsableZoom(zoom)) {
      return { x: this.camX, y: this.camY };
    }
    return {
      x: (screen.x - this.viewportWidth / 2) / zoom + this.camX,
      y: (screen.y - this.viewportHeight / 2) / zoom + this.camY,
    };
  }

  /**
   * Pan the view by screen-space pixels.
   *
   * Drag-to-pan convention: finger/cursor moves right by `dx` → content under
   * the cursor should follow (world moves right on screen) → camera moves left
   * in world space: camX -= dx / zoom (same for y).
   * Non-finite deltas or unusable zoom are ignored.
   */
  panByScreen(dx: number, dy: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const zoom = this.zoom;
    if (!isUsableZoom(zoom)) return;
    this.camX -= dx / zoom;
    this.camY -= dy / zoom;
  }

  /**
   * Zoom toward a screen pixel: the world point under (screenX, screenY)
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
