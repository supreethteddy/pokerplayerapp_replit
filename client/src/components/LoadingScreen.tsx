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

  useEffect(() => {
    // Force fresh video load each time by clearing any cached state
    setVideoLoaded(false);
    setShowFallback(false);
    
    // Allow video to play to full completion (remove auto-timeout)
    // Only fallback timeout for emergency cases
    const maxTimer = setTimeout(() => {
      console.log('🚨 [EMERGENCY] Video max timeout reached - forcing completion');
      setShowVideo(false);
      onComplete();
    }, 15000); // 15 seconds emergency timeout

    // Show fallback after 3 seconds if video doesn't load  
    const fallbackTimer = setTimeout(() => {
      if (!videoLoaded) {
        console.log('🎬 [FALLBACK] Video not loaded, showing fallback welcome screen');
        setShowFallback(true);
        // Let fallback display for reasonable time, then complete
        setTimeout(() => {
          console.log('🎬 [FALLBACK] Fallback display complete - proceeding to dashboard');
          onComplete();
        }, 3000);
      }
    }, 3000);

    // Clear session storage flags to ensure video shows next time
    return () => {
      clearTimeout(maxTimer);
      clearTimeout(fallbackTimer);
    };
  }, [onComplete]);

  const handleVideoEnd = () => {
    console.log('🎬 [WELCOME VIDEO] Video playback completed naturally');
    setTimeout(() => {
      console.log('🎬 [WELCOME VIDEO] Transitioning to dashboard after video end');
      setShowVideo(false);
      onComplete();
    }, 500); // Small delay for smooth transition
  };

  const handleVideoLoad = () => {
    console.log('Video loaded successfully - attempting autoplay with audio');
    setVideoLoaded(true);
    setShowFallback(false);
    
    // Ensure video plays with audio - try multiple times if needed
    const video = document.querySelector('video');
    if (video) {
      // Force unmute and try to play
      video.muted = false;
      video.volume = 1.0;
      
      const attemptPlay = () => {
        video.play().catch((error) => {
          console.error('Video autoplay failed:', error);
          // Try again after a short delay
          setTimeout(attemptPlay, 100);
        });
      };
      
      attemptPlay();
    }
  };

  const handleVideoError = (e: any) => {
    console.error('Video failed to load:', e);
    setShowFallback(true);
  };

  if (!showVideo) return null;

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center overflow-hidden">
      <div className="relative w-full h-full">
        {/* MP4 Video with Audio */}
        <video 
          autoPlay 
          playsInline
          onEnded={handleVideoEnd}
          onLoadedData={handleVideoLoad}
          onError={handleVideoError}
          className="w-full h-full object-cover"
          style={{ display: showFallback ? 'none' : 'block' }}
          controls={false}
          preload="metadata"
          key={Date.now()} // Force fresh video load
        >
          <source src={tiltReelsVideo} type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        {/* Fallback content if video doesn't load */}
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
        
        {/* Skip button overlay */}
        <button 
          onClick={handleVideoEnd}
          className="absolute bottom-8 right-8 text-white bg-black bg-opacity-50 hover:bg-opacity-70 px-4 py-2 rounded-lg transition-all text-sm backdrop-blur-sm"
        >
          Skip →
        </button>
        
        {/* Loading indicator for video */}
        {!videoLoaded && !showFallback && (
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