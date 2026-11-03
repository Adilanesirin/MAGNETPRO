import React, { useState, useRef, useEffect } from 'react';
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
  Modal,
  Animated,
} from 'react-native';
import Svg, { Path, Circle, Rect, G, Line } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Responsive Helpers ────────────────────────────────────────────────────────
const { width } = Dimensions.get('window');
const BASE_WIDTH = 393;
const scale = width / BASE_WIDTH;
const rs = (size: number) => Math.round(size * Math.min(scale, 1.45));
const fs = (size: number) =>
  Math.round((size * Math.min(scale, 1.3)) / PixelRatio.getFontScale());

const H_PAD = rs(16);

// ─── Color Palette ────────────────────────────────────────────────────────────
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

  // Event category colors
  holiday:     '#E74C6F',
  holidayBg:   '#FEF0F4',
  exam:        '#F59E0B',
  examBg:      '#FFFBEB',
  event:       '#6366F1',
  eventBg:     '#EEF2FF',
  sports:      '#10B981',
  sportsBg:    '#ECFDF5',
  meeting:     '#0E7EA4',
  meetingBg:   '#EDF6FA',
  cultural:    '#EC4899',
  culturalBg:  '#FDF2F8',
};

// ─── Types ────────────────────────────────────────────────────────────────────
type EventCategory = 'holiday' | 'exam' | 'event' | 'sports' | 'meeting' | 'cultural';

interface CalendarEvent {
  id: string;
  title: string;
  date: string; // 'YYYY-MM-DD'
  category: EventCategory;
  description?: string;
  time?: string;
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ─── Category Config ──────────────────────────────────────────────────────────
const CAT: Record<EventCategory, { label: string; color: string; bg: string }> = {
  holiday:  { label: 'Holiday',  color: C.holiday,  bg: C.holidayBg  },
  exam:     { label: 'Exam',     color: C.exam,     bg: C.examBg     },
  event:    { label: 'Event',    color: C.event,    bg: C.eventBg    },
  sports:   { label: 'Sports',   color: C.sports,   bg: C.sportsBg   },
  meeting:  { label: 'Meeting',  color: C.meeting,  bg: C.meetingBg  },
  cultural: { label: 'Cultural', color: C.cultural, bg: C.culturalBg },
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const BackIcon = () => (
  <Svg width={rs(20)} height={rs(20)} viewBox="0 0 24 24" fill="none">
    <Path d="M15 18l-6-6 6-6" stroke={C.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const CalIcon = () => (
  <Svg width={rs(16)} height={rs(16)} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="4" width="18" height="18" rx="2" stroke={C.accent} strokeWidth="1.8"/>
    <Path d="M3 9h18M8 2v4M16 2v4" stroke={C.accent} strokeWidth="1.6" strokeLinecap="round"/>
  </Svg>
);

const ClockIcon = ({ color }: { color: string }) => (
  <Svg width={rs(13)} height={rs(13)} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8"/>
    <Path d="M12 7v5l3 3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const ChevronLeft = ({ color = C.accent }: { color?: string }) => (
  <Svg width={rs(18)} height={rs(18)} viewBox="0 0 24 24" fill="none">
    <Path d="M15 18l-6-6 6-6" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const ChevronRight = ({ color = C.accent }: { color?: string }) => (
  <Svg width={rs(18)} height={rs(18)} viewBox="0 0 24 24" fill="none">
    <Path d="M9 18l6-6-6-6" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const CloseIcon = () => (
  <Svg width={rs(18)} height={rs(18)} viewBox="0 0 24 24" fill="none">
    <Path d="M18 6L6 18M6 6l12 12" stroke={C.muted} strokeWidth="2" strokeLinecap="round"/>
  </Svg>
);

// ─── Helper ───────────────────────────────────────────────────────────────────
const getDaysInMonth = (year: number, month: number) =>
  new Date(year, month + 1, 0).getDate();

const getFirstDayOfMonth = (year: number, month: number) =>
  new Date(year, month, 1).getDay();

const padDate = (n: number) => String(n).padStart(2, '0');

const toKey = (year: number, month: number, day: number) =>
  `${year}-${padDate(month + 1)}-${padDate(day)}`;

// ─── Event Detail Modal ───────────────────────────────────────────────────────
const EventModal = ({
  event,
  visible,
  onClose,
}: {
  event: CalendarEvent | null;
  visible: boolean;
  onClose: () => void;
}) => {
  if (!event) return null;
  const cat = CAT[event.category];
  const [y, m, d] = event.date.split('-').map(Number);
  const dateStr = `${DAYS[new Date(y, m - 1, d).getDay()]}, ${d} ${MONTHS[m - 1]} ${y}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <View style={ms.sheet}>
          {/* Top accent bar */}
          <View style={[ms.topBar, { backgroundColor: cat.color }]} />

          <View style={ms.sheetBody}>
            {/* Category badge */}
            <View style={[ms.catBadge, { backgroundColor: cat.bg }]}>
              <View style={[ms.catDot, { backgroundColor: cat.color }]} />
              <Text style={[ms.catLabel, { color: cat.color }]}>{cat.label}</Text>
            </View>

            {/* Title */}
            <Text style={ms.title}>{event.title}</Text>

            {/* Date row */}
            <View style={ms.infoRow}>
              <CalIcon />
              <Text style={ms.infoText}>{dateStr}</Text>
            </View>

            {/* Time row */}
            {event.time && (
              <View style={ms.infoRow}>
                <ClockIcon color={C.accent} />
                <Text style={ms.infoText}>{event.time}</Text>
              </View>
            )}

            {/* Description */}
            {event.description && (
              <View style={ms.descBox}>
                <Text style={ms.descText}>{event.description}</Text>
              </View>
            )}
          </View>

          {/* Close */}
          <TouchableOpacity style={ms.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <CloseIcon />
          </TouchableOpacity>

          {/* Done button */}
          <TouchableOpacity style={ms.doneBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={ms.doneBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,30,44,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: rs(28),
    borderTopRightRadius: rs(28),
    overflow: 'hidden',
    paddingBottom: rs(36),
  },
  topBar: {
    height: rs(5),
    marginHorizontal: rs(80),
    borderBottomLeftRadius: rs(4),
    borderBottomRightRadius: rs(4),
    opacity: 0.9,
  },
  sheetBody: {
    paddingHorizontal: H_PAD + rs(4),
    paddingTop: rs(20),
    paddingBottom: rs(12),
  },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: rs(8),
    paddingHorizontal: rs(10),
    paddingVertical: rs(4),
    gap: rs(5),
    marginBottom: rs(12),
  },
  catDot: {
    width: rs(7),
    height: rs(7),
    borderRadius: rs(4),
  },
  catLabel: {
    fontSize: fs(11),
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: fs(22),
    fontWeight: '800',
    color: C.dark,
    marginBottom: rs(14),
    letterSpacing: -0.3,
    lineHeight: fs(28),
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(7),
    marginBottom: rs(8),
  },
  infoText: {
    fontSize: fs(13),
    color: C.muted,
    fontWeight: '600',
  },
  descBox: {
    marginTop: rs(8),
    backgroundColor: C.accentLight,
    borderRadius: rs(12),
    padding: rs(14),
  },
  descText: {
    fontSize: fs(13),
    color: C.dark,
    fontWeight: '500',
    lineHeight: fs(20),
  },
  closeBtn: {
    position: 'absolute',
    top: rs(14),
    right: H_PAD + rs(4),
    width: rs(34),
    height: rs(34),
    borderRadius: rs(17),
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtn: {
    marginHorizontal: H_PAD + rs(4),
    backgroundColor: C.accent,
    borderRadius: rs(14),
    paddingVertical: rs(14),
    alignItems: 'center',
    marginTop: rs(4),
  },
  doneBtnText: {
    color: C.white,
    fontSize: fs(15),
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});

// ─── Upcoming Event Card ──────────────────────────────────────────────────────
const EventCard = ({
  event,
  onPress,
}: {
  event: CalendarEvent;
  onPress: () => void;
}) => {
  const cat = CAT[event.category];
  const [y, m, d] = event.date.split('-').map(Number);
  const dayName = DAYS[new Date(y, m - 1, d).getDay()];

  return (
    <TouchableOpacity style={ec.card} onPress={onPress} activeOpacity={0.82}>
      {/* Left date column */}
      <View style={[ec.datePill, { backgroundColor: cat.bg }]}>
        <Text style={[ec.dateDay, { color: cat.color }]}>{d}</Text>
        <Text style={[ec.dateMon, { color: cat.color }]}>{MONTHS[m - 1].slice(0, 3).toUpperCase()}</Text>
        <Text style={[ec.dateWday, { color: cat.color }]}>{dayName}</Text>
      </View>

      {/* Content */}
      <View style={ec.content}>
        <View style={[ec.catBadge, { backgroundColor: cat.bg }]}>
          <Text style={[ec.catLabel, { color: cat.color }]}>{cat.label}</Text>
        </View>
        <Text style={ec.title} numberOfLines={1}>{event.title}</Text>
        {event.time && (
          <View style={ec.timeRow}>
            <ClockIcon color={C.mutedLight} />
            <Text style={ec.timeText}>{event.time}</Text>
          </View>
        )}
        {event.description && (
          <Text style={ec.desc} numberOfLines={1}>{event.description}</Text>
        )}
      </View>

      {/* Right accent bar */}
      <View style={[ec.accent, { backgroundColor: cat.color }]} />
    </TouchableOpacity>
  );
};

const ec = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderRadius: rs(16),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: C.accentDark,
    shadowOffset: { width: 0, height: rs(2) },
    shadowOpacity: 0.07,
    shadowRadius: rs(8),
    elevation: 2,
  },
  datePill: {
    width: rs(60),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: rs(14),
    gap: rs(1),
  },
  dateDay: {
    fontSize: fs(22),
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  dateMon: {
    fontSize: fs(9),
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  dateWday: {
    fontSize: fs(9),
    fontWeight: '600',
    opacity: 0.7,
  },
  content: {
    flex: 1,
    paddingVertical: rs(12),
    paddingLeft: rs(12),
    paddingRight: rs(8),
    gap: rs(3),
  },
  catBadge: {
    alignSelf: 'flex-start',
    borderRadius: rs(5),
    paddingHorizontal: rs(7),
    paddingVertical: rs(2),
    marginBottom: rs(2),
  },
  catLabel: {
    fontSize: fs(9),
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: fs(14),
    fontWeight: '800',
    color: C.dark,
    letterSpacing: -0.1,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4),
    marginTop: rs(2),
  },
  timeText: {
    fontSize: fs(11),
    color: C.mutedLight,
    fontWeight: '600',
  },
  desc: {
    fontSize: fs(11),
    color: C.muted,
    fontWeight: '500',
  },
  accent: {
    width: rs(4),
  },
});

// ─── Mini Calendar ────────────────────────────────────────────────────────────
const MiniCalendar = ({
  year,
  month,
  eventMap,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: {
  year: number;
  month: number;
  eventMap: Record<string, CalendarEvent[]>;
  selectedDate: string | null;
  onSelectDate: (d: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) => {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const todayKey = toKey(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate()
  );

  // Build cells: blanks + days
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View style={cal.container}>
      {/* Month navigator */}
      <View style={cal.navRow}>
        <TouchableOpacity style={cal.navBtn} onPress={onPrevMonth} activeOpacity={0.7}>
          <ChevronLeft />
        </TouchableOpacity>
        <Text style={cal.monthLabel}>{MONTHS[month]} {year}</Text>
        <TouchableOpacity style={cal.navBtn} onPress={onNextMonth} activeOpacity={0.7}>
          <ChevronRight />
        </TouchableOpacity>
      </View>

      {/* Day headers */}
      <View style={cal.dayHeaderRow}>
        {DAYS.map((d) => (
          <Text key={d} style={cal.dayHeader}>{d}</Text>
        ))}
      </View>

      {/* Date grid */}
      {rows.map((row, ri) => (
        <View key={ri} style={cal.row}>
          {row.map((day, ci) => {
            if (!day) return <View key={ci} style={cal.cell} />;
            const key = toKey(year, month, day);
            const isToday = key === todayKey;
            const isSelected = key === selectedDate;
            const dayEvents = eventMap[key] ?? [];
            const hasEvent = dayEvents.length > 0;
            // Pick first event's color for the dot
            const dotColor = hasEvent ? CAT[dayEvents[0].category].color : null;

            return (
              <TouchableOpacity
                key={ci}
                style={cal.cell}
                onPress={() => onSelectDate(key)}
                activeOpacity={0.75}
              >
                <View
                  style={[
                    cal.dayCircle,
                    isToday && cal.todayCircle,
                    isSelected && cal.selectedCircle,
                  ]}
                >
                  <Text
                    style={[
                      cal.dayText,
                      isToday && cal.todayText,
                      isSelected && cal.selectedText,
                    ]}
                  >
                    {day}
                  </Text>
                </View>
                {dotColor && !isSelected && (
                  <View style={[cal.dot, { backgroundColor: dotColor }]} />
                )}
                {isSelected && hasEvent && (
                  <View style={[cal.dot, { backgroundColor: C.white }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const CAL_CELL = (width - H_PAD * 2 - rs(24)) / 7;

const cal = StyleSheet.create({
  container: {
    marginHorizontal: H_PAD,
    backgroundColor: C.white,
    borderRadius: rs(20),
    padding: rs(16),
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: C.accentDark,
    shadowOffset: { width: 0, height: rs(3) },
    shadowOpacity: 0.09,
    shadowRadius: rs(10),
    elevation: 3,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: rs(14),
  },
  navBtn: {
    width: rs(34),
    height: rs(34),
    borderRadius: rs(17),
    backgroundColor: C.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: fs(16),
    fontWeight: '800',
    color: C.dark,
    letterSpacing: -0.2,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    marginBottom: rs(4),
  },
  dayHeader: {
    width: CAL_CELL,
    textAlign: 'center',
    fontSize: fs(10),
    fontWeight: '700',
    color: C.mutedLight,
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    width: CAL_CELL,
    height: CAL_CELL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: rs(30),
    height: rs(30),
    borderRadius: rs(15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircle: {
    borderWidth: 2,
    borderColor: C.accent,
  },
  selectedCircle: {
    backgroundColor: C.accent,
  },
  dayText: {
    fontSize: fs(13),
    fontWeight: '600',
    color: C.dark,
  },
  todayText: {
    color: C.accent,
    fontWeight: '800',
  },
  selectedText: {
    color: C.white,
    fontWeight: '800',
  },
  dot: {
    position: 'absolute',
    bottom: rs(3),
    width: rs(4),
    height: rs(4),
    borderRadius: rs(2),
  },
});

// ─── Legend ───────────────────────────────────────────────────────────────────
const Legend = () => (
  <View style={lg.wrap}>
    {(Object.keys(CAT) as EventCategory[]).map((k) => {
      const c = CAT[k];
      return (
        <View key={k} style={lg.item}>
          <View style={[lg.dot, { backgroundColor: c.color }]} />
          <Text style={lg.label}>{c.label}</Text>
        </View>
      );
    })}
  </View>
);

const lg = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rs(8),
    marginHorizontal: H_PAD,
    marginTop: rs(16),
    marginBottom: rs(4),
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(5),
    backgroundColor: C.white,
    borderRadius: rs(20),
    paddingHorizontal: rs(10),
    paddingVertical: rs(5),
    borderWidth: 1,
    borderColor: C.border,
  },
  dot: {
    width: rs(8),
    height: rs(8),
    borderRadius: rs(4),
  },
  label: {
    fontSize: fs(10),
    fontWeight: '700',
    color: C.dark,
    letterSpacing: 0.2,
  },
});

// ─── Summary Strip ────────────────────────────────────────────────────────────
const SummaryStrip = ({ events }: { events: CalendarEvent[] }) => {
  const counts = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + 1;
    return acc;
  }, {});

  const items = [
    { label: 'Holidays', count: counts.holiday ?? 0, color: C.holiday, bg: C.holidayBg },
    { label: 'Exams',    count: counts.exam    ?? 0, color: C.exam,    bg: C.examBg    },
    { label: 'Events',   count: counts.event   ?? 0, color: C.event,   bg: C.eventBg   },
    { label: 'Sports',   count: counts.sports  ?? 0, color: C.sports,  bg: C.sportsBg  },
    { label: 'Meetings', count: counts.meeting ?? 0, color: C.meeting, bg: C.meetingBg },
    { label: 'Cultural', count: counts.cultural?? 0, color: C.cultural,bg: C.culturalBg},
  ];

  return (
    <View style={ss.row}>
      {items.map((it) => (
        <View key={it.label} style={[ss.box, { backgroundColor: it.bg }]}>
          <Text style={[ss.count, { color: it.color }]}>{it.count}</Text>
          <Text style={[ss.label, { color: it.color }]}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
};

// 2×3 grid (2 columns, 3 rows)
const SS_W = (width - H_PAD * 2 - rs(8)) / 2;

const ss = StyleSheet.create({
  row: {
    marginHorizontal: H_PAD,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rs(8),
  },
  box: {
    width: SS_W,
    borderRadius: rs(14),
    paddingVertical: rs(14),
    paddingHorizontal: rs(14),
    alignItems: 'flex-start',
  },
  count: {
    fontSize: fs(26),
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  label: {
    fontSize: fs(11),
    fontWeight: '700',
    letterSpacing: 0.2,
    opacity: 0.85,
    marginTop: rs(2),
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const AcademicCalendarScreen = ({ navigation, route }: any) => {
  const token       = route?.params?.token ?? '';
  const studentName = route?.params?.studentName ?? '';

  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'calendar' | 'upcoming'>('calendar');
  const [modalEvent, setModalEvent] = useState<CalendarEvent | null>(null);
  const [events,  setEvents]  = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('https://magnetpro.in/api/calendar/holidays/', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        const data = await res.json();
        if (!data.status) throw new Error('Failed to load holidays');

        const mapped: CalendarEvent[] = (data.holidays ?? []).map((h: any) => ({
          id: String(h.id),
          title: h.title,
          date: h.date,
          category: 'holiday' as EventCategory,
          description: h.description || undefined,
        }));
        setEvents(mapped);
      } catch (e) {
        setError('Unable to load calendar. Pull to retry.');
      } finally {
        setLoading(false);
      }
    };

    fetchHolidays();
  }, [token]);

  // Build event map: date-key → events[]
  const eventMap = events.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = [];
    acc[e.date].push(e);
    return acc;
  }, {});

  // Events for selected date
  const selectedEvents = selectedDate ? (eventMap[selectedDate] ?? []) : [];

  // Upcoming events sorted
  const todayStr = toKey(today.getFullYear(), today.getMonth(), today.getDate());
  const upcoming = events.filter((e) => e.date >= todayStr).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // Month events for summary
  const monthKey = `${viewYear}-${padDate(viewMonth + 1)}`;
  const monthEvents = events.filter((e) => e.date.startsWith(monthKey));

  const handlePrevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const handleNextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  return (
    <SafeAreaView style={scr.safe} edges={['bottom']}>
      {/* ── Header ── */}
      <View style={scr.header}>
        <TouchableOpacity style={scr.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <BackIcon />
        </TouchableOpacity>
        <View style={scr.headerTitle}>
          <Text style={scr.headerMain}>Academic Calendar</Text>
          <Text style={scr.headerSub}>{studentName || 'School Year 2025'}</Text>
        </View>
      </View>

      {/* ── Tab Switcher ── */}
      <View style={scr.tabRow}>
        <TouchableOpacity
          style={[scr.tab, activeTab === 'calendar' && scr.tabActive]}
          onPress={() => setActiveTab('calendar')}
          activeOpacity={0.8}
        >
          <Text style={[scr.tabText, activeTab === 'calendar' && scr.tabTextActive]}>
            Calendar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[scr.tab, activeTab === 'upcoming' && scr.tabActive]}
          onPress={() => setActiveTab('upcoming')}
          activeOpacity={0.8}
        >
          <Text style={[scr.tabText, activeTab === 'upcoming' && scr.tabTextActive]}>
            Upcoming
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={scr.scroll} showsVerticalScrollIndicator={false}>

        {activeTab === 'calendar' && (
          <>
            {/* Calendar */}
            <MiniCalendar
              year={viewYear}
              month={viewMonth}
              eventMap={eventMap}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
            />

            {/* Legend */}
            <Legend />

            {/* Month summary — 2×3 grid */}
            <Text style={scr.sectionTitle}>
              {MONTHS[viewMonth]} Overview
            </Text>
            <SummaryStrip events={monthEvents} />

            {/* Selected date events */}
            {selectedDate && selectedEvents.length > 0 && (
              <>
                <Text style={scr.sectionTitle}>
                  {(() => {
                    const [y, m, d] = selectedDate.split('-').map(Number);
                    return `${d} ${MONTHS[m - 1]} ${y}`;
                  })()}
                </Text>
                <View style={scr.eventList}>
                  {selectedEvents.map((e) => (
                    <EventCard
                      key={e.id}
                      event={e}
                      onPress={() => setModalEvent(e)}
                    />
                  ))}
                </View>
              </>
            )}

            {selectedDate && selectedEvents.length === 0 && (
              <View style={scr.emptyBox}>
                <Text style={scr.emptyText}>No events on this date</Text>
              </View>
            )}

            {/* All month events */}
            {monthEvents.length > 0 && (
              <>
                <Text style={scr.sectionTitle}>This Month's Events</Text>
                <View style={scr.eventList}>
                  {monthEvents
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((e) => (
                      <EventCard key={e.id} event={e} onPress={() => setModalEvent(e)} />
                    ))}
                </View>
              </>
            )}
          </>
        )}

        {activeTab === 'upcoming' && (
          <>
            <Text style={scr.sectionTitle}>Upcoming Events</Text>
            <View style={scr.eventList}>
              {upcoming.length === 0 ? (
                <View style={scr.emptyBox}>
                  <Text style={scr.emptyText}>No upcoming events</Text>
                </View>
              ) : (
                upcoming.map((e) => (
                  <EventCard key={e.id} event={e} onPress={() => setModalEvent(e)} />
                ))
              )}
            </View>
          </>
        )}

        <Text style={scr.footer}>Academic Year 2025 · MagnetPro</Text>
      </ScrollView>

      <EventModal
        event={modalEvent}
        visible={!!modalEvent}
        onClose={() => setModalEvent(null)}
      />
    </SafeAreaView>
  );
};

// ─── Screen Styles ────────────────────────────────────────────────────────────
const scr = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    paddingBottom: rs(50),
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12),
    backgroundColor: C.accent,
    paddingHorizontal: H_PAD + rs(4),
    paddingTop: Platform.OS === 'android'
      ? (StatusBar.currentHeight ?? rs(28)) + rs(8)
      : rs(54),
    paddingBottom: rs(20),
  },
  backBtn: {
    width: rs(38),
    height: rs(38),
    borderRadius: rs(19),
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    gap: rs(2),
  },
  headerMain: {
    fontSize: fs(20),
    fontWeight: '800',
    color: C.white,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: fs(12),
    color: 'rgba(255,255,255,0.72)',
    fontWeight: '600',
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderColor: C.border,
    paddingHorizontal: H_PAD,
  },
  tab: {
    flex: 1,
    paddingVertical: rs(13),
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: C.accent,
  },
  tabText: {
    fontSize: fs(13),
    fontWeight: '700',
    color: C.mutedLight,
    letterSpacing: 0.2,
  },
  tabTextActive: {
    color: C.accent,
  },

  // Section
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

  // Events
  eventList: {
    marginHorizontal: H_PAD,
    gap: rs(10),
  },
  emptyBox: {
    marginHorizontal: H_PAD,
    marginTop: rs(12),
    backgroundColor: C.white,
    borderRadius: rs(14),
    paddingVertical: rs(24),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyText: {
    fontSize: fs(13),
    color: C.mutedLight,
    fontWeight: '600',
  },

  footer: {
    textAlign: 'center',
    marginTop: rs(28),
    fontSize: fs(11),
    color: C.mutedLight,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default AcademicCalendarScreen;