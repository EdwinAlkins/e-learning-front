'use client';

import { forwardRef, useImperativeHandle, useRef, useEffect, useMemo } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { usePlayerStore } from '../stores/player.store';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type Player = ReturnType<typeof videojs>;

export interface VideoPlayerRef {
  seekTo: (time: number) => void;
}

interface VideoPlayerProps {
  videoId: string;
}

const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ videoId }, ref) => {
    const videoContainer = useRef<HTMLDivElement>(null); // On cible le conteneur (div), pas la video
    const player = useRef<Player | null>(null);
    const { setCurrentTime, setIsPlaying, updateProgress } = usePlayerStore();
    const videoUrl = `${API_BASE_URL}/videos/${videoId}/stream?user_uid=${localStorage.getItem('user_uid') ?? ''}`;

    const options = useMemo(
      () => ({
        controls: true,
        responsive: true,
        fluid: true,
        playbackRates: [0.5, 1, 1.25, 1.5, 2],
        sources: [
          {
            src: videoUrl,
            type: 'video/mp4',
          },
        ],
      }),
      [videoUrl]
    );

    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        if (player.current) {
          player.current.currentTime(time);
          setCurrentTime(time);
        }
      },
    }));

    useEffect(() => {
      // S'assurer que le player n'est pas déjà instancié
      if (player.current) {
        // Si le player existe déjà (mise à jour des props)
        const currentPlayer = player.current;
        currentPlayer.src(options.sources);
        return;
      }

      // 1. On crée l'élément vidéo manuellement
      // Cela garantit que l'élément est neuf à chaque montage
      const videoElement = document.createElement('video-js');
      videoElement.classList.add('vjs-big-play-centered');

      // 2. On l'ajoute dans notre div conteneur
      if (videoContainer.current) {
        videoContainer.current.appendChild(videoElement);

        // 3. On initialise Video.js sur cet élément tout neuf
        player.current = videojs(videoElement, options, () => {
          // console.log('Player is ready');

          // Event handlers
          if (player.current) {
            const handleTimeUpdate = () => {
              const currentTime = player.current?.currentTime();
              if (currentTime) {
                updateProgress(currentTime);
              }
            };

            const handlePlay = () => {
              setIsPlaying(true);
            };

            const handlePause = () => {
              setIsPlaying(false);
            };

            player.current.on('timeupdate', handleTimeUpdate);
            player.current.on('play', handlePlay);
            player.current.on('pause', handlePause);
          }
        });
      }
    }, [options, setIsPlaying, updateProgress, setCurrentTime]);

    // Nettoyage impératif
    useEffect(() => {
      const playerCurrent = player.current;

      return () => {
        // On détruit le player et on remet le compteur à zéro
        if (playerCurrent && !playerCurrent.isDisposed()) {
          playerCurrent.dispose();
          player.current = null;
        }
      };
    }, []);

    // Le JSX ne rend qu'un conteneur vide.
    // C'est le useEffect qui va injecter la vidéo dedans.
    return (
      <div
        ref={videoContainer}
        style={{ width: '100%', maxWidth: '100%' }}
      />
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
