import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Animated,
} from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Swipeable } from 'react-native-gesture-handler';

// ─── Brand Colors ─────────────────────────────────────────────────────────────
const C = {
  accent:      '#12BED8',
  accentDark:  '#0A8FA3',
  accentLight: '#D6F5FA',
  dark:        '#0F1923',
  darkCard:    '#1A2535',
  midGray:     '#4A5568',
  muted:       '#8A97A8',
  border:      '#E8EEF4',
  bg:          '#F4F7FA',
  white:       '#FFFFFF',
  red:         '#E5534B',
  redLight:    '#FEF2F2',
  redBorder:   '#FECACA',
  teal:        '#10B981',
  tealLight:   '#ECFDF5',
  tealBorder:  '#6EE7B7',
  amber:       '#F59E0B',
  amberLight:  '#FFFBEB',
  purple:      '#8B5CF6',
  purpleLight: '#F5F3FF',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface FeePendingItem {
  id: number;
  month: string;
  particulars: string;
  amount: string;
  date: string;
}

interface FeePaidItem {
  id: number;
  particulars: string;
  amount: number;
  date: string;
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const BackIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M15 18l-6-6 6-6" stroke={C.dark} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const CheckIcon = () => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
    <Path d="M20 6L9 17l-5-5" stroke={C.white} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const BellIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={C.dark} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={C.dark} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const ReceiptIcon = ({ color }: { color: string }) => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const CarIcon = ({ color }: { color: string }) => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <Path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-1" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <Circle cx="7.5" cy="17.5" r="2.5" stroke={color} strokeWidth="1.8"/>
    <Circle cx="17.5" cy="17.5" r="2.5" stroke={color} strokeWidth="1.8"/>
  </Svg>
);

const FlaskIcon = ({ color }: { color: string }) => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <Path d="M9 3h6M9 3v8L5.5 17A2 2 0 0 0 7.37 20h9.26A2 2 0 0 0 18.5 17L15 11V3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const FlameIcon = ({ color }: { color: string }) => (
  <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
    <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const ClockIcon = ({ color }: { color: string }) => (
  <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8"/>
    <Path d="M12 6v6l4 2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const CheckCircleIcon = ({ color }: { color: string }) => (
  <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
    <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M22 4L12 14.01l-3-3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const LockIcon = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <Path d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z" stroke={C.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={C.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

// ─── Progress Ring (Animated) ──────────────────────────────────────────────────
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const ProgressRing = ({
  paid, total, size = 80,
}: { paid: number; total: number; size?: number }) => {
  const pct = total > 0 ? Math.min(paid / total, 1) : 0;
  const r = (size - 10) / 2;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;

  const animPct = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animPct, {
      toValue: pct,
      duration: 900,
      useNativeDriver: false, // strokeDasharray can't use native driver
    }).start();
  }, [pct]);

  const strokeDashoffset = animPct.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <Svg width={size} height={size}>
      {/* Track */}
      <Circle cx={cx} cy={cx} r={r} stroke={C.redLight} strokeWidth={7} fill="none" />
      {/* Progress */}
      <AnimatedCircle
        cx={cx} cy={cx} r={r}
        stroke={C.teal}
        strokeWidth={7}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        rotation={-90}
        originX={cx}
        originY={cx}
      />
    </Svg>
  );
};
// ─── Skeleton Loader ──────────────────────────────────────────────────────────
const SkeletonPulse = ({ style }: { style: any }) => {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return <Animated.View style={[style, { opacity, backgroundColor: C.border }]} />;
};

const FeeCardSkeleton = () => (
  <View style={s.feeCard}>
    <SkeletonPulse style={{ width: 40, height: 40, borderRadius: 12 }} />
    <View style={{ flex: 1, marginLeft: 12 }}>
      <SkeletonPulse style={{ width: '60%', height: 13, borderRadius: 4, marginBottom: 8 }} />
      <SkeletonPulse style={{ width: '40%', height: 11, borderRadius: 4 }} />
    </View>
    <SkeletonPulse style={{ width: 60, height: 16, borderRadius: 4 }} />
  </View>
);

const FeesScreenSkeleton = () => (
  <>
    <SkeletonPulse style={{ width: '100%', height: 40, borderRadius: 12, marginBottom: 14 }} />
    <FeeCardSkeleton />
    <FeeCardSkeleton />
    <FeeCardSkeleton />
    <FeeCardSkeleton />
  </>
);
export const FeesScreen = ({ route, navigation }: any) => {
  const [token, setToken]             = useState(route?.params?.token ?? '');
  const [studentName, setStudentName] = useState((route?.params?.studentName ?? 'Student').trim());
  const [features, setFeatures]       = useState<string[]>(route?.params?.features ?? []);
  const initials = studentName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  useEffect(() => {
    if (route?.params?.token) return; // already have it from navigation
    (async () => {
      const [storedToken, storedName, storedFeatures] = await Promise.all([
        AsyncStorage.getItem('token'),
        AsyncStorage.getItem('studentName'),
        AsyncStorage.getItem('mobileAppFeatures'),
      ]);
      if (storedToken) setToken(storedToken);
      if (storedName) setStudentName(storedName.trim());
      if (storedFeatures) setFeatures(JSON.parse(storedFeatures));
    })();
  }, []);

    // Only needed when gateway isn't enabled — determines if QR fallback exists
  const [hasQrOption, setHasQrOption] = useState<boolean | null>(null); // null = not checked yet

  useEffect(() => {
    if (!token) return;
    if (features.includes('payment_gateway')) return; // gateway available, no need to check QR
    (async () => {
      try {
        const res = await fetch('https://magnetpro.in/api/payments/bank-details/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setHasQrOption(!!data?.qr_image_url);
      } catch {
        setHasQrOption(false);
      }
    })();
  }, [token, features]);

  const [pendingFees, setPendingFees]     = useState<FeePendingItem[]>([]);
  const [paidFees, setPaidFees]           = useState<FeePaidItem[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [error, setError]                 = useState('');
  const [activeTab, setActiveTab]         = useState<'pending' | 'paid'>('pending');
  const [pendingFilter, setPendingFilter] = useState<'all' | 'fee' | 'vehicle'>('all');
  const [selectedIds, setSelectedIds]     = useState<Set<number>>(new Set());
  const [showUpcoming, setShowUpcoming]   = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);

  // Receipt bottom-sheet
  const [receiptItem, setReceiptItem] = useState<FeePaidItem | null>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const swipeRefs = useRef<Record<number, Swipeable | null>>({});

  const fetchFees = async () => {
    setError('');
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
      const [pendingRes, paidRes] = await Promise.all([
        fetch('https://magnetpro.in/api/fee_pending/pending/', { headers }),
        fetch('https://magnetpro.in/api/feepaid/paid/', { headers }),
      ]);
      const pendingData = await pendingRes.json();
      const paidData    = await paidRes.json();
      if (pendingData.status) setPendingFees(pendingData.fees ?? []);
      if (paidData.status)    setPaidFees(paidData.fees ?? []);
    } catch {
      setError('Could not load fee details. Pull down to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useFocusEffect(
    useCallback(() => {
        if (!token) return;
      fetchFees();
    }, [])
  );

  const onRefresh = () => { setRefreshing(true); fetchFees(); };

  const totalPending = pendingFees.reduce((s, f) => s + parseFloat(f.amount), 0);
  const totalPaid    = paidFees.reduce((s, f) => s + f.amount, 0);
  const totalFees    = totalPaid + totalPending;

  const filteredPending = pendingFees.filter(f => {
    if (pendingFilter === 'all') return true;
    if (pendingFilter === 'vehicle') return f.particulars.toLowerCase().includes('vehicle');
    return !f.particulars.toLowerCase().includes('vehicle');
  });
    const today = new Date();
const currentMonth = today.getMonth();   // 0 = Jan, 6 = Jul
const currentYear  = today.getFullYear();

const isDue = (f: FeePendingItem) => {
  const d = new Date(f.date);
  return d.getFullYear() < currentYear ||
    (d.getFullYear() === currentYear && d.getMonth() <= currentMonth);
};

const dueFees      = filteredPending.filter(isDue);
const upcomingFees = filteredPending
  .filter(f => !isDue(f))
  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Countdown/overdue badge info for a given due date
  const getDueStatus = (dateStr: string) => {
    const due = new Date(dateStr);
    const today = new Date();
    due.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - due.getTime()) / 86400000);

    if (diffDays > 0) {
      return {
        label: diffDays === 1 ? 'Overdue 1 day' : `Overdue ${diffDays} days`,
        color: C.red, bg: C.redLight, icon: 'flame' as const,
      };
    }
    if (diffDays === 0) {
      return { label: 'Due today', color: C.red, bg: C.redLight, icon: 'flame' as const };
    }
    const daysLeft = Math.abs(diffDays);
    if (daysLeft <= 7) {
      return {
        label: `${daysLeft} day${daysLeft > 1 ? 's' : ''} left`,
        color: C.amber, bg: C.amberLight, icon: 'clock' as const,
      };
    }
    return {
      label: `${daysLeft} days left`,
      color: C.midGray, bg: C.border, icon: 'clock' as const,
    };
  };

  const toggleSelect = (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedFees  = pendingFees.filter(f => selectedIds.has(f.id));
  const selectedTotal = selectedFees.reduce((s, f) => s + parseFloat(f.amount), 0);
    const handleProceedToPay = () => {
    const allowGateway = features.includes('payment_gateway');

    // Neither online gateway nor a configured QR — nothing to pay with.
    if (!allowGateway && !hasQrOption) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Online payment is not available for your school yet. Please contact the school office.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.navigate('PaymentScreen', {
      token, studentName, selectedFees, totalAmount: selectedTotal,
      paymentMode: allowGateway ? 'gateway' : 'qr',
    });
  };

  // Swipe-to-pay action (adds to existing multi-selection, never overwrites)
  const renderRightAction = (item: FeePendingItem) => {
    const isSelected = selectedIds.has(item.id);
    return (
      <TouchableOpacity
        style={[s.swipePayAction, isSelected && { backgroundColor: C.midGray }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          toggleSelect(item.id);
          swipeRefs.current[item.id]?.close();
        }}
      >
        <Text style={s.swipePayActionText}>
          {isSelected ? 'Selected ✓' : 'Select to Pay'}
        </Text>
      </TouchableOpacity>
    );
  };

  // Receipt bottom-sheet
  const openReceipt = (item: FeePaidItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReceiptItem(item);
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
  };

  const closeReceipt = () => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 200, useNativeDriver: true })
      .start(() => setReceiptItem(null));
  };

  const getRowIcon = (particulars: string, color: string) => {
    const lower = particulars.toLowerCase();
    if (lower.includes('vehicle') || lower.includes('bus') || lower.includes('transport')) {
      return <CarIcon color={color} />;
    }
    if (lower.includes('lab') || lower.includes('science')) {
      return <FlaskIcon color={color} />;
    }
    return <ReceiptIcon color={color} />;
  };

  const getRowColor = (particulars: string) => {
    const lower = particulars.toLowerCase();
    if (lower.includes('vehicle') || lower.includes('bus')) return { bg: C.purpleLight, fg: C.purple };
    if (lower.includes('lab')) return { bg: C.amberLight, fg: C.amber };
    return { bg: C.redLight, fg: C.red };
  };

  // Clear progress pct
  const clearedPct = totalFees > 0 ? Math.round((totalPaid / totalFees) * 100) : 0;

 const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={s.headerBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <BackIcon />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Fee Details</Text>
          <Text style={s.headerSubtitle}>Track & manage your payments</Text>
        </View>

        {/* spacer to keep title visually centered against the back button */}
        <View style={s.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, selectedIds.size > 0 && { paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />
        }
      >
        {/* ── Hero Card (Compact Glass) ── */}
        <View style={s.heroCardWrap}>
          {/* Soft color blobs behind glass for tint pickup */}
          <View style={s.heroGlow1} />
          <View style={s.heroGlow2} />

          <BlurView intensity={40} tint="light" style={s.heroCard}>
            <View style={s.heroRow}>
              {/* Avatar */}
              <LinearGradient
                colors={[C.accent, C.purple]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.avatarRingSmall}
              >
                <View style={s.avatarInnerSmall}>
                  <Text style={s.avatarTextSmall}>{initials}</Text>
                </View>
              </LinearGradient>

              {/* Name + status */}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.heroNameCompact} numberOfLines={1}>{studentName}</Text>
                <View style={s.statusDotRowCompact}>
                  <View style={[s.statusDot, { backgroundColor: totalPending > 0 ? C.red : C.teal }]} />
                  <Text style={s.statusDotText}>
                    {totalPending > 0 ? `${pendingFees.length} pending` : 'All cleared'}
                  </Text>
                </View>
              </View>

              {/* Small ring */}
              <View>
                <ProgressRing paid={totalPaid} total={totalFees} size={54} />
                <View style={s.ringCenter}>
                  <Text style={s.ringPctCompact}>{clearedPct}%</Text>
                </View>
              </View>
            </View>

            {/* Compact stats row */}
            <View style={s.statsRowCompact}>
              <View style={s.statItemNew}>
                <Text style={s.statLabelNew}>Paid</Text>
                <Text style={[s.statValueCompact, { color: '#0F6E56' }]}>₹{totalPaid.toFixed(0)}</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItemNew}>
                <Text style={s.statLabelNew}>Pending</Text>
                <Text style={[s.statValueCompact, { color: C.red }]}>₹{totalPending.toFixed(0)}</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItemNew}>
                <Text style={s.statLabelNew}>Total</Text>
                <Text style={[s.statValueCompact, { color: C.dark }]}>₹{totalFees.toFixed(0)}</Text>
              </View>
            </View>
          </BlurView>
        </View>

        {/* ── Error ── */}
        {!!error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

       {loading ? (
          <FeesScreenSkeleton />
        ) : (
          <>
            {/* ── Segmented Tab (Glass) ── */}
            <BlurView intensity={30} tint="light" style={s.tabWrap}>
              <TouchableOpacity
                style={[s.tabBtn, activeTab === 'pending' && s.tabBtnActiveRed]}
                onPress={() => { Haptics.selectionAsync(); setActiveTab('pending'); clearSelection(); }}
                activeOpacity={0.85}
              >
                <Text style={[s.tabText, activeTab === 'pending' && { color: C.white }]}>
                  Pending
                </Text>
                {pendingFees.length > 0 && (
                  <View style={[s.tabBadge, { backgroundColor: activeTab === 'pending' ? 'rgba(255,255,255,0.25)' : C.redLight }]}>
                    <Text style={[s.tabBadgeText, { color: activeTab === 'pending' ? C.white : C.red }]}>
                      {pendingFees.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.tabBtn, activeTab === 'paid' && s.tabBtnActiveTeal]}
                onPress={() => { Haptics.selectionAsync(); setActiveTab('paid'); clearSelection(); }}
                activeOpacity={0.85}
              >
                <Text style={[s.tabText, activeTab === 'paid' && { color: C.white }]}>
                  Paid
                </Text>
                {paidFees.length > 0 && (
                  <View style={[s.tabBadge, { backgroundColor: activeTab === 'paid' ? 'rgba(255,255,255,0.25)' : C.tealLight }]}>
                    <Text style={[s.tabBadgeText, { color: activeTab === 'paid' ? C.white : C.teal }]}>
                      {paidFees.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </BlurView>

            {/* ── Filter Chips (Glass Pills, Pending tab only) ── */}
            {activeTab === 'pending' && (
              <View style={s.filterRow}>
                {(['all', 'fee', 'vehicle'] as const).map(f => (
                  <TouchableOpacity
                    key={f}
                    onPress={() => { Haptics.selectionAsync(); setPendingFilter(f); }}
                    activeOpacity={0.75}
                  >
                    {pendingFilter === f ? (
                      <View style={[s.filterChip, s.filterChipActive]}>
                        <Text style={[s.filterChipText, s.filterChipTextActive]}>
                          {f === 'all' ? '⊞  All' : f === 'fee' ? '🎓  Fee' : '🚌  Vehicle'}
                        </Text>
                      </View>
                    ) : (
                      <BlurView intensity={25} tint="light" style={s.filterChip}>
                        <Text style={s.filterChipText}>
                          {f === 'all' ? '⊞  All' : f === 'fee' ? '🎓  Fee' : '🚌  Vehicle'}
                        </Text>
                      </BlurView>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* ── Fee List ── */}
            {activeTab === 'pending' ? (
              <>
                {pendingFees.length === 0 ? (
                  <BlurView intensity={25} tint="light" style={s.emptyBoxGlass}>
                    <Text style={s.emptyIcon}>🎉</Text>
                    <Text style={s.emptyTitle}>No pending fees!</Text>
                    <Text style={s.emptySubtitle}>You're all caught up.</Text>
                  </BlurView>
                ) : filteredPending.length === 0 ? (
                  <View style={s.emptyBox}>
                    <Text style={s.emptyText}>No items in this category.</Text>
                  </View>
                ) : (
                  <>
                    {activeTab === 'pending' && pendingFees.length > 0 && (
                      <Text style={s.selectHint}>Tap a row to select for payment</Text>
                    )}
                    {dueFees.map(fee => {
                      const selected = selectedIds.has(fee.id);
                      const rowColor = getRowColor(fee.particulars);
                      return (
                        <Swipeable
                          key={fee.id}
                          ref={ref => { swipeRefs.current[fee.id] = ref; }}
                          renderRightActions={() => renderRightAction(fee)}
                          overshootRight={false}
                        >
                          <TouchableOpacity
                            activeOpacity={0.75}
                            onPress={() => toggleSelect(fee.id)}
                            style={[s.feeCard, selected && s.feeCardSelected]}
                          >
                            {/* Checkbox */}
                            <View style={[s.checkbox, selected && s.checkboxSelected]}>
                              {selected && <CheckIcon />}
                            </View>

                            {/* Icon Box */}
                            <View style={[s.feeIconBox, { backgroundColor: selected ? rowColor.fg : rowColor.bg }]}>
                              {getRowIcon(fee.particulars, selected ? C.white : rowColor.fg)}
                            </View>

                            {/* Info */}
                            <View style={s.feeInfo}>
                              <Text style={s.feeParticulars} numberOfLines={1}>{fee.particulars}</Text>
                              <Text style={s.feeMeta}>{fee.month} · {formatDate(fee.date)}</Text>
                            </View>

                            {/* Amount + badge */}
                            <View style={s.feeRight}>
                              <Text style={[s.feeAmount, { color: C.red }]}>
                                ₹{parseFloat(fee.amount).toFixed(2)}
                              </Text>
                              {(() => {
                                const due = getDueStatus(fee.date);
                                return (
                                  <View style={[s.statusBadge, { backgroundColor: due.bg }]}>
                                    {due.icon === 'flame'
                                      ? <FlameIcon color={due.color} />
                                      : <ClockIcon color={due.color} />}
                                    <Text style={[s.statusBadgeText, { color: due.color }]}>{due.label}</Text>
                                  </View>
                                );
                              })()}
                            </View>
                          </TouchableOpacity>
                        </Swipeable>
                      );
                    })}
                    {upcomingFees.length > 0 && (
                    <View style={{ marginTop: 12 }}>
                      <TouchableOpacity
                        style={s.upcomingHeader}
                        onPress={() => setShowUpcoming(p => !p)}
                        activeOpacity={0.8}
                      >
                        <Text style={s.upcomingHeaderText}>Upcoming Fees ({upcomingFees.length})</Text>
                        <Text style={s.upcomingChevron}>{showUpcoming ? '▲' : '▼'}</Text>
                      </TouchableOpacity>

                      {showUpcoming && (
                        <>
                          {(showAllUpcoming ? upcomingFees : upcomingFees.slice(0, 3)).map(fee => (
                            <View key={fee.id} style={[s.feeCard, { opacity: 0.6 }]}>
                              <View style={[s.feeIconBox, { backgroundColor: getRowColor(fee.particulars).bg }]}>
                                {getRowIcon(fee.particulars, getRowColor(fee.particulars).fg)}
                              </View>
                              <View style={s.feeInfo}>
                                <Text style={s.feeParticulars} numberOfLines={1}>{fee.particulars}</Text>
                                <Text style={s.feeMeta}>{fee.month} · {formatDate(fee.date)}</Text>
                              </View>
                              <Text style={[s.feeAmount, { color: C.midGray }]}>
                                ₹{parseFloat(fee.amount).toFixed(2)}
                              </Text>
                            </View>
                          ))}

                          {!showAllUpcoming && upcomingFees.length > 3 && (
                            <TouchableOpacity onPress={() => setShowAllUpcoming(true)} style={{ paddingVertical: 8 }}>
                              <Text style={{ color: C.accentDark, fontWeight: '600', fontSize: 12, textAlign: 'center' }}>
                                See {upcomingFees.length - 3} more
                              </Text>
                            </TouchableOpacity>
                          )}
                        </>
                      )}
                    </View>
                  )}
                  </>
                )}
              </>
            ) : (
              <>
                {paidFees.length === 0 ? (
                  <BlurView intensity={25} tint="light" style={s.emptyBoxGlass}>
                    <Text style={s.emptyIcon}>📄</Text>
                    <Text style={s.emptyText}>No payment records found.</Text>
                  </BlurView>
                ) : (
                  <>
                    {/* Section label */}
                    <View style={s.sectionDivider}>
                      <View style={s.dividerLine} />
                      <Text style={s.dividerLabel}>Payments</Text>
                      <View style={s.dividerLine} />
                    </View>

                    {paidFees.map(fee => (
                      <TouchableOpacity
                        key={fee.id}
                        style={s.feeCard}
                        onPress={() => openReceipt(fee)}
                        activeOpacity={0.8}
                      >
                        <View style={[s.feeIconBox, { backgroundColor: C.tealLight }]}>
                          {getRowIcon(fee.particulars, C.teal)}
                        </View>
                        <View style={s.feeInfo}>
                          <Text style={s.feeParticulars} numberOfLines={1}>{fee.particulars}</Text>
                          <Text style={s.feeMeta}>{formatDate(fee.date)}</Text>
                        </View>
                        <View style={s.feeRight}>
                          <Text style={[s.feeAmount, { color: C.teal }]}>
                            ₹{fee.amount.toFixed(2)}
                          </Text>
                          <View style={[s.statusBadge, { backgroundColor: C.tealLight }]}>
                            <CheckCircleIcon color={C.teal} />
                            <Text style={[s.statusBadgeText, { color: C.teal }]}>Paid</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Floating Action Bar (Glass) ── */}
      {selectedIds.size > 0 && (
        <BlurView intensity={60} tint="light" style={s.actionBar}>
          <View style={s.actionBarInfo}>
            <Text style={s.actionBarCount}>{selectedIds.size} item{selectedIds.size > 1 ? 's' : ''} selected</Text>
            <Text style={s.actionBarAmount}>₹{selectedTotal.toFixed(2)}</Text>
          </View>
          <View style={s.actionBarButtons}>
            <TouchableOpacity style={s.cancelBtn} onPress={clearSelection} activeOpacity={0.8}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.proceedBtn} onPress={handleProceedToPay} activeOpacity={0.8}>
              <LockIcon />
              <Text style={s.proceedBtnText}>Proceed to Pay</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      )}

      {/* ── Receipt Bottom Sheet (Glass) ── */}
      {receiptItem && (
        <View style={s.sheetOverlay}>
          <TouchableOpacity style={s.sheetBackdrop} onPress={closeReceipt} activeOpacity={1} />
          <Animated.View style={[
            s.receiptSheetWrap,
            { transform: [{ translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] },
          ]}>
            <BlurView intensity={70} tint="light" style={s.receiptSheet}>
              <View style={s.receiptCheckCircle}>
                <CheckCircleIcon color={C.white} />
              </View>
              <Text style={s.receiptTitle}>Payment Receipt</Text>
              <Text style={s.receiptAmount}>₹{receiptItem.amount.toFixed(2)}</Text>
              <Text style={s.receiptMeta}>{receiptItem.particulars}</Text>
              <Text style={s.receiptMeta}>{formatDate(receiptItem.date)}</Text>
              <TouchableOpacity style={s.receiptCloseBtn} onPress={closeReceipt}>
                <Text style={s.receiptCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </BlurView>
          </Animated.View>
        </View>
      )}
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

 header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F3F7',
  },
  headerBtn: {
    width: 36, height: 36, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.white,
    position: 'relative',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:    { fontSize: 17, fontWeight: '800', color: C.dark, letterSpacing: 0.2 },
  headerSubtitle: { fontSize: 12, fontWeight: '500', color: C.accentDark, marginTop: 2 },
  scroll: { padding: 16, paddingBottom: 40 },

  // ── Hero Card (Compact Glass) ──
  heroCardWrap: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGlow1: {
    position: 'absolute', top: -20, left: -20,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: C.accent, opacity: 0.15,
  },
  heroGlow2: {
    position: 'absolute', bottom: -30, right: -20,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: C.purple, opacity: 0.12,
  },
  heroCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarRingSmall: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', padding: 2,
  },
  avatarInnerSmall: {
    flex: 1, width: '100%', borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTextSmall: { fontSize: 14, fontWeight: '800', color: C.accentDark },
  heroNameCompact: { fontSize: 15, fontWeight: '800', color: C.dark, marginBottom: 3 },
  statusDotRowCompact: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusDotText: { fontSize: 11, color: C.muted, fontWeight: '600' },

  ringCenter: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  ringPctCompact: { fontSize: 12, fontWeight: '800', color: C.dark },

  statsRowCompact: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  statItemNew:  { alignItems: 'center', flex: 1 },
  statLabelNew: { fontSize: 10, color: C.muted, fontWeight: '600', marginBottom: 4 },
  statValueCompact: { fontSize: 14, fontWeight: '800' },
  statDivider:  { width: 1, height: 28, backgroundColor: C.border },

  // ── Error ──
  errorBox: {
    backgroundColor: C.redLight, borderLeftWidth: 3,
    borderLeftColor: C.red, borderRadius: 8, padding: 12, marginBottom: 14,
  },
  errorText: { color: C.red, fontSize: 13, fontWeight: '500' },

  // ── Tabs (Glass) ──
  tabWrap: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    gap: 4,
    overflow: 'hidden',
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 10,
    borderRadius: 12, gap: 6,
  },
  tabBtnActiveRed:  { backgroundColor: C.red },
  tabBtnActiveTeal: { backgroundColor: C.teal },
  tabText:     { fontSize: 13, fontWeight: '600', color: C.muted },
  tabBadge:    { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  tabBadgeText: { fontSize: 11, fontWeight: '700' },

  // ── Filter chips (Glass Pills) ──
  filterRow:       { flexDirection: 'row', gap: 8, marginBottom: 14 },
  filterChip: {
    paddingHorizontal: 13, paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)',
    overflow: 'hidden',
  },
  filterChipActive: {
    backgroundColor: C.dark, borderColor: C.dark,
  },
  filterChipText:       { fontSize: 11, fontWeight: '600', color: C.midGray },
  filterChipTextActive: { color: C.white },

  selectHint: {
    fontSize: 11, color: C.muted,
    marginBottom: 8, marginLeft: 2,
  },
  upcomingHeader: {
  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.border,
  paddingHorizontal: 14, paddingVertical: 12,
},
upcomingHeaderText: { fontSize: 13, fontWeight: '700', color: C.dark },
upcomingChevron: { fontSize: 11, color: C.muted },

  // ── Fee Card ──
  feeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F0F3F7',
    gap: 10,
    shadowColor: '#0F1923',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  feeCardSelected: {
    borderColor: C.redBorder,
    backgroundColor: C.redLight,
  },

  checkbox: {
    width: 20, height: 20, borderRadius: 6,
    borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.white,
  },
  checkboxSelected: {
    backgroundColor: C.red, borderColor: C.red,
  },

  feeIconBox: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  feeInfo:       { flex: 1 },
  feeParticulars:{ fontSize: 13, fontWeight: '600', color: C.dark },
  feeMeta:       { fontSize: 11, color: C.muted, marginTop: 2 },
  feeRight:      { alignItems: 'flex-end', gap: 4 },
  feeAmount:     { fontSize: 14, fontWeight: '800' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 20,
  },
  statusBadgeText: { fontSize: 9, fontWeight: '700' },

  // ── Empty ──
  emptyBox:     { alignItems: 'center', paddingVertical: 32 },
  emptyBoxGlass: {
    alignItems: 'center', paddingVertical: 32,
    borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)',
    overflow: 'hidden', marginBottom: 4,
  },
  emptyIcon:    { fontSize: 32, marginBottom: 8 },
  emptyTitle:   { fontSize: 15, fontWeight: '700', color: C.dark },
  emptySubtitle:{ fontSize: 12, color: C.muted, marginTop: 4 },
  emptyText:    { fontSize: 13, color: C.muted, fontWeight: '500' },

  // ── Section divider ──
  sectionDivider: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginVertical: 12,
  },
  dividerLine:  { flex: 1, height: 1, backgroundColor: C.border },
  dividerLabel: { fontSize: 11, color: C.muted, fontWeight: '600' },

  // ── Inline Pay Panel ──
  inlinePayPanel: {
    backgroundColor: C.darkCard,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  inlinePayInfo: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  inlinePayCount: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  inlinePayTotal: { fontSize: 20, fontWeight: '800', color: C.white },
  inlinePayBtns:  { flexDirection: 'row', gap: 10 },
  ghostBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  ghostBtnText: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  payBtn: {
    flex: 2, paddingVertical: 13, borderRadius: 12,
    backgroundColor: C.teal,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  payBtnText: { fontSize: 14, fontWeight: '700', color: C.white },

  // ── Bottom Action Bar (Glass) ──
  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.5)',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28,
    overflow: 'hidden',
  },
  actionBarInfo: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  actionBarCount:   { fontSize: 12, color: C.muted, fontWeight: '600' },
  actionBarAmount:  { fontSize: 18, fontWeight: '800', color: C.dark },
  actionBarButtons: { flexDirection: 'row', gap: 10 },

  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: C.muted },

  proceedBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12,
    backgroundColor: C.red, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  proceedBtnText: { fontSize: 14, fontWeight: '700', color: C.white },

  // ── Swipe-to-Pay Action ──
  swipePayAction: {
    backgroundColor: C.teal, justifyContent: 'center', alignItems: 'center',
    width: 100, borderRadius: 14, marginBottom: 8, marginLeft: 8,
  },
  swipePayActionText: { color: C.white, fontWeight: '700', fontSize: 12, textAlign: 'center', paddingHorizontal: 6 },

  // ── Receipt Bottom Sheet ──
  sheetOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  receiptSheetWrap: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  receiptSheet: {
    padding: 24, paddingBottom: 36, alignItems: 'center',
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  receiptCheckCircle: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: C.teal,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  receiptTitle:  { fontSize: 14, color: C.muted, fontWeight: '600', marginBottom: 6 },
  receiptAmount: { fontSize: 28, fontWeight: '800', color: C.dark, marginBottom: 8 },
  receiptMeta:   { fontSize: 13, color: C.midGray, marginBottom: 2 },
  receiptCloseBtn: { marginTop: 18, paddingVertical: 12, paddingHorizontal: 32, borderRadius: 12, backgroundColor: C.bg },
  receiptCloseBtnText: { color: C.midGray, fontWeight: '700', fontSize: 13 },
});