/**
 * Gestor de entrada unificado: Teclado (WASD / Flechas) + Joystick Táctil flotante
 * optimizado para móviles y tablets.
 */
export interface TouchJoystickState {
  active: boolean;
  originX: number;
  originY: number;
  thumbX: number;
  thumbY: number;
  maxRadius: number;
}

export class Input {
  private keys: Set<string> = new Set();

  private activeTouchId: number | null = null;
  private touchOriginX: number = 0;
  private touchOriginY: number = 0;
  private touchThumbX: number = 0;
  private touchThumbY: number = 0;
  private touchVecX: number = 0;
  private touchVecY: number = 0;
  private readonly maxRadius: number = 64;
  private readonly deadZone: number = 8;
  public hasUsedTouch: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.hasUsedTouch =
        'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.clearTouch();
    });
  }

  public startTouch(id: number, logicalX: number, logicalY: number): void {
    this.hasUsedTouch = true;
    this.activeTouchId = id;
    this.touchOriginX = logicalX;
    this.touchOriginY = logicalY;
    this.touchThumbX = logicalX;
    this.touchThumbY = logicalY;
    this.touchVecX = 0;
    this.touchVecY = 0;
  }

  public moveTouch(id: number, logicalX: number, logicalY: number): void {
    if (this.activeTouchId !== id) return;
    const dx = logicalX - this.touchOriginX;
    const dy = logicalY - this.touchOriginY;
    const dist = Math.hypot(dx, dy);

    if (dist <= this.deadZone) {
      this.touchThumbX = logicalX;
      this.touchThumbY = logicalY;
      this.touchVecX = 0;
      this.touchVecY = 0;
      return;
    }

    const clampedDist = Math.min(this.maxRadius, dist);
    const nx = dx / dist;
    const ny = dy / dist;
    this.touchThumbX = this.touchOriginX + nx * clampedDist;
    this.touchThumbY = this.touchOriginY + ny * clampedDist;
    const strength = Math.min(1, (dist - this.deadZone) / (this.maxRadius - this.deadZone));
    this.touchVecX = nx * strength;
    this.touchVecY = ny * strength;
  }

  public endTouch(id: number): boolean {
    if (this.activeTouchId !== id) return false;
    this.clearTouch();
    return true;
  }

  public clearTouch(): void {
    this.activeTouchId = null;
    this.touchVecX = 0;
    this.touchVecY = 0;
  }

  public isTouchActive(): boolean {
    return this.activeTouchId !== null;
  }

  public getActiveTouchId(): number | null {
    return this.activeTouchId;
  }

  public getJoystickState(): TouchJoystickState {
    return {
      active: this.activeTouchId !== null,
      originX: this.touchOriginX,
      originY: this.touchOriginY,
      thumbX: this.touchThumbX,
      thumbY: this.touchThumbY,
      maxRadius: this.maxRadius,
    };
  }

  public getDirection(): { x: number; y: number } {
    let dx = 0;
    let dy = 0;

    if (this.keys.has('w') || this.keys.has('arrowup')) dy -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) dy += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) dx += 1;

    if (dx !== 0 && dy !== 0) {
      const length = Math.hypot(dx, dy);
      dx /= length;
      dy /= length;
    }

    if (dx === 0 && dy === 0 && this.activeTouchId !== null) {
      return { x: this.touchVecX, y: this.touchVecY };
    }

    return { x: dx, y: dy };
  }
}
