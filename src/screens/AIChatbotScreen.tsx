import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Dimensions,
  PixelRatio,
  Platform,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Animated,
  Easing,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AudioModule,
  createAudioPlayer,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioPlayer,
  type AudioRecorder,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Responsive Helpers (matches HomeScreen/DiaryScreen) ─────────────────────
const { width: SCREEN_W } = Dimensions.get('window');
const BASE_WIDTH = 393;
const scale = SCREEN_W / BASE_WIDTH;
const rs = (size: number) => Math.round(size * Math.min(scale, 1.5));
const fs = (size: number) =>
  Math.round((size * Math.min(scale, 1.3)) / PixelRatio.getFontScale());

// ─── Brand Colors (matches app) ───────────────────────────────────────────────
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
  bubbleUser: '#0E7EA4',
  bubbleBot: '#FFFFFF',
  danger: '#D9534F',
  success: '#2ECC9A',
  gold: '#FFD15C',
};

// ─── Storage Key ───────────────────────────────────────────────────────────────
const CHAT_STORAGE_KEY = 'study_buddy_chat_history';

// ─── Gemini Config ─────────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;

const SYSTEM_PROMPT = `You are "Study Buddy", a friendly educational AI assistant inside a school app used by students and parents.
Your job is ONLY to help with learning-related tasks:
- Essay writing (outlines, drafts, feedback, grammar)
- Quiz generation on any school subject
- Poster/project ideas and layouts (described in text)
- Exam preparation (study plans, summaries, practice questions)
- General homework help and explaining concepts simply

If the user sends a voice recording, listen to it, gently point out any English grammar or pronunciation mistakes in a kind way, then continue the conversation naturally to keep them practicing.

Rules you always follow:
- Keep all responses age-appropriate, positive, and encouraging.
- Keep answers clear and reasonably short unless asked for something long (like a full essay).
- If asked something unrelated to learning/school, gently redirect back to educational topics.
- Never discuss anything inappropriate, unsafe, or unrelated to education.
- Use simple formatting (short paragraphs, bullet points) since this is read on a phone screen.`;

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
];

// Preset quick-actions shown as compact pills.
// "Speak English" is special-cased to launch the dedicated EnglishTutorScreen
// instead of sending a chat message — see handlePreset below.
const PRESETS = [
  { id: 'essay', label: 'Essay Help', emoji: '📝', prompt: 'Help me write an essay. Ask me the topic first.' },
  { id: 'quiz', label: 'Quiz Me', emoji: '❓', prompt: 'Create a short quiz for me. Ask me the subject and grade level first.' },
  { id: 'poster', label: 'Poster Ideas', emoji: '🎨', prompt: 'Give me creative ideas for a school poster. Ask me the topic first.' },
  { id: 'exam', label: 'Exam Prep', emoji: '📚', prompt: 'Help me prepare for an exam. Ask me the subject and exam date first.' },
  { id: 'english', label: 'Speak English', emoji: '🗣️', prompt: '' },
  { id: 'homework', label: 'Homework', emoji: '✏️', prompt: 'Help me with my homework. Ask me the subject and question first.' },
];

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isVoice?: boolean;
  audioUri?: string;
  durationMillis?: number;
  reaction?: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'model',
  text: "Hi! 👋 I'm Study Buddy, your AI learning helper. I can help with essays, quizzes, poster ideas, exam prep, and homework. Tap the robot above anytime for live spoken English practice, or pick something below, type, or use the mic.",
};

// ─── Icons ─────────────────────────────────────────────────────────────────────
const BackIcon = () => (
  <Svg width={rs(22)} height={rs(22)} viewBox="0 0 24 24" fill="none">
    <Path d="M15 18l-6-6 6-6" stroke={C.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const SendIcon = () => (
  <Svg width={rs(17)} height={rs(17)} viewBox="0 0 24 24" fill="none">
    <Path d="M3 11l18-8-8 18-2-8-8-2z" fill={C.white} />
  </Svg>
);

const BotIcon = ({ size = 18 }: { size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={C.accent} strokeWidth="1.8" />
    <Circle cx="9" cy="11" r="1.3" fill={C.accent} />
    <Circle cx="15" cy="11" r="1.3" fill={C.accent} />
    <Path d="M9 15c1 1 5 1 6 0" stroke={C.accent} strokeWidth="1.6" strokeLinecap="round" />
  </Svg>
);

// A small geometric robot face (antenna + visor eyes) — used for the live
// English-tutor launcher instead of a phone/call icon.
const RobotIcon = ({ size = 20, color = C.white }: { size?: number; color?: string }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Path d="M12 2v3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Circle cx="12" cy="3.5" r="1.4" fill={color} />
    <Rect x="4" y="6" width="16" height="13" rx="4" stroke={color} strokeWidth="1.8" />
    <Circle cx="9" cy="12.5" r="1.6" fill={color} />
    <Circle cx="15" cy="12.5" r="1.6" fill={color} />
    <Path d="M9 16h6" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    <Path d="M2 11v3M22 11v3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

const MicIcon = ({ color = C.white }: { color?: string }) => (
  <Svg width={rs(18)} height={rs(18)} viewBox="0 0 24 24" fill="none">
    <Path d="M9 2h6a3 3 0 013 3v6a3 3 0 01-3 3H9a3 3 0 01-3-3V5a3 3 0 013-3z" stroke={color} strokeWidth="1.8" />
    <Path d="M5 11a7 7 0 0014 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M12 18v3M9 21h6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

const StopIcon = () => (
  <Svg width={rs(16)} height={rs(16)} viewBox="0 0 24 24" fill="none">
    <Path d="M6 6h12v12H6z" fill={C.white} />
  </Svg>
);

const PlayIcon = ({ color = C.white }: { color?: string }) => (
  <Svg width={rs(13)} height={rs(13)} viewBox="0 0 24 24" fill="none">
    <Path d="M6 4l14 8-14 8V4z" fill={color} />
  </Svg>
);

const PauseIcon = ({ color = C.white }: { color?: string }) => (
  <Svg width={rs(13)} height={rs(13)} viewBox="0 0 24 24" fill="none">
    <Rect x="5" y="4" width="4.5" height="16" rx="1.5" fill={color} />
    <Rect x="14.5" y="4" width="4.5" height="16" rx="1.5" fill={color} />
  </Svg>
);

const SpeakerIcon = ({ active }: { active: boolean }) => (
  <Svg width={rs(14)} height={rs(14)} viewBox="0 0 24 24" fill="none">
    <Path d="M4 9v6h4l5 4V5L8 9H4z" fill={active ? C.accent : C.mutedLight} />
    <Path d="M16.5 9a4.5 4.5 0 010 6" stroke={active ? C.accent : C.mutedLight} strokeWidth="1.6" strokeLinecap="round" />
  </Svg>
);

const VoiceWaveIcon = () => (
  <Svg width={rs(16)} height={rs(16)} viewBox="0 0 24 24" fill="none">
    <Path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 12h2" stroke={C.white} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

// ─── Typing Indicator ──────────────────────────────────────────────────────────
// ─── Voice message waveform ────────────────────────────────────────────────────
const WAVE_BARS = [6, 10, 15, 9, 18, 12, 20, 8, 14, 11, 17, 7, 13, 9, 16, 10, 6, 12, 8, 15];

const Waveform = ({ progressPct, active }: { progressPct: number; active: boolean }) => (
  <View style={s.waveRow}>
    {WAVE_BARS.map((h, i) => {
      const filled = active && (i / WAVE_BARS.length) * 100 <= progressPct;
      return (
        <View
          key={i}
          style={[
            s.waveBar,
            { height: rs(h), backgroundColor: filled ? C.accent : C.mutedLight },
          ]}
        />
      );
    })}
  </View>
);

const TypingDots = () => (
  <View style={[s.bubble, s.botBubble]}>
    <ActivityIndicator size="small" color={C.accent} />
  </View>
);

// ─── Animated chat bubble wrapper (gentle fade + rise on entrance) ───────────
const AnimatedBubbleRow = ({ children, style }: { children: React.ReactNode; style: any }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);
  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
};

// ─── Header robot launcher with a soft white sonar-wave pulse ───────────────
const RobotHeaderButton = ({ onPress }: { onPress: () => void }) => {
  const wave1 = useRef(new Animated.Value(0)).current;
  const wave2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeWave = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: false }),
          Animated.timing(val, { toValue: 0, duration: 0, useNativeDriver: false }),
        ])
      );
    const a1 = makeWave(wave1, 0);
    const a2 = makeWave(wave2, 800);
    a1.start();
    a2.start();
    return () => { a1.stop(); a2.stop(); };
  }, [wave1, wave2]);

  const waveStyle = (val: Animated.Value) => ({
    opacity: val.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
    transform: [{ scale: val.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
  });

  return (
    <View style={s.robotHeaderWrap}>
      <Animated.View style={[s.robotHeaderWave, waveStyle(wave1)]} />
      <Animated.View style={[s.robotHeaderWave, waveStyle(wave2)]} />
      <TouchableOpacity style={s.robotHeaderBtn} activeOpacity={0.85} onPress={onPress}>
        <RobotIcon size={18} />
      </TouchableOpacity>
    </View>
  );
};

// ─── Screen ────────────────────────────────────────────────────────────────────
export const AIChatbotScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recordingRef = useRef<AudioRecorder | null>(null);
  const soundRef = useRef<AudioPlayer | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [playProgress, setPlayProgress] = useState<{ id: string; pct: number } | null>(null);
  const [reactionPickerId, setReactionPickerId] = useState<string | null>(null);
  const REACTIONS = ['👍', '❤️', '😂', '😮', '🙏'];

  const addReaction = useCallback((msgId: string, emoji: string) => {
    setMessages(prev =>
      prev.map(m => (m.id === msgId ? { ...m, reaction: m.reaction === emoji ? undefined : emoji } : m))
    );
    setReactionPickerId(null);
  }, []);

  // Load saved chat history once when screen opens
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
        if (saved) {
          const parsed: ChatMessage[] = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
        }
      } catch {
        // ignore corrupt/missing storage
      } finally {
        setHistoryLoaded(true);
      }
    })();
  }, []);

  // Save chat history whenever it changes (skip the very first load)
  useEffect(() => {
    if (!historyLoaded) return;
    AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages)).catch(() => {});
  }, [messages, historyLoaded]);

    useEffect(() => {
    if (!historyLoaded) return;
    AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages)).catch(() => {});
  }, [messages, historyLoaded]);


  // Hide preset pills while keyboard is open to save space
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      Speech.stop();
      recordingRef.current?.stop().catch(() => {});
      soundRef.current?.remove();
    };
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // ── Core Gemini call (accepts text and/or inline audio part) ──
  const callGemini = useCallback(async (
    newPart: { text?: string; inlineAudio?: { mimeType: string; base64: string } },
    currentMessages: ChatMessage[],
  ) => {
    if (!GEMINI_API_KEY) {
      setMessages(prev => [
        ...prev,
        { id: Date.now().toString(), role: 'model', text: '⚠️ AI key not configured. Add EXPO_PUBLIC_GEMINI_API_KEY to your .env and restart the app.' },
      ]);
      return;
    }

    setLoading(true);
    try {
      const contents = currentMessages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, parts: [{ text: m.text }] }));

      const parts: any[] = [];
      if (newPart.inlineAudio) {
        parts.push({ inlineData: { mimeType: newPart.inlineAudio.mimeType, data: newPart.inlineAudio.base64 } });
      }
      if (newPart.text) {
        parts.push({ text: newPart.text });
      }
      contents.push({ role: 'user', parts });

      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
          safetySettings: SAFETY_SETTINGS,
        }),
      });

      const data = await res.json();

      // Surface real API errors instead of a generic fallback
      if (!res.ok || data?.error) {
        const code = data?.error?.code ?? res.status;
        const reason = data?.error?.message ?? 'Unknown error';
        const friendly = code === 429
          ? "I'm getting too many requests right now (free tier limit). Please wait about a minute and try again."
          : `⚠️ AI error (${code}): ${reason}`;
        setMessages(prev => [...prev, { id: Date.now().toString() + 'e', role: 'model', text: friendly }]);
        return;
      }

      const finishReason = data?.candidates?.[0]?.finishReason;
      if (finishReason === 'SAFETY') {
        setMessages(prev => [
          ...prev,
          { id: Date.now().toString() + 's', role: 'model', text: "I can't respond to that one — let's stick to school and learning topics! Try asking something else." },
        ]);
        return;
      }

      const replyText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ??
        "Sorry, I couldn't think of a reply. Could you try rephrasing that?";

      setMessages(prev => [...prev, { id: Date.now().toString() + 'b', role: 'model', text: replyText }]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { id: Date.now().toString() + 'err', role: 'model', text: '⚠️ Something went wrong reaching the AI. Check your internet connection and try again.' },
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, []);

  const handleSend = useCallback((textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { id: Date.now().toString() + 'u', role: 'user', text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    scrollToBottom();
    callGemini({ text }, updated);
  }, [input, loading, messages, callGemini]);

  // "Speak English" launches the dedicated live tutor screen instead of
  // sending a chat message. Every other preset behaves as before.
  const handlePreset = useCallback((preset: typeof PRESETS[number]) => {
    if (preset.id === 'english') {
      navigation?.navigate('EnglishTutor');
      return;
    }
    handleSend(preset.prompt);
  }, [handleSend, navigation]);

  const openEnglishTutor = useCallback(() => {
    navigation?.navigate('EnglishTutor');
  }, [navigation]);

  // ── Voice recording for speaking practice ──
  const startRecording = useCallback(async () => {
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: '🎤 Microphone permission is needed for speaking practice. Please enable it in your phone settings.' }]);
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      recordingRef.current = audioRecorder;
      setIsRecording(true);
    } catch (err: any) {
      console.error('startRecording error', err);
      setIsRecording(false);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: '⚠️ Recording could not start. Please ensure microphone access is enabled and try again.' }]);
    }
  }, [audioRecorder]);

  const stopRecording = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    setIsRecording(false);
    try {
      const statusBeforeStop = recording.getStatus();
      const durationMillis = statusBeforeStop.durationMillis ?? 0;
      await recording.stop();
      const uri = recording.uri;
      recordingRef.current = null;
      if (!uri) throw new Error('Recording file is missing.');

      let base64: string;
      try {
        base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      } catch (readErr: any) {
        throw new Error(`Recording file could not be read: ${readErr?.message || 'Unknown error'}`);
      }
      if (!base64) throw new Error('Recording file is empty.');

      const mimeType = uri.endsWith('.wav')
        ? 'audio/wav'
        : uri.endsWith('.caf')
        ? 'audio/x-caf'
        : 'audio/mp4';

      const userMsg: ChatMessage = { id: Date.now().toString() + 'v', role: 'user', text: '🎤 Voice message', isVoice: true, audioUri: uri, durationMillis };
      const updated = [...messages, userMsg];
      setMessages(updated);
      scrollToBottom();

      callGemini(
        { inlineAudio: { mimeType, base64 }, text: '(This is a spoken English practice attempt — please respond and gently correct any mistakes.)' },
        updated
      );
    } catch (err: any) {
      console.error('stopRecording error', err);
      const message = err?.message
        ? `⚠️ Could not process that recording. ${err.message}`
        : '⚠️ Could not process that recording. Please try again.';
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: message }]);
    }
  }, [messages, callGemini]);

  const handleMicPress = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const playUserAudio = useCallback(async (msg: ChatMessage) => {
    if (!msg.audioUri) return;
    try {
      if (speakingId === msg.id) {
        soundRef.current?.pause();
        setSpeakingId(null);
        setPlayProgress(null);
        return;
      }
      if (soundRef.current) {
        soundRef.current.remove();
        soundRef.current = null;
      }
      setSpeakingId(msg.id);
      setPlayProgress({ id: msg.id, pct: 0 });
      const player = createAudioPlayer({ uri: msg.audioUri }, { updateInterval: 200 });
      soundRef.current = player;
      player.addListener('playbackStatusUpdate', status => {
        if (!status.isLoaded) return;
        const pct = status.duration ? (status.currentTime / status.duration) * 100 : 0;
        setPlayProgress({ id: msg.id, pct });
        if (status.didJustFinish) {
          setSpeakingId(null);
          setPlayProgress(null);
          player.remove();
          soundRef.current = null;
        }
      });
    } catch (err) {
      console.error('playUserAudio error', err);
      setSpeakingId(null);
      setPlayProgress(null);
    }
  }, [speakingId]);

  const formatDuration = (ms?: number) => {
    const totalSec = Math.round((ms ?? 0) / 1000);
    const m = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // ── Speak a bot message aloud ──
  const toggleSpeak = useCallback((msg: ChatMessage) => {
    if (speakingId === msg.id) {
      Speech.stop();
      setSpeakingId(null);
      return;
    }
    Speech.stop();
    setSpeakingId(msg.id);
    Speech.speak(msg.text, {
      language: 'en-US',
      pitch: 1.0,
      rate: 0.94,
      onDone: () => setSpeakingId(null),
      onStopped: () => setSpeakingId(null),
      onError: () => setSpeakingId(null),
    });
  }, [speakingId]);

  const handleNewChat = useCallback(() => {
    Speech.stop();
    setMessages([WELCOME_MESSAGE]);
    AsyncStorage.removeItem(CHAT_STORAGE_KEY).catch(() => {});
  }, []);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={C.accent} />

      {/* ── Header ── */}
      <LinearGradient
        colors={[C.accentMid, C.accentDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: insets.top > 0 ? insets.top + rs(8) : Platform.OS === 'android' ? (StatusBar.currentHeight ?? rs(20)) + rs(8) : rs(50) }]}
      >
        <TouchableOpacity style={s.backBtn} onPress={() => navigation?.goBack()} activeOpacity={0.8}>
          <BackIcon />
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={s.headerName}>STUDY BUDDY</Text>
          <View style={s.headerStatusRow}>
            <View style={s.headerStatusDot} />
            <Text style={s.headerSub}>AI Learning Assistant</Text>
          </View>
        </View>

        {/* Live English tutor launcher — robot icon with a soft white wave pulse */}
        <RobotHeaderButton onPress={openEnglishTutor} />
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? rs(10) : 0}
      >
        {/* ── Preset Pills (hidden while typing to save space) ── */}
        {!keyboardVisible && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.presetScroll}
            contentContainerStyle={s.presetRow}
          >
            {PRESETS.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[s.presetPill, p.id === 'english' && s.presetPillHighlight]}
                activeOpacity={0.8}
                onPress={() => handlePreset(p)}
                disabled={loading}
              >
                <Text style={s.presetEmoji}>{p.emoji}</Text>
                <Text style={[s.presetPillText, p.id === 'english' && s.presetPillTextHighlight]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── Chat Messages ── */}
       <ScrollView
        ref={scrollRef}
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
          {messages.map(msg => (
            <AnimatedBubbleRow
              key={msg.id}
              style={[s.bubbleRow, msg.role === 'user' ? s.bubbleRowUser : s.bubbleRowBot]}
            >
              {msg.role === 'model' && (
                <TouchableOpacity
                  style={s.botAvatarSmall}
                  activeOpacity={0.7}
                  onPress={() => setReactionPickerId(prev => (prev === msg.id ? null : msg.id))}
                >
                  <BotIcon size={14} />
                </TouchableOpacity>
              )}
              <View style={[s.bubble, msg.role === 'user' ? s.userBubble : s.botBubble]}>
                {reactionPickerId === msg.id && (
                  <View style={s.reactionPickerRow}>
                    {REACTIONS.map(emoji => (
                      <TouchableOpacity key={emoji} onPress={() => addReaction(msg.id, emoji)} style={s.reactionOption}>
                        <Text style={s.reactionOptionText}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {msg.isVoice && msg.audioUri ? (
                  <TouchableOpacity
                    style={s.voiceBubbleRow}
                    onPress={() => playUserAudio(msg)}
                    activeOpacity={0.75}
                  >
                    <View style={s.voicePlayBtn}>
                      {speakingId === msg.id ? <PauseIcon color={C.white} /> : <PlayIcon color={C.white} />}
                    </View>
                    <Waveform
                      progressPct={playProgress?.id === msg.id ? playProgress.pct : 0}
                      active={speakingId === msg.id}
                    />
                    <Text style={s.voiceDuration}>{formatDuration(msg.durationMillis)}</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <Text style={[s.bubbleText, msg.role === 'user' && s.bubbleTextUser]}>
                      {msg.text}
                    </Text>
                    {msg.role === 'model' && msg.id !== 'welcome' && (
                      <TouchableOpacity style={s.speakBtn} onPress={() => toggleSpeak(msg)} activeOpacity={0.7}>
                        <SpeakerIcon active={speakingId === msg.id} />
                        <Text style={[s.speakBtnText, speakingId === msg.id && { color: C.accent }]}>
                          {speakingId === msg.id ? 'Speaking…' : 'Listen'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
                {msg.reaction && (
                  <View style={s.reactionBadge}>
                    <Text style={s.reactionBadgeText}>{msg.reaction}</Text>
                  </View>
                )}
              </View>
            </AnimatedBubbleRow>
          ))}
          {loading && (
            <View style={[s.bubbleRow, s.bubbleRowBot]}>
              <View style={s.botAvatarSmall}>
                <BotIcon size={14} />
              </View>
              <TypingDots />
            </View>
          )}
        </ScrollView>

        {/* ── Input Bar ── */}
        <View style={[s.inputBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : rs(10) }]}>
          <TouchableOpacity
            style={[s.micBtn, isRecording && s.micBtnActive]}
            onPress={handleMicPress}
            activeOpacity={0.85}
          >
            {isRecording ? <StopIcon /> : <MicIcon color={C.white} />}
          </TouchableOpacity>

          <TextInput
            style={s.input}
            placeholder={isRecording ? 'Listening…' : 'Ask anything about your studies...'}
            placeholderTextColor={C.mutedLight}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={1000}
            editable={!isRecording}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || loading || isRecording) && s.sendBtnDisabled]}
            onPress={() => handleSend()}
            disabled={!input.trim() || loading || isRecording}
            activeOpacity={0.85}
          >
            <SendIcon />
          </TouchableOpacity>
        </View>

        {isRecording && (
          <View style={s.recordingBanner}>
            <VoiceWaveIcon />
            <Text style={s.recordingText}>Recording… tap the mic again to send</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

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
    width: rs(36),
    height: rs(36),
    borderRadius: rs(18),
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: { flex: 1, gap: rs(2) },
  headerName: { fontSize: fs(15), fontWeight: '800', color: C.white, letterSpacing: 0.4 },
  headerStatusRow: { flexDirection: 'row', alignItems: 'center', gap: rs(5) },
  headerStatusDot: { width: rs(6), height: rs(6), borderRadius: rs(3), backgroundColor: C.success },
  headerSub: { fontSize: fs(11), color: 'rgba(255,255,255,0.72)', fontWeight: '500' },

  // Robot launcher in the header — opens the live English tutor screen,
  // with a soft white sonar-wave pulse radiating outward behind it.
  robotHeaderWrap: {
    width: rs(36),
    height: rs(36),
    alignItems: 'center',
    justifyContent: 'center',
  },
  robotHeaderWave: {
    position: 'absolute',
    width: rs(36),
    height: rs(36),
    borderRadius: rs(18),
    backgroundColor: C.white,
  },
  robotHeaderBtn: {
    width: rs(36),
    height: rs(36),
    borderRadius: rs(18),
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Preset Pills — explicit fixed height so they never stretch ──
  presetScroll: {
    flexGrow: 0,
    flexShrink: 0,
    height: rs(46),
  },
  presetRow: {
    paddingHorizontal: rs(12),
    paddingVertical: rs(6),
    gap: rs(8),
    alignItems: 'center',
  },
  presetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(6),
    backgroundColor: C.white,
    borderRadius: rs(20),
    paddingHorizontal: rs(13),
    height: rs(34),
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: C.accentDark,
    shadowOffset: { width: 0, height: rs(1) },
    shadowOpacity: 0.06,
    shadowRadius: rs(3),
    elevation: 1,
  },
  presetPillHighlight: {
    backgroundColor: C.accentLight,
    borderColor: C.accent,
  },
  presetEmoji: { fontSize: fs(13) },
  presetPillText: {
    fontSize: fs(11.5),
    fontWeight: '700',
    color: C.dark,
  },
  presetPillTextHighlight: { color: C.accentDark },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: rs(12),
    paddingTop: rs(6),
    paddingBottom: rs(90),
    gap: rs(10),
  },

  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: rs(8) },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowBot: { justifyContent: 'flex-start' },

  botAvatarSmall: {
    width: rs(24),
    height: rs(24),
    borderRadius: rs(12),
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
    flexShrink: 0,
  },

  bubble: {
    maxWidth: '78%',
    borderRadius: rs(16),
    paddingHorizontal: rs(13),
    paddingVertical: rs(10),
    position: 'relative',
  },
  userBubble: {
    backgroundColor: C.bubbleUser,
    borderBottomRightRadius: rs(4),
  },
  botBubble: {
    backgroundColor: C.bubbleBot,
    borderBottomLeftRadius: rs(4),
    borderWidth: 1,
    borderColor: C.border,
  },
  bubbleText: { fontSize: fs(13.5), color: C.dark, lineHeight: fs(19) },
  bubbleTextUser: { color: C.white },

  speakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4),
    marginTop: rs(7),
    alignSelf: 'flex-start',
  },
  speakBtnText: {
    fontSize: fs(10.5),
    fontWeight: '700',
    color: C.mutedLight,
  },

  voiceBubbleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: rs(160),
    paddingVertical: rs(2),
  },
  voicePlayBtn: {
    width: rs(30),
    height: rs(30),
    borderRadius: rs(15),
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: rs(8),
  },
  waveRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(2),
    marginRight: rs(8),
  },
  waveBar: {
    width: rs(2.5),
    borderRadius: rs(2),
  },
  voiceDuration: {
    fontSize: fs(11),
    color: C.mutedLight,
    minWidth: rs(30),
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: rs(8),
    backgroundColor: C.white,
    paddingHorizontal: rs(12),
    paddingTop: rs(10),
    borderTopWidth: 0.8,
    borderTopColor: C.border,
  },
  micBtn: {
    width: rs(40),
    height: rs(40),
    borderRadius: rs(20),
    backgroundColor: C.accentMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: C.danger,
  },
  input: {
    flex: 1,
    backgroundColor: C.bg,
    borderRadius: rs(18),
    paddingHorizontal: rs(14),
    paddingVertical: rs(10),
    fontSize: fs(13.5),
    color: C.dark,
    maxHeight: rs(100),
  },
  sendBtn: {
    width: rs(40),
    height: rs(40),
    borderRadius: rs(20),
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: C.mutedLight },

  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(8),
    backgroundColor: C.danger,
    paddingVertical: rs(7),
  },
  recordingText: {
    color: C.white,
    fontSize: fs(11.5),
    fontWeight: '700',
  },
  reactionPickerRow: {
  flexDirection: 'row',
  gap: rs(6),
  marginBottom: rs(6),
  backgroundColor: C.white,
  borderRadius: rs(20),
  paddingHorizontal: rs(8),
  paddingVertical: rs(6),
  alignSelf: 'flex-start',
  borderWidth: 1,
  borderColor: C.border,
},
reactionOption: { paddingHorizontal: rs(2) },
reactionOptionText: { fontSize: fs(18) },
reactionBadge: {
  position: 'absolute',
  bottom: rs(-10),
  left: rs(6),
  backgroundColor: C.white,
  borderRadius: rs(10),
  paddingHorizontal: rs(5),
  paddingVertical: rs(1),
  borderWidth: 1,
  borderColor: C.border,
},
reactionBadgeText: { fontSize: fs(12) },
});

export default AIChatbotScreen;