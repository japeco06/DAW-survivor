/**
 * Sintetizador de audio retro y banda sonora chiptune/synthwave procedural.
 * Utiliza exclusivamente la Web Audio API nativa sin ningún archivo de audio externo.
 * Proporciona control de volumen maestro, efectos (SFX) y música de fondo (BGM) adaptativa.
 */

export type MusicTrack = 'NONE' | 'MENU' | 'INGAME' | 'BOSS' | 'FINAL_BOSS';

export interface AudioSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
  screenShakeEnabled: boolean;
}

const SETTINGS_KEY = 'cyber_survivor_audio_settings_v1';

export class SoundSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  public masterVolume: number = 0.8;
  public sfxVolume: number = 0.8;
  public musicVolume: number = 0.5;
  public muted: boolean = false;
  public screenShakeEnabled: boolean = true;

  private currentTrack: MusicTrack = 'NONE';
  private musicIntervalId: number | null = null;
  private musicStep: number = 0;
  private nextNoteTime: number = 0;

  private lastShootSoundTime: number = 0;
  private lastStaticSoundTime: number = 0;

  constructor() {
    this.loadSettings();
  }

  private loadSettings(): void {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<AudioSettings>;
        if (typeof parsed.masterVolume === 'number') this.masterVolume = parsed.masterVolume;
        if (typeof parsed.sfxVolume === 'number') this.sfxVolume = parsed.sfxVolume;
        if (typeof parsed.musicVolume === 'number') this.musicVolume = parsed.musicVolume;
        if (typeof parsed.muted === 'boolean') this.muted = parsed.muted;
        if (typeof parsed.screenShakeEnabled === 'boolean') {
          this.screenShakeEnabled = parsed.screenShakeEnabled;
        }
      }
    } catch {
      // Ignorar errores en entornos sin localStorage
    }
  }

  public saveSettings(): void {
    try {
      const data: AudioSettings = {
        masterVolume: this.masterVolume,
        sfxVolume: this.sfxVolume,
        musicVolume: this.musicVolume,
        muted: this.muted,
        screenShakeEnabled: this.screenShakeEnabled,
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
    } catch {
      // Ignorar errores
    }
    this.applyVolumes();
  }

  public applyVolumes(): void {
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const targetMaster = this.muted ? 0 : this.masterVolume;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(targetMaster, now + 0.05);

    this.sfxGain.gain.cancelScheduledValues(now);
    this.sfxGain.gain.setValueAtTime(this.sfxGain.gain.value, now);
    this.sfxGain.gain.linearRampToValueAtTime(this.sfxVolume, now + 0.05);

    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(this.musicVolume, now + 0.05);
  }

  public ensureContext(): AudioContext | null {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();

        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        this.applyVolumes();
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  // ==========================================
  // BANDA SONORA PROCEDURAL (BGM SYNTH)
  // ==========================================

  public setTrack(track: MusicTrack): void {
    if (this.currentTrack === track) return;
    this.currentTrack = track;

    if (track === 'NONE') {
      this.stopMusic();
      return;
    }

    this.ensureContext();
    this.startMusicScheduler();
  }

  public getCurrentTrack(): MusicTrack {
    return this.currentTrack;
  }

  private stopMusic(): void {
    if (this.musicIntervalId !== null) {
      clearInterval(this.musicIntervalId);
      this.musicIntervalId = null;
    }
  }

  private startMusicScheduler(): void {
    this.stopMusic();
    if (!this.ctx) return;

    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.musicStep = 0;

    // Scheduler periódico cada 35ms que programa las notas con anticipación exacta
    this.musicIntervalId = window.setInterval(() => {
      this.scheduleMusic();
    }, 35);
  }

  private scheduleMusic(): void {
    if (!this.ctx || !this.musicGain || this.currentTrack === 'NONE') return;

    const tempoBpm =
      this.currentTrack === 'FINAL_BOSS' ? 146 : this.currentTrack === 'BOSS' ? 138 : 124;
    const stepDuration = 60 / tempoBpm / 4; // Duración de una semicorchea (1/16 de compás)
    const scheduleAheadTime = 0.15; // Adelanto de 150ms

    while (this.nextNoteTime < this.ctx.currentTime + scheduleAheadTime) {
      this.playMusicStep(this.musicStep, this.nextNoteTime, this.currentTrack);
      this.nextNoteTime += stepDuration;
      this.musicStep = (this.musicStep + 1) % 64; // Bucle de 4 compases (64 steps)
    }
  }

  private playMusicStep(step: number, time: number, track: MusicTrack): void {
    if (!this.ctx || !this.musicGain) return;

    // 1. Percusión / Batería sintetizada
    if (track === 'FINAL_BOSS') {
      // Bombo potente en cada negra (steps 0, 4, 8, 12...)
      if (step % 4 === 0) {
        this.synthKick(time, 150, 32, 0.22, 0.35);
      }
      // Hi-hat cerrado en semicorcheas impares
      if (step % 2 === 1) {
        this.synthHiHat(time, 0.03, 0.07);
      }
      // Caja agresiva en steps 4, 12, 20...
      if (step % 8 === 4) {
        this.synthSnare(time, 0.14, 0.24);
      }
    } else if (track === 'BOSS') {
      if (step % 4 === 0) {
        this.synthKick(time, 130, 40, 0.18, 0.28);
      }
      if (step % 4 === 2) {
        this.synthSnare(time, 0.12, 0.2);
      }
      if (step % 2 === 1) {
        this.synthHiHat(time, 0.025, 0.05);
      }
    } else if (track === 'INGAME' || track === 'MENU') {
      // Synthwave beat relajado pero rítmico
      if (step % 8 === 0) {
        this.synthKick(time, 110, 45, 0.14, 0.22);
      }
      if (step % 8 === 4) {
        this.synthSnare(time, 0.1, 0.15);
      }
      if (step % 2 === 0) {
        this.synthHiHat(time, 0.02, 0.035);
      }
    }

    // 2. Línea de Bajo (Bassline)
    if (track === 'INGAME' || track === 'MENU') {
      // Progresión Am - F - C - G (Dorian/Cyberpunk)
      const rootNotes = [110, 87.31, 130.81, 98]; // A2, F2, C3, G2
      const bar = Math.floor(step / 16) % 4;
      const rootFreq = rootNotes[bar];

      // Bajo en corcheas constantes con filtro retro
      if (step % 2 === 0) {
        const octaveMult = (step % 4 === 2) ? 2 : 1;
        this.synthBassNote(time, rootFreq * octaveMult, 0.12, 0.18);
      }
    } else if (track === 'BOSS') {
      // Bajo frenético en E menor / Bb disminuido
      const bossRoots = [82.41, 82.41, 116.54, 73.42]; // E2, E2, Bb2, D2
      const bar = Math.floor(step / 16) % 4;
      const freq = bossRoots[bar];
      if (step % 2 === 0) {
        this.synthBassNote(time, freq, 0.1, 0.22, 'sawtooth');
      }
    } else if (track === 'FINAL_BOSS') {
      // Sub-bajo oscuro e industrial continuo en C / C#
      const root = (step < 32) ? 65.41 : 69.3; // C2 / C#2
      if (step % 2 === 0) {
        this.synthBassNote(time, root, 0.14, 0.3, 'sawtooth');
      }
      // Alarma aguda de advertencia en momentos clave
      if (step === 0 || step === 32) {
        this.synthLeadNote(time, 880, 0.3, 0.12, 'sawtooth');
      }
    }

    // 3. Arpegio / Melodía de sintetizador (Lead Arp)
    if (track === 'INGAME' || track === 'MENU') {
      // Arpegio estilo Stranger Things / Blade Runner
      const arpNotes = [220, 261.63, 329.63, 392.0, 440, 523.25, 659.25, 523.25];
      const noteFreq = arpNotes[step % arpNotes.length];
      if (step % 2 === 0) {
        this.synthLeadNote(time, noteFreq, 0.09, 0.08, 'triangle');
      }
    } else if (track === 'BOSS') {
      const bossArp = [329.63, 392.0, 466.16, 587.33, 466.16, 392.0];
      const noteFreq = bossArp[step % bossArp.length];
      if (step % 2 === 0) {
        this.synthLeadNote(time, noteFreq, 0.08, 0.1, 'square');
      }
    }
  }

  private synthKick(time: number, startF: number, endF: number, dur: number, vol: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.frequency.setValueAtTime(startF, time);
    osc.frequency.exponentialRampToValueAtTime(endF, time + dur);

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + dur);
  }

  private synthSnare(time: number, dur: number, vol: number): void {
    if (!this.ctx || !this.musicGain) return;
    const sampleRate = this.ctx.sampleRate;
    const bufferSize = Math.floor(sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1000, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    noise.start(time);
    noise.stop(time + dur);
  }

  private synthHiHat(time: number, dur: number, vol: number): void {
    if (!this.ctx || !this.musicGain) return;
    const sampleRate = this.ctx.sampleRate;
    const bufferSize = Math.floor(sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7000, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    noise.start(time);
    noise.stop(time + dur);
  }

  private synthBassNote(
    time: number,
    freq: number,
    dur: number,
    vol: number,
    type: OscillatorType = 'triangle'
  ): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, time);
    filter.frequency.exponentialRampToValueAtTime(180, time + dur);

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + dur);
  }

  private synthLeadNote(
    time: number,
    freq: number,
    dur: number,
    vol: number,
    type: OscillatorType = 'sine'
  ): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + dur);
  }

  // ==========================================
  // EFECTOS DE SONIDO (SFX)
  // ==========================================

  public playShoot(isHoming: boolean = false): void {
    const now = performance.now();
    if (now - this.lastShootSoundTime < 35) return;
    this.lastShootSoundTime = now;

    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = isHoming ? 'triangle' : 'square';
    const startFreq = isHoming ? 1180 : 960;
    const endFreq = isHoming ? 520 : 310;

    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + 0.065);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.065);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(ctx.currentTime + 0.07);
  }

  public playExplosion(isBoss: boolean = false): void {
    const now = performance.now();
    if (!isBoss && now - this.lastStaticSoundTime < 25) return;
    this.lastStaticSoundTime = now;

    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;

    const duration = isBoss ? 0.32 : 0.09;
    const sampleRate = ctx.sampleRate;
    const bufferSize = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const decay = 1 - i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * decay;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isBoss ? 600 : 1400, ctx.currentTime);
    filter.Q.setValueAtTime(1.2, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(isBoss ? 0.35 : 0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start();
    noise.stop(ctx.currentTime + duration);
  }

  public playCoinPickup(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1320, ctx.currentTime);
    osc.frequency.setValueAtTime(1760, ctx.currentTime + 0.045);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  }

  /**
   * Fanfarria cibernética triunfal cuando se desbloquea un Hito / Logro.
   */
  public playAchievement(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const startTime = ctx.currentTime + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(startTime);
      osc.stop(startTime + 0.23);
    });
  }

  /**
   * Sirena de alarma de advertencia para eventos de jefe.
   */
  public playBossAlert(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.muted) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(740, ctx.currentTime + 0.25);
    osc.frequency.linearRampToValueAtTime(320, ctx.currentTime + 0.5);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.55);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(ctx.currentTime + 0.55);
  }
}
