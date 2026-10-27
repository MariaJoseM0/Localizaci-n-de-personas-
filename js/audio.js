/** Pequeño sintetizador WebAudio: todos los efectos se generan sin archivos externos. */
export class SoundEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.enabled = true;
  }

  warm() {
    if (!this.enabled) return;
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") this.context.resume().catch(() => {});
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.master) this.master.gain.value = enabled ? 0.22 : 0;
    if (enabled) this.warm();
  }

  tone({ frequency = 440, endFrequency = frequency, duration = 0.18, type = "sine", gain = 0.2, delay = 0 }) {
    if (!this.enabled || !this.context || !this.master) return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), now + duration);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + Math.min(0.025, duration * 0.2));
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  noise({ duration = 0.18, gain = 0.08, delay = 0, filterFrequency = 1400 }) {
    if (!this.enabled || !this.context || !this.master) return;
    const now = this.context.currentTime + delay;
    const length = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = filterFrequency;
    filter.Q.value = 1.6;
    envelope.gain.value = gain;
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.master);
    source.start(now);
  }

  play(kind) {
    this.warm();
    switch (kind) {
      case "scan":
        this.tone({ frequency: 260, endFrequency: 940, duration: 0.5, type: "sine", gain: 0.18 });
        this.tone({ frequency: 520, endFrequency: 1500, duration: 0.42, type: "triangle", gain: 0.08, delay: 0.05 });
        this.noise({ duration: 0.32, gain: 0.025, filterFrequency: 900 });
        break;
      case "found":
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
          this.tone({ frequency: freq, duration: 0.24, type: "sine", gain: 0.15, delay: index * 0.075 });
        });
        break;
      case "human":
        this.tone({ frequency: 180, endFrequency: 420, duration: 0.32, type: "triangle", gain: 0.12 });
        this.tone({ frequency: 620, endFrequency: 380, duration: 0.24, type: "sine", gain: 0.08, delay: 0.08 });
        break;
      case "world":
        this.tone({ frequency: 110, endFrequency: 330, duration: 0.8, type: "sawtooth", gain: 0.07 });
        this.tone({ frequency: 440, endFrequency: 220, duration: 0.7, type: "sine", gain: 0.1, delay: 0.1 });
        break;
      case "click":
        this.tone({ frequency: 760, endFrequency: 540, duration: 0.075, type: "sine", gain: 0.07 });
        break;
      case "error":
        this.tone({ frequency: 220, endFrequency: 130, duration: 0.2, type: "square", gain: 0.07 });
        break;
      case "win":
        [392, 493.88, 587.33, 783.99, 987.77].forEach((freq, index) => {
          this.tone({ frequency: freq, duration: 0.5, type: "triangle", gain: 0.11, delay: index * 0.11 });
        });
        break;
      default:
        this.tone({ frequency: 480, endFrequency: 620, duration: 0.12, type: "sine", gain: 0.07 });
    }
  }
}
