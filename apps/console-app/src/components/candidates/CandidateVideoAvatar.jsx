import { User, Play } from 'lucide-react';
import { useState } from 'react';

/**
 * Displays a candidate video avatar.
 * @param candidate - The candidate to display.
 * @param className - The class name of the video avatar.
 * @param showPlayIcon - Whether to show the play icon.
 * @returns The candidate video avatar.
 */
export default function CandidateVideoAvatar({
  candidate,
  className = 'h-11 w-11 rounded-full',
  showPlayIcon = false,
}) {
  const [videoFailed, setVideoFailed] = useState(false);
  const initials =
    `${candidate.firstName?.[0] || ''}${candidate.lastName?.[0] || ''}`.toUpperCase() || '?';
  const videoUrl = candidate.videoUrl;

  if (candidate.videoThumbnail) {
    return (
      <div className={`relative shrink-0 overflow-hidden bg-hover ${className}`}>
        <img src={candidate.videoThumbnail} alt="" className="h-full w-full object-cover" />
        {showPlayIcon && videoUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Play size={20} className="text-white" fill="white" />
          </div>
        )}
      </div>
    );
  }

  if (videoUrl && !videoFailed) {
    return (
      <div className={`relative shrink-0 overflow-hidden bg-black ${className}`}>
        <video
          src={videoUrl}
          muted
          playsInline
          preload="metadata"
          onError={() => setVideoFailed(true)}
          className="h-full w-full object-cover"
        />
        {showPlayIcon && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/25">
            <Play size={18} className="text-white" fill="white" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex shrink-0 items-center justify-center bg-hover ${className}`}>
      <span className="text-sm font-semibold text-muted">{initials || <User size={18} />}</span>
    </div>
  );
}
