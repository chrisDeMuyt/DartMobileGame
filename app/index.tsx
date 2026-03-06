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
import { PIXEL_FONT, pixelShadow, pixelShadowSm, COLORS } from '../lib/theme';

export default function HomeScreen() {
  const [playerName, setPlayerName] = useState('Player 1');

  function startGame() {
    router.push({ pathname: '/game', params: { playerName: playerName.trim() || 'Player 1' } });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Darts</Text>
        <Text style={styles.subtitle}>Swipe up to throw</Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoLine}>Reach your target each turn.</Text>
          <Text style={styles.infoLine}>Targets grow every turn.</Text>
          <Text style={styles.infoLine}>Miss once — game over.</Text>
        </View>

        <Text style={styles.sectionLabel}>Your Name</Text>
        <TextInput
          style={styles.nameInput}
          value={playerName}
          onChangeText={setPlayerName}
          placeholder="Player 1"
          placeholderTextColor="#7ab3cc"
          maxLength={16}
        />

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
    backgroundColor: COLORS.bgDark,
  },
  container: {
    flex: 1,
    padding: 20,
    gap: 14,
  },
  title: {
    fontFamily: PIXEL_FONT,
    fontSize: 22,
    color: COLORS.gold,
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 8,
    textShadowColor: COLORS.gold,
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 0,
  },
  subtitle: {
    fontFamily: PIXEL_FONT,
    fontSize: 7,
    color: COLORS.muted,
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 2,
  },
  infoCard: {
    backgroundColor: COLORS.bgPanel,
    borderWidth: 2,
    borderColor: COLORS.bgCard,
    padding: 14,
    gap: 6,
    ...pixelShadowSm,
  },
  infoLine: {
    fontFamily: PIXEL_FONT,
    color: COLORS.muted,
    fontSize: 7,
    letterSpacing: 1,
    lineHeight: 12,
  },
  sectionLabel: {
    fontFamily: PIXEL_FONT,
    fontSize: 8,
    color: COLORS.muted,
    letterSpacing: 2,
    marginTop: 4,
  },
  nameInput: {
    backgroundColor: COLORS.bgPanel,
    borderRadius: 0,
    padding: 12,
    color: COLORS.bright,
    fontSize: 10,
    fontFamily: PIXEL_FONT,
    borderWidth: 2,
    borderColor: COLORS.bgCard,
  },
  startBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 0,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 'auto',
    borderWidth: 2,
    borderColor: COLORS.bright,
    ...pixelShadow,
  },
  startBtnText: {
    fontFamily: PIXEL_FONT,
    color: COLORS.bgDark,
    fontSize: 11,
    letterSpacing: 3,
  },
});
