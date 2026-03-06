import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { GameMode } from '../lib/gameLogic';

const MODES: { id: GameMode; label: string; description: string; maxPlayers: number }[] = [
  { id: 'practice', label: 'Practice', description: 'Free throw — no rules', maxPlayers: 1 },
  { id: '301', label: '301', description: 'Count down from 301 to 0', maxPlayers: 2 },
  { id: '501', label: '501', description: 'Count down from 501 to 0', maxPlayers: 2 },
  { id: 'cricket', label: 'Cricket', description: 'Close 15–20 & Bull first', maxPlayers: 2 },
];

export default function HomeScreen() {
  const [selectedMode, setSelectedMode] = useState<GameMode>('301');
  const [numPlayers, setNumPlayers] = useState(2);
  const [player1, setPlayer1] = useState('Player 1');
  const [player2, setPlayer2] = useState('Player 2');

  const mode = MODES.find(m => m.id === selectedMode)!;
  const showTwoPlayers = numPlayers === 2 && mode.maxPlayers >= 2;

  function startGame() {
    const params: Record<string, string> = {
      mode: selectedMode,
      numPlayers: String(numPlayers),
      player1: player1.trim() || 'Player 1',
      player2: player2.trim() || 'Player 2',
    };
    router.push({ pathname: '/game', params });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Darts</Text>
        <Text style={styles.subtitle}>Swipe up to throw</Text>

        {/* Mode selection */}
        <Text style={styles.sectionLabel}>Game Mode</Text>
        <View style={styles.modeGrid}>
          {MODES.map(m => (
            <TouchableOpacity
              key={m.id}
              style={[styles.modeCard, selectedMode === m.id && styles.modeCardActive]}
              onPress={() => {
                setSelectedMode(m.id);
                if (m.maxPlayers < 2) setNumPlayers(1);
              }}
            >
              <Text style={[styles.modeLabel, selectedMode === m.id && styles.modeLabelActive]}>
                {m.label}
              </Text>
              <Text style={styles.modeDesc}>{m.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Players */}
        {mode.maxPlayers >= 2 && selectedMode !== 'practice' && (
          <>
            <Text style={styles.sectionLabel}>Players</Text>
            <View style={styles.playerToggle}>
              {[1, 2].map(n => (
                <TouchableOpacity
                  key={n}
                  style={[styles.toggleBtn, numPlayers === n && styles.toggleBtnActive]}
                  onPress={() => setNumPlayers(n)}
                >
                  <Text style={[styles.toggleText, numPlayers === n && styles.toggleTextActive]}>
                    {n} {n === 1 ? 'Player' : 'Players'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.nameRow}>
              <TextInput
                style={styles.nameInput}
                value={player1}
                onChangeText={setPlayer1}
                placeholder="Player 1"
                placeholderTextColor="#555"
                maxLength={16}
              />
              {showTwoPlayers && (
                <TextInput
                  style={styles.nameInput}
                  value={player2}
                  onChangeText={setPlayer2}
                  placeholder="Player 2"
                  placeholderTextColor="#555"
                  maxLength={16}
                />
              )}
            </View>
          </>
        )}

        <TouchableOpacity style={styles.startBtn} onPress={startGame}>
          <Text style={styles.startBtnText}>Start Game</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
  container: {
    flex: 1,
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modeCardActive: {
    borderColor: '#4a9eff',
    backgroundColor: '#1a2a4a',
  },
  modeLabel: {
    color: '#ccc',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modeLabelActive: {
    color: '#4a9eff',
  },
  modeDesc: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  playerToggle: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#4a9eff',
  },
  toggleText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },
  toggleTextActive: {
    color: 'white',
  },
  nameRow: {
    flexDirection: 'row',
    gap: 8,
  },
  nameInput: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 12,
    color: 'white',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  startBtn: {
    backgroundColor: '#4a9eff',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 'auto',
  },
  startBtnText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
