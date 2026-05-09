import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  PixelRatio,
  ImageBackground,
  StatusBar,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Responsive Helpers ────────────────────────────────────────────────────────
const { width } = Dimensions.get('window');
const BASE_WIDTH = 393; // iPhone 14 Pro base width
const scale = width / BASE_WIDTH;
const rs = (size: number) => Math.round(size * Math.min(scale, 1.45));
const fs = (size: number) =>
  Math.round((size * Math.min(scale, 1.3)) / PixelRatio.getFontScale());

const H_PAD      = rs(16);
const CARD_WIDTH = (width - H_PAD * 2 - rs(10)) / 2;
const SCHOOL_W   = width * 0.44;
const SCHOOL_H   = SCHOOL_W * 0.76;

// ─── Brand Colors ─────────────────────────────────────────────────────────────
const C = {
  accent:      '#0E7EA4',
  accentDark:  '#0A5F7A',
  accentLight: '#EDF6FA',
  bg:          '#F2F5F7',
  white:       '#FFFFFF',
  dark:        '#1A2B35',
  muted:       '#7AA0B0',
  mutedLight:  '#9BBAC8',
  border:      'rgba(14,126,164,0.09)',
  statBg:      '#F2F8FA',
  amber:       '#C97A3A',
  amberBg:     '#FEF3EC',
  card1:       '#0E6E8E',
  card2:       '#1591B8',
  card3:       '#0C6079',
  card4:       '#157EA0',
  card5:       '#0A5068',
};

// ─── Module Data ──────────────────────────────────────────────────────────────
const MODULES = [
  { id: 'profile',    label: 'Profile',        sub: 'Student details',   route: 'Profile',    live: false },
  { id: 'fees',       label: 'Fee Management', sub: 'Paid & pending',    route: 'Fees',       live: true  },
  { id: 'attendance', label: 'Attendance',     sub: 'Daily report',      route: 'Attendance', live: false },
  { id: 'progress',   label: 'Progress Card',  sub: 'Academic results',  route: 'Progress',   live: false },
  { id: 'library',    label: 'Library',        sub: 'Books & resources', route: 'Library',    live: false },
];

// ─── School Cards ─────────────────────────────────────────────────────────────
// Project structure: D:\magnet-parents\
//   assets\school-assembly.jpg  ← root-level assets folder
//   src\screens\HomeScreen.tsx  ← this file
// Relative path from src/screens/ up to root:  ../../assets/
const SCHOOL_CARDS = [
  {
    id: 'assembly',
    label: 'Morning Assembly',
    quote: '"Be the change you wish to see"',
    badge: null,
    image: require('../../assets/school-assembly.jpg'),
  },
  {
    id: 'lab',
    label: 'Science Lab',
    quote: 'Hands-on learning today',
    badge: 'NEW',
    image: require('../../assets/science-lab.jpg'),
  },
  {
    id: 'sports',
    label: 'Annual Sports Day',
    quote: '15 May — all parents invited',
    badge: 'MAY',
    image: require('../../assets/sports.jpg'),
  },
  {
    id: 'note',
    label: "Teacher's Note",
    quote: '"Great progress this week!"',
    badge: null,
    image: require('../../assets/teacher.jpg'),
  },
  {
    id: 'exam',
    label: 'Exam Timetable',
    quote: 'Term 2 finals — May 20',
    badge: 'EXAM',
    image: require('../../assets/exam-time-table.jpg'),
  },
];

// ─── Icons ────────────────────────────────────────────────────────────────────
const ICO = rs(20);

const ProfileIcon = () => (
  <Svg width={ICO} height={ICO} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="8" r="4" fill={C.accent} />
    <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill={C.accent} />
  </Svg>
);

const FeesIcon = () => (
  <Svg width={ICO} height={ICO} viewBox="0 0 24 24" fill="none">
    <Rect x="2" y="5" width="20" height="14" rx="2" stroke={C.accent} strokeWidth="1.8" />
    <Path d="M2 9h20M6 14h3M11 14h7" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" />
  </Svg>
);

const AttendanceIcon = () => (
  <Svg width={ICO} height={ICO} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="4" width="18" height="18" rx="2" stroke={C.accent} strokeWidth="1.8" />
    <Path d="M3 9h18M8 2v4M16 2v4" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" />
    <Path d="M8 14l2 2 4-4" stroke={C.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const ProgressIcon = () => (
  <Svg width={ICO} height={ICO} viewBox="0 0 24 24" fill="none">
    <Path d="M4 20V14M8 20V10M12 20V12M16 20V6M20 20V8" stroke={C.accent} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

const LibraryIcon = () => (
  <Svg width={ICO} height={ICO} viewBox="0 0 24 24" fill="none">
    <Rect x="4" y="4" width="4" height="16" rx="1" fill={C.accent} opacity={0.9} />
    <Rect x="10" y="4" width="4" height="16" rx="1" fill={C.accent} opacity={0.6} />
    <Rect x="16" y="4" width="4" height="16" rx="1" fill={C.accent} opacity={0.35} />
  </Svg>
);

const MODULE_ICONS: Record<string, () => JSX.Element> = {
  profile:    ProfileIcon,
  fees:       FeesIcon,
  attendance: AttendanceIcon,
  progress:   ProgressIcon,
  library:    LibraryIcon,
};

const ChevronRight = () => (
  <Svg width={rs(13)} height={rs(13)} viewBox="0 0 24 24" fill="none">
    <Path
      d="M9 18l6-6-6-6"
      stroke={C.accent}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const SignOutIcon = () => (
  <Svg width={rs(15)} height={rs(15)} viewBox="0 0 24 24" fill="none">
    <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke={C.white} strokeWidth="2.5" strokeLinecap="round" />
    <Path d="M16 17l5-5-5-5" stroke={C.white} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M21 12H9" stroke={C.white} strokeWidth="2.5" strokeLinecap="round" />
  </Svg>
);
// ─── Animated School Card ─────────────────────────────────────────────────────
// ─── Auto Scrolling School Carousel ──────────────────────────────────────────
const SchoolCarousel = () => {
  const scrollRef  = useRef<ScrollView>(null);
  const currentIdx = useRef(0);
  const cardWidth  = SCHOOL_W + rs(10);

  useEffect(() => {
    const interval = setInterval(() => {
      const nextIdx = (currentIdx.current + 1) % SCHOOL_CARDS.length;
      scrollRef.current?.scrollTo({ x: nextIdx * cardWidth, animated: true });
      currentIdx.current = nextIdx;
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.schoolScrollContent}
      decelerationRate="fast"
      snapToInterval={cardWidth}
      snapToAlignment="start"
      scrollEnabled={true}
    >
      {SCHOOL_CARDS.map((card) => (
        <TouchableOpacity key={card.id} activeOpacity={0.88} style={s.schoolCard}>
          <ImageBackground
            source={card.image}
            style={s.schoolCardBg}
            imageStyle={s.schoolCardBgImg}
            resizeMode="cover"
          >
            <View style={s.schoolCardDimmer} />
            {card.badge && (
              <View style={s.schoolCardBadge}>
                <Text style={s.schoolCardBadgeText}>{card.badge}</Text>
              </View>
            )}
            <View style={s.schoolCardContent}>
              <Text style={s.schoolCardLabel} numberOfLines={1}>{card.label}</Text>
              <Text style={s.schoolCardQuote} numberOfLines={2}>{card.quote}</Text>
            </View>
          </ImageBackground>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

// ─── Screen Component ─────────────────────────────────────────────────────────
export const HomeScreen = ({ route, navigation }: any) => {
  const token       = route?.params?.token ?? '';
  const studentName = (route?.params?.studentName ?? 'Parent').trim();

  const [totalPending, setTotalPending] = useState<number | null>(null);
  const [feeLoading, setFeeLoading]     = useState(true);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const res  = await fetch('https://magnetpro.in/api/fee_pending/pending/', {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (data.status && Array.isArray(data.fees)) {
          const total = data.fees.reduce(
            (sum: number, f: { amount: string }) => sum + parseFloat(f.amount),
            0
          );
          setTotalPending(total);
        }
      } catch {
        setTotalPending(null);
      } finally {
        setFeeLoading(false);
      }
    };
    fetchPending();
  }, [token]);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove(['token', 'studentName']);
          navigation.replace('Login');
        },
      },
    ]);
  };

  const handleModulePress = (mod: (typeof MODULES)[0]) => {
    if (!mod.live) {
      Alert.alert('Coming Soon', `${mod.label} module is under construction. 🚧`);
      return;
    }
    navigation.navigate(mod.route, { token, studentName });
  };

  // Build rows: 2 columns; last solo card spans full width
  const rows: (typeof MODULES)[] = [];
  for (let i = 0; i < MODULES.length; i += 2) {
    rows.push(MODULES.slice(i, i + 2));
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.greeting}>Welcome back 👋</Text>
            <Text style={s.studentName} numberOfLines={1} adjustsFontSizeToFit>
              {studentName}
            </Text>
          </View>
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
            <SignOutIcon />
            <Text style={s.logoutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {/* ── Stats Card ── */}
        <View style={s.statsCard}>
          <View style={s.statsRow}>
            <View style={s.statBox}>
              <Text style={s.statLabel}>ATTENDANCE</Text>
              <Text style={s.statVal}>87%</Text>
              <Text style={s.statSub}>This term</Text>
            </View>
            <View style={[s.statBox, s.statBoxMid]}>
            <Text style={s.statLabel}>FEE STATUS</Text>
            {feeLoading ? (
              <ActivityIndicator size="small" color={C.amber} style={{ marginVertical: 4 }} />
            ) : totalPending === null ? (
              <Text style={[s.statVal, { color: C.muted }]}>—</Text>
            ) : totalPending === 0 ? (
              <Text style={[s.statVal, { color: '#2ECC9A' }]}>Paid ✓</Text>
            ) : (
              <>
                <Text style={[s.statVal, { color: C.amber }]}>Pending</Text>
                <Text style={s.statSub}>₹{totalPending.toFixed(0)} due</Text>
              </>
            )}
          </View>
            <View style={s.statBox}>
              <Text style={s.statLabel}>GPA</Text>
              <Text style={s.statVal}>8.6</Text>
              <Text style={s.statSub}>Last exam</Text>
            </View>
          </View>
        </View>

        {/* ── From School ── */}
        <Text style={s.sectionTitle}>From School</Text>

        <SchoolCarousel />

        {/* ── Quick Access ── */}
        <Text style={s.sectionTitle}>Quick Access</Text>

        <View style={s.grid}>
          {rows.map((row, ri) => (
            <View key={ri} style={s.row}>
              {row.map((mod) => {
                const Icon = MODULE_ICONS[mod.id];
                const full = row.length === 1;
                return (
                  <TouchableOpacity
                    key={mod.id}
                    activeOpacity={0.8}
                    onPress={() => handleModulePress(mod)}
                    style={[s.modCard, full && s.modCardFull]}
                  >
                    <View style={s.modAccent} />

                    <View style={[s.modIconWrap, full && s.modIconWrapRow]}>
                      <Icon />
                    </View>

                    <View style={[s.modText, full && s.modTextRow]}>
                      <Text style={s.modName}>{mod.label}</Text>
                      <Text style={s.modDesc}>{mod.sub}</Text>
                      {!mod.live && (
                        <View style={[s.soonBadge, { marginTop: rs(5) }]}>
                          <Text style={s.soonText}>Soon</Text>
                        </View>
                      )}
                    </View>

                    <View style={[s.modArrow, full ? s.modArrowRow : s.modArrowAbs]}>
                      <ChevronRight />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* ── Footer ── */}
        <Text style={s.footer}>Powered by MagnetPro</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    paddingBottom: rs(50),
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.accent,
    paddingHorizontal: H_PAD + rs(4),
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? rs(28)) : rs(50),
    paddingBottom: rs(54),
  },
  headerLeft: {
    flex: 1,
    gap: rs(3),
    marginRight: rs(12),
  },
  greeting: {
    fontSize: fs(13),
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  studentName: {
    fontSize: fs(22),
    fontWeight: '800',
    color: C.white,
    letterSpacing: -0.3,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(6),
    backgroundColor: 'rgba(229,83,75,0.92)',
    borderRadius: rs(24),
    paddingVertical: rs(8),
    paddingLeft: rs(11),
    paddingRight: rs(14),
  },
  logoutText: {
    fontSize: fs(13),
    fontWeight: '700',
    color: C.white,
    letterSpacing: 0.2,
  },

  // ── Stats Card ────────────────────────────────────────────────────────────
  statsCard: {
    marginHorizontal: H_PAD,
    marginTop: rs(-36),
    backgroundColor: C.white,
    borderRadius: rs(20),
    padding: rs(14),
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: C.accentDark,
    shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 0.12,
    shadowRadius: rs(12),
    elevation: 5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: rs(8),
  },
  statBox: {
    flex: 1,
    backgroundColor: C.statBg,
    borderRadius: rs(12),
    paddingHorizontal: rs(10),
    paddingVertical: rs(11),
  },
  statBoxMid: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: C.border,
  },
  statLabel: {
    fontSize: fs(9),
    color: C.mutedLight,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginBottom: rs(3),
    textTransform: 'uppercase',
  },
  statVal: {
    fontSize: fs(18),
    fontWeight: '800',
    color: C.accent,
    letterSpacing: -0.3,
  },
  statSub: {
    fontSize: fs(10),
    color: C.mutedLight,
    fontWeight: '500',
    marginTop: rs(2),
  },

  // ── Section Title ─────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: fs(11),
    fontWeight: '800',
    color: '#4A6A7A',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: rs(24),
    marginBottom: rs(12),
    marginHorizontal: H_PAD,
  },

  // ── School Cards ──────────────────────────────────────────────────────────
  schoolScrollContent: {
    paddingHorizontal: H_PAD,
    paddingRight: rs(24),
    gap: rs(10),
  },
  schoolCard: {
    width: SCHOOL_W,
    height: SCHOOL_H,
    borderRadius: rs(16),
    overflow: 'hidden',
    shadowColor: C.accentDark,
    shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 0.22,
    shadowRadius: rs(10),
    elevation: 6,
  },
  schoolCardBg: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  schoolCardBgImg: {
    borderRadius: rs(16),
  },
  schoolCardDimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,20,32,0.30)',
  },
  schoolCardContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: rs(10),
    paddingBottom: rs(10),
    paddingTop: rs(10),
    backgroundColor: 'rgba(4,20,32,0.65)',
  },
  schoolCardLabel: {
    fontSize: fs(12),
    fontWeight: '800',
    color: C.white,
    letterSpacing: 0.1,
    lineHeight: fs(16),
  },
  schoolCardQuote: {
    fontSize: fs(10),
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '500',
    marginTop: rs(2),
    lineHeight: fs(14),
    fontStyle: 'italic',
  },
  schoolCardBadge: {
    position: 'absolute',
    top: rs(9),
    right: rs(9),
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.44)',
    borderRadius: rs(10),
    paddingHorizontal: rs(8),
    paddingVertical: rs(3),
  },
  schoolCardBadgeText: {
    fontSize: fs(10),
    fontWeight: '800',
    color: C.white,
    letterSpacing: 0.6,
  },

  // ── Module Grid ───────────────────────────────────────────────────────────
  grid: {
    paddingHorizontal: H_PAD,
    gap: rs(10),
  },
  row: {
    flexDirection: 'row',
    gap: rs(10),
  },
  modCard: {
    width: CARD_WIDTH,
    backgroundColor: C.white,
    borderRadius: rs(16),
    padding: rs(14),
    paddingBottom: rs(12),
    borderWidth: 1,
    borderColor: C.border,
    position: 'relative',
    overflow: 'hidden',
    minHeight: rs(118),
    flexDirection: 'column',
    shadowColor: C.accentDark,
    shadowOffset: { width: 0, height: rs(2) },
    shadowOpacity: 0.08,
    shadowRadius: rs(8),
    elevation: 2,
  },
  modCardFull: {
    width: '100%',
    minHeight: rs(72),
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(14),
    paddingVertical: rs(16),
  },
  modAccent: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: rs(54),
    height: rs(54),
    borderBottomLeftRadius: rs(54),
    borderTopRightRadius: rs(16),
    backgroundColor: C.accentLight,
  },
  modIconWrap: {
    width: rs(40),
    height: rs(40),
    borderRadius: rs(12),
    backgroundColor: C.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: rs(10),
    zIndex: 1,
  },
  modIconWrapRow: {
    marginBottom: 0,
    flexShrink: 0,
  },
  modText: {
    zIndex: 1,
  },
  modTextRow: {
    flex: 1,
  },
  modName: {
    fontSize: fs(14),
    fontWeight: '800',
    color: C.dark,
    marginBottom: rs(2),
    letterSpacing: -0.1,
  },
  modDesc: {
    fontSize: fs(11),
    color: C.muted,
    fontWeight: '600',
  },
  soonBadge: {
    alignSelf: 'flex-start',
    backgroundColor: C.amberBg,
    borderRadius: rs(5),
    paddingHorizontal: rs(7),
    paddingVertical: rs(2),
  },
  soonText: {
    fontSize: fs(10),
    fontWeight: '800',
    color: C.amber,
    letterSpacing: 0.3,
  },
  modArrow: {
    width: rs(28),
    height: rs(28),
    borderRadius: rs(14),
    backgroundColor: C.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  modArrowAbs: {
    position: 'absolute',
    bottom: rs(11),
    right: rs(11),
  },
  modArrowRow: {
    marginLeft: 'auto',
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    textAlign: 'center',
    marginTop: rs(26),
    fontSize: fs(11),
    color: C.mutedLight,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default HomeScreen;