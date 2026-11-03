import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  PixelRatio,
  StatusBar,
  ActivityIndicator,
  Modal,
  PanResponder,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Responsive helpers ───────────────────────────────────────────────────────
const { width, height } = Dimensions.get('window');
const BASE_WIDTH = 393;
const scale = width / BASE_WIDTH;
const rs = (n: number) => Math.round(n * Math.min(scale, 1.45));
const fs = (n: number) =>
  Math.round((n * Math.min(scale, 1.3)) / PixelRatio.getFontScale());
const H_PAD = rs(16);

// ─── Colors ───────────────────────────────────────────────────────────────────
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
  present:     '#22C07A',
  presentBg:   '#E8FAF3',
  absent:      '#EF4444',
  absentBg:    '#FEE9E9',
  half:        '#F59E0B',
  halfBg:      '#FEF3DC',
  holiday:     '#A78BFA',
  holidayBg:   '#F3F0FF',
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Status = 'P' | 'A' | 'H' | 'HD';

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string }> = {
  P:  { label: 'Present',  color: C.present,  bg: C.presentBg  },
  A:  { label: 'Absent',   color: C.absent,   bg: C.absentBg   },
  H:  { label: 'Holiday',  color: C.holiday,  bg: C.holidayBg  },
  HD: { label: 'Half Day', color: C.half,     bg: C.halfBg     },
};

interface DayRecord {
  date:   string; // 'YYYY-MM-DD'
  status: Status;
  note?:  string;
}

interface MonthData {
  key:     string; // 'YYYY-MM'
  label:   string; // 'June 2026'
  records: DayRecord[];
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function groupRecordsByMonth(
  records: { date: string; status: Status }[],
  holidays: { date: string; title: string }[]
): MonthData[] {
  const holidayMap = new Map(holidays.map(h => [h.date, h.title]));
  const map = new Map<string, DayRecord[]>();

  records.forEach(r => {
    const key = r.date.slice(0, 7); // 'YYYY-MM'
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push({
      date: r.date,
      status: r.status,
      note: r.status === 'H' ? holidayMap.get(r.date) : undefined,
    });
  });

  // include holiday dates that don't already appear in attendance records
  holidays.forEach(h => {
    const key = h.date.slice(0, 7);
    const list = map.get(key) ?? [];
    if (!list.some(r => r.date === h.date)) {
      list.push({ date: h.date, status: 'H', note: h.title });
      map.set(key, list);
    }
  });

  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, recs]) => {
      const [y, m] = key.split('-');
      return {
        key,
        label: `${MONTH_NAMES[+m - 1]} ${y}`,
        records: recs.sort((a, b) => a.date.localeCompare(b.date)),
      };
    });
}


// ─── Helpers ──────────────────────────────────────────────────────────────────
const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function computeSummary(records: DayRecord[]) {
  let P = 0, A = 0, H = 0, HD = 0;
  records.forEach(r => {
    if (r.status === 'P')  P++;
    if (r.status === 'A')  A++;
    if (r.status === 'H')  H++;
    if (r.status === 'HD') HD++;
  });
  const total = P + A + HD;
  const pct   = total ? Math.round(((P + HD * 0.5) / total) * 100) : 0;
  return { P, A, H, HD, pct };
}

// ─── Donut chart ──────────────────────────────────────────────────────────────
function DonutChart({ pct }: { pct: number }) {
  const size  = rs(90);
  const cx    = size / 2;
  const cy    = size / 2;
  const r     = rs(34);
  const sw    = rs(9);
  const circ  = 2 * Math.PI * r;
  const dash  = (pct / 100) * circ;
  const color = pct >= 75 ? C.present : pct >= 50 ? C.half : C.absent;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={cx} cy={cy} r={r} stroke={C.border} strokeWidth={sw}
        fill="none" strokeDasharray={`${circ} 0`} />
      <Circle cx={cx} cy={cy} r={r} stroke={color} strokeWidth={sw}
        fill="none" strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round" rotation="-90" origin={`${cx},${cy}`} />
    </Svg>
  );
}

// ─── Calendar grid ────────────────────────────────────────────────────────────
function CalendarGrid({ monthData }: { monthData: MonthData }) {
  const [year, month] = monthData.key.split('-').map(Number);
  const firstDay      = getFirstDayOfMonth(year, month - 1);
  const totalDays     = getDaysInMonth(year, month - 1);

  const lookup: Record<number, DayRecord> = {};
  monthData.records.forEach(r => {
    lookup[parseInt(r.date.split('-')[2], 10)] = r;
  });

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const CELL = Math.floor((width - H_PAD * 2 - rs(28)) / 7);

  return (
    <View>
      {/* Day-of-week header */}
      <View style={s.calHeaderRow}>
        {DAY_HEADERS.map(d => (
          <View key={d} style={[s.calHeaderCell, { width: CELL }]}>
            <Text style={[
              s.calHeaderText,
              (d === 'Sun' || d === 'Sat') && { color: C.absent },
            ]}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Weeks */}
      {Array.from({ length: cells.length / 7 }, (_, wi) => (
        <View key={wi} style={s.calRow}>
          {cells.slice(wi * 7, wi * 7 + 7).map((day, ci) => {
            if (!day) {
              return <View key={ci} style={{ width: CELL, height: CELL + rs(4) }} />;
            }
            const rec       = lookup[day];
            const cfg       = rec ? STATUS_CONFIG[rec.status] : null;
            const isWeekend = ci === 0 || ci === 6;
            return (
              <View
                key={ci}
                style={[
                  s.calCell,
                  { width: CELL, height: CELL + rs(4) },
                  cfg && { backgroundColor: cfg.bg },
                ]}
              >
                <Text style={[
                  s.calDayNum,
                  cfg  && { color: cfg.color, fontWeight: '800' },
                  !cfg && isWeekend && { color: C.mutedLight },
                ]}>{day}</Text>
                {cfg && <View style={[s.calDot, { backgroundColor: cfg.color }]} />}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Month picker modal ───────────────────────────────────────────────────────
function MonthPicker({
  visible, months, selectedKey, onSelect, onClose,
}: {
  visible: boolean;
  months: MonthData[];
  selectedKey: string;
  onSelect: (k: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Tap-outside to close */}
      <TouchableOpacity style={s.pickerOverlay} activeOpacity={1} onPress={onClose} />
      <View style={[s.pickerSheet, { paddingBottom: insets.bottom + rs(16) }]}>
        {/* Drag handle */}
        <View style={s.pickerHandle} />

        {/* Title */}
        <Text style={s.pickerTitle}>Select Month</Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          {months.map(m => {
            const sel = m.key === selectedKey;
            return (
              <TouchableOpacity
                key={m.key}
                style={[s.pickerItem, sel && s.pickerItemSel]}
                onPress={() => { onSelect(m.key); onClose(); }}
                activeOpacity={0.7}
              >
                {/* Check mark placeholder for spacing balance */}
                <View style={s.pickerCheckPlaceholder}>
                  {sel && (
                    <Svg width={rs(16)} height={rs(16)} viewBox="0 0 24 24" fill="none">
                      <Path d="M5 13l4 4L19 7" stroke={C.accent}
                        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  )}
                </View>

                {/* Centred label */}
                <Text style={[s.pickerItemText, sel && s.pickerItemTextSel]}>
                  {m.label}
                </Text>

                {/* Right spacer to keep label visually centred */}
                <View style={s.pickerCheckPlaceholder} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export const AttendanceScreen = ({ route, navigation }: any) => {
  const studentName = route?.params?.studentName ?? 'Student';
  const token       = route?.params?.token ?? '';
  const insets      = useSafeAreaInsets();
  const now        = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [months,        setMonths]        = useState<MonthData[]>([]);
  const [selectedKey,   setSelectedKey]   = useState(currentKey);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        setLoading(true);
        setError(null);
        const authToken = token || (await AsyncStorage.getItem('accessToken'));

        const [attRes, holRes] = await Promise.all([
          fetch('https://magnetpro.in/api/attendance/parent-attendance/', {
            headers: { Authorization: `Bearer ${authToken}`, Accept: 'application/json' },
          }),
          fetch('https://magnetpro.in/api/calendar/holidays/', {
            headers: { Authorization: `Bearer ${authToken}`, Accept: 'application/json' },
          }),
        ]);

        const attData = await attRes.json();
        const holData = await holRes.json();
        if (!attData.status) throw new Error('Failed to load attendance');

        const grouped = groupRecordsByMonth(attData.records ?? [], holData.holidays ?? []);
        setMonths(grouped);
        setSelectedKey(grouped.find(m => m.key === currentKey)?.key ?? grouped[0]?.key ?? currentKey);
      } catch (e) {
        setError('Unable to load attendance. Pull to retry.');
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, []);

  const selectedMonth =
    months.find(m => m.key === selectedKey) ?? months[0] ?? { key: currentKey, label: '', records: [] };
  const { P, A, H, HD, pct } = computeSummary(selectedMonth.records);
  const dragY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) dragY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.8) {
          Animated.timing(dragY, {
            toValue: height, duration: 220, useNativeDriver: true,
          }).start(() => navigation.goBack());
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;
  const problemDays = selectedMonth.records.filter(
    r => r.status === 'A' || r.status === 'HD'
  );

  return (
    <Animated.View style={[s.root, { transform: [{ translateY: dragY }] }]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} translucent />
      <View style={[s.statusBarFill, { height: insets.top }]} />
      <View style={[s.body, { paddingTop: insets.top }]}>
      <View style={s.header} {...panResponder.panHandlers}>
      <View style={s.headerRow}>

            {/* Back button */}
            <TouchableOpacity
              style={s.headerIconBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Svg width={rs(20)} height={rs(20)} viewBox="0 0 24 24" fill="none">
                <Path d="M15 19l-7-7 7-7" stroke={C.dark} strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>

            {/* Centre block */}
            <View style={s.headerCenter}>
              <Text style={s.headerSub}>
                {studentName.toUpperCase()}
              </Text>
              <TouchableOpacity
                style={s.monthPill}
                onPress={() => setPickerVisible(true)}
                activeOpacity={0.75}
              >
                <Text style={s.monthPillText}>{selectedMonth.label}</Text>
                <Text style={s.monthPillChev}>▾</Text>
              </TouchableOpacity>
            </View>

            {/* Invisible spacer — balances the back button's width so
                headerCenter's flex box stays centered on screen */}
            <View style={s.headerIconBtn.width ? { width: rs(36) } : undefined} />

          </View>
        </View>

        {/* ── Scrollable content ── */}
        {loading ? (
          <View style={s.loader}>
            <ActivityIndicator size="large" color={C.accent} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[
              s.scroll,
              { paddingBottom: rs(40) + insets.bottom },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* ── Summary card ── */}
            <View style={s.summaryCard}>
              {/* Donut */}
              <View style={s.donutWrap}>
                <DonutChart pct={pct} />
                <View style={s.donutCenter}>
                  <Text style={[
                    s.donutPct,
                    { color: pct >= 75 ? C.present : pct >= 50 ? C.half : C.absent },
                  ]}>{pct}%</Text>
                  <Text style={s.donutLabel}>ATTEND.</Text>
                </View>
              </View>

              {/* Stat chips */}
              <View style={s.chipsGrid}>
                {([
                  { s: 'P',  n: P,  l: 'PRESENT'  },
                  { s: 'A',  n: A,  l: 'ABSENT'   },
                  { s: 'HD', n: HD, l: 'HALF DAY' },
                  { s: 'H',  n: H,  l: 'HOLIDAY'  },
                ] as { s: Status; n: number; l: string }[]).map(item => {
                  const cfg = STATUS_CONFIG[item.s];
                  return (
                    <View key={item.s} style={[s.chip, { backgroundColor: cfg.bg }]}>
                      <Text style={[s.chipNum,   { color: cfg.color }]}>{item.n}</Text>
                      <Text style={[s.chipLabel, { color: cfg.color }]}>{item.l}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* ── Legend ── */}
            <View style={s.legendRow}>
              {(Object.entries(STATUS_CONFIG) as [Status, typeof STATUS_CONFIG[Status]][]).map(
                ([k, cfg]) => (
                  <View key={k} style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: cfg.color }]} />
                    <Text style={s.legendText}>{cfg.label}</Text>
                  </View>
                )
              )}
            </View>

            {/* ── Calendar ── */}
            <View style={s.calCard}>
              <CalendarGrid monthData={selectedMonth} />
            </View>

            {/* ── Absences & Half Days ── */}
            {problemDays.length > 0 && (
              <>
                <Text style={s.sectionTitle}>ABSENCES & HALF DAYS</Text>
                <View style={s.detailCard}>
                  {problemDays.map((r, i) => {
                    const cfg = STATUS_CONFIG[r.status];
                    const d   = new Date(r.date);
                    return (
                      <View
                        key={r.date}
                        style={[
                          s.detailRow,
                          i === problemDays.length - 1 && { borderBottomWidth: 0 },
                        ]}
                      >
                        <View style={[s.detailDateBox, { backgroundColor: cfg.bg }]}>
                          <Text style={[s.detailDow, { color: cfg.color }]}>
                            {DAY_NAMES[d.getDay()]}
                          </Text>
                          <Text style={[s.detailDay, { color: cfg.color }]}>
                            {d.getDate()}
                          </Text>
                        </View>

                        <View style={[s.detailLine, { backgroundColor: cfg.color }]} />

                        <View style={{ flex: 1 }}>
                          <Text style={[s.detailStatus, { color: cfg.color }]}>
                            {cfg.label}
                          </Text>
                          {r.note && (
                            <Text style={s.detailNote}>{r.note}</Text>
                          )}
                        </View>

                        <View style={[s.detailBadge, { backgroundColor: cfg.bg }]}>
                          <Text style={[s.detailBadgeText, { color: cfg.color }]}>
                            {r.status}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={s.footer}>Powered by MagnetPro</Text>
          </ScrollView>
        )}
      </View>

      {/* ── Month picker modal ── */}
      <MonthPicker
        visible={pickerVisible}
        months={months}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
        onClose={() => setPickerVisible(false)}
      />
    </Animated.View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.white,
  },
  statusBarFill: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    backgroundColor: C.white,
    zIndex: 99,
  },
  body: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: C.white,
    paddingBottom: rs(14),
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(2) },
    shadowOpacity: 0.06,
    shadowRadius: rs(6),
    elevation: 4,
  },
  dragBar: {
    width: rs(40),
    height: rs(5),
    borderRadius: rs(3),
    backgroundColor: 'rgba(14,126,164,0.22)',
    alignSelf: 'center',
    marginTop: rs(10),
    marginBottom: rs(12),
  },
  // Single row: [back-btn] [center-block] [calendar-btn]
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    gap: rs(8),
  },
  // Square icon buttons (back + calendar) — identical size for symmetry
  headerIconBtn: {
    width: rs(36),
    height: rs(36),
    borderRadius: rs(12),
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  // Centre block stretches to fill remaining space
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: rs(2),
  },
  headerTitle: {
    fontSize: fs(18),
    fontWeight: '800',
    color: C.dark,
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: fs(18),
    color: '#109acc',
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  // Inline month pill below student name
  monthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(3),
    marginTop: rs(4),
    backgroundColor: C.accentLight,
    borderRadius: rs(20),
    paddingHorizontal: rs(12),
    paddingVertical: rs(4),
    borderWidth: 1,
    borderColor: 'rgba(14,126,164,0.18)',
  },
  monthPillText: {
    fontSize: fs(12),
    fontWeight: '700',
    color: C.accent,
  },
  monthPillChev: {
    fontSize: fs(10),
    color: C.accent,
    lineHeight: fs(14),
  },

  // ── Content scroll ──────────────────────────────────────────────────────────
  scroll: {
    flexGrow: 1,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Summary card ────────────────────────────────────────────────────────────
  summaryCard: {
    backgroundColor: C.white,
    marginHorizontal: H_PAD,
    marginTop: rs(16),
    borderRadius: rs(20),
    padding: rs(16),
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(14),
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: C.accentDark,
    shadowOffset: { width: 0, height: rs(3) },
    shadowOpacity: 0.08,
    shadowRadius: rs(10),
    elevation: 3,
  },
  donutWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  donutPct: {
    fontSize: fs(15),
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  donutLabel: {
    fontSize: fs(7),
    color: C.mutedLight,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  chipsGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rs(7),
  },
  chip: {
    flex: 1,
    minWidth: rs(58),
    borderRadius: rs(12),
    paddingVertical: rs(8),
    paddingHorizontal: rs(6),
    alignItems: 'center',
  },
  chipNum: {
    fontSize: fs(18),
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  chipLabel: {
    fontSize: fs(8),
    fontWeight: '800',
    letterSpacing: 0.3,
    marginTop: rs(1),
  },

  // ── Legend ──────────────────────────────────────────────────────────────────
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rs(10),
    paddingHorizontal: H_PAD,
    paddingTop: rs(14),
    paddingBottom: rs(2),
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(5),
  },
  legendDot: {
    width: rs(8),
    height: rs(8),
    borderRadius: rs(4),
  },
  legendText: {
    fontSize: fs(11),
    color: C.muted,
    fontWeight: '600',
  },
  calCard: {
    backgroundColor: C.white,
    marginHorizontal: H_PAD,
    marginTop: rs(10),
    borderRadius: rs(20),
    padding: rs(14),
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: C.accentDark,
    shadowOffset: { width: 0, height: rs(2) },
    shadowOpacity: 0.06,
    shadowRadius: rs(8),
    elevation: 2,
  },
  calHeaderRow: {
    flexDirection: 'row',
    marginBottom: rs(4),
  },
  calHeaderCell: {
    alignItems: 'center',
    paddingVertical: rs(4),
  },
  calHeaderText: {
    fontSize: fs(10),
    fontWeight: '800',
    color: C.muted,
    letterSpacing: 0.3,
  },
  calRow: {
    flexDirection: 'row',
  },
  calCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rs(8),
    marginVertical: rs(2),
    marginHorizontal: rs(1),
    gap: rs(2),
  },
  calDayNum: {
    fontSize: fs(12),
    fontWeight: '600',
    color: C.dark,
  },
  calDot: {
    width: rs(5),
    height: rs(5),
    borderRadius: rs(3),
  },
  sectionTitle: {
    fontSize: fs(11),
    fontWeight: '800',
    color: '#4A6A7A',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: rs(22),
    marginBottom: rs(10),
    marginHorizontal: H_PAD,
  },
  detailCard: {
    backgroundColor: C.white,
    marginHorizontal: H_PAD,
    borderRadius: rs(18),
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    paddingHorizontal: rs(14),
    shadowColor: C.accentDark,
    shadowOffset: { width: 0, height: rs(2) },
    shadowOpacity: 0.06,
    shadowRadius: rs(8),
    elevation: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: rs(12),
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: rs(10),
  },
  detailDateBox: {
    width: rs(44),
    height: rs(44),
    borderRadius: rs(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailDow: {
    fontSize: fs(9),
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  detailDay: {
    fontSize: fs(16),
    fontWeight: '900',
    lineHeight: fs(20),
  },
  detailLine: {
    width: rs(3),
    height: rs(36),
    borderRadius: rs(2),
  },
  detailStatus: {
    fontSize: fs(13),
    fontWeight: '700',
  },
  detailNote: {
    fontSize: fs(11),
    color: C.muted,
    fontWeight: '500',
    marginTop: rs(2),
  },
  detailBadge: {
    borderRadius: rs(8),
    paddingHorizontal: rs(10),
    paddingVertical: rs(5),
    minWidth: rs(40),
    alignItems: 'center',
  },
  detailBadgeText: {
    fontSize: fs(11),
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  pickerSheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: rs(24),
    borderTopRightRadius: rs(24),
    paddingTop: rs(12),
    paddingHorizontal: H_PAD,
    maxHeight: height * 0.65,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -rs(4) },
    shadowOpacity: 0.12,
    shadowRadius: rs(16),
    elevation: 20,
  },
  pickerHandle: {
    width: rs(40),
    height: rs(5),
    borderRadius: rs(3),
    backgroundColor: 'rgba(14,126,164,0.2)',
    alignSelf: 'center',
    marginBottom: rs(14),
  },
  pickerTitle: {
    fontSize: fs(15),
    fontWeight: '800',
    color: C.dark,
    textAlign: 'center',
    marginBottom: rs(6),
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: rs(14),
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  pickerItemSel: {
    backgroundColor: C.accentLight,
    borderRadius: rs(12),
    borderBottomWidth: 0,
    marginBottom: rs(1),
  },
  pickerCheckPlaceholder: {
    width: rs(28),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerItemText: {
    flex: 1,
    fontSize: fs(14),
    fontWeight: '600',
    color: C.dark,
    textAlign: 'center',
  },
  pickerItemTextSel: {
    color: C.accent,
    fontWeight: '800',
  },
  footer: {
    textAlign: 'center',
    marginTop: rs(26),
    fontSize: fs(11),
    color: C.mutedLight,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default AttendanceScreen;