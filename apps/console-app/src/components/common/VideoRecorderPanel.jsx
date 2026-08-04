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
 * Ask for camera/mic once via getUserMedia, then mount the webcam preview.
 * Avoids needing a full page reload after the user grants permission.
 */
async function requestMediaAccess() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: VIDEO_CONSTRAINTS,
    audio: true,
  });
  stream.getTracks().forEach((track) => track.stop());
}

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

  const [permissionState, setPermissionState] = useState('unknown'); // unknown | granted | prompt | denied
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [error, setError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [webcamKey, setWebcamKey] = useState(0);

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
    let cancelled = false;

    async function checkExistingPermission() {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setPermissionState('denied');
          setError('Video recording is not supported in this browser.');
        }
        return;
      }

      try {
        if (navigator.permissions?.query) {
          const [camera, microphone] = await Promise.all([
            navigator.permissions.query({ name: 'camera' }).catch(() => null),
            navigator.permissions
              .query({ name: 'microphone' })
              .catch(() => null),
          ]);
          if (cancelled) return;
          if (
            camera?.state === 'granted' &&
            (!microphone || microphone.state === 'granted')
          ) {
            setPermissionState('granted');
            return;
          }
          if (camera?.state === 'denied' || microphone?.state === 'denied') {
            setPermissionState('denied');
            return;
          }
        }
      } catch {
        // Permissions API unsupported — fall through to prompt UI.
      }

      if (!cancelled) setPermissionState('prompt');
    }

    checkExistingPermission();
    return () => {
      cancelled = true;
    };
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
    setPermissionState('denied');
    onError?.(message);
  };

  const handleAllowMedia = async () => {
    if (requestingPermission) return;
    setRequestingPermission(true);
    setError(null);
    try {
      await requestMediaAccess();
      setPermissionState('granted');
      setWebcamKey((key) => key + 1);
      setCameraReady(false);
    } catch (err) {
      handleUserMediaError(err);
    } finally {
      setRequestingPermission(false);
    }
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

  if (permissionState === 'unknown') {
    return (
      <div className="flex min-h-[14rem] items-center justify-center rounded-xl border border-border bg-hover/40 text-sm text-muted">
        Checking camera permissions…
      </div>
    );
  }

  if (permissionState !== 'granted') {
    return (
      <div className="space-y-4">
        {error ? (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Permission or device error</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-hover/30 px-6 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <Video size={28} />
          </div>
          <div className="max-w-sm space-y-1.5">
            <p className="text-base font-semibold text-heading">
              Allow camera & microphone
            </p>
            <p className="text-sm text-muted">
              Your browser will ask for permission. After you allow access, recording
              starts here — no page reload needed.
            </p>
          </div>
          <Button
            type="button"
            className="rounded-full px-6 shadow-md shadow-accent/20"
            onClick={handleAllowMedia}
            disabled={disabled || uploading || requestingPermission}
          >
            {requestingPermission ? 'Waiting for permission…' : 'Allow & continue'}
          </Button>
        </div>
      </div>
    );
  }

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
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Permission or device error</p>
            <p className="mt-1">{error}</p>
            <button
              type="button"
              className="mt-2 text-xs font-semibold underline"
              onClick={handleAllowMedia}
            >
              Try again
            </button>
          </div>
        </div>
      ) : null}

      <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-black shadow-inner">
        <Webcam
          key={webcamKey}
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
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/75 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              REC {formatRecordingTime(elapsed)}
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 animate-pulse bg-red-500/80" />
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
            className="w-full rounded-full sm:w-auto sm:min-w-[200px]"
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
            className="w-full rounded-full sm:w-auto sm:min-w-[200px]"
            onClick={cancelCountdown}
          >
            Cancel countdown
          </Button>
        ) : (
          <Button
            type="button"
            className="w-full rounded-full shadow-md shadow-accent/20 sm:w-auto sm:min-w-[200px]"
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
