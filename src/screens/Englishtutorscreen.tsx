import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  PixelRatio,
  Platform,
  StatusBar,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
} from 'react-native';
import Svg, { Path, Circle, Rect, G, Ellipse } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type AudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';

/**
 * EnglishTutorScreen
 * ──────────────────────────────────────────────────────────────────────────
 * A dedicated, professional "live AI tutor" experience for English fluency
 * practice — similar in spirit to dedicated speaking-practice / tutoring apps.
 *
 * Flow:
 *   1) SETUP   — learner picks a session length (1 min … 60 min, or custom).
 *   2) SESSION — a visual animated AI tutor avatar (not an emoji) runs a
 *                continuous spoken Q&A: it always asks a follow-up question,
 *                gently corrects grammar/pronunciation, scores fluency, and
 *                counts down the chosen time. Session auto-ends at 00:00.
 *   3) SUMMARY — a short report card: average fluency score, number of
 *                questions answered, and a recap of corrections to review.
 *
 * Drop this in as its own screen/route (e.g. "EnglishTutorScreen") and
 * navigate to it from a "Speak English" entry point in your app/menu.
 */

// ─── Responsive Helpers (matches other screens in the app) ──────────────────
const { width: SCREEN_W } = Dimensions.get('window');
const BASE_WIDTH = 393;
const scale = SCREEN_W / BASE_WIDTH;
const rs = (size: number) => Math.round(size * Math.min(scale, 1.5));
const fs = (size: number) =>
  Math.round((size * Math.min(scale, 1.3)) / PixelRatio.getFontScale());

// ─── Brand Colors (matches app) ──────────────────────────────────────────────
const C = {
  accent: '#0E7EA4',
  accentDark: '#0A5F7A',
  accentLight: '#EDF6FA',
  accentMid: '#1591B8',
  bg: '#F2F5F7',
  white: '#FFFFFF',
  dark: '#1A2B35',
  muted: '#7AA0B0',
  mutedLight: '#9BBAC8',
  border: 'rgba(14,126,164,0.09)',
  danger: '#D9534F',
  success: '#2ECC9A',
  gold: '#FFD15C',
};

// ─── Gemini Config ────────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
];

const CALL_RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

// Structured-JSON tutor prompt. Keeps the AI continuously driving the
// conversation forward with a fresh question every single turn, like a
// real one-on-one spoken-English coaching session.
const TUTOR_SYSTEM_PROMPT = (minutesLeftAtStart: number, level: string) => `You are "Study Buddy", a friendly, enthusiastic AI English-speaking peer/classmate buddy. Speak in a warm, encouraging, and child-friendly tone, using simple, clear, and age-appropriate language (like a peer or classmate of a similar age). Do not use complex, overly mature academic jargon. You are running a timed ${minutesLeftAtStart}-minute one-on-one speaking session with a student. The student's self-rated level is "${level}".

Your job for the ENTIRE session:
- Keep a natural, flowing spoken conversation going. NEVER let the conversation stall.
- EVERY single reply must end with exactly one new, clear follow-up question, so the student always has something to answer next. Vary the topics (daily life, opinions, hypotheticals, work/school, describing things, storytelling) and gradually raise the difficulty as the session goes on.
- After listening to the student's spoken answer, briefly and kindly point out at most ONE grammar or word-choice mistake (or null if none), and ONE pronunciation tip (or null if it was clear).
- Rate the student's fluency for that turn from 0-100, considering grammar, vocabulary range, and confidence/flow (not just correctness).
- Keep your spoken "reply" short (1-3 sentences) since it is read aloud by text-to-speech — long replies feel unnatural in a live call.
- Be warm, encouraging, and specific. Never sound like a checklist or a robot reciting rules.
- If the student asks to pause, switch topics, or says something off-topic, gently steer back to English-speaking practice.

Respond with ONLY a JSON object (no markdown, no commentary, nothing outside the braces) in exactly this shape:
{
  "reply": "your short spoken reply, ending with one new follow-up question",
  "correction": "a short, kind grammar/word-choice correction, or null",
  "pronunciationTip": "a short, specific pronunciation tip, or null",
  "score": a whole number from 0 to 100
}`;

const FIRST_QUESTIONS = [
  "Hi! I'm your AI English buddy. Let's get started — tell me, what did you do earlier today?",
  "Hi there! Ready to practice? To begin, what's one thing you're looking forward to this week?",
  "Hello! Let's warm up — can you describe your favorite place in a few sentences?",
  "Hi! Let's begin. If you could learn any new skill this year, what would it be and why?",
];

const SESSION_LENGTHS = [
  { id: '1', minutes: 1, label: '1 min', sub: 'Quick check' },
  { id: '5', minutes: 5, label: '5 min', sub: 'Short practice' },
  { id: '10', minutes: 10, label: '10 min', sub: 'Standard' },
  { id: '15', minutes: 15, label: '15 min', sub: 'Focused' },
  { id: '20', minutes: 20, label: '20 min', sub: 'Deep practice' },
  { id: '30', minutes: 30, label: '30 min', sub: 'Full lesson' },
  { id: '45', minutes: 45, label: '45 min', sub: 'Extended' },
  { id: '60', minutes: 60, label: '60 min', sub: 'Full hour' },
];

const LEVELS = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];

// English accent options — mapped to BCP-47 language codes that expo-speech
// passes to the platform TTS engine. Actual available accents/voices still
// depend on what's installed on the device.
const ACCENTS = [
  { id: 'en-US', label: 'American', flag: '🇺🇸' },
  { id: 'en-GB', label: 'British', flag: '🇬🇧' },
  { id: 'en-IN', label: 'Indian', flag: '🇮🇳' },
  { id: 'en-AU', label: 'Australian', flag: '🇦🇺' },
];

// Voice gender preference — pitch tuned for natural child-sounding TTS.
const VOICE_GENDERS = [
  { id: 'female', label: 'Girl Buddy', pitch: 1.65, rate: 0.94 },
  { id: 'male', label: 'Boy Buddy', pitch: 1.5, rate: 0.92 },
];

const INTRO_LINE = "Hi! I'm your AI English buddy. Let's practice speaking English together and have fun!";

const getVoiceConfig = (voices: any[], genderId: string, accentId: string) => {
  const accentLang = accentId.toLowerCase();
  const accentShort = accentId.split('-')[0].toLowerCase();
  
  const matchingLangVoices = (voices || []).filter(v => {
    const vLang = v.language.toLowerCase();
    return vLang === accentLang || vLang.replace('_', '-') === accentLang || vLang.startsWith(accentShort);
  });

  let bestVoice: any;
  let usePitch = genderId === 'female' ? 1.65 : 1.5; 
  let useRate = genderId === 'female' ? 0.94 : 0.92;

  if (genderId === 'female') {
    // Look for iOS child voices (Noelle/Joelle) or containing child/kid
    bestVoice = matchingLangVoices.find(v => {
      const name = v.name.toLowerCase();
      const id = v.identifier.toLowerCase();
      return name.includes('noelle') || name.includes('joelle') || id.includes('noelle') || id.includes('joelle');
    });

    if (bestVoice) {
      // Native child voice found! No need to pitch shift heavily
      usePitch = 1.0; 
      useRate = 0.94;
    }
  }

  // If no native child voice was found or we want male/Boy Buddy, let's find the best fallback voice
  if (!bestVoice && matchingLangVoices.length > 0) {
    if (genderId === 'female') {
      bestVoice = matchingLangVoices.find(v => {
        const name = v.name.toLowerCase();
        return name.includes('samantha') || name.includes('zira') || name.includes('female') || name.includes('girl');
      }) || matchingLangVoices[0];
    } else {
      bestVoice = matchingLangVoices.find(v => {
        const name = v.name.toLowerCase();
        return name.includes('david') || name.includes('male') || name.includes('boy');
      }) || matchingLangVoices[0];
    }
  }

  return {
    voice: bestVoice?.identifier,
    pitch: usePitch,
    rate: useRate,
  };
};

type TutorStatus = 'idle' | 'listening' | 'thinking' | 'speaking' | 'ended';

interface Turn {
  id: string;
  reply: string;
  correction?: string | null;
  pronunciationTip?: string | null;
  score?: number;
}

const pad2 = (n: number) => n.toString().padStart(2, '0');
const formatTime = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${pad2(m)}:${pad2(sec)}`;
};

// ─── Icons ─────────────────────────────────────────────────────────────────────
const BackIcon = () => (
  <Svg width={rs(22)} height={rs(22)} viewBox="0 0 24 24" fill="none">
    <Path d="M15 18l-6-6 6-6" stroke={C.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const MicIcon = ({ color = C.white }: { color?: string }) => (
  <Svg width={rs(20)} height={rs(20)} viewBox="0 0 24 24" fill="none">
    <Path d="M9 2h6a3 3 0 013 3v6a3 3 0 01-3 3H9a3 3 0 01-3-3V5a3 3 0 013-3z" stroke={color} strokeWidth="1.8" />
    <Path d="M5 11a7 7 0 0014 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M12 18v3M9 21h6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

const StopIcon = () => (
  <Svg width={rs(18)} height={rs(18)} viewBox="0 0 24 24" fill="none">
    <Path d="M6 6h12v12H6z" fill={C.white} />
  </Svg>
);

const ClockIcon = () => (
  <Svg width={rs(15)} height={rs(15)} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={C.white} strokeWidth="1.8" />
    <Path d="M12 7v5l3.5 2" stroke={C.white} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const TrophyIcon = () => (
  <Svg width={rs(34)} height={rs(34)} viewBox="0 0 24 24" fill="none">
    <Path d="M7 4h10v4a5 5 0 01-10 0V4z" stroke={C.accentDark} strokeWidth="1.8" strokeLinejoin="round" />
    <Path d="M7 5H4a3 3 0 003 5M17 5h3a3 3 0 01-3 5" stroke={C.accentDark} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M12 13v3M9 20h6M10 20v-2h4v2" stroke={C.accentDark} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

const tutorAvatarStyles = StyleSheet.create({
  dot: { width: rs(6), height: rs(6), borderRadius: rs(3), backgroundColor: C.accentMid },
});

// ─── Robot Avatar — ai-robo.png ──────────────────────────────────────────────
// Uses the real robot artwork for the face. Pulses a ring while listening,
// glows gold while speaking, and bounces dots while thinking.
const RoboAvatar = ({ status, size = 150 }: { status: TutorStatus; size?: number }) => {
  const pulse = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  // Gentle idle bob, always running.
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [bob]);

  // Status pulse ring.
  useEffect(() => {
    pulse.setValue(0);
    if (status === 'idle' || status === 'ended') return;
    const speed = status === 'listening' ? 900 : status === 'speaking' ? 700 : 1200;
    const anim = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: speed, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    anim.start();
    return () => anim.stop();
  }, [status, pulse]);

  // Thinking dots.
  useEffect(() => {
    if (status !== 'thinking') {
      dot1.setValue(0); dot2.setValue(0); dot3.setValue(0);
      return;
    }
    const bounce = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(val, { toValue: 0, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: false }),
          Animated.delay(260),
        ])
      );
    const a1 = bounce(dot1, 0);
    const a2 = bounce(dot2, 140);
    const a3 = bounce(dot3, 280);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [status, dot1, dot2, dot3]);

  const ringColor =
    status === 'listening' ? C.success
    : status === 'speaking' ? C.gold
    : status === 'thinking' ? C.accentMid
    : 'rgba(255,255,255,0.2)';

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.7, 0.35, 0] });
  const bobTranslate = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const dotY1 = dot1.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const dotY2 = dot2.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const dotY3 = dot3.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {status !== 'idle' && status !== 'ended' && (
        <Animated.View
          style={{
            position: 'absolute',
            width: size * 1.05, height: size * 1.05,
            borderRadius: (size * 1.05) / 2,
            borderWidth: 3, borderColor: ringColor,
            opacity: ringOpacity, transform: [{ scale: ringScale }],
          }}
        />
      )}
      <Animated.View style={{ transform: [{ translateY: bobTranslate }] }}>
        <Image
          source={require('../../assets/ai-robo.png')}
          style={{ width: size, height: size, resizeMode: 'contain' }}
        />
      </Animated.View>

      {status === 'thinking' && (
        <View style={{ position: 'absolute', top: size * 0.0, flexDirection: 'row', gap: rs(5) }}>
          <Animated.View style={[tutorAvatarStyles.dot, { transform: [{ translateY: dotY1 }] }]} />
          <Animated.View style={[tutorAvatarStyles.dot, { transform: [{ translateY: dotY2 }] }]} />
          <Animated.View style={[tutorAvatarStyles.dot, { transform: [{ translateY: dotY3 }] }]} />
        </View>
      )}
    </View>
  );
};

// ─── Intro screen: robot + intro options animate in parallel instantaneously ──
const IntroScreen = ({
  onGetStarted,
  selectedAccent,
  setSelectedAccent,
  selectedGender,
  setSelectedGender,
  voices,
}: {
  onGetStarted: () => void;
  selectedAccent: typeof ACCENTS[number];
  setSelectedAccent: (a: typeof ACCENTS[number]) => void;
  selectedGender: typeof VOICE_GENDERS[number];
  setSelectedGender: (g: typeof VOICE_GENDERS[number]) => void;
  voices: any[];
}) => {
  const insets = useSafeAreaInsets();

  // Animation values
  const flyX        = useRef(new Animated.Value(-SCREEN_W)).current;
  const flyRotate   = useRef(new Animated.Value(-1)).current;
  const landBounce  = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  const accentRef = useRef(selectedAccent);
  const genderRef = useRef(selectedGender);
  useEffect(() => { accentRef.current = selectedAccent; }, [selectedAccent]);
  useEffect(() => { genderRef.current = selectedGender; }, [selectedGender]);

  const [speakTriggered, setSpeakTriggered] = useState(false);

  useEffect(() => {
    // Animate everything together simultaneously and fast
    Animated.parallel([
      Animated.timing(flyX, {
        toValue: 0,
        duration: 350,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(flyRotate, {
        toValue: 0,
        duration: 350,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(landBounce, {
        toValue: 1,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSpeakTriggered(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!speakTriggered) return;
    const config = getVoiceConfig(voices, genderRef.current.id, accentRef.current.id);
    Speech.stop();
    Speech.speak(INTRO_LINE, {
      language: accentRef.current.id,
      voice: config.voice,
      pitch: config.pitch,
      rate: config.rate,
    });
  }, [speakTriggered, voices]);

  const previewVoice = useCallback((
    accent: typeof ACCENTS[number],
    gender: typeof VOICE_GENDERS[number],
  ) => {
    Speech.stop();
    const config = getVoiceConfig(voices, gender.id, accent.id);
    Speech.speak(`Hi! This is what I sound like with a ${accent.label} accent.`, {
      language: accent.id,
      voice: config.voice,
      pitch: config.pitch,
      rate: config.rate,
    });
  }, [voices]);

  const rotateDeg      = flyRotate.interpolate({ inputRange: [-1, 0], outputRange: ['-18deg', '0deg'] });
  const bounceTranslate = landBounce.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -14, 0] });

  return (
    <SafeAreaView style={it.safe} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={C.accentDark} />
      <LinearGradient colors={[C.accentMid, C.accentDark, '#082F3D']} style={it.bg}>
        <ScrollView
          contentContainerStyle={[it.scrollContent, { paddingTop: insets.top + rs(30) }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Robot fly-in stage ── */}
          <View style={it.flyStage}>
            <Animated.View
              style={{
                transform: [
                  { translateX: flyX },
                  { translateY: bounceTranslate },
                  { rotate: rotateDeg },
                ],
              }}
            >
              <RoboAvatar status="speaking" size={rs(160)} />
            </Animated.View>
          </View>

          {/* ── All content fades in together the moment robot lands ── */}
          <Animated.View style={{ opacity: contentOpacity, width: '100%', alignItems: 'center' }}>
            {/* Intro headline + text */}
            <Text style={it.introHeadline}>Let's practice together!</Text>
            <Text style={it.introLine}>{INTRO_LINE}</Text>

            {/* Accent picker */}
            <Text style={it.sectionLabel}>Choose your tutor's accent</Text>
            <View style={it.accentGrid}>
              {ACCENTS.map(a => {
                const selected = a.id === selectedAccent.id;
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[it.accentCard, selected && it.accentCardActive]}
                    activeOpacity={0.85}
                    onPress={() => {
                      setSelectedAccent(a);
                      previewVoice(a, selectedGender);
                    }}
                  >
                    <Text style={it.accentFlag}>{a.flag}</Text>
                    <Text style={[it.accentLabel, selected && it.accentLabelActive]}>{a.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Voice gender picker */}
            <Text style={it.sectionLabel}>Choose a voice</Text>
            <View style={it.genderRow}>
              {VOICE_GENDERS.map(g => {
                const selected = g.id === selectedGender.id;
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[it.genderPill, selected && it.genderPillActive]}
                    activeOpacity={0.85}
                    onPress={() => {
                      setSelectedGender(g);
                      previewVoice(selectedAccent, g);
                    }}
                  >
                    <Text style={[it.genderPillText, selected && it.genderPillTextActive]}>{g.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Get Started */}
            <TouchableOpacity
              style={it.getStartedBtn}
              activeOpacity={0.88}
              onPress={() => { Speech.stop(); onGetStarted(); }}
            >
              <Text style={it.getStartedBtnText}>Get Started</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const it = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.accentDark },
  bg: { flex: 1 },
  scrollContent: { paddingHorizontal: rs(22), paddingBottom: rs(40), alignItems: 'center' },
  flyStage: { width: '100%', alignItems: 'center', marginBottom: rs(18) },
  introHeadline: { color: C.white, fontSize: fs(22), fontWeight: '800', textAlign: 'center', marginBottom: rs(8) },
  introLine: { color: 'rgba(255,255,255,0.85)', fontSize: fs(13.5), textAlign: 'center', lineHeight: fs(20), marginBottom: rs(28), paddingHorizontal: rs(6) },
  sectionLabel: { color: 'rgba(255,255,255,0.85)', fontSize: fs(12.5), fontWeight: '700', marginBottom: rs(10), alignSelf: 'flex-start' },
  accentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: rs(10), width: '100%', marginBottom: rs(22) },
  accentCard: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: rs(14),
    paddingVertical: rs(14),
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  accentCardActive: { borderColor: C.gold, backgroundColor: 'rgba(255,209,92,0.12)' },
  accentFlag: { fontSize: fs(22), marginBottom: rs(4) },
  accentLabel: { color: 'rgba(255,255,255,0.8)', fontSize: fs(12.5), fontWeight: '700' },
  accentLabelActive: { color: C.gold },
  genderRow: { flexDirection: 'row', gap: rs(10), width: '100%', marginBottom: rs(28) },
  genderPill: {
    flex: 1,
    paddingVertical: rs(12),
    borderRadius: rs(12),
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  genderPillActive: { borderColor: C.gold, backgroundColor: 'rgba(255,209,92,0.12)' },
  genderPillText: { color: 'rgba(255,255,255,0.8)', fontSize: fs(12.5), fontWeight: '700' },
  genderPillTextActive: { color: C.gold },
  getStartedBtn: {
    width: '100%',
    backgroundColor: C.success,
    borderRadius: rs(16),
    paddingVertical: rs(18),
    marginVertical: rs(24),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 0.25,
    shadowRadius: rs(8),
    elevation: 4,
  },
  getStartedBtnText: { color: C.white, fontSize: fs(16), fontWeight: '800' },
});

// ─── Screen ────────────────────────────────────────────────────────────────────
export const EnglishTutorScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const audioRecorder = useAudioRecorder(CALL_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(audioRecorder, 200);
  const recordingRef = useRef<AudioRecorder | null>(null);
  const hasSpokenRef = useRef(false);
  const silenceMsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [phase, setPhase] = useState<'intro' | 'setup' | 'session' | 'summary'>('intro');
  const [selectedLength, setSelectedLength] = useState(SESSION_LENGTHS[2]); // default 10 min
  const [selectedLevel, setSelectedLevel] = useState(LEVELS[1]);
  const [selectedAccent, setSelectedAccent] = useState(ACCENTS[0]);
  const [selectedGender, setSelectedGender] = useState(VOICE_GENDERS[0]);
  const selectedAccentRef = useRef(selectedAccent);
  const selectedGenderRef = useRef(selectedGender);
  useEffect(() => { selectedAccentRef.current = selectedAccent; }, [selectedAccent]);
  useEffect(() => { selectedGenderRef.current = selectedGender; }, [selectedGender]);

  const [voices, setVoices] = useState<any[]>([]);
  useEffect(() => {
    async function loadAvailableVoices() {
      try {
        const available = await Speech.getAvailableVoicesAsync();
        setVoices(available || []);
      } catch (err) {
        console.warn('Failed to load TTS voices', err);
      }
    }
    loadAvailableVoices();
  }, []);

  const [status, setStatus] = useState<TutorStatus>('idle');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [turns, setTurns] = useState<Turn[]>([]);
  const sessionActiveRef = useRef(false);
  const turnsRef = useRef<Turn[]>([]);

  useEffect(() => { turnsRef.current = turns; }, [turns]);

  useEffect(() => {
    return () => {
      Speech.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      recordingRef.current?.stop().catch(() => {});
    };
  }, []);

  const scrollToBottom = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);


  // ── Countdown timer ──
  const startTimer = useCallback((totalSeconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSecondsLeft(totalSeconds);
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          endSessionRef.current(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── Ask Gemini for the next tutoring turn (audio in, structured JSON out) ──
  const askTutor = useCallback(async (
    inlineAudio: { mimeType: string; base64: string } | null,
    historyTurns: Turn[]
  ) => {
    if (!GEMINI_API_KEY) {
      setStatus('idle');
      setTurns(prev => [...prev, { id: Date.now().toString(), reply: '⚠️ AI key not configured. Add EXPO_PUBLIC_GEMINI_API_KEY to your .env and restart the app.' }]);
      return;
    }
    setStatus('thinking');
    try {
      const contents = historyTurns.map(t => ({ role: 'model', parts: [{ text: t.reply }] }));
      if (inlineAudio) {
        contents.push({ role: 'user', parts: [{ inlineData: { mimeType: inlineAudio.mimeType, data: inlineAudio.base64 } }] } as any);
      }

      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: TUTOR_SYSTEM_PROMPT(Math.ceil(selectedLength.minutes), selectedLevel.label) }] },
          generationConfig: { temperature: 0.75, maxOutputTokens: 512, responseMimeType: 'application/json' },
          safetySettings: SAFETY_SETTINGS,
        }),
      });
      const data = await res.json();

      if (!res.ok || data?.error) {
        const reason = data?.error?.message ?? 'Unknown error';
        setTurns(prev => [...prev, { id: Date.now().toString() + 'e', reply: `⚠️ AI error: ${reason}` }]);
        setStatus('idle');
        return;
      }

      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
      let parsed: { reply?: string; correction?: string | null; pronunciationTip?: string | null; score?: number } = {};
      try { parsed = JSON.parse(raw); } catch { parsed = { reply: raw }; }

      const newTurn: Turn = {
        id: Date.now().toString() + 'b',
        reply: parsed.reply || "Sorry, could you say that again?",
        correction: parsed.correction ?? null,
        pronunciationTip: parsed.pronunciationTip ?? null,
        score: typeof parsed.score === 'number' ? parsed.score : undefined,
      };
      setTurns(prev => [...prev, newTurn]);
      scrollToBottom();
      speak(newTurn.reply);
    } catch (err) {
      setTurns(prev => [...prev, { id: Date.now().toString() + 'err', reply: '⚠️ Connection problem reaching the AI. Check your internet and try again.' }]);
      setStatus('idle');
    }
  }, [selectedLength, selectedLevel]);

  const askTutorRef = useRef(askTutor);
  useEffect(() => { askTutorRef.current = askTutor; }, [askTutor]);

  // ── Speak a tutor line aloud, then wait for the learner's next tap ──
  const speak = useCallback((text: string) => {
    setStatus('speaking');
    Speech.stop();
    const config = getVoiceConfig(voices, selectedGenderRef.current.id, selectedAccentRef.current.id);
    Speech.speak(text, {
      language: selectedAccentRef.current.id,
      voice: config.voice,
      pitch: config.pitch,
      rate: config.rate,
      onDone: () => setStatus(sessionActiveRef.current ? 'idle' : 'ended'),
      onStopped: () => setStatus(sessionActiveRef.current ? 'idle' : 'ended'),
      onError: () => setStatus(sessionActiveRef.current ? 'idle' : 'ended'),
    });
  }, [voices]);

  // ── Mic recording for one learner turn, with silence-based auto-stop ──
  const stopListening = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;
    try {
      await recording.stop();
      const uri = recording.uri;
      if (!uri) throw new Error('Recording file missing.');
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const mimeType = uri.endsWith('.wav') ? 'audio/wav' : uri.endsWith('.caf') ? 'audio/x-caf' : 'audio/mp4';
      askTutorRef.current({ mimeType, base64 }, turnsRef.current);
    } catch (err) {
      console.error('stopListening error', err);
      setStatus('idle');
    }
  }, []);

  const stopListeningRef = useRef(stopListening);
  useEffect(() => { stopListeningRef.current = stopListening; }, [stopListening]);

  useEffect(() => {
    if (!recorderState.isRecording) return;
    const db = recorderState.metering ?? -160;
    if (db > -35) {
      hasSpokenRef.current = true;
      silenceMsRef.current = 0;
    } else if (hasSpokenRef.current) {
      silenceMsRef.current += 200;
    }
    if (hasSpokenRef.current && silenceMsRef.current >= 1200 && recorderState.durationMillis > 600) {
      stopListeningRef.current();
    }
  }, [recorderState]);

  const startListening = useCallback(async () => {
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        setTurns(prev => [...prev, { id: Date.now().toString(), reply: '🎤 Microphone permission is needed for spoken practice.' }]);
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      hasSpokenRef.current = false;
      silenceMsRef.current = 0;
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      recordingRef.current = audioRecorder;
      setStatus('listening');
    } catch (err) {
      console.error('startListening error', err);
      setStatus('idle');
    }
  }, [audioRecorder]);

  const handleMicPress = useCallback(() => {
    if (status === 'listening') stopListeningRef.current();
    else if (status === 'idle') startListening();
  }, [status, startListening]);

  // ── Session lifecycle ──
  const startSession = useCallback(() => {
    setTurns([]);
    sessionActiveRef.current = true;
    setPhase('session');
    setStatus('speaking');
    startTimer(Math.round(selectedLength.minutes * 60));
    const greeting = FIRST_QUESTIONS[Math.floor(Math.random() * FIRST_QUESTIONS.length)];
    const firstTurn: Turn = { id: Date.now().toString() + 'g', reply: greeting };
    setTurns([firstTurn]);
    speak(greeting);
  }, [selectedLength, speak, startTimer]);

  const endSession = useCallback((autoEnded: boolean) => {
    sessionActiveRef.current = false;
    Speech.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    recordingRef.current?.stop().catch(() => {});
    recordingRef.current = null;
    setStatus('ended');
    setPhase('summary');
  }, []);

  const endSessionRef = useRef(endSession);
  useEffect(() => { endSessionRef.current = endSession; }, [endSession]);

  const restart = useCallback(() => {
    setTurns([]);
    setSecondsLeft(0);
    setPhase('setup');
    setStatus('idle');
  }, []);

  // ── Derived summary stats ──
  const scoredTurns = turns.filter(t => typeof t.score === 'number');
  const avgScore = scoredTurns.length
    ? Math.round(scoredTurns.reduce((sum, t) => sum + (t.score || 0), 0) / scoredTurns.length)
    : null;
  const correctionTurns = turns.filter(t => !!t.correction);

  const statusLabel =
    status === 'listening' ? 'Listening… tap again to stop' :
    status === 'thinking' ? 'Thinking…' :
    status === 'speaking' ? 'Speaking…' :
    status === 'ended' ? 'Session ended' :
    'Tap the mic to answer';

  // ─── INTRO PHASE ───────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <IntroScreen
        onGetStarted={() => setPhase('setup')}
        selectedAccent={selectedAccent}
        setSelectedAccent={setSelectedAccent}
        selectedGender={selectedGender}
        setSelectedGender={setSelectedGender}
        voices={voices}
      />
    );
  }

  // ─── SETUP PHASE ───────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <SafeAreaView style={st.safe} edges={['bottom']}>
        <StatusBar barStyle="light-content" backgroundColor={C.accentDark} />
        <LinearGradient
          colors={[C.accentMid, C.accentDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[st.header, { paddingTop: insets.top > 0 ? insets.top + rs(8) : Platform.OS === 'android' ? (StatusBar.currentHeight ?? rs(20)) + rs(8) : rs(50) }]}
        >
          <TouchableOpacity style={st.backBtn} onPress={() => navigation?.goBack()} activeOpacity={0.8}>
            <BackIcon />
          </TouchableOpacity>
          <View style={st.headerInfo}>
            <Text style={st.headerName}>English Speaking Tutor</Text>
            <Text style={st.headerSub}>Live AI fluency practice</Text>
          </View>
        </LinearGradient>

        <ScrollView contentContainerStyle={st.setupScroll} showsVerticalScrollIndicator={false}>
          <View style={st.setupAvatarWrap}>
            <RoboAvatar status="idle" size={rs(120)} />
          </View>
          <Text style={st.setupTitle}>Let's set up your session</Text>
          <Text style={st.setupHint}>Your study buddy will keep the conversation going with questions, gentle corrections, and a fluency score for each answer.</Text>

          <Text style={st.sectionLabel}>How long do you want to practice?</Text>
          <View style={st.lengthGrid}>
            {SESSION_LENGTHS.map(opt => {
              const selected = opt.id === selectedLength.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[st.lengthCard, selected && st.lengthCardActive]}
                  activeOpacity={0.85}
                  onPress={() => setSelectedLength(opt)}
                >
                  <Text style={[st.lengthCardTime, selected && st.lengthCardTimeActive]}>{opt.label}</Text>
                  <Text style={[st.lengthCardSub, selected && st.lengthCardSubActive]}>{opt.sub}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={st.sectionLabel}>Your current level</Text>
          <View style={st.levelRow}>
            {LEVELS.map(lv => {
              const selected = lv.id === selectedLevel.id;
              return (
                <TouchableOpacity
                  key={lv.id}
                  style={[st.levelPill, selected && st.levelPillActive]}
                  activeOpacity={0.85}
                  onPress={() => setSelectedLevel(lv)}
                >
                  <Text style={[st.levelPillText, selected && st.levelPillTextActive]}>{lv.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={st.startBtn} activeOpacity={0.88} onPress={startSession}>
            <Text style={st.startBtnText}>Start {selectedLength.label} Session</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── SUMMARY PHASE ─────────────────────────────────────────────────────────
  if (phase === 'summary') {
    return (
      <SafeAreaView style={st.safe} edges={['bottom']}>
        <StatusBar barStyle="light-content" backgroundColor={C.accentDark} />
        <LinearGradient
          colors={[C.accentMid, C.accentDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[st.header, { paddingTop: insets.top > 0 ? insets.top + rs(8) : Platform.OS === 'android' ? (StatusBar.currentHeight ?? rs(20)) + rs(8) : rs(50) }]}
        >
          <TouchableOpacity style={st.backBtn} onPress={() => navigation?.goBack()} activeOpacity={0.8}>
            <BackIcon />
          </TouchableOpacity>
          <View style={st.headerInfo}>
            <Text style={st.headerName}>Session Report</Text>
            <Text style={st.headerSub}>{selectedLength.label} • {selectedLevel.label}</Text>
          </View>
        </LinearGradient>

        <ScrollView contentContainerStyle={st.summaryScroll} showsVerticalScrollIndicator={false}>
          <View style={st.trophyWrap}><TrophyIcon /></View>
          <Text style={st.summaryHeadline}>Nice work!</Text>
          <Text style={st.summarySub}>Here's how your session went.</Text>

          <View style={st.statsRow}>
            <View style={st.statCard}>
              <Text style={st.statValue}>{avgScore ?? '–'}</Text>
              <Text style={st.statLabel}>Avg. Fluency</Text>
            </View>
            <View style={st.statCard}>
              <Text style={st.statValue}>{Math.max(0, turns.length - 1)}</Text>
              <Text style={st.statLabel}>Questions Answered</Text>
            </View>
            <View style={st.statCard}>
              <Text style={st.statValue}>{correctionTurns.length}</Text>
              <Text style={st.statLabel}>Corrections</Text>
            </View>
          </View>

          {correctionTurns.length > 0 && (
            <>
              <Text style={st.sectionLabel}>Things to review</Text>
              {correctionTurns.map(t => (
                <View key={t.id} style={st.reviewCard}>
                  {!!t.correction && <Text style={st.reviewLine}>✏️ <Text style={st.reviewBold}>Grammar:</Text> {t.correction}</Text>}
                  {!!t.pronunciationTip && <Text style={st.reviewLine}>🗣️ <Text style={st.reviewBold}>Pronunciation:</Text> {t.pronunciationTip}</Text>}
                </View>
              ))}
            </>
          )}

          <TouchableOpacity style={st.startBtn} activeOpacity={0.88} onPress={restart}>
            <Text style={st.startBtnText}>Start Another Session</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.doneBtn} activeOpacity={0.85} onPress={() => navigation?.goBack()}>
            <Text style={st.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── SESSION PHASE — Video Call Layout ────────────────────────────────────
  const lastTurn = turns[turns.length - 1];
  const timeLow = secondsLeft <= 30;

  return (
    <View style={st.vcRoot}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Robot avatar, centered on a plain black call background ── */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <RoboAvatar status={status} size={rs(220)} />
        </View>
      </View>

      {/* ── Dark gradient overlay at top for controls ── */}
      <LinearGradient
        colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.0)']}
        style={[st.vcTopGradient, { paddingTop: insets.top > 0 ? insets.top + rs(10) : rs(44) }]}
      >
        {/* Timer + tutor name */}
        <View style={st.vcTopBar}>
          <View>
            <Text style={st.vcTutorName}>AI Study Buddy</Text>
            <Text style={st.vcTutorSub}>{selectedLevel.label} · English</Text>
          </View>
          <View style={[st.timerPill, timeLow && st.timerPillLow]}>
            <ClockIcon />
            <Text style={st.timerText}>{formatTime(secondsLeft)}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── Status badge — top center ── */}
      <View style={st.vcStatusBadge} pointerEvents="none">
        {status === 'thinking' && (
          <View style={st.vcBadgePill}>
            <ActivityIndicator size="small" color={C.white} />
            <Text style={st.vcBadgeText}>Thinking…</Text>
          </View>
        )}
        {status === 'speaking' && (
          <View style={[st.vcBadgePill, { backgroundColor: 'rgba(255,209,92,0.22)', borderColor: C.gold }]}>
            <Text style={[st.vcBadgeText, { color: C.gold }]}>Speaking…</Text>
          </View>
        )}
        {status === 'listening' && (
          <View style={[st.vcBadgePill, { backgroundColor: 'rgba(46,204,154,0.22)', borderColor: C.success }]}>
            <Text style={[st.vcBadgeText, { color: C.success }]}>Listening…</Text>
          </View>
        )}
      </View>

      {/* ── Dark gradient overlay at bottom for subtitles + controls ── */}
      <LinearGradient
        colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.82)', 'rgba(0,0,0,0.96)']}
        style={[st.vcBottomGradient, { paddingBottom: insets.bottom > 0 ? insets.bottom + rs(10) : rs(28) }]}
      >
        {/* Tutor subtitle / last reply */}
        {lastTurn && (
          <ScrollView
            style={st.vcSubtitleScroll}
            contentContainerStyle={st.vcSubtitleContent}
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
          >
            <Text style={st.vcSubtitleText}>{lastTurn.reply}</Text>
            {(lastTurn.correction || lastTurn.pronunciationTip || typeof lastTurn.score === 'number') && (
              <View style={st.vcFeedbackCard}>
                {typeof lastTurn.score === 'number' && (
                  <View style={st.scoreRow}>
                    <Text style={st.scoreLabel}>Fluency Score</Text>
                    <Text style={st.scoreValue}>{lastTurn.score}/100</Text>
                  </View>
                )}
                {!!lastTurn.correction && (
                  <Text style={st.feedbackLine}>✏️ <Text style={st.feedbackBold}>Grammar:</Text> {lastTurn.correction}</Text>
                )}
                {!!lastTurn.pronunciationTip && (
                  <Text style={st.feedbackLine}>🗣️ <Text style={st.feedbackBold}>Pronunciation:</Text> {lastTurn.pronunciationTip}</Text>
                )}
              </View>
            )}
          </ScrollView>
        )}

        {/* ── Controls row — mic centre, end call right ── */}
        <View style={st.vcControls}>
          {/* Spacer left */}
          <View style={{ width: rs(56) }} />

          {/* Mic button — centre */}
          <TouchableOpacity
            style={[
              st.vcMicBtn,
              status === 'listening' && st.vcMicBtnActive,
              (status === 'thinking' || status === 'speaking') && st.vcMicBtnDisabled,
            ]}
            onPress={handleMicPress}
            disabled={status === 'thinking' || status === 'speaking'}
            activeOpacity={0.85}
          >
            {status === 'listening' ? <StopIcon /> : <MicIcon color={C.white} />}
          </TouchableOpacity>

          {/* End call — right */}
          <TouchableOpacity style={st.vcEndBtn} activeOpacity={0.85} onPress={() => endSession(false)}>
            {/* Phone hang-up icon */}
            <Svg width={rs(22)} height={rs(22)} viewBox="0 0 24 24" fill="none">
              <Path
                d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.12-.56-2.32-.56-3.56 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"
                fill={C.white}
              />
            </Svg>
          </TouchableOpacity>
        </View>

        <Text style={st.vcMicHint}>
          {status === 'listening' ? 'Tap to stop' : status === 'idle' ? 'Tap mic to answer' : ' '}
        </Text>
      </LinearGradient>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  sessionSafe: { flex: 1, backgroundColor: C.accentDark },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rs(14),
    paddingBottom: rs(14),
    gap: rs(10),
    shadowColor: C.accentDark,
    shadowOffset: { width: 0, height: rs(3) },
    shadowOpacity: 0.2,
    shadowRadius: rs(8),
    elevation: 6,
  },
  backBtn: {
    width: rs(36), height: rs(36), borderRadius: rs(18),
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  headerInfo: { flex: 1, gap: rs(2) },
  headerName: { fontSize: fs(15), fontWeight: '700', color: C.white },
  headerSub: { fontSize: fs(11), color: 'rgba(255,255,255,0.72)', fontWeight: '500' },

  setupScroll: { padding: rs(18), paddingBottom: rs(40) },
  setupAvatarWrap: { alignItems: 'center', marginBottom: rs(14) },
  setupTitle: { fontSize: fs(19), fontWeight: '800', color: C.dark, textAlign: 'center' },
  setupHint: { fontSize: fs(12.5), color: C.muted, textAlign: 'center', lineHeight: fs(18), marginTop: rs(6), marginBottom: rs(22), paddingHorizontal: rs(10) },

  sectionLabel: { fontSize: fs(12.5), fontWeight: '700', color: C.dark, marginBottom: rs(10), marginTop: rs(6) },

  lengthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: rs(10), marginBottom: rs(20) },
  lengthCard: {
    width: '47%',
    backgroundColor: C.white,
    borderRadius: rs(14),
    paddingVertical: rs(14),
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
  },
  lengthCardActive: { borderColor: C.accent, backgroundColor: C.accentLight },
  lengthCardTime: { fontSize: fs(17), fontWeight: '800', color: C.dark },
  lengthCardTimeActive: { color: C.accentDark },
  lengthCardSub: { fontSize: fs(10.5), color: C.muted, fontWeight: '600', marginTop: rs(2) },
  lengthCardSubActive: { color: C.accent },

  levelRow: { flexDirection: 'row', gap: rs(10), marginBottom: rs(26) },
  levelPill: {
    flex: 1,
    paddingVertical: rs(12),
    borderRadius: rs(12),
    backgroundColor: C.white,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
  },
  levelPillActive: { borderColor: C.accent, backgroundColor: C.accentLight },
  levelPillText: { fontSize: fs(12.5), fontWeight: '700', color: C.dark },
  levelPillTextActive: { color: C.accentDark },

  startBtn: {
    backgroundColor: C.accent,
    borderRadius: rs(16),
    paddingVertical: rs(16),
    alignItems: 'center',
    shadowColor: C.accentDark,
    shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 0.25,
    shadowRadius: rs(8),
    elevation: 4,
  },
  startBtnText: { color: C.white, fontSize: fs(14.5), fontWeight: '800' },

  doneBtn: { alignItems: 'center', paddingVertical: rs(14), marginTop: rs(4) },
  doneBtnText: { color: C.muted, fontSize: fs(12.5), fontWeight: '700' },

  // Summary
  summaryScroll: { padding: rs(18), paddingBottom: rs(40), alignItems: 'center' },
  trophyWrap: {
    width: rs(74), height: rs(74), borderRadius: rs(37),
    backgroundColor: C.accentLight, alignItems: 'center', justifyContent: 'center', marginTop: rs(10), marginBottom: rs(14),
  },
  summaryHeadline: { fontSize: fs(20), fontWeight: '800', color: C.dark },
  summarySub: { fontSize: fs(12.5), color: C.muted, marginTop: rs(4), marginBottom: rs(20) },
  statsRow: { flexDirection: 'row', gap: rs(10), width: '100%', marginBottom: rs(22) },
  statCard: {
    flex: 1, backgroundColor: C.white, borderRadius: rs(14), paddingVertical: rs(16),
    alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  statValue: { fontSize: fs(20), fontWeight: '800', color: C.accentDark },
  statLabel: { fontSize: fs(10), color: C.muted, fontWeight: '700', marginTop: rs(4), textAlign: 'center' },
  reviewCard: {
    width: '100%', backgroundColor: C.accentLight, borderRadius: rs(12), padding: rs(12), marginBottom: rs(8), gap: rs(4),
  },
  reviewLine: { fontSize: fs(12), color: C.dark, lineHeight: fs(17) },
  reviewBold: { fontWeight: '800' },

  // Session (full-screen video call style)
  sessionBg: { flex: 1 },
  vcRoot: { flex: 1, backgroundColor: '#000' },

  timerPill: {
    flexDirection: 'row', alignItems: 'center', gap: rs(6),
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: rs(14), paddingHorizontal: rs(12), paddingVertical: rs(7),
  },
  timerPillLow: { backgroundColor: 'rgba(217,83,79,0.85)', borderColor: C.danger },
  timerText: { color: C.white, fontSize: fs(13), fontWeight: '800' },

  vcTopGradient: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: rs(18), paddingBottom: rs(40),
    zIndex: 10,
  },
  vcTopBar: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  vcTutorName: { color: C.white, fontSize: fs(16), fontWeight: '800' },
  vcTutorSub:  { color: 'rgba(255,255,255,0.7)', fontSize: fs(11.5), fontWeight: '600', marginTop: rs(2) },

  vcStatusBadge: {
    position: 'absolute', top: '18%', left: 0, right: 0,
    alignItems: 'center', zIndex: 10,
  },
  vcBadgePill: {
    flexDirection: 'row', alignItems: 'center', gap: rs(6),
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: rs(14), paddingVertical: rs(6),
    borderRadius: rs(20),
  },
  vcBadgeText: { color: C.white, fontSize: fs(12), fontWeight: '700' },

  vcBottomGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: rs(18), paddingTop: rs(30),
    zIndex: 10,
  },
  vcSubtitleScroll: { maxHeight: rs(140) },
  vcSubtitleContent: { paddingBottom: rs(12) },
  vcSubtitleText: {
    color: C.white, fontSize: fs(15.5), fontWeight: '600',
    textAlign: 'center', lineHeight: fs(22),
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  vcFeedbackCard: {
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: rs(12),
    padding: rs(12), marginTop: rs(10), gap: rs(5),
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  vcControls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: rs(16), paddingHorizontal: rs(20),
  },
  vcMicBtn: {
    width: rs(64), height: rs(64), borderRadius: rs(32),
    backgroundColor: C.success,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 0.4, shadowRadius: rs(8), elevation: 6,
  },
  vcMicBtnActive:    { backgroundColor: C.danger },
  vcMicBtnDisabled:  { backgroundColor: 'rgba(255,255,255,0.2)' },
  vcEndBtn: {
    width: rs(56), height: rs(56), borderRadius: rs(28),
    backgroundColor: C.danger,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: rs(3) },
    shadowOpacity: 0.35, shadowRadius: rs(6), elevation: 5,
  },
  vcMicHint: {
    color: 'rgba(255,255,255,0.65)', fontSize: fs(11.5), fontWeight: '600',
    textAlign: 'center', marginTop: rs(10),
  },
  avatarSection: { alignItems: 'center', marginTop: rs(10), marginBottom: rs(6) },
  statusText: { color: 'rgba(255,255,255,0.85)', fontSize: fs(13), fontWeight: '700', marginTop: rs(12) },

  feedbackScroll: { flex: 1, marginTop: rs(10) },
  feedbackScrollContent: { paddingHorizontal: rs(24), paddingBottom: rs(10) },
  tutorLine: { color: C.white, fontSize: fs(16), fontWeight: '600', textAlign: 'center', lineHeight: fs(23) },
  turnFeedbackCard: {
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: rs(14), padding: rs(14), marginTop: rs(16), gap: rs(6),
  },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(2) },
  scoreLabel: { color: 'rgba(255,255,255,0.8)', fontSize: fs(11.5), fontWeight: '700' },
  scoreValue: { color: C.white, fontSize: fs(15), fontWeight: '800' },
  feedbackLine: { color: C.white, fontSize: fs(12.5), lineHeight: fs(18) },
  feedbackBold: { fontWeight: '800' },

  micWrap: { alignItems: 'center', paddingVertical: rs(20) },
  micBtn: {
    width: rs(68), height: rs(68), borderRadius: rs(34),
    backgroundColor: C.success, alignItems: 'center', justifyContent: 'center',
  },
  micBtnActive: { backgroundColor: C.danger },
  micBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.25)' },
  micHint: { color: 'rgba(255,255,255,0.7)', fontSize: fs(11.5), fontWeight: '600', marginTop: rs(10) },
});

export default EnglishTutorScreen;