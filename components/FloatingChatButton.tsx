import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, TouchableOpacity, Vibration, View } from 'react-native';

const WAVE_COUNT = 3;
const BUTTON_SIZE = 60;
const WAVE_MAX_SCALE = 2.2;
const WAVE_DURATION = 2000;
const WAVE_STAGGER = 670;

interface FloatingChatButtonProps {
  bottomOffset?: number;
}

function WaveRing({ delay }: { delay: number }) {
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const runWave = () => {
      scale.setValue(0.4);
      opacity.setValue(0.5);

      Animated.parallel([
        Animated.timing(scale, {
          toValue: WAVE_MAX_SCALE,
          duration: WAVE_DURATION,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: WAVE_DURATION,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
      ]).start();
    };

    const timeout = setTimeout(runWave, delay);
    const interval = setInterval(runWave, WAVE_DURATION + WAVE_STAGGER);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [delay, scale, opacity]);

  return (
    <Animated.View
      style={[
        styles.waveRing,
        {
          width: BUTTON_SIZE,
          height: BUTTON_SIZE,
          borderRadius: BUTTON_SIZE / 2,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

export function FloatingChatButton({ bottomOffset = 110 }: FloatingChatButtonProps) {
  const router = useRouter();

  return (
    <View
      style={[
        styles.floatingContainer,
        { bottom: bottomOffset },
      ]}
    >
      {Array.from({ length: WAVE_COUNT }).map((_, i) => (
        <WaveRing key={i} delay={i * WAVE_STAGGER} />
      ))}
      <View style={styles.buttonWrapper}>
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() => { Vibration.vibrate(10); router.push('/(tabs)/chat'); }}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubble-ellipses" size={30} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    right: 20,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'ios' ? { zIndex: 9999 } : null),
  },
  waveRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.25)',
    backgroundColor: 'transparent',
  },
  buttonWrapper: {
    position: 'absolute',
  },
  floatingButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
});

