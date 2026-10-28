/** Reconocimiento de voz, nivel de sonido de respaldo y síntesis de voz del navegador. */
export class VoiceSystem {
  constructor({ onResult, onStatus }) {
    this.onResult = onResult;
    this.onStatus = onStatus;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognitionSupported = Boolean(Recognition);
    this.recognitionClass = Recognition;
    this.recognition = null;
    this.audioStream = null;
    this.audioContext = null;
    this.analyser = null;
    this.levelTimer = null;
    this.listening = false;
    this.fallbackMode = false;
    this.lastSoundEvent = 0;
  }

  start() {
    if (this.listening) return;
    if (this.recognitionSupported) {
      this.startRecognition();
    } else {
      this.startSoundLevel().catch((error) => {
        this.onStatus(error.message || "No pude abrir el micrófono.", "error");
      });
    }
  }

  startRecognition() {
    const Recognition = this.recognitionClass;
    const recognition = new Recognition();
    recognition.lang = "es-CO";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      this.listening = true;
      this.fallbackMode = false;
      this.onStatus("Escuchando en español... habla ahora.", "listening");
    };
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) this.onResult({ type: "transcript", text: transcript });
    };
    recognition.onerror = (event) => {
      const messages = {
        "not-allowed": "Micrófono no autorizado. Puedes escribir los comandos.",
        "no-speech": "No oí nada. Intenta otra vez.",
        network: "El reconocimiento necesita conexión; usa el teclado.",
      };
      this.onStatus(messages[event.error] || `Micrófono: ${event.error}.`, "error");
    };
    recognition.onend = () => {
      this.listening = false;
      this.recognition = null;
      if (!this.fallbackMode) this.onStatus("Micrófono en reposo.", "idle");
    };

    this.recognition = recognition;
    try {
      recognition.start();
    } catch (error) {
      this.listening = false;
      this.recognition = null;
      this.onStatus("No pude iniciar el dictado.", "error");
    }
  }

  async startSoundLevel() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioStream = stream;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContextClass();
    const source = this.audioContext.createMediaStreamSource(stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    source.connect(this.analyser);
    this.listening = true;
    this.fallbackMode = true;
    this.onStatus("Dictado no disponible: leyendo energía sonora.", "listening");

    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.levelTimer = window.setInterval(() => {
      if (!this.analyser) return;
      this.analyser.getByteFrequencyData(data);
      const average = data.reduce((sum, value) => sum + value, 0) / data.length;
      const now = performance.now();
      if (average > 36 && now - this.lastSoundEvent > 1800) {
        this.lastSoundEvent = now;
        this.onResult({ type: "sound", level: average / 255, text: "[energía sonora]" });
      }
    }, 180);
  }

  stop() {
    if (this.recognition) {
      try { this.recognition.stop(); } catch { /* ya terminó */ }
    }
    if (this.levelTimer) clearInterval(this.levelTimer);
    if (this.audioStream) this.audioStream.getTracks().forEach((track) => track.stop());
    if (this.audioContext) this.audioContext.close().catch(() => {});
    this.levelTimer = null;
    this.audioStream = null;
    this.audioContext = null;
    this.analyser = null;
    this.listening = false;
    this.fallbackMode = false;
    this.onStatus("Micrófono en reposo.", "idle");
  }

  speak(text, enabled = true) {
    if (!enabled || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(String(text).slice(0, 260));
    utterance.lang = "es-CO";
    utterance.rate = 1.03;
    utterance.pitch = 1.16;
    utterance.volume = 0.72;
    const voices = window.speechSynthesis.getVoices();
    const spanishVoice = voices.find((voice) => /^es(-|_)/i.test(voice.lang)) || voices.find((voice) => /rafy|robot/i.test(voice.name));
    if (spanishVoice) utterance.voice = spanishVoice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  cancelSpeech() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }
}
