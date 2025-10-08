export function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch (e) {
    return false;
  }
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export class MouthAnimator {
  private targetOpen = 0;
  private currentOpen = 0;
  private lerpSpeed = 0.15;

  setTarget(value: number) {
    this.targetOpen = Math.max(0, Math.min(1, value));
  }

  update(): number {
    this.currentOpen = lerp(this.currentOpen, this.targetOpen, this.lerpSpeed);
    return this.currentOpen;
  }

  reset() {
    this.targetOpen = 0;
    this.currentOpen = 0;
  }
}
