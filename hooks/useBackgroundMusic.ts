import { useEffect, useRef } from 'react';
import { Audio } from 'expo-av';

const TRACK = require('../assets/sounds/soundtrack.mp3');

export function useBackgroundMusic() {
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        // playsInSilentModeIOS: true is required when staysActiveInBackground is true
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });

        const { sound } = await Audio.Sound.createAsync(TRACK, {
          isLooping: true,
          volume: 0.35,
          shouldPlay: true,
        });

        if (!mounted) { sound.unloadAsync(); return; }
        soundRef.current = sound;
      } catch (e) {
        console.warn('[BGM]', e);
      }
    }

    load();
    return () => {
      mounted = false;
      soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, []);
}
