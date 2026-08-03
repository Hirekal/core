export const VIDEO_CONSTRAINTS = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  facingMode: 'user',
};

export const RECORDING_COUNTDOWN_SECONDS = 3;

/**
 * Front cameras often deliver a mirrored stream. Flip once so preview and
 * saved video match real-world left/right (text readable, not selfie-mirror).
 */
export function createCorrectedRecordingStream(sourceStream, videoElement) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Video recording is not supported in this browser.');
  }

  const width = videoElement.videoWidth || VIDEO_CONSTRAINTS.width.ideal;
  const height = videoElement.videoHeight || VIDEO_CONSTRAINTS.height.ideal;
  canvas.width = width;
  canvas.height = height;

  let frameId = null;
  const drawFrame = () => {
    if (videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      context.save();
      context.translate(width, 0);
      context.scale(-1, 1);
      context.drawImage(videoElement, 0, 0, width, height);
      context.restore();
    }
    frameId = requestAnimationFrame(drawFrame);
  };
  drawFrame();

  const recordingStream = canvas.captureStream(30);
  const audioTrack = sourceStream.getAudioTracks()[0];
  if (audioTrack) {
    recordingStream.addTrack(audioTrack);
  }

  return {
    stream: recordingStream,
    stop() {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    },
  };
}

export function formatRecordingTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function streamHasAudio(stream) {
  return Boolean(stream?.getAudioTracks?.().length);
}

export function streamHasVideo(stream) {
  return Boolean(stream?.getVideoTracks?.().length);
}
