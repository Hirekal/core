import { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Circle, Square, AlertCircle, Mic, Video } from 'lucide-react';
import Button from './Button';
import {
  getMediaErrorMessage,
  getSupportedVideoMimeType,
} from '../../utils/mediaHelpers';
import {
  VIDEO_CONSTRAINTS,
  RECORDING_COUNTDOWN_SECONDS,
  createCorrectedRecordingStream,
  formatRecordingTime,
  streamHasAudio,
  streamHasVideo,
} from '../../utils/videoRecordingUtils';

/**
 * Inline camera recorder for the public apply flow — live preview, 3-2-1 countdown, record/stop.
 */
export default function VideoRecorderPanel({
  onRecorded,
  onError,
  disabled = false,
  uploading = false,
}) {
  const webcamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingPipelineRef = useRef(null);
  const chunksRef = useRef([]);
  const countdownTimerRef = useRef(null);

  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [error, setError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const stopRecordingPipeline = useCallback(() => {
    recordingPipelineRef.current?.stop?.();
    recordingPipelineRef.current = null;
  }, []);

  const stopTracks = useCallback(() => {
    const stream = webcamRef.current?.stream;
    stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const clearCountdownTimer = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearCountdownTimer();
      stopRecordingPipeline();
      stopTracks();
    };
  }, [clearCountdownTimer, stopRecordingPipeline, stopTracks]);

  useEffect(() => {
    if (!recording) return undefined;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  const handleUserMedia = (stream) => {
    setError(null);
    setCameraReady(streamHasVideo(stream));
    setHasAudio(streamHasAudio(stream));
  };

  const handleUserMediaError = (err) => {
    setCameraReady(false);
    setHasAudio(false);
    const message = getMediaErrorMessage(err);
    setError(message);
    onError?.(message);
  };

  const beginRecording = useCallback(() => {
    const stream = webcamRef.current?.stream;
    const video = webcamRef.current?.video;
    if (!stream || !video) {
      const message = 'Camera is not ready yet. Please wait or check permissions.';
      setError(message);
      onError?.(message);
      return;
    }

    const mimeType = getSupportedVideoMimeType();
    if (!mimeType) {
      const message = 'Video recording is not supported in this browser.';
      setError(message);
      onError?.(message);
      return;
    }

    try {
      chunksRef.current = [];
      stopRecordingPipeline();

      const pipeline = createCorrectedRecordingStream(stream, video);
      recordingPipelineRef.current = pipeline;

      const recorder = new MediaRecorder(pipeline.stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stopRecordingPipeline();
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          onRecorded({
            type: 'video',
            blob,
            url: URL.createObjectURL(blob),
            fileName: `recording-${Date.now()}.webm`,
          });
          stopTracks();
        } catch {
          const message = 'Failed to save recording. Please try again.';
          setError(message);
          onError?.(message);
        } finally {
          setRecording(false);
          setElapsed(0);
        }
      };

      recorder.onerror = () => {
        stopRecordingPipeline();
        const message = 'Recording failed. Please try again.';
        setError(message);
        onError?.(message);
        setRecording(false);
        setElapsed(0);
      };

      recorder.start(250);
      setRecording(true);
      setError(null);
    } catch (err) {
      stopRecordingPipeline();
      const message = getMediaErrorMessage(err);
      setError(message);
      onError?.(message);
    }
  }, [onError, onRecorded, stopRecordingPipeline, stopTracks]);

  const startCountdown = () => {
    if (disabled || uploading || recording || countdown !== null) return;
    setError(null);
    setCountdown(RECORDING_COUNTDOWN_SECONDS);

    let remaining = RECORDING_COUNTDOWN_SECONDS;
    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearCountdownTimer();
        setCountdown(null);
        beginRecording();
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  };

  const cancelCountdown = () => {
    clearCountdownTimer();
    setCountdown(null);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const busy = disabled || uploading || recording || countdown !== null;
  const statusMessage = (() => {
    if (error) return null;
    if (!cameraReady) return 'Requesting camera and microphone access…';
    if (hasAudio) return 'Camera ready · Microphone ready';
    return 'Camera ready · Allow microphone for audio in your response';
  })();

  return (
    <div className="space-y-4">
      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Permission or device error</p>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-xl border border-border bg-black aspect-video shadow-inner">
        <Webcam
          ref={webcamRef}
          audio
          muted
          mirrored={false}
          screenshotFormat="image/jpeg"
          videoConstraints={VIDEO_CONSTRAINTS}
          onUserMedia={handleUserMedia}
          onUserMediaError={handleUserMediaError}
          className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
        />

        {!cameraReady && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-sm text-white">
            <Video size={28} className="opacity-80" />
            <span>Starting camera…</span>
          </div>
        )}

        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-[2px]">
            <span
              key={countdown}
              className="animate-pulse text-7xl font-bold tabular-nums text-white drop-shadow-lg sm:text-8xl"
            >
              {countdown}
            </span>
          </div>
        )}

        {recording && (
          <>
            <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-black/75 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              REC {formatRecordingTime(elapsed)}
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-red-500/80 animate-pulse" />
          </>
        )}
      </div>

      {statusMessage && (
        <div className="flex items-center justify-center gap-3 text-xs text-muted sm:text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Video size={14} className={cameraReady ? 'text-green-600' : 'text-muted'} />
            {cameraReady ? 'Camera on' : 'Camera…'}
          </span>
          <span className="text-border">·</span>
          <span className="inline-flex items-center gap-1.5">
            <Mic size={14} className={hasAudio ? 'text-green-600' : 'text-amber-600'} />
            {hasAudio ? 'Mic on' : 'Mic pending'}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        {recording ? (
          <Button
            type="button"
            className="w-full sm:w-auto sm:min-w-[200px] rounded-full"
            onClick={stopRecording}
            disabled={uploading}
          >
            <Square size={16} className="fill-current" />
            Stop recording
          </Button>
        ) : countdown !== null ? (
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto sm:min-w-[200px] rounded-full"
            onClick={cancelCountdown}
          >
            Cancel countdown
          </Button>
        ) : (
          <Button
            type="button"
            className="w-full sm:w-auto sm:min-w-[200px] rounded-full shadow-md shadow-accent/20"
            onClick={startCountdown}
            disabled={!cameraReady || Boolean(error) || busy}
          >
            <Circle size={16} className="fill-current text-white" />
            {uploading ? 'Uploading…' : 'Start recording'}
          </Button>
        )}
      </div>

      <p className="text-center text-xs text-muted">
        A {RECORDING_COUNTDOWN_SECONDS}-second countdown plays before recording begins.
      </p>
    </div>
  );
}
