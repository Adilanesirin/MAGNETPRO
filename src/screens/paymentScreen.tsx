import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Brand Colors ─────────────────────────────────────────────────────────────
const C = {
  accent:     '#12BED8',
  accentDark: '#0A8FA3',
  accentLight:'#D6F5FA',
  dark:       '#1A2332',
  muted:      '#8A97A8',
  border:     '#DDE6EF',
  bg:         '#F0F8FA',
  white:      '#FFFFFF',
  red:        '#E5534B',
  redLight:   '#FEF2F2',
  teal:       '#2ECC9A',
  tealLight:  '#E6F9F3',
  tealDark:   '#0F6E56',
};

interface FeePendingItem {
  id: number;
  month: string;
  particulars: string;
  amount: string;
  date: string;
}

const BackIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M15 18l-6-6 6-6" stroke={C.accentDark} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const ShieldIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={C.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M9 12l2 2 4-4" stroke={C.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const PaymentScreen = ({ route, navigation }: any) => {
  const token        = route?.params?.token ?? '';
  const studentName  = (route?.params?.studentName ?? 'Student').trim();
  const selectedFees: FeePendingItem[] = route?.params?.selectedFees ?? [];
  const totalAmount: number = route?.params?.totalAmount ?? 0;

  const [paying, setPaying] = useState(false);

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handlePay = async () => {
    setPaying(true);
    try {
      // ── Replace this block with your actual payment gateway integration ──
      // e.g. Razorpay, PayU, etc.
      // const response = await fetch('https://magnetpro.in/api/payment/initiate/', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      //   body: JSON.stringify({ fee_ids: selectedFees.map(f => f.id), amount: totalAmount }),
      // });
      // const data = await response.json();
      // if (data.status) { /* open payment gateway */ }

      await new Promise(r => setTimeout(r, 1500)); // simulate API call
      Alert.alert(
        'Payment Initiated',
        `Payment of ₹${totalAmount.toFixed(2)} has been initiated successfully.`,
        [{ text: 'OK', onPress: () => navigation.popToTop() }]
      );
    } catch {
      Alert.alert('Error', 'Payment failed. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  const convenience = totalAmount * 0.02; // 2% convenience fee — adjust as needed
  const grandTotal  = totalAmount + convenience;

  return (
    <SafeAreaView style={s.safe}>
      {/* ── Top Bar ── */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <BackIcon />
        </TouchableOpacity>
        <View style={s.topBarCenter}>
          <Text style={s.topBarTitle}>Payment Summary</Text>
          <Text style={s.topBarSub}>{studentName}</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Selected Fees Card ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={[s.cardDot, { backgroundColor: C.red }]} />
            <Text style={s.cardTitle}>Selected Fee Items</Text>
            <View style={s.countBadge}>
              <Text style={s.countBadgeText}>{selectedFees.length}</Text>
            </View>
          </View>

          {selectedFees.map((fee, i) => (
            <View
              key={fee.id}
              style={[s.feeRow, i === selectedFees.length - 1 && { borderBottomWidth: 0 }]}
            >
              <View style={[s.feeIconBox, { backgroundColor: C.redLight }]}>
                <Text style={[s.feeIconText, { color: C.red }]}>₹</Text>
              </View>
              <View style={s.feeInfo}>
                <Text style={s.feeParticulars}>{fee.particulars}</Text>
                <Text style={s.feeMeta}>{fee.month}  ·  {formatDate(fee.date)}</Text>
              </View>
              <Text style={[s.feeAmount, { color: C.red }]}>
                ₹{parseFloat(fee.amount).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Amount Breakdown Card ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={[s.cardDot, { backgroundColor: C.accent }]} />
            <Text style={s.cardTitle}>Amount Breakdown</Text>
          </View>

          <View style={s.breakdownRow}>
            <Text style={s.breakdownLabel}>Sub Total</Text>
            <Text style={s.breakdownValue}>₹{totalAmount.toFixed(2)}</Text>
          </View>

          <View style={s.breakdownRow}>
            <Text style={s.breakdownLabel}>Convenience Fee (2%)</Text>
            <Text style={s.breakdownValue}>₹{convenience.toFixed(2)}</Text>
          </View>

          <View style={s.divider} />

          <View style={s.breakdownRow}>
            <Text style={s.totalLabel}>Total Payable</Text>
            <Text style={s.totalValue}>₹{grandTotal.toFixed(2)}</Text>
          </View>
        </View>

        {/* ── Secure badge ── */}
        <View style={s.secureRow}>
          <ShieldIcon />
          <Text style={s.secureText}>100% Secure Payment  ·  Encrypted & Safe</Text>
        </View>
      </ScrollView>

      {/* ── Bottom Action Bar ── */}
      <View style={s.actionBar}>
        <View style={s.actionBarAmount}>
          <Text style={s.actionBarLabel}>Total Payable</Text>
          <Text style={s.actionBarValue}>₹{grandTotal.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={[s.payBtn, paying && { opacity: 0.75 }]}
          onPress={handlePay}
          disabled={paying}
          activeOpacity={0.85}
        >
          {paying ? (
            <ActivityIndicator color={C.white} size="small" />
          ) : (
            <Text style={s.payBtnText}>Pay Now</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: '#C8E8EE',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: C.accentLight,
    alignItems: 'center', justifyContent: 'center',
  },
  topBarCenter: { flex: 1, alignItems: 'center' },
  topBarTitle:  { fontSize: 17, fontWeight: '800', color: C.dark },
  topBarSub:    { fontSize: 12, color: C.muted, fontWeight: '500', marginTop: 1 },

  scroll: { padding: 20, paddingBottom: 120 },

  card: {
    backgroundColor: C.white, borderRadius: 16,
    padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: C.border,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8,
  },
  cardDot:   { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: C.dark, flex: 1 },

  countBadge: {
    backgroundColor: C.redLight, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: C.red },

  feeRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1,
    borderBottomColor: '#F0F4F8', gap: 12,
  },
  feeIconBox: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  feeIconText:    { fontSize: 16, fontWeight: '700' },
  feeInfo:        { flex: 1 },
  feeParticulars: { fontSize: 14, fontWeight: '600', color: C.dark },
  feeMeta:        { fontSize: 12, color: C.muted, marginTop: 2 },
  feeAmount:      { fontSize: 15, fontWeight: '700' },

  // Breakdown
  breakdownRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 8,
  },
  breakdownLabel: { fontSize: 14, color: C.muted, fontWeight: '500' },
  breakdownValue: { fontSize: 14, color: C.dark, fontWeight: '600' },
  divider: {
    height: 1, backgroundColor: C.border, marginVertical: 8,
  },
  totalLabel: { fontSize: 16, fontWeight: '800', color: C.dark },
  totalValue: { fontSize: 20, fontWeight: '800', color: C.red },

  // Secure badge
  secureRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6, marginTop: 4,
  },
  secureText: { fontSize: 12, color: C.muted, fontWeight: '500' },

  // Action bar
  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.white,
    borderTopWidth: 1, borderTopColor: C.border,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28,
    gap: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 12,
  },
  actionBarAmount: { flex: 1 },
  actionBarLabel:  { fontSize: 11, color: C.muted, fontWeight: '600', marginBottom: 2 },
  actionBarValue:  { fontSize: 22, fontWeight: '800', color: C.dark },

  payBtn: {
    flex: 1.5, paddingVertical: 16, borderRadius: 14,
    backgroundColor: C.red,
    alignItems: 'center', justifyContent: 'center',
  },
  payBtnText: { fontSize: 16, fontWeight: '800', color: C.white },
});