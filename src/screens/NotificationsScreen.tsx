import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  PixelRatio,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppNotification } from '../data/notifications';
import { getAllNotifications, markAllAsSeen } from '../utils/notificationStore';
import { openStorePage } from '../utils/checkStoreUpdate';

// ─── Responsive Helpers (match HomeScreen) ─────────────────────────────────
const { width } = Dimensions.get('window');
const BASE_WIDTH = 393;
const scale = width / BASE_WIDTH;
const rs = (size: number) => Math.round(size * Math.min(scale, 1.45));
const fs = (size: number) =>
  Math.round((size * Math.min(scale, 1.3)) / PixelRatio.getFontScale());

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
  amber:       '#C97A3A',
  amberBg:     '#FEF3EC',
};

const TYPE_STYLE: Record<AppNotification['type'], { bg: string; fg: string }> = {
  update: { bg: '#EDF6FA', fg: C.accent },
  info:   { bg: '#EAF9F4', fg: '#1E9E7A' },
  alert:  { bg: C.amberBg, fg: C.amber },
};

const BackIcon = () => (
  <Svg width={rs(20)} height={rs(20)} viewBox="0 0 24 24" fill="none">
    <Path d="M15 6l-6 6 6 6" stroke={C.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const UpdateIcon = ({ color }: { color: string }) => (
  <Svg width={rs(18)} height={rs(18)} viewBox="0 0 24 24" fill="none">
    <Path d="M12 3v10M12 13l4-4M12 13l-4-4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M5 17a7 7 0 0014 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

const InfoIcon = ({ color }: { color: string }) => (
  <Svg width={rs(18)} height={rs(18)} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
    <Path d="M12 11v5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Circle cx="12" cy="8" r="1" fill={color} />
  </Svg>
);

const AlertIcon = ({ color }: { color: string }) => (
  <Svg width={rs(18)} height={rs(18)} viewBox="0 0 24 24" fill="none">
    <Path d="M12 3l9 16H3z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <Path d="M12 10v4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Circle cx="12" cy="17" r="1" fill={color} />
  </Svg>
);

const TYPE_ICON: Record<AppNotification['type'], (p: { color: string }) => JSX.Element> = {
  update: UpdateIcon,
  info:   InfoIcon,
  alert:  AlertIcon,
};

const EmptyBellIcon = () => (
  <Svg width={64} height={64} viewBox="0 0 24 24" fill="none">
    <Path d="M6 8a6 6 0 0112 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6z" stroke={C.mutedLight} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M9.5 18a2.5 2.5 0 005 0" stroke={C.mutedLight} strokeWidth="1.6" strokeLinecap="round" />
  </Svg>
);

export const NotificationsScreen = ({ navigation }: any) => {
  const [loading, setLoading]           = useState(true);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    (async () => {
      const all = await getAllNotifications();
      setNotifications(all);
      setLoading(false);
      // Mark everything as seen once loaded, so the Home screen badge
      // clears next time the user goes back.
      markAllAsSeen(all);
    })();
  }, []);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          activeOpacity={0.8}
          onPress={() => navigation.goBack()}
        >
          <BackIcon />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Notifications</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={s.emptyWrap}>
            <ActivityIndicator size="small" color={C.accent} />
          </View>
        ) : notifications.length === 0 ? (
          <View style={s.emptyWrap}>
            <EmptyBellIcon />
            <Text style={s.emptyTitle}>No notifications yet</Text>
            <Text style={s.emptySub}>You'll see app updates and school announcements here.</Text>
          </View>
        ) : (
          notifications.map((n) => {
            const Icon = TYPE_ICON[n.type];
            const colors = TYPE_STYLE[n.type];
            return (
              <View key={n.id} style={s.card}>
                <View style={[s.iconWrap, { backgroundColor: colors.bg }]}>
                  <Icon color={colors.fg} />
                </View>
                <View style={s.cardText}>
                  <Text style={s.cardTitle}>{n.title}</Text>
                  <Text style={s.cardMessage}>{n.message}</Text>
                  <Text style={s.cardDate}>{n.date}</Text>
                  {n.actionUrl && (
                    <TouchableOpacity
                      style={s.actionBtn}
                      activeOpacity={0.85}
                      onPress={() => openStorePage(n.actionUrl!)}
                    >
                      <Text style={s.actionBtnText}>Update Now</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.accent,
    paddingHorizontal: rs(16),
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? rs(28)) : rs(50),
    paddingBottom: rs(16),
  },
  backBtn: {
    width: rs(34),
    height: rs(34),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: fs(17),
    fontWeight: '800',
    color: C.white,
  },
  scroll: {
    padding: rs(16),
    gap: rs(12),
  },
  card: {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderRadius: rs(16),
    padding: rs(14),
    borderWidth: 1,
    borderColor: C.border,
    gap: rs(12),
    shadowColor: C.accentDark,
    shadowOffset: { width: 0, height: rs(2) },
    shadowOpacity: 0.06,
    shadowRadius: rs(8),
    elevation: 2,
  },
  iconWrap: {
    width: rs(38),
    height: rs(38),
    borderRadius: rs(12),
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardText: {
    flex: 1,
    gap: rs(3),
  },
  cardTitle: {
    fontSize: fs(14),
    fontWeight: '800',
    color: C.dark,
  },
  cardMessage: {
    fontSize: fs(12),
    color: C.muted,
    fontWeight: '500',
    lineHeight: fs(17),
  },
  cardDate: {
    fontSize: fs(10),
    color: C.mutedLight,
    fontWeight: '700',
    marginTop: rs(2),
    letterSpacing: 0.3,
  },
  actionBtn: {
    alignSelf: 'flex-start',
    backgroundColor: C.accent,
    borderRadius: rs(8),
    paddingHorizontal: rs(14),
    paddingVertical: rs(7),
    marginTop: rs(8),
  },
  actionBtnText: {
    fontSize: fs(12),
    fontWeight: '800',
    color: C.white,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: rs(80),
    paddingHorizontal: rs(32),
  },
  emptyTitle: {
    fontSize: fs(15),
    fontWeight: '800',
    color: C.dark,
    marginTop: rs(16),
  },
  emptySub: {
    fontSize: fs(12),
    color: C.muted,
    fontWeight: '500',
    marginTop: rs(6),
    textAlign: 'center',
    lineHeight: fs(17),
  },
});