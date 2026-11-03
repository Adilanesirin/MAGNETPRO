/**
 * ProgressCardScreen.tsx  — Redesigned UI
 * ─────────────────────────────────────────────────────────────────
 * Color theme aligned with HomeScreen (#0E7EA4 teal family)
 * Classy, light, minimal design with soft cards and clean layout
 *
 * Setup:
 *   1. Copy progress_card.pdf into:  assets/progress_card.pdf
 *   2. npm install react-native-webview
 *   3. For Expo: npx expo install react-native-webview
 * ─────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  PixelRatio,
  Platform,
  ActivityIndicator,
  Modal,
  StatusBar,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

// ─── Responsive helpers ───────────────────────────────────────────
const { width } = Dimensions.get('window');
const BASE_WIDTH = 393;
const scale = width / BASE_WIDTH;
const rs = (size: number) => Math.round(size * Math.min(scale, 1.45));
const fs = (size: number) =>
  Math.round((size * Math.min(scale, 1.3)) / PixelRatio.getFontScale());
const H_PAD = rs(20);

// ─── Brand colors — aligned with HomeScreen ───────────────────────
const C = {
  // Primary teal palette (from HomeScreen #0E7EA4)
  accent:       '#0E7EA4',
  accentDark:   '#0A5F7A',
  accentMid:    '#1591B8',
  accentLight:  '#EDF6FA',
  accentBg:     '#F2F8FA',
  // Amber accent (from HomeScreen)
  amber:        '#C97A3A',
  amberBg:      '#FEF3EC',
  // Neutrals
  bg:           '#F2F5F7',
  surface:      '#FFFFFF',
  dark:         '#1A2B35',
  body:         '#2C3E50',
  muted:        '#7AA0B0',
  mutedLight:   '#9BBAC8',
  border:       'rgba(14,126,164,0.09)',
  borderMed:    'rgba(14,126,164,0.15)',
  white:        '#FFFFFF',
};

// ─── Types ────────────────────────────────────────────────────────
interface ProgressCard {
  id: string;
  title: string;
  term: string;
  academic_year: string;
  uploaded_at: string;
  pdf_url: string | null;
  localAsset?: number;
}

// ─── DEMO CARDS ───────────────────────────────────────────────────
const DEMO_CARDS: ProgressCard[] = [
  {
    id: 'demo-1',
    title: 'Holistic Progress Card',
    term: 'Annual',
    academic_year: '2024-25',
    uploaded_at: '2025-04-01T09:00:00Z',
    pdf_url: null,
    localAsset: require('../../assets/progress card.pdf'),
  },
];

// ─── Helpers ─────────────────────────────────────────────────────
const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
};

// ─── Icons ───────────────────────────────────────────────────────
const BackIcon = () => (
  <Svg width={rs(20)} height={rs(20)} viewBox="0 0 24 24" fill="none">
    <Path d="M15 18l-6-6 6-6" stroke={C.white} strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const DownloadIcon = ({ color = C.white }: { color?: string }) => (
  <Svg width={rs(17)} height={rs(17)} viewBox="0 0 24 24" fill="none">
    <Path d="M12 3v13M7 11l5 5 5-5" stroke={color} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M5 20h14" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

const CloseIcon = () => (
  <Svg width={rs(16)} height={rs(16)} viewBox="0 0 24 24" fill="none">
    <Path d="M18 6L6 18M6 6l12 12" stroke={C.white} strokeWidth="2.2"
      strokeLinecap="round" />
  </Svg>
);

const ChevronRight = ({ color = C.white }: { color?: string }) => (
  <Svg width={rs(14)} height={rs(14)} viewBox="0 0 24 24" fill="none">
    <Path d="M9 18l6-6-6-6" stroke={color} strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// Clean document icon in teal
const DocIcon = ({ size = rs(40) }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <Rect x="7" y="4" width="26" height="34" rx="4" fill={C.accentLight}
      stroke={C.accent} strokeWidth="1.5" />
    <Path d="M25 4l8 8" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" />
    <Rect x="25" y="4" width="8" height="8" rx="2"
      fill="rgba(14,126,164,0.15)" stroke={C.accent} strokeWidth="1.3" />
    <Path d="M13 20h14M13 26h10M13 32h7" stroke={C.accentMid}
      strokeWidth="1.4" strokeLinecap="round" />
    <Circle cx="36" cy="36" r="8" fill={C.accent} />
    <Path d="M36 31v10M31 36h10" stroke={C.white} strokeWidth="2"
      strokeLinecap="round" />
  </Svg>
);

const CalIcon = () => (
  <Svg width={rs(12)} height={rs(12)} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="4" width="18" height="18" rx="2" stroke={C.muted} strokeWidth="1.6" />
    <Path d="M3 9h18M8 2v4M16 2v4" stroke={C.muted} strokeWidth="1.5"
      strokeLinecap="round" />
  </Svg>
);

// ─── PDF.js HTML builder ──────────────────────────────────────────
const buildPdfJsHtml = (source: string, isBase64: boolean): string => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #EDF6FA; overflow: hidden; }
    #viewer-wrap {
      width: 100%; height: 100%;
      overflow-y: auto; overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    canvas {
      display: block;
      margin: 12px auto;
      box-shadow: 0 2px 16px rgba(14,126,164,0.15);
      background: #fff;
      max-width: 100%;
    }
    #msg {
      font-family: sans-serif; font-size: 15px;
      color: #7AA0B0; text-align: center;
      padding: 40px 20px;
    }
  </style>
</head>
<body>
  <div id="viewer-wrap">
    <div id="msg">Loading PDF…</div>
  </div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <script>
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const wrap = document.getElementById('viewer-wrap');
    const msg  = document.getElementById('msg');
    async function renderPdf() {
      try {
        ${isBase64
          ? `const raw = atob('${source}');
             const bytes = new Uint8Array(raw.length);
             for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
             var loadingTask = pdfjsLib.getDocument({ data: bytes });`
          : `var loadingTask = pdfjsLib.getDocument('${source}');`
        }
        const pdf = await loadingTask.promise;
        msg.style.display = 'none';
        const devicePixelRatio = window.devicePixelRatio || 1;
        const viewportWidth    = window.innerWidth || 360;
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page     = await pdf.getPage(pageNum);
          const scale    = (viewportWidth - 24) / page.getViewport({ scale: 1 }).width;
          const viewport = page.getViewport({ scale: scale * devicePixelRatio });
          const canvas  = document.createElement('canvas');
          const ctx     = canvas.getContext('2d');
          canvas.width  = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width  = (viewport.width  / devicePixelRatio) + 'px';
          canvas.style.height = (viewport.height / devicePixelRatio) + 'px';
          wrap.appendChild(canvas);
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('loaded');
      } catch (err) {
        msg.textContent = 'Could not render PDF: ' + err.message;
        if (window.ReactNativeWebView)
          window.ReactNativeWebView.postMessage('error:' + err.message);
      }
    }
    renderPdf();
  </script>
</body>
</html>
`;

// ─── PDF Viewer Modal ─────────────────────────────────────────────
interface ViewerProps {
  visible: boolean;
  card: ProgressCard | null;
  localUri: string | null;
  pdfBase64: string | null;
  onClose: () => void;
  onDownload: () => void;
}

const PdfViewerModal: React.FC<ViewerProps> = ({
  visible, card, localUri, pdfBase64, onClose, onDownload,
}) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) { setLoading(true); setError(false); fadeAnim.setValue(0); }
  }, [visible]);

  if (!card) return null;

  const buildSource = () => {
    if (pdfBase64) return { html: buildPdfJsHtml(pdfBase64, true) };
    if (card.pdf_url) return { html: buildPdfJsHtml(card.pdf_url, false) };
    return {
      html: '<body style="background:#EDF6FA;font-family:sans-serif;padding:24px;color:#7AA0B0">No PDF available</body>',
    };
  };

  const handleMessage = (event: any) => {
    const msg = event.nativeEvent.data;
    if (msg === 'loaded') {
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    } else if (msg.startsWith('error:')) {
      setLoading(false); setError(true);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" backgroundColor={C.accentDark} />

      {/* Header */}
      <View style={[mv.header, { paddingTop: insets.top + rs(10) }]}>
        <View style={mv.hBlob1} />
        <View style={mv.hBlob2} />
        <TouchableOpacity style={mv.iconBtn} onPress={onClose} activeOpacity={0.75}>
          <CloseIcon />
        </TouchableOpacity>
        <View style={mv.hCenter}>
          <Text style={mv.hTitle} numberOfLines={1}>{card.title}</Text>
          <Text style={mv.hSub}>{card.term}  ·  {card.academic_year}</Text>
        </View>
        <TouchableOpacity style={mv.iconBtn} onPress={onDownload} activeOpacity={0.75}>
          <DownloadIcon />
        </TouchableOpacity>
      </View>

      {/* PDF area */}
      <View style={mv.pdfWrap}>
        {loading && !error && (
          <View style={mv.overlay}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={mv.overlayTitle}>Loading progress card…</Text>
            <Text style={mv.overlaySub}>Please wait a moment</Text>
          </View>
        )}
        {error && (
          <View style={mv.overlay}>
            <Text style={{ fontSize: rs(44) }}>📄</Text>
            <Text style={mv.errTitle}>Couldn't load PDF</Text>
            <Text style={mv.errSub}>The file may be missing or corrupt.</Text>
          </View>
        )}
        {(pdfBase64 || card.pdf_url) && (
          <Animated.View style={[{ flex: 1 }, { opacity: loading ? 0 : 1 }]}>
            <WebView
              source={buildSource()}
              style={mv.webview}
              javaScriptEnabled
              domStorageEnabled
              scrollEnabled
              nestedScrollEnabled
              scalesPageToFit={false}
              originWhitelist={['*']}
              mixedContentMode="always"
              onMessage={handleMessage}
              onError={() => { setLoading(false); setError(true); }}
            />
          </Animated.View>
        )}
      </View>

      {/* Bottom bar */}
      <View style={[mv.bottomBar, { paddingBottom: insets.bottom + rs(6) }]}>
        <View style={mv.bottomLeft}>
          <View style={mv.termChip}>
            <Text style={mv.termChipText}>{card.term}  {card.academic_year}</Text>
          </View>
          <Text style={mv.bottomDate}>Uploaded {formatDate(card.uploaded_at)}</Text>
        </View>
        <TouchableOpacity style={mv.dlFab} onPress={onDownload} activeOpacity={0.85}>
          <DownloadIcon />
          <Text style={mv.dlFabText}>Download</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

// ─── Card list item ───────────────────────────────────────────────
interface ItemProps {
  card: ProgressCard;
  index: number;
  onPress: () => void;
  onDownload: () => void;
}

const CardItem: React.FC<ItemProps> = ({ card, index, onPress, onDownload }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const press   = () =>
    Animated.spring(scaleAnim, { toValue: 0.978, useNativeDriver: true, speed: 40 }).start();
  const release = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 40 }).start();

  return (
    <Animated.View style={[s.cardWrap, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={s.card}
        onPress={onPress}
        onPressIn={press}
        onPressOut={release}
        activeOpacity={1}
      >
        {/* Thin teal top accent bar */}
        <View style={s.cardStripe} />

        <View style={s.cardInner}>
          {/* Icon + content row */}
          <View style={s.cardMainRow}>
            <View style={s.iconWrap}>
              <DocIcon size={rs(28)} />
            </View>

            <View style={s.cardContent}>
              <Text style={s.cardTitle} numberOfLines={2}>{card.title}</Text>

              {/* Term + year chips */}
              <View style={s.chipRow}>
                <View style={s.chip}>
                  <Text style={s.chipText}>{card.term}</Text>
                </View>
                <View style={[s.chip, s.chipAmber]}>
                  <Text style={[s.chipText, s.chipTextAmber]}>{card.academic_year}</Text>
                </View>
              </View>

              {/* Date */}
              <View style={s.dateRow}>
                <CalIcon />
                <Text style={s.dateText}>Uploaded {formatDate(card.uploaded_at)}</Text>
              </View>
            </View>
          </View>

          {/* Divider */}
          <View style={s.divider} />

          {/* Actions */}
          <View style={s.cardActions}>
            <TouchableOpacity
              style={s.dlBtn}
              onPress={onDownload}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <DownloadIcon color={C.accent} />
              <Text style={s.dlBtnText}>Save PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.viewBtn} onPress={onPress} activeOpacity={0.85}>
              <Text style={s.viewBtnText}>View Report</Text>
              <ChevronRight color={C.white} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Empty state ─────────────────────────────────────────────────
const EmptyState = () => (
  <View style={s.emptyWrap}>
    <View style={s.emptyIconBg}>
      <DocIcon size={rs(52)} />
    </View>
    <Text style={s.emptyTitle}>No Reports Yet</Text>
    <Text style={s.emptyBody}>
      Progress cards will appear here once they are uploaded by the school.
    </Text>
  </View>
);

// ─── Main Screen ─────────────────────────────────────────────────
export const ProgressCardScreen = ({ route, navigation }: any) => {
  const token       = route?.params?.token ?? '';
  const studentName = (route?.params?.studentName ?? 'Student').trim();

  const [cards,      setCards]      = useState<ProgressCard[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState<ProgressCard | null>(null);
  const [localUri,   setLocalUri]   = useState<string | null>(null);
  const [pdfBase64,  setPdfBase64]  = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const headerFade  = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade,
        { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(headerSlide,
        { toValue: 0, speed: 14, bounciness: 3, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Fetch cards ───────────────────────────────────────────────
  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('https://magnetpro.in/api/progress_card/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.status && Array.isArray(data.cards) && data.cards.length > 0) {
        setCards(data.cards);
      } else {
        setCards(DEMO_CARDS);
      }
    } catch {
      setCards(DEMO_CARDS);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  // ── Resolve local asset ───────────────────────────────────────
  const resolveLocalAsset = async (assetModule: number): Promise<string> => {
    const asset = Asset.fromModule(assetModule);
    await asset.downloadAsync();
    const src = asset.localUri;
    if (!src) throw new Error('asset.localUri is null after downloadAsync');
    const dest = FileSystem.cacheDirectory + 'progress_card_preview.pdf';
    const destInfo = await FileSystem.getInfoAsync(dest);
    if (destInfo.exists) await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: src, to: dest });
    return dest;
  };

  // ── Open card ─────────────────────────────────────────────────
  const handleOpen = async (card: ProgressCard) => {
    setSelected(card);
    setLocalUri(null);
    setPdfBase64(null);
    setViewerOpen(true);
    if (card.localAsset) {
      try {
        const uri = await resolveLocalAsset(card.localAsset);
        setLocalUri(uri);
        const b64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        setPdfBase64(b64);
      } catch (e: any) {
        setViewerOpen(false);
        Alert.alert(
          'Could not load PDF',
          'Make sure the file exists at assets/progress_card.pdf and the ' +
          'filename matches the require() call exactly.\n\n' + (e?.message ?? String(e)),
        );
      }
    }
  };

  // ── Download ─────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!selected) return;
    const safeName = (selected.title + '_' + selected.academic_year)
      .replace(/[^a-zA-Z0-9_\-\.]/g, '_') + '.pdf';
    const dest = FileSystem.documentDirectory + safeName;
    try {
      if (localUri) {
        await FileSystem.copyAsync({ from: localUri, to: dest });
      } else if (selected.pdf_url) {
        Alert.alert('Downloading…', 'Please wait while the file downloads.');
        const result = await FileSystem.downloadAsync(selected.pdf_url, dest, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (result.status !== 200) {
          Alert.alert('Download failed', `Server returned status ${result.status}.`);
          return;
        }
      } else {
        Alert.alert('No file', 'No PDF is available for this card.');
        return;
      }
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(dest, {
          mimeType: 'application/pdf',
          dialogTitle: selected.title,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('✅ Saved', `File saved to:\n${dest}`);
      }
    } catch (e: any) {
      Alert.alert('Download failed', e?.message ?? String(e));
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={C.accentDark} />

      {/* ── Header ── */}
      <Animated.View
        style={[
          s.header,
          { opacity: headerFade, transform: [{ translateY: headerSlide }] },
        ]}
      >
        {/* Top nav row */}
        <View style={s.hNav}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.75}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <BackIcon />
          </TouchableOpacity>
        </View>

        {/* Title block */}
        <View style={s.hBody}>
          <Text style={s.hEyebrow}>Academic Records</Text>
          <Text style={s.hTitle}>Progress Cards</Text>
          <Text style={s.hSub}>{studentName}</Text>
        </View>
      </Animated.View>

      {/* ── Content ── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.sectionRow}>
          <View style={s.sectionDot} />
          <Text style={s.sectionTitle}>Your Reports</Text>
        </View>

        {loading && (
          <View style={s.centre}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={s.centreText}>Fetching progress cards…</Text>
          </View>
        )}

        {!loading && cards.map((card, i) => (
          <CardItem
            key={card.id}
            card={card}
            index={i}
            onPress={() => handleOpen(card)}
            onDownload={handleDownload}
          />
        ))}

        {!loading && cards.length === 0 && <EmptyState />}

        {!loading && cards.length > 0 && (
          <View style={s.infoBanner}>
            <Text style={s.infoIcon}>💡</Text>
            <Text style={s.infoText}>
              Tap <Text style={{ fontWeight: '700' }}>View Report</Text> to open the PDF,
              or use <Text style={{ fontWeight: '700' }}>Save PDF</Text> to download it.
            </Text>
          </View>
        )}

        <View style={{ height: rs(48) }} />
      </ScrollView>

      {/* PDF Modal */}
      <PdfViewerModal
        visible={viewerOpen}
        card={selected}
        localUri={localUri}
        pdfBase64={pdfBase64}
        onClose={() => setViewerOpen(false)}
        onDownload={handleDownload}
      />
    </SafeAreaView>
  );
};

// ─── Modal Styles ─────────────────────────────────────────────────
const mv = StyleSheet.create({
  header: {
    backgroundColor: C.accentDark,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: H_PAD, paddingBottom: rs(14),
    gap: rs(10), overflow: 'hidden',
  },
  hBlob1: {
    position: 'absolute', width: rs(160), height: rs(160),
    borderRadius: rs(80), backgroundColor: 'rgba(255,255,255,0.05)',
    top: -rs(50), right: -rs(20),
  },
  hBlob2: {
    position: 'absolute', width: rs(80), height: rs(80),
    borderRadius: rs(40), backgroundColor: 'rgba(255,255,255,0.04)',
    top: rs(20), right: rs(90),
  },
  iconBtn: {
    width: rs(36), height: rs(36), borderRadius: rs(18),
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  hCenter: { flex: 1, alignItems: 'center' },
  hTitle:  { fontSize: fs(15), fontWeight: '700', color: C.white, letterSpacing: 0.1 },
  hSub:    { fontSize: fs(10), color: 'rgba(255,255,255,0.55)', fontWeight: '500', marginTop: rs(2) },
  pdfWrap: { flex: 1, backgroundColor: '#EDF6FA' },
  webview: { flex: 1, backgroundColor: 'transparent' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EDF6FA', gap: rs(10), zIndex: 10,
  },
  overlayTitle: { fontSize: fs(14), fontWeight: '700', color: C.dark, marginTop: rs(6) },
  overlaySub:   { fontSize: fs(12), color: C.muted, fontWeight: '500' },
  errTitle:     { fontSize: fs(17), fontWeight: '800', color: C.dark, marginTop: rs(8) },
  errSub:       { fontSize: fs(13), color: C.muted, textAlign: 'center' },
  bottomBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: H_PAD, paddingTop: rs(12),
    backgroundColor: C.white,
    borderTopWidth: 1, borderTopColor: C.border,
    gap: rs(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -rs(2) },
    shadowOpacity: 0.04, shadowRadius: rs(6), elevation: 8,
  },
  bottomLeft:    { flex: 1, gap: rs(4) },
  termChip: {
    alignSelf: 'flex-start',
    backgroundColor: C.accentLight, borderRadius: rs(6),
    paddingHorizontal: rs(8), paddingVertical: rs(3),
    borderWidth: 1, borderColor: C.borderMed,
  },
  termChipText:  { fontSize: fs(10), fontWeight: '700', color: C.accent },
  bottomDate:    { fontSize: fs(11), color: C.muted, fontWeight: '500' },
  dlFab: {
    flexDirection: 'row', alignItems: 'center', gap: rs(7),
    backgroundColor: C.accent, borderRadius: rs(12),
    paddingHorizontal: rs(18), paddingVertical: rs(11),
    shadowColor: C.accentDark,
    shadowOffset: { width: 0, height: rs(3) },
    shadowOpacity: 0.22, shadowRadius: rs(7), elevation: 6,
  },
  dlFabText: { fontSize: fs(13), fontWeight: '700', color: C.white },
});

// ─── Screen Styles ────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  // ── Header — clean, minimal, professional ────────────────────────
  header: {
    backgroundColor: C.accent,
    paddingTop: Platform.OS === 'android'
      ? (StatusBar.currentHeight ?? rs(28)) + rs(8)
      : rs(54),
    paddingBottom: rs(24),
    paddingHorizontal: H_PAD,
  },
  hNav: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: rs(20),
  },
  backBtn: {
    width: rs(34), height: rs(34), borderRadius: rs(10),
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  hBody: {},
  hEyebrow: {
    fontSize: fs(9), fontWeight: '700',
    color: 'rgba(255,255,255,0.50)',
    letterSpacing: 2.8, textTransform: 'uppercase',
    marginBottom: rs(5),
  },
  hTitle: {
    fontSize: fs(26), fontWeight: '800',
    color: C.white, letterSpacing: -0.4,
    lineHeight: fs(32), marginBottom: rs(3),
  },
  hSub: {
    fontSize: fs(13), fontWeight: '500',
    color: 'rgba(255,255,255,0.65)',
  },

  // ── Scroll ───────────────────────────────────────────────────────
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: H_PAD, paddingTop: rs(24) },

  sectionRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: rs(8), marginBottom: rs(16),
  },
  sectionDot: {
    width: rs(4), height: rs(16),
    borderRadius: rs(2), backgroundColor: C.accent,
  },
  sectionTitle: {
    fontSize: fs(11), fontWeight: '700',
    color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase',
  },

  // ── Card ─────────────────────────────────────────────────────────
  cardWrap: {
    marginBottom: rs(14),
    borderRadius: rs(16),
    shadowColor: '#0A3D55',
    shadowOffset: { width: 0, height: rs(3) },
    shadowOpacity: 0.07, shadowRadius: rs(12), elevation: 4,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: rs(16),
    overflow: 'hidden',
    borderWidth: 1, borderColor: C.border,
  },
  // Top teal accent bar (horizontal)
  cardStripe: {
    height: rs(3), backgroundColor: C.accent,
    borderTopLeftRadius: rs(16), borderTopRightRadius: rs(16),
  },
  cardInner:   { padding: rs(18) },
  cardMainRow: { flexDirection: 'row', gap: rs(14), marginBottom: rs(16) },
  iconWrap: {
    width: rs(52), height: rs(52),
    borderRadius: rs(12), backgroundColor: C.accentLight,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    borderWidth: 1, borderColor: C.borderMed,
  },
  cardContent: { flex: 1, justifyContent: 'center' },
  cardTitle: {
    fontSize: fs(15), fontWeight: '700', color: C.dark,
    letterSpacing: -0.1, lineHeight: fs(21), marginBottom: rs(8),
  },
  chipRow:        { flexDirection: 'row', gap: rs(6), marginBottom: rs(6) },
  chip: {
    backgroundColor: C.accentLight, borderRadius: rs(4),
    paddingHorizontal: rs(8), paddingVertical: rs(3),
    borderWidth: 1, borderColor: C.borderMed,
  },
  chipText:       { fontSize: fs(10), fontWeight: '700', color: C.accent },
  chipAmber:      { backgroundColor: '#FEF3EC', borderColor: 'rgba(201,122,58,0.20)' },
  chipTextAmber:  { color: '#C97A3A' },
  dateRow:        { flexDirection: 'row', alignItems: 'center', gap: rs(5) },
  dateText:       { fontSize: fs(11), color: C.muted, fontWeight: '500' },
  divider:        { height: 1, backgroundColor: C.border, marginBottom: rs(14) },
  cardActions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dlBtn: {
    flexDirection: 'row', alignItems: 'center', gap: rs(6),
    paddingHorizontal: rs(12), paddingVertical: rs(8),
    borderRadius: rs(8), borderWidth: 1, borderColor: C.borderMed,
    backgroundColor: C.accentLight,
  },
  dlBtnText: { fontSize: fs(12), fontWeight: '600', color: C.accent },
  viewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: rs(5),
    backgroundColor: C.accent, borderRadius: rs(9),
    paddingHorizontal: rs(18), paddingVertical: rs(9),
    shadowColor: C.accentDark,
    shadowOffset: { width: 0, height: rs(2) },
    shadowOpacity: 0.18, shadowRadius: rs(5), elevation: 4,
  },
  viewBtnText: { fontSize: fs(12), fontWeight: '700', color: C.white, letterSpacing: 0.1 },

  // ── Empty state ──────────────────────────────────────────────────
  emptyWrap: { alignItems: 'center', paddingTop: rs(56), gap: rs(14) },
  emptyIconBg: {
    width: rs(88), height: rs(88), borderRadius: rs(22),
    backgroundColor: C.accentLight, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.borderMed,
  },
  emptyTitle: { fontSize: fs(17), fontWeight: '700', color: C.dark },
  emptyBody: {
    fontSize: fs(13), color: C.muted, textAlign: 'center',
    lineHeight: fs(20), paddingHorizontal: rs(24),
  },

  // ── Info banner ──────────────────────────────────────────────────
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: C.accentLight, borderRadius: rs(10),
    padding: rs(14), marginTop: rs(4), gap: rs(8),
    borderWidth: 1, borderColor: C.borderMed,
  },
  infoIcon: { fontSize: fs(14) },
  infoText: { flex: 1, fontSize: fs(12), color: C.body, lineHeight: fs(18) },

  // ── Loading ──────────────────────────────────────────────────────
  centre:     { alignItems: 'center', paddingVertical: rs(56), gap: rs(10) },
  centreText: { fontSize: fs(13), color: C.muted, fontWeight: '500' },
});

export default ProgressCardScreen;