import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  PixelRatio,
  Platform,
  StatusBar,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Responsive Helpers ────────────────────────────────────────────────────────
const { width } = Dimensions.get('window');
const BASE_WIDTH = 393;
const scale = width / BASE_WIDTH;
const rs = (size: number) => Math.round(size * Math.min(scale, 1.45));
const fs = (size: number) =>
  Math.round((size * Math.min(scale, 1.3)) / PixelRatio.getFontScale());

const H_PAD = rs(16);

// ─── Brand Colors ─────────────────────────────────────────────────────────────
const C = {
  accent:      '#0E7EA4',
  accentDark:  '#0A5F7A',
  accentLight: '#EDF6FA',
  teal:        '#2ECC9A',
  tealLight:   '#E6F9F3',
  tealMid:     '#A8E9D5',
  bg:          '#F2F5F7',
  white:       '#FFFFFF',
  dark:        '#1A2B35',
  muted:       '#7AA0B0',
  mutedLight:  '#9BBAC8',
  border:      'rgba(14,126,164,0.09)',
  borderFocus: '#2ECC9A',
  borderSolid: '#DDE6EF',
  amber:       '#C97A3A',
  amberBg:     '#FEF3EC',
  danger:      '#E05252',
  dangerBg:    '#FEF0F0',
  error:       '#E5534B',
  errorLight:  '#FEF2F2',
  inputBg:     '#F7FBFE',
};

// ─── Avatar colors pool ────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#0E7EA4', '#1591B8', '#3A8FBF', '#2E6DA4', '#4A6A9A',
  '#C97A3A', '#2ECC9A', '#9B59B6', '#E67E22', '#1ABC9C',
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface StudentProfile {
  id: string;
  name: string;
  grade: string;
  section: string;
  rollNo: string;
  token: string;
  admno: string;
  isSignedOut?: boolean; // true = credentials cleared on this device, needs re-login
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const PersonIcon = ({ size = 22, color = C.white }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.8" />
    <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

const EditIcon = ({ size = 16, color = C.accent }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const TrashIcon = ({ size = 16, color = C.danger }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const PlusIcon = ({ size = 18, color = C.white }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

const CheckIcon = ({ size = 16, color = C.accent }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 13l4 4L19 7" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const LogoutIcon = ({ size = 18, color = C.danger }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M16 17l5-5-5-5M21 12H9" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const BackIcon = ({ size = 22, color = C.white }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M19 12H5M12 5l-7 7 7 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const SchoolIcon = ({ size = 16, color = C.muted }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <Rect x="9" y="13" width="6" height="8" stroke={color} strokeWidth="1.4" />
  </Svg>
);

const BadgeIcon = ({ color = C.muted }: { color?: string }) => (
  <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="7" width="18" height="13" rx="2" stroke={color} strokeWidth="1.6" />
    <Path d="M8 7V5a4 4 0 018 0v2" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    <Circle cx="12" cy="14" r="2.5" stroke={color} strokeWidth="1.5" />
  </Svg>
);

const LockIcon = ({ color = C.muted }: { color?: string }) => (
  <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
    <Rect x="5" y="11" width="14" height="10" rx="2" stroke={color} strokeWidth="1.6" />
    <Path d="M8 11V7a4 4 0 018 0v4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    <Circle cx="12" cy="16" r="1.5" fill={color} />
  </Svg>
);

const EyeIcon = ({ off, color = C.muted }: { off?: boolean; color?: string }) => (
  <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
    {off ? (
      <>
        <Path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"
          stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        <Path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"
          stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        <Path d="M3 3l18 18" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      </>
    ) : (
      <>
        <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
          stroke={color} strokeWidth="1.6" />
        <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.6" />
      </>
    )}
  </Svg>
);

// ─── Add Student Login Modal ──────────────────────────────────────────────────
const AddStudentModal = ({
  visible,
  onClose,
  onSuccess,
  institutionId,
  mode = 'add',
  reauthProfile = null,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: (profile: Omit<StudentProfile, 'id'>) => void;
  institutionId: string;
  mode?: 'add' | 'reauth';
  reauthProfile?: StudentProfile | null;
}) => {
  const [admno, setAdmno]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPass, setShowPass]         = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const isReauth = mode === 'reauth' && !!reauthProfile;

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setAdmno(isReauth ? reauthProfile!.admno : '');
      setPassword('');
      setShowPass(false);
      setError('');
      setLoading(false);
    }
  }, [visible]);

  const fieldBorderColor = (name: string, val: string) => {
    if (focusedField === name) return C.borderFocus;
    if (val.trim().length > 0) return C.tealMid;
    return C.borderSolid;
  };

 const handleAdd = async () => {
  if (!admno.trim() || !password.trim()) {
    setError('Please fill in both fields to continue.');
    return;
  }
  setError('');
  setLoading(true);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    console.log('📤 Sending request with:', {
      institution_id: institutionId.trim(),
      admno: admno.trim(),
      password,
    });

    const response = await fetch('https://magnetpro.in/api/parent-login/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        institution_id: institutionId.trim(),
        admno: admno.trim(),
        password,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    console.log('📥 Response status:', response.status);

    const data = await response.json();
    console.log('📦 Response body:', data);

    if (response.ok) {
      onSuccess({
        name:    data.student_name ?? admno.trim(),
        grade:   data.grade ?? '',
        section: data.section ?? '',
        rollNo:  data.roll_no ?? '',
        token:   data.access,
        admno:   admno.trim(),
      });
    } else {
      setError(data?.detail || data?.message || 'Incorrect credentials. Please try again.');
    }
  } catch (err: any) {
    clearTimeout(timeout);
    console.log('❌ Error:', err?.message, err);
    if (err?.name === 'AbortError') {
      setError('Request timed out. Please try again.');
    } else {
      setError(err?.message || 'Network error. Please check your connection and try again.');
    }
  } finally {
    setLoading(false);
  }
};

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={am.overlay}>
          <View style={am.sheet}>
            {/* ── Header ── */}
            <View style={am.sheetHeader}>
              <View>
                <Text style={am.sheetTitle}>{isReauth ? 'Sign Back In' : 'Add Student Profile'}</Text>
                <Text style={am.sheetSub}>
                  {isReauth
                    ? `Enter the password for ${reauthProfile!.name} to continue`
                    : 'Sign in with student credentials'}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={am.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* ── Institution ID (read-only pill) ── */}
            <View style={am.instPill}>
              <SchoolIcon size={14} color={C.accent} />
              <Text style={am.instPillLabel}>Institution ID</Text>
              <Text style={am.instPillValue}>{institutionId || '—'}</Text>
              <View style={am.instPillBadge}>
                <CheckIcon size={12} color={C.teal} />
                <Text style={am.instPillBadgeText}>Auto-filled</Text>
              </View>
            </View>

            {/* ── Error ── */}
            {!!error && (
              <View style={am.errorBox}>
                <Text style={am.errorText}>{error}</Text>
              </View>
            )}

            {/* ── Admission Number ── */}
            <Text style={am.label}>Admission Number</Text>
            <View style={[am.field, { borderColor: fieldBorderColor('adm', admno) }, isReauth && am.fieldLocked]}>
              <BadgeIcon color={focusedField === 'adm' ? C.accent : C.muted} />
              <TextInput
                style={am.input}
                placeholder="e.g. S/7058"
                placeholderTextColor={C.mutedLight}
                value={admno}
                onChangeText={setAdmno}
                autoCapitalize="characters"
                editable={!isReauth}
                onFocus={() => setFocusedField('adm')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* ── Password ── */}
            <Text style={am.label}>Password</Text>
            <View style={[am.field, { borderColor: fieldBorderColor('pass', password) }]}>
              <LockIcon color={focusedField === 'pass' ? C.accent : C.muted} />
              <TextInput
                style={am.input}
                placeholder="Enter student password"
                placeholderTextColor={C.mutedLight}
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
                <EyeIcon off={showPass} color={focusedField === 'pass' ? C.accent : C.muted} />
              </TouchableOpacity>
            </View>

            {/* ── Add Button ── */}
            <TouchableOpacity
              style={[am.btn, loading && am.btnDisabled]}
              onPress={handleAdd}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={C.white} size="small" />
              ) : (
                <>
                  <PlusIcon size={17} color={C.white} />
                  <Text style={am.btnText}>{isReauth ? 'Sign In' : 'Add Student'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const am = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,30,45,0.50)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: rs(24),
    borderTopRightRadius: rs(24),
    paddingHorizontal: rs(22),
    paddingTop: rs(24),
    paddingBottom: rs(32),
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: rs(18),
  },
  sheetTitle: {
    fontSize: fs(17),
    fontWeight: '800',
    color: C.dark,
    letterSpacing: -0.2,
  },
  sheetSub: {
    fontSize: fs(12),
    color: C.mutedLight,
    fontWeight: '500',
    marginTop: rs(2),
  },
  sheetClose: {
    fontSize: fs(18),
    color: C.muted,
    fontWeight: '600',
  },

  // ── Institution pill ──
  instPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(6),
    backgroundColor: C.accentLight,
    borderRadius: rs(12),
    paddingHorizontal: rs(12),
    paddingVertical: rs(10),
    marginBottom: rs(18),
    borderWidth: 1,
    borderColor: 'rgba(14,126,164,0.15)',
  },
  instPillLabel: {
    fontSize: fs(12),
    fontWeight: '600',
    color: C.muted,
  },
  instPillValue: {
    fontSize: fs(13),
    fontWeight: '800',
    color: C.accent,
    flex: 1,
  },
  instPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(3),
    backgroundColor: C.tealLight,
    borderRadius: rs(8),
    paddingHorizontal: rs(7),
    paddingVertical: rs(3),
  },
  instPillBadgeText: {
    fontSize: fs(9),
    fontWeight: '700',
    color: C.teal,
  },

  // ── Error ──
  errorBox: {
    backgroundColor: C.errorLight,
    borderLeftWidth: 3,
    borderLeftColor: C.error,
    borderRadius: rs(8),
    paddingVertical: rs(10),
    paddingHorizontal: rs(12),
    marginBottom: rs(14),
  },
  errorText: {
    fontSize: fs(13),
    color: C.error,
    fontWeight: '500',
  },

  // ── Fields ──
  label: {
    fontSize: fs(12),
    fontWeight: '700',
    color: C.dark,
    marginBottom: rs(6),
    letterSpacing: 0.2,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: rs(12),
    paddingHorizontal: rs(12),
    backgroundColor: C.inputBg,
    gap: rs(10),
    marginBottom: rs(16),
    height: rs(52),
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    height: rs(48),
    fontSize: fs(15),
    color: C.dark,
    fontWeight: '500',
  },
  fieldLocked: {
    backgroundColor: C.border,
    opacity: 0.75,
  },

  // ── Button ──
  btn: {
    backgroundColor: C.teal,
    borderRadius: rs(12),
    height: rs(50),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(8),
    marginTop: rs(4),
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: C.white,
    fontSize: fs(16),
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

// ─── Edit Profile Modal (for existing profiles) ───────────────────────────────
const EditProfileModal = ({
  visible,
  onClose,
  onSave,
  initial,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (p: Partial<StudentProfile>) => void;
  initial: StudentProfile | null;
}) => {
  const [name, setName]       = useState(initial?.name ?? '');
  const [grade, setGrade]     = useState(initial?.grade ?? '');
  const [section, setSection] = useState(initial?.section ?? '');
  const [rollNo, setRollNo]   = useState(initial?.rollNo ?? '');

  useEffect(() => {
    if (visible && initial) {
      setName(initial.name);
      setGrade(initial.grade);
      setSection(initial.section);
      setRollNo(initial.rollNo);
    }
  }, [visible, initial]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter the student name.');
      return;
    }
    onSave({ name: name.trim(), grade: grade.trim(), section: section.trim(), rollNo: rollNo.trim() });
  };

  const Field = ({
    label,
    value,
    onChange,
    placeholder,
    autoCapitalize = 'words',
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
  }) => (
    <View style={em.fieldWrap}>
      <Text style={em.fieldLabel}>{label}</Text>
      <TextInput
        style={em.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.mutedLight}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={em.overlay}>
        <View style={em.sheet}>
          <View style={em.sheetHeader}>
            <Text style={em.sheetTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={em.sheetClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Field label="Student Name *" value={name} onChange={setName} placeholder="e.g. Aarav Kumar" />
            <Field label="Grade / Class" value={grade} onChange={setGrade} placeholder="e.g. 9" autoCapitalize="none" />
            <Field label="Section" value={section} onChange={setSection} placeholder="e.g. A" autoCapitalize="characters" />
            <Field label="Roll Number" value={rollNo} onChange={setRollNo} placeholder="e.g. 24" autoCapitalize="none" />
            <View style={em.hint}>
              <Text style={em.hintText}>
                ℹ️ These details are for display only. The student's login credentials remain unchanged.
              </Text>
            </View>
          </ScrollView>
          <TouchableOpacity style={em.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <CheckIcon size={18} color={C.white} />
            <Text style={em.saveBtnText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const em = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,30,45,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: rs(24),
    borderTopRightRadius: rs(24),
    padding: rs(20),
    maxHeight: '82%',
    gap: rs(4),
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: rs(12),
  },
  sheetTitle: {
    fontSize: fs(17),
    fontWeight: '800',
    color: C.dark,
    letterSpacing: -0.2,
  },
  sheetClose: {
    fontSize: fs(18),
    color: C.muted,
    fontWeight: '600',
  },
  fieldWrap: {
    marginBottom: rs(14),
  },
  fieldLabel: {
    fontSize: fs(11),
    fontWeight: '700',
    color: C.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: rs(6),
  },
  input: {
    backgroundColor: C.bg,
    borderRadius: rs(12),
    paddingHorizontal: rs(14),
    paddingVertical: rs(12),
    fontSize: fs(14),
    fontWeight: '600',
    color: C.dark,
    borderWidth: 1,
    borderColor: C.border,
  },
  hint: {
    backgroundColor: C.accentLight,
    borderRadius: rs(12),
    padding: rs(12),
    marginBottom: rs(16),
  },
  hintText: {
    fontSize: fs(12),
    color: C.accent,
    fontWeight: '500',
    lineHeight: fs(18),
  },
  saveBtn: {
    backgroundColor: C.accent,
    borderRadius: rs(14),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(8),
    paddingVertical: rs(14),
    marginTop: rs(8),
  },
  saveBtnText: {
    fontSize: fs(15),
    fontWeight: '800',
    color: C.white,
    letterSpacing: -0.1,
  },
});

// ─── Student Card ─────────────────────────────────────────────────────────────
const StudentCard = ({
  profile,
  isActive,
  onSwitch,
  onEdit,
  onSignOut,
  onReauth,
  onDelete,
}: {
  profile: StudentProfile;
  isActive: boolean;
  onSwitch: () => void;
  onEdit: () => void;
  onSignOut: () => void;
  onReauth: () => void;
  onDelete: () => void;
}) => {
  const bg = avatarColor(profile.name);
  const signedOut = !!profile.isSignedOut;

  return (
    <TouchableOpacity
      style={[sc.card, isActive && !signedOut && sc.cardActive, signedOut && sc.cardSignedOut]}
      onPress={signedOut ? onReauth : onSwitch}
      activeOpacity={0.85}
    >
      {isActive && !signedOut && <View style={sc.activeStrip} />}

      <View style={[sc.avatar, { backgroundColor: bg }, signedOut && sc.avatarDim]}>
        <Text style={sc.avatarText}>{initials(profile.name)}</Text>
      </View>

      <View style={sc.info}>
        <View style={sc.nameRow}>
          <Text style={sc.name} numberOfLines={1}>{profile.name}</Text>
          {isActive && !signedOut && (
            <View style={sc.activePill}>
              <Text style={sc.activePillText}>Active</Text>
            </View>
          )}
          {signedOut && (
            <View style={sc.signedOutPill}>
              <Text style={sc.signedOutPillText}>Signed Out</Text>
            </View>
          )}
        </View>
        <View style={sc.metaRow}>
          <SchoolIcon size={13} color={C.mutedLight} />
          <Text style={sc.meta}>
            {signedOut
              ? 'Tap to sign in again'
              : [
                  profile.grade   && `Grade ${profile.grade}`,
                  profile.section && `Sec ${profile.section}`,
                  profile.rollNo  && `Roll ${profile.rollNo}`,
                  profile.admno   && `Adm: ${profile.admno}`,
                ].filter(Boolean).join(' · ') || 'No details added'}
          </Text>
        </View>
      </View>

      <View style={sc.actions}>
        <TouchableOpacity style={sc.actionBtn} onPress={onEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <EditIcon size={15} color={C.accent} />
        </TouchableOpacity>
        {!signedOut && (
          <TouchableOpacity style={sc.actionBtn} onPress={onSignOut} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <LogoutIcon size={15} color={C.accent} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[sc.actionBtn, sc.actionBtnDanger]} onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <TrashIcon size={15} color={C.danger} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const sc = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: rs(16),
    padding: rs(14),
    gap: rs(12),
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: C.accentDark,
    shadowOffset: { width: 0, height: rs(2) },
    shadowOpacity: 0.07,
    shadowRadius: rs(8),
    elevation: 2,
    marginBottom: rs(10),
    overflow: 'hidden',
  },
  cardActive: {
    borderColor: C.accent,
    borderWidth: 1.5,
    backgroundColor: '#F7FCFE',
  },
  cardSignedOut: {
    borderColor: C.borderSolid,
    borderStyle: 'dashed',
    backgroundColor: '#FAFBFC',
    opacity: 0.85,
  },
  activeStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: rs(4),
    backgroundColor: C.accent,
    borderTopLeftRadius: rs(16),
    borderBottomLeftRadius: rs(16),
  },
  avatar: {
    width: rs(48),
    height: rs(48),
    borderRadius: rs(24),
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: fs(17),
    fontWeight: '800',
    color: C.white,
    letterSpacing: -0.3,
  },
  avatarDim: {
    opacity: 0.45,
  },
  info: {
    flex: 1,
    gap: rs(4),
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(7),
  },
  name: {
    fontSize: fs(15),
    fontWeight: '800',
    color: C.dark,
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  activePill: {
    backgroundColor: C.accentLight,
    borderRadius: rs(8),
    paddingHorizontal: rs(8),
    paddingVertical: rs(2),
  },
  activePillText: {
    fontSize: fs(10),
    fontWeight: '700',
    color: C.accent,
    letterSpacing: 0.3,
  },
  signedOutPill: {
    backgroundColor: C.amberBg,
    borderRadius: rs(8),
    paddingHorizontal: rs(8),
    paddingVertical: rs(2),
  },
  signedOutPillText: {
    fontSize: fs(10),
    fontWeight: '700',
    color: C.amber,
    letterSpacing: 0.3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4),
  },
  meta: {
    fontSize: fs(12),
    color: C.mutedLight,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: rs(6),
    flexShrink: 0,
  },
  actionBtn: {
    width: rs(32),
    height: rs(32),
    borderRadius: rs(10),
    backgroundColor: C.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDanger: {
    backgroundColor: C.dangerBg,
  },
});

// ─── Main ProfileScreen ───────────────────────────────────────────────────────
export const ProfileScreen = ({ route, navigation }: any) => {
  const currentToken       = route?.params?.token ?? '';
  const currentStudentName = route?.params?.studentName ?? '';

  const [profiles, setProfiles]           = useState<StudentProfile[]>([]);
  const [activeId, setActiveId]           = useState<string | null>(null);
  const [institutionId, setInstitutionId] = useState('');
  useEffect(() => {
  AsyncStorage.getItem('institutionId').then(id => {
    if (id) setInstitutionId(id);
  });
}, []);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editTarget, setEditTarget]           = useState<StudentProfile | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [reauthTarget, setReauthTarget]       = useState<StudentProfile | null>(null);
  const [reauthModalVisible, setReauthModalVisible] = useState(false);

  // ── Load stored institution ID + profiles ──
  useEffect(() => {
    const load = async () => {
      try {
        const [raw, storedInstId, activeRaw] = await AsyncStorage.multiGet([
          'studentProfiles',
          'institutionId',
          'activeProfileId',
        ]).then(pairs => pairs.map(p => p[1]));

        // Restore institution ID used at login
        if (storedInstId) setInstitutionId(storedInstId);

        const saved: StudentProfile[] = raw ? JSON.parse(raw) : [];

        if (saved.length === 0 && currentToken) {
          const seed: StudentProfile = {
            id:      Date.now().toString(),
            name:    currentStudentName || 'Student',
            grade:   '',
            section: '',
            rollNo:  '',
            token:   currentToken,
            admno:   '',
          };
          const seeded = [seed];
          setProfiles(seeded);
          setActiveId(seed.id);
          await AsyncStorage.setItem('studentProfiles', JSON.stringify(seeded));
          await AsyncStorage.setItem('activeProfileId', seed.id);
        } else {
          setProfiles(saved);
          setActiveId(activeRaw ?? saved[0]?.id ?? null);
        }
      } catch {
        /* ignore */
      }
    };
    load();
  }, []);

  const saveProfiles = async (updated: StudentProfile[], newActiveId?: string | null) => {
    setProfiles(updated);
    await AsyncStorage.setItem('studentProfiles', JSON.stringify(updated));
    if (newActiveId !== undefined) {
      setActiveId(newActiveId);
      if (newActiveId) {
        await AsyncStorage.setItem('activeProfileId', newActiveId);
      } else {
        await AsyncStorage.removeItem('activeProfileId');
      }
    }
  };

  // ── Switch active student ──
  const handleSwitch = async (profile: StudentProfile) => {
    setActiveId(profile.id);
    await AsyncStorage.setItem('activeProfileId', profile.id);
    await AsyncStorage.setItem('token', profile.token);
    await AsyncStorage.setItem('studentName', profile.name);
    navigation.replace('Home', { token: profile.token, studentName: profile.name });
  };

  // ── Add new student (called after successful API login) ──
  const handleAddSuccess = async (data: Omit<StudentProfile, 'id'>) => {
    const newProfile: StudentProfile = { id: Date.now().toString(), ...data };
    const updated = [...profiles, newProfile];
    await saveProfiles(updated);
    setAddModalVisible(false);
  };

  // ── Edit existing profile (display info only) ──
  const handleEditSave = async (data: Partial<StudentProfile>) => {
    if (!editTarget) return;
    const updated = profiles.map(pr =>
      pr.id === editTarget.id ? { ...pr, ...data } : pr
    );
    await saveProfiles(updated);
    if (editTarget.id === activeId && data.name) {
      await AsyncStorage.setItem('studentName', data.name);
    }
    setEditTarget(null);
    setEditModalVisible(false);
  };

  // ── Delete ──
  const handleDelete = (profile: StudentProfile) => {
    if (profiles.length === 1) {
      Alert.alert('Cannot Delete', 'You must have at least one student profile.');
      return;
    }
    Alert.alert(
      'Remove Profile',
      `Remove ${profile.name}'s profile? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updated = profiles.filter(pr => pr.id !== profile.id);
            const newActiveId = profile.id === activeId ? updated[0]?.id ?? null : activeId;
            await saveProfiles(updated, newActiveId ?? undefined);
          },
        },
      ]
    );
  };

  // ── Sign out of ONE student profile only ──
  // Clears that student's saved credentials on this device but keeps their
  // card in the list (marked "Signed Out") so they can be re-added with a
  // password instead of the full "Add Student" flow. Other profiles are untouched.
  const handleSignOutProfile = (profile: StudentProfile) => {
    Alert.alert(
      'Sign Out',
      `Sign out of ${profile.name}'s profile? You'll need to enter their password again to view it. Other student profiles stay signed in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            const updated = profiles.map(pr =>
              pr.id === profile.id ? { ...pr, token: '', isSignedOut: true } : pr
            );

            if (profile.id === activeId) {
              const nextActive = updated.find(pr => pr.id !== profile.id && !pr.isSignedOut);
              if (nextActive) {
                await saveProfiles(updated, nextActive.id);
                await AsyncStorage.setItem('token', nextActive.token);
                await AsyncStorage.setItem('studentName', nextActive.name);
                navigation.replace('Home', { token: nextActive.token, studentName: nextActive.name });
              } else {
                await saveProfiles(updated, null);
                await AsyncStorage.multiRemove(['token', 'studentName']);
                navigation.replace('Login');
              }
            } else {
              await saveProfiles(updated);
            }
          },
        },
      ]
    );
  };

  // ── Re-authenticate a signed-out profile (tap the card) ──
  const handleReauthSuccess = async (data: Omit<StudentProfile, 'id'>) => {
    if (!reauthTarget) return;
    const updated = profiles.map(pr =>
      pr.id === reauthTarget.id
        ? { ...pr, token: data.token, isSignedOut: false }
        : pr
    );
    await saveProfiles(updated, reauthTarget.id);
    await AsyncStorage.setItem('token', data.token);
    await AsyncStorage.setItem('studentName', reauthTarget.name);
    setReauthModalVisible(false);
    setReauthTarget(null);
    navigation.replace('Home', { token: data.token, studentName: reauthTarget.name });
  };

  // ── Sign out of ALL profiles (the only "wipe everything" action) ──
  const handleLogoutAll = () => {
    Alert.alert(
      'Sign Out of All Profiles',
      `This signs out all ${profiles.length} student profile${profiles.length !== 1 ? 's' : ''} linked on this device. You'll need to sign in again to view any of them.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out All',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove([
              'token', 'studentName', 'studentProfiles', 'activeProfileId', 'institutionId',
            ]);
            navigation.replace('Login');
          },
        },
      ]
    );
  };

  const activeProfile = profiles.find(pr => pr.id === activeId);

  return (
    <SafeAreaView style={ps.safe} edges={['bottom']}>
      {/* ── Header ── */}
      <View style={ps.header}>
        <TouchableOpacity style={ps.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <BackIcon size={22} color={C.white} />
        </TouchableOpacity>
        <Text style={ps.headerTitle}>Profiles</Text>
        <View style={{ width: rs(38) }} />
      </View>

      <ScrollView contentContainerStyle={ps.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Parent Banner ── */}
        <View style={ps.parentBanner}>
          <View style={ps.parentAvatarWrap}>
            <PersonIcon size={28} color={C.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ps.parentLabel}>Parent Account</Text>
            <Text style={ps.parentSub}>
              {profiles.length} student{profiles.length !== 1 ? 's' : ''} linked
            </Text>
          </View>
          {/* Quick "Sign Out" button removed from here — it used to trigger a
              full sign-out-of-everything action under a misleading label.
              Sign-out actions now live per student card and in the Account
              section below, each labeled for exactly what it does. */}
        </View>

        {/* ── Active Profile Highlight ── */}
        {activeProfile && (
          <View style={ps.activeHighlight}>
            <View style={[ps.activeHighlightAvatar, { backgroundColor: avatarColor(activeProfile.name) }]}>
              <Text style={ps.activeHighlightInitials}>{initials(activeProfile.name)}</Text>
            </View>
            <View>
              <Text style={ps.activeHighlightName}>{activeProfile.name}</Text>
              <Text style={ps.activeHighlightSub}>Currently viewing</Text>
            </View>
          </View>
        )}

        {/* ── Student Profiles ── */}
        <Text style={ps.sectionTitle}>Student Profiles</Text>

        {profiles.map(profile => (
          <StudentCard
            key={profile.id}
            profile={profile}
            isActive={profile.id === activeId}
            onSwitch={() => handleSwitch(profile)}
            onEdit={() => { setEditTarget(profile); setEditModalVisible(true); }}
            onSignOut={() => handleSignOutProfile(profile)}
            onReauth={() => { setReauthTarget(profile); setReauthModalVisible(true); }}
            onDelete={() => handleDelete(profile)}
          />
        ))}

        {/* ── Add Profile Button ── */}
        <TouchableOpacity
          style={ps.addBtn}
          onPress={() => setAddModalVisible(true)}
          activeOpacity={0.85}
        >
          <View style={ps.addBtnIcon}>
            <PlusIcon size={20} color={C.white} />
          </View>
          <View>
            <Text style={ps.addBtnLabel}>Add Student Profile</Text>
            <Text style={ps.addBtnSub}>Link another child from the same school</Text>
          </View>
        </TouchableOpacity>

        {/* ── Info Note ── */}
        <View style={ps.infoNote}>
          <Text style={ps.infoNoteText}>
            💡 Tap a profile to switch to that student. Your Institution ID is reused automatically when adding new students.
          </Text>
        </View>

        {/* ── Danger Zone ── */}
        <View style={ps.dangerZone}>
          <Text style={ps.dangerZoneTitle}>Account</Text>
          <TouchableOpacity style={ps.dangerRow} onPress={handleLogoutAll} activeOpacity={0.8}>
            <LogoutIcon size={18} color={C.danger} />
            <Text style={ps.dangerText}>Sign Out of All Profiles</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── Add Student Modal (login-style) ── */}
      <AddStudentModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSuccess={handleAddSuccess}
        institutionId={institutionId}
      />

      {/* ── Re-sign-in Modal (for a signed-out profile) ── */}
      <AddStudentModal
        visible={reauthModalVisible}
        onClose={() => { setReauthModalVisible(false); setReauthTarget(null); }}
        onSuccess={handleReauthSuccess}
        institutionId={institutionId}
        mode="reauth"
        reauthProfile={reauthTarget}
      />

      {/* ── Edit Profile Modal (display info only) ── */}
      <EditProfileModal
        visible={editModalVisible}
        onClose={() => { setEditModalVisible(false); setEditTarget(null); }}
        onSave={handleEditSave}
        initial={editTarget}
      />
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const ps = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    paddingHorizontal: H_PAD,
    paddingBottom: rs(50),
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.accent,
    paddingHorizontal: H_PAD,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? rs(28)) : rs(52),
    paddingBottom: rs(16),
  },
  backBtn: {
    width: rs(38),
    height: rs(38),
    borderRadius: rs(12),
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: fs(18),
    fontWeight: '800',
    color: C.white,
    letterSpacing: -0.2,
  },

  // ── Parent Banner ──
  parentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: rs(16),
    padding: rs(14),
    marginTop: rs(16),
    marginBottom: rs(10),
    gap: rs(12),
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: C.accentDark,
    shadowOffset: { width: 0, height: rs(2) },
    shadowOpacity: 0.07,
    shadowRadius: rs(8),
    elevation: 2,
  },
  parentAvatarWrap: {
    width: rs(48),
    height: rs(48),
    borderRadius: rs(24),
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  parentLabel: {
    fontSize: fs(15),
    fontWeight: '800',
    color: C.dark,
    letterSpacing: -0.1,
  },
  parentSub: {
    fontSize: fs(12),
    color: C.mutedLight,
    fontWeight: '500',
    marginTop: rs(2),
  },
  // ── Active Highlight ──
  activeHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12),
    backgroundColor: C.accentLight,
    borderRadius: rs(14),
    padding: rs(12),
    marginBottom: rs(16),
    borderWidth: 1,
    borderColor: 'rgba(14,126,164,0.15)',
  },
  activeHighlightAvatar: {
    width: rs(40),
    height: rs(40),
    borderRadius: rs(20),
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activeHighlightInitials: {
    fontSize: fs(15),
    fontWeight: '800',
    color: C.white,
  },
  activeHighlightName: {
    fontSize: fs(14),
    fontWeight: '800',
    color: C.accent,
    letterSpacing: -0.1,
  },
  activeHighlightSub: {
    fontSize: fs(11),
    color: C.muted,
    fontWeight: '500',
    marginTop: rs(2),
  },

  // ── Section Title ──
  sectionTitle: {
    fontSize: fs(11),
    fontWeight: '800',
    color: '#4A6A7A',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: rs(12),
  },

  // ── Add Button ──
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12),
    backgroundColor: C.white,
    borderRadius: rs(16),
    padding: rs(14),
    borderWidth: 1.5,
    borderColor: C.accent,
    borderStyle: 'dashed',
    marginTop: rs(4),
    marginBottom: rs(16),
  },
  addBtnIcon: {
    width: rs(40),
    height: rs(40),
    borderRadius: rs(20),
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  addBtnLabel: {
    fontSize: fs(14),
    fontWeight: '800',
    color: C.accent,
    letterSpacing: -0.1,
  },
  addBtnSub: {
    fontSize: fs(11),
    color: C.muted,
    fontWeight: '500',
    marginTop: rs(2),
  },

  // ── Info Note ──
  infoNote: {
    backgroundColor: '#FFFBEC',
    borderRadius: rs(12),
    padding: rs(12),
    marginBottom: rs(24),
    borderWidth: 1,
    borderColor: '#F5E6C5',
  },
  infoNoteText: {
    fontSize: fs(12),
    color: C.amber,
    fontWeight: '500',
    lineHeight: fs(18),
  },

  // ── Danger Zone ──
  dangerZone: {
    backgroundColor: C.white,
    borderRadius: rs(16),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  dangerZoneTitle: {
    fontSize: fs(11),
    fontWeight: '700',
    color: C.mutedLight,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: rs(16),
    paddingTop: rs(12),
    paddingBottom: rs(8),
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12),
    paddingHorizontal: rs(16),
    paddingVertical: rs(14),
    borderTopWidth: 1,
    borderColor: C.border,
  },
  dangerText: {
    fontSize: fs(14),
    fontWeight: '700',
    color: C.danger,
  },
});

export default ProfileScreen;