import { useEffect, useState } from 'react';
import tiltRoomLogo from "@assets/1_1752926810964.png";
import tiltReelsVideo from "@assets/Tilt Reels Endscreen_1752927966341.mp4";

interface LoadingScreenProps {
  onComplete: () => void;
}

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [showVideo, setShowVideo] = useState(true);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [videoError, setVideoError] = useState(false); // State to track video errors

  useEffect(() => {
    console.log('🎬 [WELCOME VIDEO] LoadingScreen component mounted, preparing video');

    // Always show the video when LoadingScreen is mounted - let App.tsx handle the logic
    console.log('🎬 [WELCOME VIDEO] Starting video playback experience');

    // Set starting flag to prevent duplicates
    sessionStorage.setItem('welcome_video_starting', 'true');

    // Emergency fallback if video completely fails to load after 8 seconds
    const fallbackTimer = setTimeout(() => {
      if (!videoLoaded && !videoError) { // Check videoError as well
        console.log('🎬 [FALLBACK] Video failed to load after 8 seconds, showing static welcome screen');
        setShowFallback(true);
        setShowVideo(false); // Hide the video element
        // Show fallback for 3 seconds, then proceed
        setTimeout(() => {
          console.log('🎬 [FALLBACK] Static welcome complete - proceeding to dashboard');
          sessionStorage.setItem('welcome_video_played', 'true');
          sessionStorage.removeItem('welcome_video_starting');
          onComplete();
        }, 3000);
      }
    }, 8000);

    return () => {
      clearTimeout(fallbackTimer);
    };
  }, [onComplete, videoLoaded, videoError]); // Added videoError to dependency array

  const handleVideoEnd = () => {
    console.log('🎬 [WELCOME VIDEO] Video playback completed naturally');
    sessionStorage.setItem('welcome_video_played', 'true');
    sessionStorage.removeItem('welcome_video_starting');
    sessionStorage.removeItem('just_signed_in');
    onComplete();
  };

  const handleSkipVideo = () => {
    console.log('🎬 [WELCOME VIDEO] User manually skipped video');
    sessionStorage.setItem('welcome_video_played', 'true');
    sessionStorage.removeItem('welcome_video_starting');
    sessionStorage.removeItem('just_signed_in');
    onComplete();
  };

  const handleVideoLoad = () => {
    console.log('🎬 [WELCOME VIDEO] Video loaded successfully');
    setVideoLoaded(true);
  };

  const handleVideoError = (error: any) => {
    console.error('🎬 [WELCOME VIDEO] Video failed to load:', error); // Use console.error for errors
    setVideoError(true);
    setShowFallback(true);
    setShowVideo(false);
    // Show fallback for 2 seconds, then proceed
    setTimeout(() => {
      console.log('🎬 [FALLBACK] Error fallback complete - proceeding to dashboard');
      sessionStorage.setItem('welcome_video_played', 'true');
      sessionStorage.removeItem('welcome_video_starting');
      onComplete();
    }, 2000);
  };

  const handleVideoCanPlay = () => {
    console.log('🎬 [WELCOME VIDEO] Video can start playing');
    setVideoLoaded(true);
  };

  if (!showVideo && !showFallback) {
    // This condition might be reached if video errors and onComplete is called before fallback shows
    // Or if the video was hidden by handleSkipVideo without onComplete being called immediately.
    // In a real app, you might want to ensure onComplete is always called eventually.
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center overflow-hidden">
      <div className="relative w-full h-full">
        {/* Video element */}
        {showVideo && !videoError && (
          <video
            autoPlay
            playsInline
            preload="auto" // Changed from metadata to auto for potentially faster loading
            onEnded={handleVideoEnd}
            onLoadedData={handleVideoLoad}
            onCanPlay={handleVideoCanPlay}
            onError={handleVideoError}
            onLoadStart={() => console.log('🎬 [WELCOME VIDEO] Video load started')}
            className="w-full h-full object-cover"
            // Removed inline style, handled by conditional rendering and CSS
          >
            <source src={tiltReelsVideo} type="video/mp4" />
            <source src="/welcome-video.mp4" type="video/mp4" /> {/* Added fallback source */}
            Your browser does not support the video tag.
          </video>
        )}

        {/* Fallback content if video doesn't load or errors */}
        {showFallback && (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-black">
            <div className="flex flex-col items-center space-y-8">
              <div className="animate-pulse">
                <img
                  src={tiltRoomLogo}
                  alt="Tilt Room Logo"
                  className="w-80 h-40 object-contain brightness-110 contrast-110"
                  style={{
                    filter: 'drop-shadow(0 4px 16px rgba(0, 0, 0, 0.4))'
                  }}
                />
              </div>
              <div className="text-white text-2xl font-light tracking-wider animate-fade-in">
                Welcome to Tilt Room
              </div>
              <div className="w-64 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 rounded-full animate-loading-bar"></div>
              </div>
            </div>
          </div>
        )}

        {/* Skip button overlay - only show if video is playing and no fallback */}
        {showVideo && !showFallback && (
          <button
            onClick={handleSkipVideo}
            className="absolute bottom-8 right-8 text-white bg-black bg-opacity-50 hover:bg-opacity-70 px-4 py-2 rounded-lg transition-all text-sm backdrop-blur-sm z-10"
          >
            Skip →
          </button>
        )}

        {/* Loading indicator for video - show if video is intended to play but not loaded/can play yet, and no error */}
        {showVideo && !videoLoaded && !showFallback && !videoError && (
          <div className="absolute inset-0 bg-black flex items-center justify-center">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              <div className="text-white text-sm">Loading...</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}