import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,

} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';


// ─── Brand Colors ─────────────────────────────────────────────────────────────
const C = {
  accent: '#12BED8',
  accentDark: '#0A8FA3',
  accentLight: '#D6F5FA',
  dark: '#1A2332',
  muted: '#8A97A8',
  border: '#DDE6EF',
  bg: '#F0F8FA',
  white: '#FFFFFF',
  red: '#E5534B',
  redLight: '#FEF2F2',
  teal: '#2ECC9A',
  tealLight: '#E6F9F3',
  tealDark: '#0F6E56',
  amber: '#F59E0B',
  amberLight: '#FFFBEB',
};

const API_BASE = 'https://magnetpro.in';

// ─── VERSION MARKER — if you don't see this exact line in your console
// after restarting, the app is NOT running this file. Check for a
// duplicate PaymentScreen file elsewhere in your project, or your bundler
// cache hasn't actually cleared. ─────────────────────────────────────────
console.log('[PaymentScreen] loaded — build v4-goBack-fix');

// ─── Types ────────────────────────────────────────────────────────────────────
interface FeePendingItem {
  id: number;
  month: string;
  particulars: string;
  amount: string;
  date: string;
}

interface InitiatePaymentResponse {
  status: boolean | number;
  data?: string;       // Easebuzz payment URL to load in WebView
  access_key?: string; // transaction identifier — embedded as the path segment in `data`
  txnid?: string;      // some backend versions may also return this explicitly
  msg?: string;
}

type PaymentApiStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

interface PaymentStatusResponse {
  status: boolean;
  payment_status?: PaymentApiStatus;
  msg?: string;
}

// Screen-level state machine
type ScreenState =
  | 'idle'          // showing summary, ready to pay
  | 'initiating'    // POST /api/payments/initiate/ in flight
  | 'checkout'       // WebView open, user is on Easebuzz page
  | 'verifying'  
  | 'qr' 
  | 'success'
  | 'failed'
  | 'timeout';


const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 10; // 10 * 3s = 30s, per API reference

// ─── Icons ────────────────────────────────────────────────────────────────────
const BackIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M15 18l-6-6 6-6" stroke={C.accentDark} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const CloseIcon = ({ color = C.dark }: { color?: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const ShieldIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={C.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M9 12l2 2 4-4" stroke={C.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const SuccessIcon = () => (
  <Svg width={72} height={72} viewBox="0 0 24 24" fill="none">
    <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke={C.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M22 4L12 14.01l-3-3" stroke={C.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const FailedIcon = () => (
  <Svg width={72} height={72} viewBox="0 0 24 24" fill="none">
    <Path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" stroke={C.red} strokeWidth="2" />
    <Path d="M15 9l-6 6M9 9l6 6" stroke={C.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ═══════════════════════════════════════════════════════════════════════════
export const PaymentScreen = ({ route, navigation }: any) => {
  const token = route?.params?.token ?? '';
  const studentName = (route?.params?.studentName ?? 'Student').trim();
  const paymentMode: 'gateway' | 'qr' = route?.params?.paymentMode ?? 'gateway';

  // What FeesScreen handed us — treated as a starting point only.
  // The authoritative amounts come from re-fetching /api/fee_pending/pending/
  // below, so a stale screen or a fee that changed server-side can never
  // cause an over/under-charge.
  const incomingFees: FeePendingItem[] = route?.params?.selectedFees ?? [];
  const incomingIds = incomingFees.map(f => f.id);

  const [screenState, setScreenState] = useState<ScreenState>('idle');
  const [verifyingFees, setVerifyingFees] = useState(true);
  const [verifiedFees, setVerifiedFees] = useState<FeePendingItem[]>([]);
  const [droppedFees, setDroppedFees] = useState<FeePendingItem[]>([]); // no longer pending — already paid/removed
  const [errorMsg, setErrorMsg] = useState('');
   const [checkoutUrl, setCheckoutUrl] = useState('');
  const [txnid, setTxnid] = useState('');
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [bankDetails, setBankDetails] = useState<{
    account_holder_name?: string;
    bank_name?: string;
    account_number?: string;
    ifsc_code?: string;
    branch_name?: string;
  } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [pollAttempt, setPollAttempt] = useState(0);

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The ONLY amount ever sent to the payment gateway — the live sum of
  // whatever /api/fee_pending/pending/ currently reports for the selected
  // fee IDs. No client-side surcharges, no numbers invented on the frontend.
  // Rounded to 2 decimals to avoid floating-point sums like 1500.0000000002
  // being rejected by a backend that does a strict server-side comparison.
  const rawTotal = verifiedFees.reduce((sum, f) => sum + parseFloat(f.amount), 0);
  const totalAmount = Math.round(rawTotal * 100) / 100;
  const grandTotal = totalAmount;

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // ── Re-verify fee amounts against the live API before showing anything
  //    payable. This is what prevents amount mismatches. ──────────────────
  const verifyFees = useCallback(async () => {
    setVerifyingFees(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/fee_pending/pending/`, { headers: authHeaders });
      const data = await response.json();
      const livePending: FeePendingItem[] = data?.status ? (data.fees ?? []) : [];

      const liveById = new Map(livePending.map(f => [f.id, f]));
      const stillPending: FeePendingItem[] = [];
      const noLongerPending: FeePendingItem[] = [];

      incomingIds.forEach(id => {
        const live = liveById.get(id);
        if (live) stillPending.push(live);
        else {
          const original = incomingFees.find(f => f.id === id);
          if (original) noLongerPending.push(original);
        }
      });

      setVerifiedFees(stillPending);
      setDroppedFees(noLongerPending);

      if (stillPending.length === 0) {
        setErrorMsg(
          noLongerPending.length > 0
            ? 'These fee items have already been paid or updated. Please go back and select again.'
            : 'No fee items to pay. Please go back and select fees to pay.'
        );
      }
    } catch {
      setErrorMsg('Could not verify current fee amounts. Please pull back and try again to ensure accurate billing.');
      setVerifiedFees([]);
    } finally {
      setVerifyingFees(false);
    }
  }, [token]);

  React.useEffect(() => {
    verifyFees();
  }, [verifyFees]);

  // QR-only parents: fetch the institution's saved bank-details QR instead
  // of ever calling /api/payments/initiate/ (Easebuzz gateway).
  React.useEffect(() => {
    if (paymentMode !== 'qr') return;
    (async () => {
      setQrLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/payments/bank-details/`, { headers: authHeaders });
        const data = await response.json();
        if (!response.ok) {
          setErrorMsg(data?.msg || 'Could not load payment details. Please try again.');
          setQrImageUrl(null);
          setBankDetails(null);
          return;
        }
        setQrImageUrl(data?.qr_image_url ?? null);
        setBankDetails(data ?? null);
      } catch {
        setErrorMsg('Could not load payment QR code. Please try again.');
      } finally {
        setQrLoading(false);
      }
    })();
  }, [paymentMode]);

  // ── Cleanup any pending poll timer on unmount ──
  React.useEffect(() => {
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  // ── 1. Initiate Payment ──────────────────────────────────────────────────
  const handlePay = async () => {
    setScreenState('initiating');
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/payments/initiate/`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          amount: grandTotal,
          fee_ids: verifiedFees.map(f => f.id),
        }),
      });

      // Read as text first so a non-JSON error page (500 HTML, etc.) doesn't
      // just look like a silent "network error" — we can see exactly what
      // the server sent back.
      const raw = await response.text();
      let data: InitiatePaymentResponse | null = null;
      try {
        data = JSON.parse(raw);
      } catch {
        // Response wasn't JSON at all — surface that clearly.
        console.warn('[initiate] non-JSON response', response.status, raw);
        setErrorMsg(`Server returned an unexpected response (HTTP ${response.status}). Please contact support.`);
        setScreenState('idle');
        return;
      }

      if (!response.ok) {
        console.warn('[initiate] HTTP error', response.status, data);
      }

   if (data?.status && data.data && data.txnid) {
      console.log('[initiate] SUCCESS — full body:', raw);
      setCheckoutUrl(data.data);
      setTxnid(data.txnid);
      openCheckout(data.data, data.txnid);
    } else {
        // Log the full backend payload so the real rejection reason is
        // visible in dev tools, even though we show a friendlier message.
        console.warn('[initiate] rejected', { httpStatus: response.status, body: data });
        setErrorMsg(
          data?.msg
            ? data.msg
            : `Could not initiate payment (HTTP ${response.status}). Please try again.`
        );
        setScreenState('idle');
      }
    } catch (err) {
      console.warn('[initiate] network/exception', err);
      setErrorMsg('Network error while starting payment. Please check your connection and try again.');
      setScreenState('idle');
    }
  };

// ── 2. Open checkout in the system browser (Safari / Chrome Custom Tabs) ─
  // This behaves exactly like the website — a real browser tab, no
  // embedded-WebView restrictions — so the Easebuzz redirect back to our
  // surl/furl callback completes reliably, same as it does on web.
  const openCheckout = async (url: string, activeTxnid: string) => {
    // Start polling right away — the browser session runs independently of
    // this screen, so we don't need to "watch" its navigation to know when
    // to check status; the status endpoint is the source of truth either way.
    setScreenState('verifying');
    setPollAttempt(0);
    startPolling(activeTxnid);

    const result = await WebBrowser.openBrowserAsync(url);
    console.log('[browser] closed with result:', result.type);
    // When the user taps "Done"/closes the browser, make sure we're showing
    // a confirming state rather than snapping back to the idle fee summary,
    // in case polling hasn't resolved yet.
    setScreenState(prev => (prev === 'idle' || prev === 'initiating' ? 'verifying' : prev));
  };

  // ── 3. Poll payment status ───────────────────────────────────────────────
  const startPolling = (activeTxnid: string) => {
    if (!activeTxnid) return;

    const poll = async (attempt: number) => {
      try {
        const response = await fetch(`${API_BASE}/api/payments/status/${activeTxnid}/`, {
          headers: authHeaders,
        });
        const raw = await response.text();
        console.log(`[poll ${attempt}] HTTP ${response.status} body:`, raw);

        const data: PaymentStatusResponse = JSON.parse(raw);
        const paymentStatus = data.payment_status;

        if (paymentStatus === 'SUCCESS') {
          setScreenState('success');
          return;
        }
        if (paymentStatus === 'FAILED') {
          setErrorMsg(data.msg || 'Your payment could not be completed.');
          setScreenState('failed');
          return;
        }

        // Still PENDING
       if (attempt >= MAX_POLL_ATTEMPTS) {
          setErrorMsg(
            "We're still confirming your payment. This can take a few minutes — " +
            'check the Paid tab shortly, or contact support with your reference below.'
          );
          setScreenState('timeout');
          return;
        }

        setPollAttempt(attempt);
        pollTimer.current = setTimeout(() => poll(attempt + 1), POLL_INTERVAL_MS);
      } catch {
        if (attempt >= MAX_POLL_ATTEMPTS) {
          setErrorMsg('Could not confirm payment status. Please check the Paid tab or contact support.');
          setScreenState('failed');
          return;
        }
        pollTimer.current = setTimeout(() => poll(attempt + 1), POLL_INTERVAL_MS);
      }
    };

    poll(1);
  };



  const handleRetry = () => {
    setErrorMsg('');
    setScreenState('idle');
  };

  const handleDone = () => {
    // Go back to whatever screen pushed this one (FeesScreen), rather than
    // navigating to a hardcoded screen name — avoids "screen not found"
    // errors if your navigator names/nests screens differently.
    navigation.goBack();
  };

  // ── Render: Verifying overlay ────────────────────────────────────────────
  if (screenState === 'verifying') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.centerFill}>
          <ActivityIndicator color={C.accent} size="large" />
          <Text style={s.verifyTitle}>Confirming your payment…</Text>
          <Text style={s.verifySub}>
            Please don't close the app. This usually takes a few seconds.
          </Text>
          {pollAttempt > 0 && (
            <Text style={s.verifyAttempt}>Checking… ({pollAttempt}/{MAX_POLL_ATTEMPTS})</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Success screen ───────────────────────────────────────────────
  if (screenState === 'success') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.centerFill}>
          <View style={s.resultIconWrap}>
            <SuccessIcon />
          </View>
          <Text style={s.resultTitle}>Payment Successful</Text>
          <Text style={s.resultSub}>
            ₹{grandTotal.toFixed(2)} paid for {studentName}
          </Text>
          <View style={s.txnPill}>
            <Text style={s.txnPillText}>Ref: {txnid}</Text>
          </View>
          <TouchableOpacity style={s.primaryBtn} onPress={handleDone} activeOpacity={0.85}>
            <Text style={s.primaryBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

// ── Render: Failed screen ────────────────────────────────────────────────
  if (screenState === 'failed') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.centerFill}>
          <View style={[s.resultIconWrap, { backgroundColor: C.redLight }]}>
            <FailedIcon />
          </View>
          <Text style={[s.resultTitle, { color: C.red }]}>Payment Not Completed</Text>
          <Text style={s.resultSub}>{errorMsg}</Text>
          {!!txnid && (
            <View style={s.txnPill}>
              <Text style={s.txnPillText}>Ref: {txnid}</Text>
            </View>
          )}
          <TouchableOpacity style={s.primaryBtn} onPress={handleRetry} activeOpacity={0.85}>
            <Text style={s.primaryBtnText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.secondaryBtn} onPress={handleDone} activeOpacity={0.7}>
            <Text style={s.secondaryBtnText}>Back to Fees</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

    // ── Render: QR payment screen (manual bank transfer) ────────────────────
  if (screenState === 'qr') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.centerFill}>
          {qrLoading ? (
            <ActivityIndicator color={C.accent} size="large" />
        ) : qrImageUrl ? (
        <>
          <Image
            source={{ uri: qrImageUrl }}
            style={{ width: 300, height: 300, borderRadius: 12 }}
            resizeMode="contain"
          />
          <Text style={s.resultTitle}>Scan to Pay ₹{grandTotal.toFixed(2)}</Text>
          <Text style={s.resultSub}>
            Pay via any UPI app, then tap Done. Your school will confirm the payment manually.
          </Text>
         {bankDetails && (
        <View style={[s.bankCard, { marginTop: 12, padding: 14 }]}>
  <View style={s.bankFullRow}>
    <Text style={s.bankLabel}>Account Holder</Text>
    <Text style={s.bankValue}>{bankDetails.account_holder_name}</Text>
  </View>
  <View style={s.bankFullRow}>
    <Text style={s.bankLabel}>Bank</Text>
    <Text style={s.bankValue}>{bankDetails.bank_name}</Text>
  </View>
  <View style={s.bankFullRow}>
    <Text style={s.bankLabel}>Account No.</Text>
    <Text style={s.bankValueMono}>{bankDetails.account_number}</Text>
  </View>
  <View style={s.bankFullRow}>
    <Text style={s.bankLabel}>IFSC</Text>
    <Text style={s.bankValueMono}>{bankDetails.ifsc_code}</Text>
  </View>
  <View style={[s.bankFullRow, { marginBottom: 0 }]}>
    <Text style={s.bankLabel}>Branch</Text>
    <Text style={s.bankValue}>{bankDetails.branch_name}</Text>
  </View>
</View>
        )}
        </>
     ) : bankDetails ? (
      <View style={s.bankCard}>
       <View style={s.bankCardHeader}>
        <View style={s.bankIconCircle}>
          <ShieldIcon />
        </View>
        <Text style={s.bankCardTitle}>Bank Transfer Details</Text>
      </View>
      <Text style={s.bankCardAmount}>₹{grandTotal.toFixed(2)}</Text>
      <View style={s.divider} />

       <View style={s.bankRow}>
        <Text style={s.bankLabel}>Account Holder</Text>
        <Text style={s.bankValue}>{bankDetails.account_holder_name}</Text>
      </View>
        <View style={s.bankRow}>
          <Text style={s.bankLabel}>Bank</Text>
          <Text style={s.bankValue}>{bankDetails.bank_name}</Text>
        </View>
        <View style={s.bankRow}>
          <Text style={s.bankLabel}>Account No.</Text>
          <Text style={s.bankValueMono}>{bankDetails.account_number}</Text>
        </View>
        <View style={s.bankRow}>
          <Text style={s.bankLabel}>IFSC</Text>
          <Text style={s.bankValueMono}>{bankDetails.ifsc_code}</Text>
        </View>
        <View style={[s.bankRow, { borderBottomWidth: 0 }]}>
          <Text style={s.bankLabel}>Branch</Text>
          <Text style={s.bankValue}>{bankDetails.branch_name}</Text>
        </View>
      </View>
    ) : (
        <Text style={s.resultSub}>Payment details not available. Please contact your school.</Text>
      )}
          <TouchableOpacity style={s.primaryBtn} onPress={handleDone} activeOpacity={0.85}>
            <Text style={s.primaryBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Timeout screen (still confirming, not a real failure) ───────
  if (screenState === 'timeout') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.centerFill}>
          <View style={[s.resultIconWrap, { backgroundColor: C.amberLight }]}>
            <ActivityIndicator color={C.amber} size="large" />
          </View>
          <Text style={s.resultTitle}>Still Confirming</Text>
          <Text style={s.resultSub}>{errorMsg}</Text>
          {!!txnid && (
            <View style={s.txnPill}>
              <Text style={s.txnPillText}>Ref: {txnid}</Text>
            </View>
          )}
          <TouchableOpacity style={s.primaryBtn} onPress={handleDone} activeOpacity={0.85}>
            <Text style={s.primaryBtnText}>Back to Fees</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Main summary + WebView modal ───────────────────────────────── 
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

      {verifyingFees ? (
        <View style={s.centerFill}>
          <ActivityIndicator color={C.accent} size="large" />
          <Text style={s.verifyTitle}>Verifying fee amounts…</Text>
          <Text style={s.verifySub}>Confirming the latest amounts with the school before you pay.</Text>
        </View>
      ) : (
      <>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {!!errorMsg && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{errorMsg}</Text>
          </View>
        )}

        {droppedFees.length > 0 && (
          <View style={s.noticeBox}>
            <Text style={s.noticeTitle}>{droppedFees.length} item(s) removed</Text>
            <Text style={s.noticeText}>
              {droppedFees.map(f => f.particulars).join(', ')} no longer show as pending — they may
              have already been paid. They've been excluded from this payment.
            </Text>
          </View>
        )}

        {/* ── Selected Fees Card ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={[s.cardDot, { backgroundColor: C.red }]} />
            <Text style={s.cardTitle}>Selected Fee Items</Text>
            <View style={s.countBadge}>
              <Text style={s.countBadgeText}>{verifiedFees.length}</Text>
            </View>
          </View>

          {verifiedFees.map((fee, i) => (
            <View key={fee.id} style={[s.feeRow, i === verifiedFees.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={[s.feeIconBox, { backgroundColor: C.redLight }]}>
                <Text style={[s.feeIconText, { color: C.red }]}>₹</Text>
              </View>
              <View style={s.feeInfo}>
                <Text style={s.feeParticulars}>{fee.particulars}</Text>
                <Text style={s.feeMeta}>{fee.month}  ·  {formatDate(fee.date)}</Text>
              </View>
              <Text style={[s.feeAmount, { color: C.red }]}>₹{parseFloat(fee.amount).toFixed(2)}</Text>
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
            <Text style={s.breakdownLabel}>Sub Total ({verifiedFees.length} item{verifiedFees.length === 1 ? '' : 's'})</Text>
            <Text style={s.breakdownValue}>₹{totalAmount.toFixed(2)}</Text>
          </View>

          <View style={s.divider} />

          <View style={s.breakdownRow}>
            <Text style={s.totalLabel}>Total Payable</Text>
            <Text style={s.totalValue}>₹{grandTotal.toFixed(2)}</Text>
          </View>
          <Text style={s.breakdownFootnote}>
            Amount verified live against your school's fee records. No extra charges are added.
          </Text>
        </View>

        {/* ── Secure badge ── */}
        <View style={s.secureRow}>
          <ShieldIcon />
          <Text style={s.secureText}>100% Secure Payment  ·  Powered by Easebuzz</Text>
        </View>
      </ScrollView>

      {/* ── Bottom Action Bar ── */}
      <View style={s.actionBar}>
        <View style={s.actionBarAmount}>
          <Text style={s.actionBarLabel}>Total Payable</Text>
          <Text style={s.actionBarValue}>₹{grandTotal.toFixed(2)}</Text>
        </View>

              <TouchableOpacity
          style={[s.payBtn, (screenState === 'initiating' || verifiedFees.length === 0) && { opacity: 0.6 }]}
          onPress={paymentMode === 'qr' ? () => setScreenState('qr') : handlePay}
          disabled={screenState === 'initiating' || verifiedFees.length === 0}
          activeOpacity={0.85}
        >
          {screenState === 'initiating' ? (
            <ActivityIndicator color={C.white} size="small" />
          ) : (
            <Text style={s.payBtnText}>{paymentMode === 'qr' ? 'Show QR to Pay' : 'Pay Now'}</Text>
          )}
        </TouchableOpacity>
      </View>
      </>
      )}

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
  topBarTitle: { fontSize: 17, fontWeight: '800', color: C.dark },
  topBarSub: { fontSize: 12, color: C.muted, fontWeight: '500', marginTop: 1 },

  scroll: { padding: 20, paddingBottom: 120 },

  errorBox: {
    backgroundColor: C.redLight, borderLeftWidth: 3, borderLeftColor: C.red,
    borderRadius: 8, padding: 12, marginBottom: 16,
  },
  errorText: { color: C.red, fontSize: 13, fontWeight: '500' },

  noticeBox: {
    backgroundColor: C.amberLight, borderLeftWidth: 3, borderLeftColor: C.amber,
    borderRadius: 8, padding: 12, marginBottom: 16,
  },
  noticeTitle: { color: '#92600A', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  noticeText: { color: '#92600A', fontSize: 12, fontWeight: '500', lineHeight: 17 },

  breakdownFootnote: { fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 15 },

  card: {
    backgroundColor: C.white, borderRadius: 16,
    padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: C.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  cardDot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: C.dark, flex: 1 },

  countBadge: { backgroundColor: C.redLight, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: C.red },

  feeRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1,
    borderBottomColor: '#F0F4F8', gap: 12,
  },
  feeIconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  feeIconText: { fontSize: 16, fontWeight: '700' },
  feeInfo: { flex: 1 },
  feeParticulars: { fontSize: 14, fontWeight: '600', color: C.dark },
  feeMeta: { fontSize: 12, color: C.muted, marginTop: 2 },
  feeAmount: { fontSize: 15, fontWeight: '700' },

  breakdownRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 8,
  },
  breakdownLabel: { fontSize: 14, color: C.muted, fontWeight: '500' },
  breakdownValue: { fontSize: 14, color: C.dark, fontWeight: '600' },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 8 },
  totalLabel: { fontSize: 16, fontWeight: '800', color: C.dark },
  totalValue: { fontSize: 20, fontWeight: '800', color: C.red },

  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
  secureText: { fontSize: 12, color: C.muted, fontWeight: '500' },

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
  actionBarLabel: { fontSize: 11, color: C.muted, fontWeight: '600', marginBottom: 2 },
  actionBarValue: { fontSize: 22, fontWeight: '800', color: C.dark },

  payBtn: {
    flex: 1.5, paddingVertical: 16, borderRadius: 14,
    backgroundColor: C.red, alignItems: 'center', justifyContent: 'center',
  },
  payBtnText: { fontSize: 16, fontWeight: '800', color: C.white },

  // ── WebView modal ──
  webviewSafe: { flex: 1, backgroundColor: C.white },
  webviewTopBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  webviewCloseBtn: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center',
  },
  webviewTitleWrap: { flex: 1, alignItems: 'center' },
  webviewTitle: { fontSize: 15, fontWeight: '700', color: C.dark },
  webviewSub: { fontSize: 11, color: C.muted, marginTop: 1 },
  webviewLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', backgroundColor: C.white,
  },

  // ── Full-screen states (verifying / success / failed) ──
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  verifyTitle: { fontSize: 18, fontWeight: '800', color: C.dark, marginTop: 20, textAlign: 'center' },
  verifySub: { fontSize: 13, color: C.muted, marginTop: 8, textAlign: 'center', lineHeight: 19 },
  verifyAttempt: { fontSize: 12, color: C.muted, marginTop: 14, fontWeight: '600' },

  resultIconWrap: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: C.tealLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  resultTitle: { fontSize: 20, fontWeight: '800', color: C.dark, textAlign: 'center' },
  resultSub: { fontSize: 14, color: C.muted, marginTop: 8, textAlign: 'center', lineHeight: 20 },

  txnPill: {
    marginTop: 16, backgroundColor: C.bg,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: C.border,
  },
  txnPillText: { fontSize: 12, color: C.muted, fontWeight: '600' },

  primaryBtn: {
    marginTop: 32, backgroundColor: C.accent,
    paddingVertical: 15, paddingHorizontal: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch',
  },
  primaryBtnText: { fontSize: 15, fontWeight: '800', color: C.white },

  secondaryBtn: { marginTop: 14, paddingVertical: 10, alignItems: 'center' },
  secondaryBtnText: { fontSize: 14, fontWeight: '700', color: C.muted },
  verifyingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  verifyingOverlayText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '600',
    color: C.textSecondary ?? '#555',
  },
bankCard: {
  alignSelf: 'stretch',
  backgroundColor: C.white,
  borderRadius: 18,
  borderWidth: 1,
  borderColor: '#EDF2F7',
  padding: 20,
  marginTop: 8,
  shadowColor: '#0F1B2B',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 3,
},
bankCardTitle: { fontSize: 16, fontWeight: '700', color: C.dark, textAlign: 'center' },
bankCardAmount: { fontSize: 26, fontWeight: '800', color: C.accentDark, textAlign: 'center', marginTop: 4 },
bankRow: {
  alignItems: 'flex-start',
  paddingVertical: 12,
  borderBottomWidth: 1,
  borderBottomColor: '#F0F4F8',
},
bankLabel: {
  fontSize: 11, color: C.muted, fontWeight: '700',
  textTransform: 'uppercase', letterSpacing: 0.6,
},
bankValue: { fontSize: 14, color: C.dark, fontWeight: '700', marginTop: 2 },
bankValueMono: { fontSize: 14, color: C.dark, fontWeight: '700', letterSpacing: 0.4, marginTop: 2 },
bankGridRow: { flexDirection: 'row', marginBottom: 10 },
bankGridCell: { flex: 1, paddingRight: 8 },
bankFullRow: { marginBottom: 8 },
});