import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
} from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Responsive Helpers ───────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window');
const BASE_WIDTH = 393;
const scale = SCREEN_W / BASE_WIDTH;
const rs = (n: number) => Math.round(n * Math.min(scale, 1.45));
const fs = (n: number) => Math.round((n * Math.min(scale, 1.3)) / PixelRatio.getFontScale());

// ─── Types ────────────────────────────────────────────────────────────────────
type BookStatus = 'active' | 'due_soon' | 'overdue' | 'returned';

interface LibraryBook {
  id:            string;
  name:          string;
  issueDate:     string;
  dueDate:       string;
  returnedDate?: string;
  status:        BookStatus;
  daysLeft?:     number;
}

// ─── Colors — same palette as AttendanceScreen ────────────────────────────────
const C = {
  // Base
  accent:      '#0E7EA4',
  accentDark:  '#0A5F7A',
  accentLight: '#EDF6FA',
  bg:          '#F2F5F7',
  white:       '#FFFFFF',
  dark:        '#1A2B35',
  muted:       '#7AA0B0',
  mutedLight:  '#9BBAC8',
  border:      'rgba(14,126,164,0.09)',
  // Attendance-sourced status colors
  present:     '#22C07A',   // → active
  presentBg:   '#E8FAF3',
  absent:      '#EF4444',   // → overdue
  absentBg:    '#FEE9E9',
  half:        '#F59E0B',   // → due_soon
  halfBg:      '#FEF3DC',
  holiday:     '#A78BFA',   // → returned
  holidayBg:   '#F3F0FF',
};

// ─── Demo Data ────────────────────────────────────────────────────────────────
const CURRENT_BOOKS: LibraryBook[] = [
  { id: 'b1', name: 'The Magic of Science',      issueDate: '12 May 2025', dueDate: '26 May 2025', status: 'overdue',  daysLeft: -9 },
  { id: 'b2', name: 'Adventures in Mathematics', issueDate: '20 May 2025', dueDate: '7 Jun 2025',  status: 'due_soon', daysLeft: 3 },
  { id: 'b3', name: 'Our Green Planet',           issueDate: '28 May 2025', dueDate: '18 Jun 2025', status: 'active',   daysLeft: 14 },
  { id: 'b4', name: 'Tales of Ancient India',     issueDate: '1 Jun 2025',  dueDate: '21 Jun 2025', status: 'active',   daysLeft: 17 },
  { id: 'b5', name: 'Wings of Words',             issueDate: '3 Jun 2025',  dueDate: '24 Jun 2025', status: 'active',   daysLeft: 20 },
];

const HISTORY_BOOKS: LibraryBook[] = [
  { id: 'h1', name: 'Wonders of the Universe', issueDate: '2 Apr 2025',  dueDate: '20 Apr 2025', returnedDate: '20 Apr 2025', status: 'returned', daysLeft: 0 },
  { id: 'h2', name: 'The Story of Numbers',    issueDate: '10 Mar 2025', dueDate: '28 Mar 2025', returnedDate: '28 Mar 2025', status: 'returned', daysLeft: 0 },
  { id: 'h3', name: 'Jungle Stories',           issueDate: '1 Feb 2025',  dueDate: '18 Feb 2025', returnedDate: '18 Feb 2025', status: 'returned', daysLeft: 0 },
  { id: 'h4', name: 'Rivers of India',          issueDate: '10 Jan 2025', dueDate: '28 Jan 2025', returnedDate: '28 Jan 2025', status: 'returned', daysLeft: 0 },
  { id: 'h5', name: 'Colours of Art',           issueDate: '5 Dec 2024',  dueDate: '22 Dec 2024', returnedDate: '21 Dec 2024', status: 'returned', daysLeft: 0 },
];

// ─── Status Config — maps library statuses to attendance colors ───────────────
const statusConfig: Record<BookStatus, { label: string; color: string; bg: string }> = {
  active:   { label: 'Active',   color: C.present, bg: C.presentBg },
  overdue:  { label: 'Overdue',  color: C.absent,  bg: C.absentBg  },
  due_soon: { label: 'Due Soon', color: C.half,    bg: C.halfBg    },
  returned: { label: 'Returned', color: C.holiday, bg: C.holidayBg },
};

const getDaysLabel = (book: LibraryBook): { label: string; color: string } => {
  if (book.status === 'returned') return { label: 'On time', color: C.holiday };
  if (!book.daysLeft && book.daysLeft !== 0) return { label: '', color: C.muted };
  if (book.daysLeft < 0) return { label: `${Math.abs(book.daysLeft)}d overdue`, color: C.absent };
  if (book.daysLeft === 0) return { label: 'Due today', color: C.half };
  if (book.daysLeft <= 5)  return { label: `${book.daysLeft}d left`, color: C.half };
  return { label: `${book.daysLeft}d left`, color: C.present };
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const BackIcon = () => (
  <Svg width={rs(20)} height={rs(20)} viewBox="0 0 24 24" fill="none">
    <Path d="M15 18l-6-6 6-6" stroke={C.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const SearchIcon = () => (
  <Svg width={rs(16)} height={rs(16)} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="11" r="7" stroke={C.mutedLight} strokeWidth="1.8" />
    <Path d="M20 20l-3-3" stroke={C.mutedLight} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

const CalendarIcon = ({ color }: { color: string }) => (
  <Svg width={rs(11)} height={rs(11)} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth="2" />
    <Path d="M3 9h18M8 2v4M16 2v4" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

// ─── Book Card ────────────────────────────────────────────────────────────────
const BookCard = ({ book }: { book: LibraryBook }) => {
  const cfg  = statusConfig[book.status];
  const days = getDaysLabel(book);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 60, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const dueDateColor =
    book.status === 'overdue'  ? C.absent :
    book.status === 'due_soon' ? C.half   : C.dark;

  return (
    <Animated.View style={[bc.shadow, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity style={bc.card} activeOpacity={0.88} onPress={onPress}>
        {/* Left accent bar */}
        <View style={[bc.bar, { backgroundColor: cfg.color }]} />

        <View style={bc.body}>
          {/* Row 1: name + badge */}
          <View style={bc.nameRow}>
            <Text style={bc.name} numberOfLines={1}>{book.name}</Text>
            <View style={[bc.badge, { backgroundColor: cfg.bg }]}>
              <View style={[bc.badgeDot, { backgroundColor: cfg.color }]} />
              <Text style={[bc.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>

          {/* Row 2: dates + days pill */}
          <View style={bc.datesRow}>
            <View style={bc.dateChip}>
              <CalendarIcon color={C.mutedLight} />
              <Text style={bc.chipLbl}>Issued  </Text>
              <Text style={bc.chipVal}>{book.issueDate}</Text>
            </View>

            <View style={bc.dateSep} />

            <View style={bc.dateChip}>
              <CalendarIcon color={dueDateColor} />
              <Text style={bc.chipLbl}>
                {book.status === 'returned' ? 'Returned  ' : 'Due  '}
              </Text>
              <Text style={[bc.chipVal, { color: dueDateColor }]}>
                {book.status === 'returned' ? book.returnedDate : book.dueDate}
              </Text>
            </View>

            {days.label ? (
              <View style={[bc.daysPill, { backgroundColor: cfg.bg, marginLeft: 'auto' }]}>
                <Text style={[bc.daysText, { color: cfg.color }]}>{days.label}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const bc = StyleSheet.create({
  shadow:    { shadowColor: C.accentDark, shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.07, shadowRadius: rs(8), elevation: 2 },
  card:      { flexDirection: 'row', backgroundColor: C.white, borderRadius: rs(14), overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  bar:       { width: rs(4), flexShrink: 0 },
  body:      { flex: 1, paddingHorizontal: rs(12), paddingVertical: rs(10), gap: rs(7) },
  nameRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: rs(8) },
  name:      { flex: 1, fontSize: fs(13), fontWeight: '700', color: C.dark, letterSpacing: -0.1 },
  badge:     { flexDirection: 'row', alignItems: 'center', gap: rs(4), paddingHorizontal: rs(8), paddingVertical: rs(3), borderRadius: rs(20), flexShrink: 0 },
  badgeDot:  { width: rs(5), height: rs(5), borderRadius: rs(3) },
  badgeText: { fontSize: fs(10), fontWeight: '800' },
  datesRow:  { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: rs(6) },
  dateChip:  { flexDirection: 'row', alignItems: 'center', gap: rs(4) },
  chipLbl:   { fontSize: fs(10), color: C.muted, fontWeight: '500' },
  chipVal:   { fontSize: fs(11), color: C.dark,  fontWeight: '700' },
  dateSep:   { width: 1, height: rs(12), backgroundColor: C.border },
  daysPill:  { paddingHorizontal: rs(8), paddingVertical: rs(2), borderRadius: rs(20) },
  daysText:  { fontSize: fs(10), fontWeight: '800' },
});

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = ({ tab }: { tab: string }) => (
  <View style={em.wrap}>
    <Text style={em.icon}>{tab === 'current' ? '📚' : '🕰️'}</Text>
    <Text style={em.title}>{tab === 'current' ? 'No books issued' : 'No history yet'}</Text>
    <Text style={em.sub}>{tab === 'current' ? 'Borrowed books will appear here.' : 'Returned books will appear here.'}</Text>
  </View>
);
const em = StyleSheet.create({
  wrap:  { alignItems: 'center', paddingVertical: rs(52), paddingHorizontal: rs(32) },
  icon:  { fontSize: fs(44), marginBottom: rs(14) },
  title: { fontSize: fs(15), fontWeight: '700', color: C.dark, textAlign: 'center', marginBottom: rs(6) },
  sub:   { fontSize: fs(12), color: C.muted, textAlign: 'center', lineHeight: fs(18) },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const LibraryScreen = ({ route, navigation }: any) => {
  const token       = route?.params?.token ?? '';
  const studentName = (route?.params?.studentName ?? 'Student').trim();
  const insets      = useSafeAreaInsets();

  const [activeTab, setActiveTab]     = useState<'current' | 'history'>('current');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading]                     = useState(false);
  const [currentBooks]                = useState<LibraryBook[]>(CURRENT_BOOKS);
  const [historyBooks]                = useState<LibraryBook[]>(HISTORY_BOOKS);
  const tabAnim = useRef(new Animated.Value(0)).current;

  const issuedCount  = currentBooks.length;
  const dueSoonCount = currentBooks.filter(b => b.status === 'due_soon').length;
  const overdueCount = currentBooks.filter(b => b.status === 'overdue').length;

  const filterBooks = (books: LibraryBook[]) => {
    if (!searchQuery.trim()) return books;
    const q = searchQuery.toLowerCase();
    return books.filter(b => b.name.toLowerCase().includes(q));
  };

  const displayedBooks = activeTab === 'current'
    ? filterBooks(currentBooks)
    : filterBooks(historyBooks);

  const switchTab = (tab: 'current' | 'history') => {
    setActiveTab(tab);
    Animated.timing(tabAnim, { toValue: tab === 'current' ? 0 : 1, duration: 200, useNativeDriver: false }).start();
  };

  useEffect(() => {
    // TODO: replace with API call using token
  }, [token]);

  const tabLeft = tabAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '50%'] });

  const safeTop = insets.top > 0
    ? insets.top
    : Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : rs(44);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: safeTop + rs(6) }]}>

        {/* Title row — back | centered title | invisible spacer */}
        <View style={s.titleRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation?.goBack()} activeOpacity={0.7}>
            <BackIcon />
          </TouchableOpacity>
          <View style={s.titleCenter}>
            <Text style={s.title}>SCHOOL LIBRARY</Text>
            <Text style={s.titleSub}>{studentName}'s books</Text>
          </View>
          <View style={s.backBtn} pointerEvents="none" />
        </View>

        {/* Stat chips — styled like attendance chips */}
        <View style={s.chipsRow}>
          <View style={[s.chip, { backgroundColor: C.accentLight }]}>
            <Text style={[s.chipNum, { color: C.accent }]}>{issuedCount}</Text>
            <Text style={[s.chipLbl, { color: C.accent }]}>Issued</Text>
          </View>
          <View style={[s.chip, { backgroundColor: C.halfBg }]}>
            <Text style={[s.chipNum, { color: C.half }]}>{dueSoonCount}</Text>
            <Text style={[s.chipLbl, { color: C.half }]}>Due Soon</Text>
          </View>
          <View style={[s.chip, { backgroundColor: C.absentBg }]}>
            <Text style={[s.chipNum, { color: C.absent }]}>{overdueCount}</Text>
            <Text style={[s.chipLbl, { color: C.absent }]}>Overdue</Text>
          </View>
        </View>

        {/* Search */}
        <View style={s.searchBox}>
          <SearchIcon />
          <TextInput
            style={s.searchInput}
            placeholder="Search books…"
            placeholderTextColor={C.mutedLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: C.mutedLight, fontSize: fs(17) }}>×</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

     

      {/* ── Tabs ── */}
      <View style={s.tabBar}>
        <View style={s.tabTrack}>
          <Animated.View style={[s.tabIndicator, { left: tabLeft }]} />
          <TouchableOpacity style={s.tabBtn} onPress={() => switchTab('current')} activeOpacity={0.8}>
            <Text style={[s.tabLabel, activeTab === 'current' && s.tabLabelActive]}>
              Current ({issuedCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.tabBtn} onPress={() => switchTab('history')} activeOpacity={0.8}>
            <Text style={[s.tabLabel, activeTab === 'history' && s.tabLabelActive]}>
              History ({historyBooks.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Legend row ── */}
      <View style={s.legendRow}>
        {[
          { color: C.present, label: 'Active' },
          { color: C.half,    label: 'Due Soon' },
          { color: C.absent,  label: 'Overdue' },
          { color: C.holiday, label: 'Returned' },
        ].map(l => (
          <View key={l.label} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: l.color }]} />
            <Text style={s.legendText}>{l.label}</Text>
          </View>
        ))}
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={C.accent} size="large" />
          <Text style={s.loadingText}>Loading…</Text>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.sectionRow}>
            <Text style={s.sectionLbl}>
              {activeTab === 'current' ? 'ACTIVE ISSUES' : 'RETURNED BOOKS'}
            </Text>
            <Text style={s.sectionCount}>{displayedBooks.length} books</Text>
          </View>

          {displayedBooks.length === 0 ? (
            <EmptyState tab={activeTab} />
          ) : (
            <View style={s.list}>
              {displayedBooks.map(book => <BookCard key={book.id} book={book} />)}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor:  '#f8fdff' },

  // Header
  header: {
    backgroundColor: C.white,
    paddingHorizontal: rs(16),
    paddingBottom: rs(14),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: rs(14),
  },
  backBtn: {
    width: rs(36),
    height: rs(36),
    borderRadius: rs(18),
    backgroundColor: C.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCenter: { flex: 1, alignItems: 'center' },
  title: {
    fontSize: fs(18),
    fontWeight: '800',
    color: '#109acc',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  titleSub: {
    fontSize: fs(11),
    color: C.muted,
    fontWeight: '500',
    marginTop: rs(2),
    textAlign: 'center',
  },

  // Chips — same style as attendance screen chips
  chipsRow: {
    flexDirection: 'row',
    gap: rs(8),
    marginBottom: rs(14),
  },
  chip: {
    flex: 1,
    borderRadius: rs(12),
    paddingVertical: rs(9),
    alignItems: 'center',
  },
  chipNum: {
    fontSize: fs(19),
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  chipLbl: {
    fontSize: fs(8),
    fontWeight: '800',
    letterSpacing: 0.3,
    marginTop: rs(1),
  },

  // Search
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8),
    backgroundColor: '#f5fbfc',
    borderWidth: 1,
    borderColor: '#d6e1e4',
    borderRadius: rs(12),
    paddingHorizontal: rs(12),
    height: rs(42),
  },
  searchInput: {
    flex: 1,
    fontSize: fs(13),
    color: C.dark,
    fontWeight: '500',
    height: '100%',
    padding: 0,
  },

  divider: { height: 1, backgroundColor: C.border },

  // Tabs
  tabBar: {
    paddingHorizontal: rs(16),
    paddingTop: rs(12),
    paddingBottom: rs(4),
    backgroundColor: C.white,
  },
  tabTrack: {
    flexDirection: 'row',
    backgroundColor: C.bg,
    borderRadius: rs(12),
    borderWidth: 1,
    borderColor: C.border,
    padding: rs(3),
    position: 'relative',
    overflow: 'hidden',
  },
  tabIndicator: {
    position: 'absolute',
    top: rs(3),
    width: '50%',
    bottom: rs(3),
    backgroundColor:  '#109acc',
    borderRadius: rs(9),
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: C.accentDark,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabBtn:         { flex: 1, paddingVertical: rs(8), alignItems: 'center', zIndex: 1 },
  tabLabel:       { fontSize: fs(12), fontWeight: '700', color:  '#109acc' },
  tabLabelActive: { color: '#ffffff' },

  // Legend row — same as attendance legendRow
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rs(12),
    paddingHorizontal: rs(16),
    paddingTop: rs(12),
    paddingBottom: rs(4),
    backgroundColor: C.white,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: rs(5) },
  legendDot:  { width: rs(8), height: rs(8), borderRadius: rs(4) },
  legendText: { fontSize: fs(11), color:  '#109acc', fontWeight: '600' },

  // Scroll / list
  scroll:        { flex: 1 },
  scrollContent: { paddingBottom: rs(28) },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rs(16),
    paddingTop: rs(14),
    paddingBottom: rs(10),
  },
  sectionLbl:   { fontSize: fs(10), fontWeight: '800', color: '#4A6A7A', letterSpacing: 1.5, textTransform: 'uppercase' },
  sectionCount: { fontSize: fs(11), fontWeight: '700', color: C.accent },
  list: {
    paddingHorizontal: rs(16),
    gap: rs(9),
    flexDirection: 'column',
  },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: rs(12) },
  loadingText: { fontSize: fs(13), color: C.muted, fontWeight: '500' },
});

export default LibraryScreen;