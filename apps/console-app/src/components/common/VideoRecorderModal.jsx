import { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Circle, Square, AlertCircle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import {
  blobToDataUrl,
  getMediaErrorMessage,
  getSupportedVideoMimeType,
} from '../../utils/mediaHelpers';

const VIDEO_CONSTRAINTS = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  facingMode: 'user',
};

export default function VideoRecorderModal({ isOpen, onClose, onRecorded, title = 'Record Video' }) {
  const webcamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const resetState = useCallback(() => {
    setRecording(false);
    setError(null);
    setCameraReady(false);
    setElapsed(0);
    chunksRef.current = [];
    mediaRecorderRef.current = null;
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  useEffect(() => {
    if (!recording) return undefined;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  const handleUserMedia = () => {
    setError(null);
    setCameraReady(true);
  };

  const handleUserMediaError = (err) => {
    setCameraReady(false);
    setError(getMediaErrorMessage(err));
  };

  const stopTracks = () => {
    const stream = webcamRef.current?.stream;
    stream?.getTracks().forEach((track) => track.stop());
  };

  const handleClose = () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
    }
    stopTracks();
    onClose();
  };

  const startRecording = () => {
    const stream = webcamRef.current?.stream;
    if (!stream) {
      setError('Camera is not ready yet. Please wait or check permissions.');
      return;
    }

    const mimeType = getSupportedVideoMimeType();
    if (!mimeType) {
      setError('Video recording is not supported in this browser.');
      return;
    }

    try {
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const dataUrl = await blobToDataUrl(blob);
          onRecorded({
            type: 'video',
            url: dataUrl,
            fileName: `recording-${Date.now()}.webm`,
          });
          stopTracks();
          onClose();
        } catch {
          setError('Failed to save recording. Please try again.');
        } finally {
          setRecording(false);
        }
      };

      recorder.onerror = () => {
        setError('Recording failed. Please try again.');
        setRecording(false);
      };

      recorder.start(250);
      setRecording(true);
      setError(null);
    } catch (err) {
      setError(getMediaErrorMessage(err));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          {recording ? (
            <Button onClick={stopRecording}>
              <Square size={16} className="fill-current" /> Stop Recording
            </Button>
          ) : (
            <Button onClick={startRecording} disabled={!cameraReady || Boolean(error)}>
              <Circle size={16} className="fill-current text-white" /> Start Recording
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Allow camera and microphone access when prompted. Your recording will be used as intro media for candidates.
        </p>

        {error ? (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Permission or device error</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        ) : null}

        <div className="relative overflow-hidden rounded-xl bg-black aspect-video">
          <Webcam
            ref={webcamRef}
            audio
            muted
            mirrored
            screenshotFormat="image/jpeg"
            videoConstraints={VIDEO_CONSTRAINTS}
            onUserMedia={handleUserMedia}
            onUserMediaError={handleUserMediaError}
            className="h-full w-full object-cover"
          />

          {recording && (
            <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              REC {formatTime(elapsed)}
            </div>
          )}

          {!cameraReady && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-white">
              Requesting camera access...
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
