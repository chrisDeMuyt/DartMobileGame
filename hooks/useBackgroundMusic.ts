import { useEffect, useState } from 'react';
import { Audio } from 'expo-av';

const TRACK = require('../assets/sounds/soundtrack.mp3');

// Module-level singleton — shared across the whole app lifetime
let _sound: Audio.Sound | null = null;
let _isMuted = false;
const _listeners = new Set<(muted: boolean) => void>();

function notifyListeners() {
  _listeners.forEach(fn => fn(_isMuted));
}

export function toggleMusicMute() {
  _isMuted = !_isMuted;
  _sound?.setIsMutedAsync(_isMuted);
  notifyListeners();
}

export function useMuteState(): boolean {
  const [isMuted, setIsMuted] = useState(_isMuted);
  useEffect(() => {
    _listeners.add(setIsMuted);
    return () => { _listeners.delete(setIsMuted); };
  }, []);
  return isMuted;
}

export function useBackgroundMusic() {
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });

        const { sound } = await Audio.Sound.createAsync(TRACK, {
          isLooping: true,
          volume: 0.35,
          shouldPlay: true,
          isMuted: _isMuted,
        });

        if (!mounted) { sound.unloadAsync(); return; }
        _sound = sound;
      } catch (e) {
        console.warn('[BGM]', e);
      }
    }

    load();
    return () => {
      mounted = false;
      _sound?.unloadAsync();
      _sound = null;
    };
  }, []);
}
