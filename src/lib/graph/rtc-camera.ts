/**
 * RTC (relative-to-center) camera.
 *
 * Cancels the huge shared world offset before scale so float precision holds
 * when cam and content sit far from the origin (e.g. FA2 clusters at 1e17).
 *
 * World → screen (RTC):
 *   screenX = (worldX - camX) * zoom + viewportWidth  / 2
 *   screenY = (worldY - camY) * zoom + viewportHeight / 2
 *
 * World → screen (naive — catastrophic cancellation demo):
 *   screenX = worldX * zoom - camX * zoom + viewportWidth  / 2
 *   (same algebra, but float loses low-order bits at huge coords)
 *
 * Inverse (screen → world) always uses RTC so pan/zoom stay well-defined.
 *
 * Camera state lives outside Pixi; never pan/zoom via container.scale.
 * No min/max zoom clamps — literal infinite zoom (float is the wall).
 */

export type ProjectionMode = "rtc" | "naive";

export type RtcCameraState = {
  camX: number;
  camY: number;
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
  projectionMode: ProjectionMode;
};

export type ScreenPoint = { x: number; y: number };
export type WorldPoint = { x: number; y: number };

function isUsableZoom(z: number): boolean {
  return Number.isFinite(z) && z !== 0;
}

/** Mutable camera for pan / zoom-at-point / look-at. */
export class RtcCamera {
  camX = 0;
  camY = 0;
  zoom = 1;
  viewportWidth = 0;
  viewportHeight = 0;
  /** `rtc` subtracts cam before scale; `naive` scales first (demo only). */
  projectionMode: ProjectionMode = "rtc";

  getState(): RtcCameraState {
    return {
      camX: this.camX,
      camY: this.camY,
      zoom: this.zoom,
      viewportWidth: this.viewportWidth,
      viewportHeight: this.viewportHeight,
      projectionMode: this.projectionMode,
    };
  }

  setViewport(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  setProjectionMode(mode: ProjectionMode): void {
    this.projectionMode = mode;
  }

  /**
   * Project world → screen.
   * RTC: (world - cam) * zoom + vp/2
   * Naive: world * zoom - cam * zoom + vp/2 (same math, worse float at huge coords)
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
    if (this.projectionMode === "naive") {
      return {
        x: world.x * z - this.camX * z + this.viewportWidth / 2,
        y: world.y * z - this.camY * z + this.viewportHeight / 2,
      };
    }
    return {
      x: (world.x - this.camX) * z + this.viewportWidth / 2,
      y: (world.y - this.camY) * z + this.viewportHeight / 2,
    };
  }

  /**
   * Inverse: screen → world (always RTC; interaction math must stay stable).
   * If zoom is 0 or non-finite, returns camera center.
   */
  screenToWorld(screen: ScreenPoint): WorldPoint {
    const z = this.zoom;
    if (!isUsableZoom(z)) {
      return { x: this.camX, y: this.camY };
    }
    return {
      x: (screen.x - this.viewportWidth / 2) / z + this.camX,
      y: (screen.y - this.viewportHeight / 2) / z + this.camY,
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
    const z = this.zoom;
    if (!isUsableZoom(z)) return;
    this.camX -= dx / z;
    this.camY -= dy / z;
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
  const cam = new RtcCamera();
  if (partial?.camX !== undefined) cam.camX = partial.camX;
  if (partial?.camY !== undefined) cam.camY = partial.camY;
  if (partial?.zoom !== undefined) cam.zoom = partial.zoom;
  if (partial?.viewportWidth !== undefined) {
    cam.viewportWidth = partial.viewportWidth;
  }
  if (partial?.viewportHeight !== undefined) {
    cam.viewportHeight = partial.viewportHeight;
  }
  if (partial?.projectionMode !== undefined) {
    cam.projectionMode = partial.projectionMode;
  }
  return cam;
}
