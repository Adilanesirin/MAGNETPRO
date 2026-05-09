import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Image,
  ImageBackground,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Brand Colors ─────────────────────────────────────────────────────────────
const C = {
  teal:        '#2ECC9A',
  tealLight:   '#E6F9F3',
  tealMid:     '#A8E9D5',
  blue:        '#1E9FD8',
  blueLight:   '#E6F4FB',
  dark:        '#1A2332',
  body:        '#4A5568',
  muted:       '#8A97A8',
  border:      '#DDE6EF',
  borderFocus: '#2ECC9A',
  bg:          '#F7FBFE',
  white:       '#FFFFFF',
  error:       '#E5534B',
  errorLight:  '#FEF2F2',
  badge:       '#FFF8E7',
  badgeDot:    '#F4A622',
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const SchoolIcon = () => (
  <Svg width={17} height={70} viewBox="0 0 24 24" fill="none">
    <Path d="M3 21V9l9-6 9 6v12" stroke={C.muted} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <Rect x="9" y="13" width="6" height="8" rx="1" stroke={C.muted} strokeWidth="1.5" />
    <Path d="M9 9h.01M15 9h.01M12 6h.01" stroke={C.muted} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

const BadgeIcon = () => (
  <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="7" width="18" height="13" rx="2" stroke={C.muted} strokeWidth="1.6" />
    <Path d="M8 7V5a4 4 0 018 0v2" stroke={C.muted} strokeWidth="1.6" strokeLinecap="round" />
    <Circle cx="12" cy="14" r="2.5" stroke={C.muted} strokeWidth="1.5" />
  </Svg>
);

const LockIcon = () => (
  <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
    <Rect x="5" y="11" width="14" height="10" rx="2" stroke={C.muted} strokeWidth="1.6" />
    <Path d="M8 11V7a4 4 0 018 0v4" stroke={C.muted} strokeWidth="1.6" strokeLinecap="round" />
    <Circle cx="12" cy="16" r="1.5" fill={C.muted} />
  </Svg>
);

const EyeIcon = ({ off }: { off?: boolean }) => (
  <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
    {off ? (
      <>
        <Path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"
          stroke={C.muted} strokeWidth="1.6" strokeLinecap="round" />
        <Path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"
          stroke={C.muted} strokeWidth="1.6" strokeLinecap="round" />
        <Path d="M3 3l18 18" stroke={C.muted} strokeWidth="1.6" strokeLinecap="round" />
      </>
    ) : (
      <>
        <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
          stroke={C.muted} strokeWidth="1.6" />
        <Circle cx="12" cy="12" r="3" stroke={C.muted} strokeWidth="1.6" />
      </>
    )}
  </Svg>
);

const CheckIcon = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <Path d="M5 12l5 5L19 7" stroke={C.teal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ─── Decorative school illustration (books + pencil) ─────────────────────────
const SchoolIllustration = () => (
  <Svg width={64} height={64} viewBox="0 0 64 64" fill="none">
    {/* Book stack */}
    <Rect x="8" y="38" width="28" height="6" rx="1.5" fill={C.blue} opacity="0.85" />
    <Rect x="10" y="32" width="24" height="6" rx="1.5" fill={C.teal} opacity="0.9" />
    <Rect x="12" y="26" width="20" height="6" rx="1.5" fill={C.blue} opacity="0.6" />
    {/* Spine lines */}
    <Path d="M13 38v6M13 32v6M15 26v6" stroke={C.white} strokeWidth="1" opacity="0.5" />
    {/* Pencil */}
    <Path d="M38 36L50 12l4 2L42 38z" fill={C.badgeDot} />
    <Path d="M38 36l2 6 4-4z" fill={C.dark} opacity="0.5" />
    <Path d="M50 12l4 2-1 2-4-2z" fill="#E8E8E8" />
    <Path d="M39 35l14-26" stroke={C.white} strokeWidth="0.8" opacity="0.4" />
    {/* Star sparkle */}
    <Circle cx="54" cy="22" r="2" fill={C.teal} opacity="0.5" />
    <Circle cx="20" cy="22" r="1.5" fill={C.blue} opacity="0.4" />
  </Svg>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
export const LoginScreen = ({ navigation }: any) => {
   useEffect(() => {
    AsyncStorage.multiGet(['token', 'studentName']).then(pairs => {
      const token = pairs[0][1];
      const studentName = pairs[1][1];
      if (token && studentName) {
        navigation.replace('Home', { token, studentName });
      }
    });
  }, []);
  const [institutionId, setInstitutionId] = useState('');
  const [admno, setAdmno]                 = useState('');
  const [password, setPassword]           = useState('');
  const [showPass, setShowPass]           = useState(false);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');
  const [focusedField, setFocusedField]   = useState<string | null>(null);

  const handleLogin = async () => {
    if (!institutionId.trim() || !admno.trim() || !password.trim()) {
      setError('Please fill in all fields to continue.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const response = await fetch('https://magnetpro.in/api/parent-login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution_id: institutionId.trim(),
          admno: admno.trim(),
          password,
        }),
      });
      const data = await response.json();
      console.log('Login response:', data); // remove after debugging
        if (response.ok) {
          await AsyncStorage.multiSet([
            ['token', data.access],
            ['studentName', data.student_name],
          ]);
          navigation.replace('Home', {
            token: data.access,
            studentName: data.student_name,
          });
        }
        else {
          setError(data?.detail || data?.message || 'Incorrect credentials. Please try again.');
        }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const fieldBorderColor = (name: string, val: string) => {
    if (focusedField === name) return C.borderFocus;
    if (val.trim().length > 0) return C.tealMid;
    return C.border;
  };

  return (
    <ImageBackground
      source={require('../../assets/login-bg.jpg')}
      style={s.bgImage}
      resizeMode="cover"
    >
      <View style={s.overlay} />
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.kav}
        >
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Single card ── */}
            <View style={s.card}>

              {/* Logo */}
              <Image
                source={require('../../assets/magnet-logo.png')}
                style={s.logo}
                resizeMode="contain"
              />

              {/* Divider */}
              <View style={s.divider} />

              {/* Error */}
              {!!error && (
                <View style={s.errorBox}>
                  <Text style={s.errorText}>{error}</Text>
                </View>
              )}

              {/* Institution ID */}
              <Text style={s.label}>Institution ID</Text>
              <View style={[s.field, { borderColor: fieldBorderColor('inst', institutionId) }]}>
                <SchoolIcon />
                <TextInput
                  style={s.input}
                  placeholder="e.g. SCH001"
                  placeholderTextColor={C.muted}
                  value={institutionId}
                  onChangeText={setInstitutionId}
                  autoCapitalize="characters"
                  onFocus={() => setFocusedField('inst')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              {/* Admission Number */}
              <Text style={s.label}>Admission Number</Text>
              <View style={[s.field, { borderColor: fieldBorderColor('adm', admno) }]}>
                <BadgeIcon />
                <TextInput
                  style={s.input}
                  placeholder="e.g. S/7058"
                  placeholderTextColor={C.muted}
                  value={admno}
                  onChangeText={setAdmno}
                  autoCapitalize="characters"
                  onFocus={() => setFocusedField('adm')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              {/* Password */}
              <Text style={s.label}>Password</Text>
              <View style={[s.field, { borderColor: fieldBorderColor('pass', password) }]}>
                <LockIcon />
                <TextInput
                  style={s.input}
                  placeholder="Enter your password"
                  placeholderTextColor={C.muted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  onFocus={() => setFocusedField('pass')}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity
                  onPress={() => setShowPass(v => !v)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <EyeIcon off={showPass} />
                </TouchableOpacity>
              </View>

              {/* Sign In Button */}
              <TouchableOpacity
                style={[s.btn, loading && s.btnDisabled]}
                onPress={handleLogin}
                activeOpacity={0.85}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color={C.white} size="small" />
                  : <Text style={s.btnText}>Sign In</Text>
                }
              </TouchableOpacity>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  bgImage: {
    flex: 1,
  },
 
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  kav: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },

  // ── Single card ──
  card: {
    backgroundColor: "#ffffffc8",
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 28,
  },

 logo: {
  width: '60%',       // relative to card width, never stretches it
  maxWidth: 150,
  height: 148,
  alignSelf: 'center',
  marginBottom: 24,
  marginTop: -50,   // pulls the logo up to overlap the card's top edge for a dynamic look
},

  divider: {
    height: 1,
    backgroundColor: C.border,
    marginBottom: 24,
    marginTop: -50,
  },

  // Error
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 3,
    borderLeftColor: C.error,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: C.error,
    fontWeight: '500',
  },

  // Fields
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: C.dark,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
field: {
  flexDirection: 'row',
  alignItems: 'center',
  borderWidth: 1.5,
  borderRadius: 10,
  paddingHorizontal: 12,
  backgroundColor: C.bg,
  gap: 10,
  marginBottom: 16,
  height: 52,        // fixed height — icon size won't affect it
  overflow: 'hidden', // clips anything that tries to grow beyond
},
  input: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: C.dark,
  },

  // Button
  btn: {
    backgroundColor: C.teal,
    borderRadius: 10,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: C.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});