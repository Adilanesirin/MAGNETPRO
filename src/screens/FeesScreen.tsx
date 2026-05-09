import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
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

interface FeePaidItem {
  id: number;
  particulars: string;
  amount: number;
  date: string;
}

const BackIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M15 18l-6-6 6-6" stroke={C.accentDark} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const CheckIcon = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <Path d="M20 6L9 17l-5-5" stroke={C.white} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const FeesScreen = ({ route, navigation }: any) => {
  const token       = route?.params?.token ?? '';
  const studentName = (route?.params?.studentName ?? 'Student').trim();

  const [pendingFees, setPendingFees]     = useState<FeePendingItem[]>([]);
  const [paidFees, setPaidFees]           = useState<FeePaidItem[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [error, setError]                 = useState('');
  const [activeTab, setActiveTab]         = useState<'pending' | 'paid'>('pending');
  const [pendingFilter, setPendingFilter] = useState<'all' | 'fee' | 'vehicle'>('all');
  const [selectedIds, setSelectedIds]     = useState<Set<number>>(new Set());

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

  useEffect(() => { fetchFees(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchFees(); };

  const totalPending = pendingFees.reduce((s, f) => s + parseFloat(f.amount), 0);
  const totalPaid    = paidFees.reduce((s, f) => s + f.amount, 0);

  const filteredPending = pendingFees.filter(f => {
    if (pendingFilter === 'all') return true;
    if (pendingFilter === 'vehicle') return f.particulars.toLowerCase().includes('vehicle');
    return !f.particulars.toLowerCase().includes('vehicle');
  });

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedFees = pendingFees.filter(f => selectedIds.has(f.id));
  const selectedTotal = selectedFees.reduce((s, f) => s + parseFloat(f.amount), 0);

  const handleProceedToPay = () => {
    navigation.navigate('PaymentScreen', {
      token,
      studentName,
      selectedFees,
      totalAmount: selectedTotal,
    });
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* ── Top Bar ── */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <BackIcon />
        </TouchableOpacity>
        <View style={s.topBarCenter}>
          <Text style={s.topBarTitle}>Fee Details</Text>
          <Text style={s.topBarSub}>{studentName}</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, selectedIds.size > 0 && { paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />
        }
      >
        {/* ── Summary chips ── */}
        <View style={s.summaryRow}>
          <View style={[s.summaryChip, { backgroundColor: '#caf1e2' }]}>
            <Text style={[s.chipLabel, { color: C.tealDark }]}>Total Paid</Text>
            <Text style={[s.chipAmount, { color: '#1e654a' }]}>₹{totalPaid.toFixed(2)}</Text>
          </View>
          <View style={[s.summaryChip, { backgroundColor: '#f7dbdb' }]}>
            <Text style={[s.chipLabel, { color: '#9B1C1C' }]}>Total Pending</Text>
            <Text style={[s.chipAmount, { color: '#9B1C1C' }]}>₹{totalPending.toFixed(2)}</Text>
          </View>
        </View>

        {/* ── Error ── */}
        {!!error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={C.accent} size="large" style={{ marginTop: 48 }} />
        ) : (
          <>
            {/* ── Toggle ── */}
            <View style={s.toggle}>
              <TouchableOpacity
                style={[s.toggleBtn, activeTab === 'pending' && { backgroundColor: C.red }]}
                onPress={() => { setActiveTab('pending'); clearSelection(); }}
                activeOpacity={0.85}
              >
                <Text style={[s.toggleText, activeTab === 'pending' && s.toggleTextActive]}>PENDING</Text>
                {pendingFees.length > 0 && (
                  <View style={[s.toggleBadge, { backgroundColor: activeTab === 'pending' ? C.white : C.redLight }]}>
                    <Text style={[s.toggleBadgeText, { color: C.red }]}>{pendingFees.length}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.toggleBtn, activeTab === 'paid' && { backgroundColor: C.teal }]}
                onPress={() => { setActiveTab('paid'); clearSelection(); }}
                activeOpacity={0.85}
              >
                <Text style={[s.toggleText, activeTab === 'paid' && s.toggleTextActive]}>PAID</Text>
                {paidFees.length > 0 && (
                  <View style={[s.toggleBadge, { backgroundColor: activeTab === 'paid' ? C.white : C.tealLight }]}>
                    <Text style={[s.toggleBadgeText, { color: C.teal }]}>{paidFees.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* ── Fee Card ── */}
            <View style={s.card}>
              <View style={s.cardHeader}>
                <View style={[s.cardDot, { backgroundColor: activeTab === 'pending' ? C.red : C.teal }]} />
                <Text style={s.cardTitle}>
                  {activeTab === 'pending' ? 'Pending Fees' : 'Paid Fees'}
                </Text>
                {activeTab === 'pending' && pendingFees.length > 0 && (
                  <Text style={s.selectHint}>Tap to select</Text>
                )}
              </View>

              {activeTab === 'pending' ? (
                <>
                  {/* ── Filter chips ── */}
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                    {(['all', 'fee', 'vehicle'] as const).map(f => (
                      <TouchableOpacity
                        key={f}
                        onPress={() => setPendingFilter(f)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 6,
                          borderRadius: 20,
                          backgroundColor: pendingFilter === f ? C.red : C.redLight,
                        }}
                      >
                        <Text style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: pendingFilter === f ? C.white : C.red,
                        }}>
                          {f === 'all' ? 'All' : f === 'fee' ? 'Fee Items' : 'Vehicle Fees'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {pendingFees.length === 0 ? (
                    <View style={s.emptyBox}>
                      <Text style={s.emptyIcon}>🎉</Text>
                      <Text style={s.emptyText}>No pending fees!</Text>
                    </View>
                  ) : filteredPending.length === 0 ? (
                    <View style={s.emptyBox}>
                      <Text style={s.emptyText}>No items in this category.</Text>
                    </View>
                  ) : (
                    filteredPending.map((fee, i) => {
                      const selected = selectedIds.has(fee.id);
                      return (
                        <TouchableOpacity
                          key={fee.id}
                          activeOpacity={0.75}
                          onPress={() => toggleSelect(fee.id)}
                          style={[
                            s.feeRow,
                            i === filteredPending.length - 1 && { borderBottomWidth: 0 },
                            selected && s.feeRowSelected,
                          ]}
                        >
                          {/* Checkbox */}
                          <View style={[s.checkbox, selected && s.checkboxSelected]}>
                            {selected && <CheckIcon />}
                          </View>

                          <View style={[s.feeIconBox, { backgroundColor: selected ? C.red : C.redLight }]}>
                            <Text style={[s.feeIconText, { color: selected ? C.white : C.red }]}>₹</Text>
                          </View>
                          <View style={s.feeInfo}>
                            <Text style={s.feeParticulars}>{fee.particulars}</Text>
                            <Text style={s.feeMeta}>{fee.month}  ·  {formatDate(fee.date)}</Text>
                          </View>
                          <Text style={[s.feeAmount, { color: C.red }]}>
                            ₹{parseFloat(fee.amount).toFixed(2)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </>
              ) : (
                paidFees.length === 0 ? (
                  <View style={s.emptyBox}>
                    <Text style={s.emptyText}>No payment records found.</Text>
                  </View>
                ) : (
                  paidFees.map((fee, i) => (
                    <View
                      key={fee.id}
                      style={[s.feeRow, i === paidFees.length - 1 && { borderBottomWidth: 0 }]}
                    >
                      <View style={[s.feeIconBox, { backgroundColor: C.tealLight }]}>
                        <Text style={[s.feeIconText, { color: C.teal }]}>₹</Text>
                      </View>
                      <View style={s.feeInfo}>
                        <Text style={s.feeParticulars}>{fee.particulars}</Text>
                        <Text style={s.feeMeta}>{formatDate(fee.date)}</Text>
                      </View>
                      <Text style={[s.feeAmount, { color: C.teal }]}>
                        ₹{fee.amount.toFixed(2)}
                      </Text>
                    </View>
                  ))
                )
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Selection Action Bar ── */}
      {selectedIds.size > 0 && (
        <View style={s.actionBar}>
          <View style={s.actionBarInfo}>
            <Text style={s.actionBarCount}>{selectedIds.size} item{selectedIds.size > 1 ? 's' : ''} selected</Text>
            <Text style={s.actionBarAmount}>₹{selectedTotal.toFixed(2)}</Text>
          </View>
          <View style={s.actionBarButtons}>
            <TouchableOpacity style={s.cancelBtn} onPress={clearSelection} activeOpacity={0.8}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.proceedBtn} onPress={handleProceedToPay} activeOpacity={0.8}>
              <Text style={s.proceedBtnText}>Proceed to Pay</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: '#C8E8EE',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: C.accentLight,
    alignItems: 'center', justifyContent: 'center',
  },
  topBarCenter: { flex: 1, alignItems: 'center' },
  topBarTitle:  { fontSize: 17, fontWeight: '800', color: C.dark },
  topBarSub:    { fontSize: 12, color: C.muted, fontWeight: '500', marginTop: 1 },

  scroll: { padding: 20, paddingBottom: 40 },

  summaryRow:  { flexDirection: 'row', gap: 12, marginBottom: 20 },
  summaryChip: { flex: 1, borderRadius: 14, padding: 16 },
  chipLabel:   { fontSize: 11, fontWeight: '600', letterSpacing: 0.3, marginBottom: 6 },
  chipAmount:  { fontSize: 20, fontWeight: '700' },

  errorBox: {
    backgroundColor: C.redLight, borderLeftWidth: 3,
    borderLeftColor: C.red, borderRadius: 8, padding: 12, marginBottom: 16,
  },
  errorText: { color: C.red, fontSize: 13, fontWeight: '500' },

  toggle: {
    flexDirection: 'row', backgroundColor: C.white,
    borderRadius: 12, padding: 4, marginBottom: 12,
    borderWidth: 1, borderColor: C.border,
  },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 10, borderRadius: 9, gap: 6,
  },
  toggleText:       { fontSize: 14, fontWeight: '600', color: C.muted },
  toggleTextActive: { color: C.white },
  toggleBadge:      { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  toggleBadgeText:  { fontSize: 11, fontWeight: '700' },

  card: {
    backgroundColor: C.white, borderRadius: 16,
    padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: C.border,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8,
  },
  cardDot:    { width: 8, height: 8, borderRadius: 4 },
  cardTitle:  { fontSize: 16, fontWeight: '700', color: C.dark, flex: 1 },
  selectHint: { fontSize: 11, color: C.muted, fontWeight: '500' },

  feeRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1,
    borderBottomColor: '#F0F4F8', gap: 10,
  },
  feeRowSelected: {
    backgroundColor: '#FEF2F2', borderRadius: 10,
    paddingHorizontal: 6, marginHorizontal: -6,
  },

  // Checkbox
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.white,
  },
  checkboxSelected: {
    backgroundColor: C.red, borderColor: C.red,
  },

  feeIconBox: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  feeIconText: { fontSize: 16, fontWeight: '700' },
  feeInfo:     { flex: 1 },
  feeParticulars: { fontSize: 14, fontWeight: '600', color: C.dark },
  feeMeta:     { fontSize: 12, color: C.muted, marginTop: 2 },
  feeAmount:   { fontSize: 15, fontWeight: '700' },

  emptyBox:  { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyIcon: { fontSize: 30 },
  emptyText: { fontSize: 14, color: C.muted, fontWeight: '500' },

  // Action Bar
  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.white,
    borderTopWidth: 1, borderTopColor: C.border,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 12,
  },
  actionBarInfo: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  actionBarCount:  { fontSize: 13, color: C.muted, fontWeight: '600' },
  actionBarAmount: { fontSize: 18, fontWeight: '800', color: C.dark },
  actionBarButtons: { flexDirection: 'row', gap: 10 },

  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '700', color: C.muted },

  proceedBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12,
    backgroundColor: C.red,
    alignItems: 'center', justifyContent: 'center',
  },
  proceedBtnText: { fontSize: 15, fontWeight: '700', color: C.white },
});