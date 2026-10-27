/**
 * Sintetizador de audio retro/8-bit utilizando exclusivamente la Web Audio API nativa.
 * No requiere archivos externos. Genera efectos en tiempo real mediante osciladores y buffers de ruido.
 */
export class SoundSystem {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;
  private lastShootSoundTime: number = 0;
  private lastStaticSoundTime: number = 0;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  /**
   * Pitido corto de alta frecuencia estilo 8-bit cada vez que el Agente dispara.
   */
  public playShoot(isHoming: boolean = false): void {
    const now = performance.now();
    // Evitar saturación si se disparan múltiples proyectiles en el mismo milisegundo
    if (now - this.lastShootSoundTime < 35) return;
    this.lastShootSoundTime = now;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = isHoming ? 'triangle' : 'square';
    const startFreq = isHoming ? 1180 : 960;
    const endFreq = isHoming ? 520 : 310;

    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + 0.065);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.065);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.07);
  }

  /**
   * Sonido de estática o ruido blanco muy breve cuando un Malware es destruido.
   */
  public playExplosion(isBoss: boolean = false): void {
    const now = performance.now();
    if (!isBoss && now - this.lastStaticSoundTime < 25) return;
    this.lastStaticSoundTime = now;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const duration = isBoss ? 0.28 : 0.09;
    const sampleRate = ctx.sampleRate;
    const bufferSize = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    // Generar ruido blanco puro con decaimiento envolvente
    for (let i = 0; i < bufferSize; i++) {
      const decay = 1 - i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * decay;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Filtro paso-banda para darle textura de estática digital / 8-bit
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isBoss ? 650 : 1400, ctx.currentTime);
    filter.Q.setValueAtTime(1.2, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(isBoss ? 0.22 : 0.13, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
    noise.stop(ctx.currentTime + duration);
  }

  /**
   * Sonido corto metálico al recoger una Criptomoneda dorada.
   */
  public playCoinPickup(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1320, ctx.currentTime);
    osc.frequency.setValueAtTime(1760, ctx.currentTime + 0.045);

    gain.gain.setValueAtTime(0.09, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  }
}
