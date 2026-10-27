/**
 * Capa de visión local. Usa cámara + diferencia de fotogramas para detectar presencia.
 * FaceDetector se aprovecha solo si el navegador lo ofrece; no se envían imágenes a ningún servidor.
 */
export class VisionSystem {
  constructor(video, onEvent) {
    this.video = video;
    this.onEvent = onEvent;
    this.stream = null;
    this.active = false;
    this.analysisCanvas = document.createElement("canvas");
    this.analysisContext = this.analysisCanvas.getContext("2d", { willReadFrequently: true });
    this.previousFrame = null;
    this.analysisWidth = 0;
    this.analysisHeight = 0;
    this.lastMotionAt = 0;
    this.lastFaceAt = 0;
    this.faceTimer = null;
    this.frameHandle = null;
    this.faceDetector = null;

    const FaceDetectorClass = window.FaceDetector;
    if (FaceDetectorClass) {
      try {
        this.faceDetector = new FaceDetectorClass({ fastMode: true, maxDetectedFaces: 4 });
      } catch {
        this.faceDetector = null;
      }
    }
  }

  get supportsFaceDetection() {
    return Boolean(this.faceDetector);
  }

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Este navegador no permite acceso a la cámara.");
    }
    if (this.active) return { faceDetection: this.supportsFaceDetection };

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "user" },
        width: { ideal: 960 },
        height: { ideal: 720 },
        frameRate: { ideal: 24, max: 30 },
      },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();
    this.active = true;
    this.previousFrame = null;
    this.lastMotionAt = performance.now();
    this.frameHandle = requestAnimationFrame(this.loop);

    if (this.faceDetector) {
      this.detectFaces();
      this.faceTimer = window.setInterval(() => this.detectFaces(), 1200);
    } else {
      this.onEvent({ type: "faces", faces: [], videoWidth: 0, videoHeight: 0, at: performance.now() });
    }
    return { faceDetection: this.supportsFaceDetection };
  }

  stop() {
    this.active = false;
    if (this.frameHandle) cancelAnimationFrame(this.frameHandle);
    if (this.faceTimer) clearInterval(this.faceTimer);
    this.frameHandle = null;
    this.faceTimer = null;
    if (this.stream) this.stream.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.pause();
    this.video.srcObject = null;
    this.previousFrame = null;
    this.onEvent({ type: "camera-off", at: performance.now() });
  }

  loop = (time) => {
    if (!this.active) return;
    if (time - this.lastMotionAt > 190) {
      this.lastMotionAt = time;
      this.analyzeMotion();
    }
    this.frameHandle = requestAnimationFrame(this.loop);
  };

  analyzeMotion() {
    if (this.video.readyState < 2 || !this.video.videoWidth || !this.video.videoHeight) return;
    const videoWidth = this.video.videoWidth;
    const videoHeight = this.video.videoHeight;
    const width = 160;
    const height = Math.max(70, Math.round(width * videoHeight / videoWidth));
    if (width !== this.analysisWidth || height !== this.analysisHeight) {
      this.analysisCanvas.width = width;
      this.analysisCanvas.height = height;
      this.analysisWidth = width;
      this.analysisHeight = height;
      this.previousFrame = null;
    }

    this.analysisContext.drawImage(this.video, 0, 0, width, height);
    const frame = this.analysisContext.getImageData(0, 0, width, height).data;
    const gray = new Uint8Array(width * height);
    let differenceSum = 0;
    let weightedX = 0;
    let weightedY = 0;
    let changed = 0;

    if (this.previousFrame) {
      for (let i = 0, pixel = 0; i < frame.length; i += 4, pixel += 1) {
        const value = (frame[i] * 0.299 + frame[i + 1] * 0.587 + frame[i + 2] * 0.114) | 0;
        gray[pixel] = value;
        const difference = Math.abs(value - this.previousFrame[pixel]);
        if (difference > 16) {
          differenceSum += difference;
          const x = pixel % width;
          const y = Math.floor(pixel / width);
          weightedX += x * difference;
          weightedY += y * difference;
          changed += 1;
        }
      }
    } else {
      for (let i = 0, pixel = 0; i < frame.length; i += 4, pixel += 1) {
        gray[pixel] = (frame[i] * 0.299 + frame[i + 1] * 0.587 + frame[i + 2] * 0.114) | 0;
      }
    }

    this.previousFrame = gray;
    if (!differenceSum || changed < 20) {
      this.onEvent({
        type: "motion",
        motion: 0,
        changed: 0,
        x: 0.5,
        y: 0.5,
        videoWidth,
        videoHeight,
        at: performance.now(),
      });
      return;
    }

    const x = weightedX / differenceSum / width;
    const y = weightedY / differenceSum / height;
    const rawEnergy = differenceSum / (width * height);
    const motion = Math.min(1, rawEnergy / 11);
    this.onEvent({
      type: "motion",
      motion,
      changed,
      x,
      y,
      videoWidth,
      videoHeight,
      at: performance.now(),
    });
  }

  async detectFaces() {
    if (!this.active || !this.faceDetector || this.video.readyState < 2) return;
    try {
      const faces = await this.faceDetector.detect(this.video);
      this.lastFaceAt = performance.now();
      this.onEvent({
        type: "faces",
        faces: faces.map((face) => ({
          x: face.boundingBox.x,
          y: face.boundingBox.y,
          width: face.boundingBox.width,
          height: face.boundingBox.height,
        })),
        videoWidth: this.video.videoWidth,
        videoHeight: this.video.videoHeight,
        at: this.lastFaceAt,
      });
    } catch {
      // FaceDetector es experimental: la detección por movimiento sigue funcionando.
    }
  }
}
