import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  PixelRatio,
  Platform,
  StatusBar,
  ActivityIndicator,
  Animated,
  Modal,
  Image,
  Linking,
  FlatList,
  Alert,
  TextInput,
  PanResponder,
} from 'react-native';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import Svg, { Path, Circle, Rect, Polyline, Defs, Pattern } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing'; 
import * as Notifications from 'expo-notifications';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
// NEW — used to pull a real first-frame thumbnail for video messages.
// Requires: expo install expo-video-thumbnails
import * as VideoThumbnails from 'expo-video-thumbnails';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});


// ─── Responsive Helpers ────────────────────────────────────────────────────────
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BASE_WIDTH = 393;
const scale = SCREEN_W / BASE_WIDTH;
const rs = (size: number) => Math.round(size * Math.min(scale, 1.5));
const fs = (size: number) =>
  Math.round((size * Math.min(scale, 1.3)) / PixelRatio.getFontScale());

// ─── Brand Colors ─────────────────────────────────────────────────────────────
const C = {
  accent:      '#0E7EA4',
  accentDark:  '#0A5F7A',
  accentDeep:  '#072F3D',   // NEW — gradient depth stop
  accentLight: '#EDF6FA',
  accentMid:   '#1591B8',
  accentGlow:  '#4FC3E8',   // NEW — gradient highlight stop
  bg:          '#E7ECEF',
  white:       '#FFFFFF',
  dark:        '#1A2B35',
  muted:       '#7AA0B0',
  mutedLight:  '#3db9f2',
  border:      'rgba(14,126,164,0.09)',
  borderMid:   'rgba(14,126,164,0.2)',
  bubble:      '#d6eae7',
  datePill:    'rgba(83, 108, 116, 0.1)',
  amber:       '#C97A3A',
  success:     '#2ECC9A',
  overlay:     'rgba(0,0,0,0.45)',
  docBg:       '#F0F7FA',
  glass:       'rgba(255,255,255,0.14)',   // NEW — frosted icon-button fill
  glassBorder: 'rgba(255,255,255,0.22)',   // NEW — frosted icon-button edge
  shadow:      '#04303F',                  // NEW — cohesive shadow tint
};

// ─── Emoji Categories ─────────────────────────────────────────────────────────
const EMOJI_CATEGORIES = [
  { label: 'Quick',    icon: '⚡', emojis: ['❤️','👍','😊','🙏','👏','🎉','😍','🔥'] },
  { label: 'Feelings', icon: '😊', emojis: ['😊','😄','😁','🥰','😍','🤩','😎','🥳','😢','😮','😲','🤔','😌','🙂','😇','🤗','😆','😋','🥹','😏','🤭','🫡','🤝','✌️'] },
  { label: 'Hearts',   icon: '❤️', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💕','💞','💓','💗','💖','💝','💘','❣️','🫀','♥️','❤️‍🔥','❤️‍🩹','💟','☮️','🫶','👐'] },
  { label: 'Praise',   icon: '👏', emojis: ['👏','🙌','🤲','👐','🫶','🤜','✊','👊','💪','🦾','🫰','👌','🤌','🤙','👋','🙏','🎖️','🏆','🥇','⭐','🌟','✨','💫','🎊'] },
  { label: 'Nature',   icon: '🌸', emojis: ['🌸','🌺','🌻','🌹','🌷','💐','🪷','🍀','🌿','🌱','🌳','🌈','☀️','🌤️','⭐','🌙','🦋','🐝','🐞','🦜','🌊','🍃','🍂','🌾'] },
  { label: 'Fun',      icon: '🎉', emojis: ['🎉','🎊','🎈','🎁','🎀','🎗️','🥂','🍰','🎂','🧁','🍭','🍬','🍫','🎠','🎡','🎢','🎯','🎮','🎲','🧩','🪅','🎪','🎭','🎨'] },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface Reaction {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

interface DiaryMessage {
  id: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document';
  text?: string;
  mediaUri?: string;
  caption?: string;
  duration?: string;
  fileName?: string;
  timestamp: string;      // display string  e.g. "8:55 AM"
  isoTimestamp: string;   // full ISO for grouping by date
  reactions: Reaction[];
  isStarred?: boolean;
  isPinned?: boolean;
}

// ─── API ──────────────────────────────────────────────────────────────────────
const BASE_URL = 'https://magnetpro.in/api';
const POLL_MS  = 8_000;
const CONTACT_ROLE = 'parent';

interface AuthSession {
  token: string;
  studentId: number;
  institutionId: string;
}

interface TeacherInfo {
  teacherId: number;
  roomId: number;
  name: string;
  className: string;
  initials: string;
}

// ─── JWT decode (Hermes-safe) ─────────────────────────────────────────────────
function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const str = base64.replace(/=+$/, '');
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < str.length; i++) {
    buffer = (buffer << 6) | chars.indexOf(str[i]);
    bits += 6;
    if (bits >= 8) { bits -= 8; output += String.fromCharCode((buffer >> bits) & 0xff); }
  }
  try { return decodeURIComponent(output.split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')); }
  catch { return output; }
}

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch { return null; }
}

async function readStoredToken(): Promise<string | null> {
  try {
    const direct = await AsyncStorage.getItem('token');
    if (direct) return direct;
    const raw = await AsyncStorage.getItem('magnetpro_user');
    if (raw) {
      const p = JSON.parse(raw);
      if (p?.access) return p.access;
      if (p?.token)  return p.token;
    }
    return null;
  } catch { return null; }
}

async function getAuthSession(): Promise<AuthSession | null> {
  const token = await readStoredToken();
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload?.user_id || !payload?.institution_id) return null;
  return { token, studentId: Number(payload.user_id), institutionId: String(payload.institution_id) };
}

function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function resolveMediaUrl(uri?: string): string | undefined {
  if (!uri) return undefined;
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;
  return `https://magnetpro.in${uri.startsWith('/') ? '' : '/'}${uri}`;
}

function makeInitials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

// ─── Attachment detection inside plain-text messages ──────────────────────────
// Many backends send attachments as plain "text" messages with a bracketed
// tag + raw URL, e.g.  "[Photo] https://...jpg"  or
// "[File] COVER-MOBILE.docx https://...docx" instead of a proper message_type.
// This parses those patterns so they render as real media/document bubbles
// with previews instead of raw link text.
const URL_RE = /(https?:\/\/\S+)/i;
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|bmp|heic)(\?.*)?$/i;
const VIDEO_EXT_RE = /\.(mp4|mov|m4v|avi|webm|3gp)(\?.*)?$/i;
const AUDIO_EXT_RE = /\.(mp3|m4a|aac|wav|ogg|opus)(\?.*)?$/i;
const DOC_EXT_RE   = /\.(pdf|docx?|xlsx?|pptx?|txt|csv|rtf)(\?.*)?$/i;

interface ParsedAttachment {
  type: 'image' | 'video' | 'audio' | 'document';
  mediaUri: string;
  fileName?: string;
  caption?: string;
}

function parseAttachmentFromText(raw: string): ParsedAttachment | null {
  if (!raw) return null;
  const text = raw.trim();
  const urlMatch = text.match(URL_RE);
  if (!urlMatch) return null;
  const url = urlMatch[1].trim();

  // Explicit bracket tag, e.g. "[Photo] <url>" or "[File] name.docx <url>"
  const tagMatch = text.match(/^\[(Photo|Image|Video|Audio|File|Document)\]\s*(.*)$/i);
  if (tagMatch) {
    const tag  = tagMatch[1].toLowerCase();
    const rest = tagMatch[2].replace(url, '').trim();
    const fileName = rest || url.split('/').pop()?.split('?')[0];
    if (tag === 'photo' || tag === 'image') return { type: 'image', mediaUri: url };
    if (tag === 'video') return { type: 'video', mediaUri: url };
    if (tag === 'audio') return { type: 'audio', mediaUri: url };
    return { type: 'document', mediaUri: url, fileName };
  }

  // No explicit tag — infer purely from the file extension in the URL.
  if (IMAGE_EXT_RE.test(url)) return { type: 'image', mediaUri: url };
  if (VIDEO_EXT_RE.test(url)) return { type: 'video', mediaUri: url };
  if (AUDIO_EXT_RE.test(url)) return { type: 'audio', mediaUri: url };
  if (DOC_EXT_RE.test(url)) {
    const fileName = text.replace(url, '').trim() || url.split('/').pop()?.split('?')[0];
    return { type: 'document', mediaUri: url, fileName };
  }
  return null;
}

// ─── Local star / pin persistence (per chat room) ─────────────────────────────
const starKey     = (roomId: number) => `diary_starred_${roomId}`;
const pinKey      = (roomId: number) => `diary_pinned_${roomId}`;
const cacheKey    = (roomId: number) => `diary_cache_${roomId}`;
const muteKey     = (roomId: number) => `diary_muted_${roomId}`;
// NEW — tracks the timestamp of the last message the person actually saw,
// so we can drop a WhatsApp-style "unread messages" divider above whatever
// arrived after that on the next visit.
const lastSeenKey = (roomId: number) => `diary_lastseen_${roomId}`;

async function loadLastSeen(roomId: number): Promise<string | null> {
  try { return await AsyncStorage.getItem(lastSeenKey(roomId)); } catch { return null; }
}
async function saveLastSeen(roomId: number, iso: string): Promise<void> {
  try { await AsyncStorage.setItem(lastSeenKey(roomId), iso); } catch {}
}

// ─── Link preview (WhatsApp-style card under text messages containing a URL) ──
interface LinkMeta { title?: string; description?: string; image?: string }
const linkPreviewCache = new Map<string, LinkMeta | null>();

function getUrlFromText(text?: string): string | null {
  if (!text) return null;
  const m = text.match(URL_RE);
  return m ? m[1].trim() : null;
}

function getDomain(url: string): string {
  try { return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0]; }
  catch { return url; }
}

function extractMetaTag(html: string, prop: string): string | undefined {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
  const m = html.match(re);
  return m?.[1];
}

// NOTE: this fetches the raw page HTML client-side to pull og: tags. Many
// sites block cross-origin requests from a mobile client — in that case we
// fall back gracefully to a domain-only chip rather than erroring out.
async function fetchLinkPreview(url: string): Promise<LinkMeta | null> {
  if (linkPreviewCache.has(url)) return linkPreviewCache.get(url) ?? null;
  try {
    const res = await fetch(url);
    const html = await res.text();
    const meta: LinkMeta = {
      title: extractMetaTag(html, 'og:title') ?? html.match(/<title>([^<]+)<\/title>/i)?.[1],
      description: extractMetaTag(html, 'og:description'),
      image: extractMetaTag(html, 'og:image'),
    };
    linkPreviewCache.set(url, meta);
    return meta;
  } catch {
    linkPreviewCache.set(url, null);
    return null;
  }
}

async function loadMuted(roomId: number): Promise<boolean> {
  try { return (await AsyncStorage.getItem(muteKey(roomId))) === '1'; } catch { return false; }
}
async function saveMuted(roomId: number, muted: boolean): Promise<void> {
  try { await AsyncStorage.setItem(muteKey(roomId), muted ? '1' : '0'); } catch {}
}

async function loadCachedMessages(roomId: number): Promise<DiaryMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(roomId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveCachedMessages(roomId: number, messages: DiaryMessage[]): Promise<void> {
  try {
    // keep cache light — last 100 messages is plenty for offline viewing
    await AsyncStorage.setItem(cacheKey(roomId), JSON.stringify(messages.slice(-100)));
  } catch {}
}
const MAX_PINS = 3;

async function loadIdSet(key: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}

async function saveIdSet(key: string, set: Set<string>): Promise<void> {
  try { await AsyncStorage.setItem(key, JSON.stringify(Array.from(set))); } catch {}
}

// ─── Fetch teacher info + room ────────────────────────────────────────────────
async function resolveTeacherInfo(
  studentId: number,
  institutionId: string,
  token: string,
): Promise<TeacherInfo | null> {
  try {
    const params = new URLSearchParams({ role: CONTACT_ROLE, user_id: String(studentId), institution_id: institutionId });
    const res = await fetch(`${BASE_URL}/chat/contacts/?${params}`, { headers: authHeaders(token) });
    if (!res.ok) return null;
    const data = await res.json();
    const contacts: any[] = Array.isArray(data) ? data : data.contacts ?? [];
    const t = contacts.find(c => c.role === 'teacher') ?? contacts[0];
    if (!t) return null;

    let roomId = t.room_id;
    if (!roomId) {
      const rRes = await fetch(`${BASE_URL}/chat/get-room/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ teacher_id: t.id, student_id: studentId }),
      });
      if (rRes.ok) { const rd = await rRes.json(); roomId = rd.room_id ?? rd.id; }
    }
    if (!roomId) return null;

    const name      = (t.name ?? t.full_name ?? t.username ?? 'Class Teacher').trim();
    const className = t.class_name ?? t.class ?? t.section ?? '';

    return { teacherId: t.id, roomId, name, className, initials: makeInitials(name) };
  } catch (e) {
    console.warn('resolveTeacherInfo failed:', e);
    return null;
  }
}

// ─── Fetch diary messages ─────────────────────────────────────────────────────
async function fetchDiaryMessages(roomId: number, token: string): Promise<DiaryMessage[]> {
  const params = new URLSearchParams({ role: CONTACT_ROLE, page: '1' });
  const res = await fetch(`${BASE_URL}/chat/history/${roomId}/?${params}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`History fetch failed (${res.status})`);
  const data = await res.json();
  const raw: any[] = Array.isArray(data) ? data : data.results ?? data.messages ?? [];

  return raw
    .map((m: any) => {
      const iso      = m.timestamp ?? m.created_at ?? m.time ?? new Date().toISOString();
      const d        = new Date(iso);
      const rawType  = (m.message_type ?? m.type ?? 'text') as string;
      const isDoc    = rawType === 'document' || rawType === 'pdf' || rawType === 'file';
      const isImage  = rawType === 'image';
      const isAudio  = rawType === 'audio';
      const isVideo  = rawType === 'video';

      let type: DiaryMessage['type'] = 'text';
      if (isImage) type = 'image';
      else if (isAudio) type = 'audio';
      else if (isVideo) type = 'video';
      else if (isDoc)   type = 'document';

      const fileName = m.file_name ?? m.filename ?? m.original_name;
      let text     = (!isImage && !isAudio && !isVideo && !isDoc)
        ? (m.content ?? m.text ?? m.message ?? '')
        : (m.content ?? m.text ?? m.message ?? '');
      let mediaUri = resolveMediaUrl(m.file ?? m.media_url ?? m.url);
      let finalFileName = fileName;

      // Backend sometimes ships attachments as plain text like
      // "[Photo] https://...jpg" with message_type still "text" — detect and fix.
      if (type === 'text' && text) {
        const parsed = parseAttachmentFromText(text);
        if (parsed) {
          type = parsed.type;
          mediaUri = resolveMediaUrl(parsed.mediaUri);
          finalFileName = parsed.fileName ?? finalFileName;
          text = '';
        }
      }

      return {
        msg: {
          id:           String(m.id ?? `${iso}-${Math.random()}`),
          type,
          text,
          mediaUri,
          caption:      m.caption ?? undefined,
          duration:     m.duration ?? undefined,
          fileName:     finalFileName ?? undefined,
                    timestamp:    d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }),
          isoTimestamp: iso,
          reactions:    [] as Reaction[],
        } as DiaryMessage,
        iso,
      };
    })
    .sort((a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime())
    .map(x => x.msg);
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function formatDateLabel(isoString: string): string {
  const d    = new Date(isoString);
  const now  = new Date();
  const diff = Math.floor((now.setHours(0,0,0,0) - new Date(d).setHours(0,0,0,0)) / 86_400_000);
  if (diff === 0) return `Today · ${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;
  if (diff === 1) return `Yesterday · ${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

// ─── Message grouping (WhatsApp/Telegram-style clustering) ───────────────────
// Consecutive messages sent within a short window are treated as one visual
// "burst": only the last bubble in the burst gets an avatar, the gap between
// them tightens, and the top-left corner sharpens on every bubble after the
// first so the group reads as one continuous shape instead of separate cards.
const GROUP_GAP_MS = 3 * 60 * 1000; // 3 minutes
function inSameGroup(a?: DiaryMessage, b?: DiaryMessage): boolean {
  if (!a || !b) return false;
  if (!isSameDay(a.isoTimestamp, b.isoTimestamp)) return false;
  return Math.abs(new Date(b.isoTimestamp).getTime() - new Date(a.isoTimestamp).getTime()) <= GROUP_GAP_MS;
}

// ─── Seeded "waveform" shape ───────────────────────────────────────────────
// There's no real per-sample audio data available client-side, so this isn't
// a true waveform — but it deterministically derives a distinct bar pattern
// from each message's own id, so every voice note looks different (and
// always looks the same way on every re-render) instead of every voice note
// in the chat reusing one identical hardcoded shape.
function seededWaveformBars(seed: string, count = 24): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 31) + seed.charCodeAt(i)) >>> 0;
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    const v = (h % 1000) / 1000;
    bars.push(7 + Math.round(v * 23)); // 7..30
  }
  return bars;
}

// ─── Real video-frame thumbnails ──────────────────────────────────────────
// Pulls an actual first-frame image from the video file instead of a flat
// color block, and caches it by URL so scrolling a FlatList (which mounts/
// unmounts offscreen rows) doesn't regenerate the same thumbnail repeatedly.
const videoThumbCache = new Map<string, string | null>();
async function getVideoThumbnail(uri: string): Promise<string | null> {
  if (videoThumbCache.has(uri)) return videoThumbCache.get(uri) ?? null;
  try {
    const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(uri, { time: 1000, quality: 0.6 });
    videoThumbCache.set(uri, thumbUri);
    return thumbUri;
  } catch {
    videoThumbCache.set(uri, null);
    return null;
  }
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const BackIcon = () => (
  <Svg width={rs(22)} height={rs(22)} viewBox="0 0 24 24" fill="none">
    <Path d="M15 18l-6-6 6-6" stroke={C.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const PlayIcon = ({ color = C.white, size = 18 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Path d="M5 3l14 9-14 9V3z" fill={color} />
  </Svg>
);

const PauseIcon = ({ color = C.white, size = 18 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Rect x="5" y="3" width="5" height="18" rx="1.5" fill={color} />
    <Rect x="14" y="3" width="5" height="18" rx="1.5" fill={color} />
  </Svg>
);

// NEW — redrawn on a tighter, single-weight grid so every glyph in the
// bubbles/badges reads as one deliberate icon set rather than mismatched
// clip-art. Slimmer strokes (1.4-1.6) and squarer corners read as "product
// UI" instead of the thick, rounded strokes this replaces.
const MicIcon = ({ color = C.white, size = 18 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Rect x="9" y="2.5" width="6" height="11.5" rx="3" stroke={color} strokeWidth="1.5" />
    <Path d="M6 11a6 6 0 0012 0" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <Path d="M12 19.5v2.3M9.2 21.8h5.6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </Svg>
);

const VideoIcon = ({ color = C.white, size = 20 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Rect x="2.5" y="6.5" width="13" height="11" rx="2.2" stroke={color} strokeWidth="1.5" />
    <Path d="M15.5 10.3l5.3-2.9a.6.6 0 01.9.53v8.12a.6.6 0 01-.9.53l-5.3-2.9v-3.38z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
  </Svg>
);

const ImageIcon = ({ color = C.white, size = 20 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="4" width="18" height="16" rx="2.4" stroke={color} strokeWidth="1.5" />
    <Circle cx="8.6" cy="9.4" r="1.5" stroke={color} strokeWidth="1.5" />
    <Path d="M21 15.5l-4.7-4.7a1.4 1.4 0 00-2 0L8 17.1M12.8 20l3.4-3.4a1.4 1.4 0 012 0L21 19" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const CameraIcon = ({ color = C.white, size = 20 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Path d="M4 8.2A1.7 1.7 0 015.7 6.5h1.9l1-1.7h6.8l1 1.7h1.9A1.7 1.7 0 0120 8.2v9.1a1.7 1.7 0 01-1.7 1.7H5.7A1.7 1.7 0 014 17.3V8.2z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    <Circle cx="12" cy="13" r="3.4" stroke={color} strokeWidth="1.5" />
  </Svg>
);

const DocIcon = ({ color = C.accent, size = 22 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Path d="M13.5 2.5H7a1.7 1.7 0 00-1.7 1.7v15.6A1.7 1.7 0 007 21.5h10a1.7 1.7 0 001.7-1.7V8.2L13.5 2.5z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    <Path d="M13.4 2.5v4.9c0 .72.58 1.3 1.3 1.3h4.7M8.6 13h6.8M8.6 16.3h6.8M8.6 9.7h2.7" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
  </Svg>
);

const DownloadIcon = ({ color = C.accent, size = 16 }: { color?: string; size?: number } = {}) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const ChevronDownIcon = ({ color = C.white, size = 16 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const SearchIcon = ({ color = C.white, size = 18 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2" />
    <Path d="M21 21l-4.3-4.3" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

const CopyIcon = ({ color = C.accent, size = 18 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Rect x="9" y="9" width="12" height="12" rx="2" stroke={color} strokeWidth="1.8" />
    <Path d="M5 15V5a2 2 0 012-2h10" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

const MuteIcon = ({ muted = false, color = C.white, size = 17 }: { muted?: boolean; color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Path d="M4 9v6h4l5 5V4L8 9H4z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    {muted ? (
      <Path d="M17 8l6 8M23 8l-6 8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    ) : (
      <Path d="M17.5 8.5a5 5 0 010 7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    )}
  </Svg>
);

const StarIcon = ({ filled = false, color = C.amber, size = 18 }: { filled?: boolean; color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2.5l2.9 6.26 6.6.62-5 4.62 1.45 6.5L12 17.27 6.05 20.5 7.5 14 2.5 9.38l6.6-.62L12 2.5z"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </Svg>
);

const PinIcon = ({ color = C.accent, size = 16 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Path d="M9.5 3.5l5.5 5.5-1.2 3.3 4.2 4.2-1.2 1.2-4.2-4.2-3.3 1.2-1.6-1.6L11 9.6 9.5 3.5z" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M5 19l4-4" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
  </Svg>
);

const CloseIcon = ({ color = C.white, size = 22 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

const ExpandIcon = ({ color = C.white, size = 16 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// NEW — an actual curved tail nub, not a corner-radius trick. Rendered only
// on the last bubble of a message group, absolutely positioned at its
// bottom-left so it reads as one continuous shape flowing out of the bubble.
const BubbleTail = ({ color = C.bubble, size = 10 }: { color?: string; size?: number }) => (
  <Svg
    width={rs(size)}
    height={rs(size * 1.1)}
    viewBox="0 0 10 11"
    style={{ position: 'absolute', left: -rs(size * 0.58), bottom: 0 }}
  >
    {/* CHANGED — a single sharp point (WhatsApp-style), not a rounded blob */}
    <Path d="M10 0V11L0 6.5C0 6.5 4 6 10 0Z" fill={color} />
  </Svg>
);

// NEW — a faint repeating dot pattern behind the chat, so the message list
// doesn't sit on a flat, empty-looking fill. Kept at ~5% opacity so it never
// competes with bubble content.
const ChatWallpaper = () => (
  <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
    <Defs>
      {/* CHANGED — muted slate dot, not brand teal, so it reads as paper texture,
          not a colour accent; opacity raised so it's actually visible on the
          deeper C.bg below */}
      <Pattern id="chatDots" width="24" height="24" patternUnits="userSpaceOnUse">
        <Circle cx="4" cy="4" r="1.1" fill={C.dark} opacity={0.07} />
        <Circle cx="16" cy="10" r="1.1" fill={C.dark} opacity={0.07} />
        <Circle cx="9" cy="18" r="1.1" fill={C.dark} opacity={0.07} />
      </Pattern>
    </Defs>
    <Rect width="100%" height="100%" fill="url(#chatDots)" />
  </Svg>
);

// ─── PressableScale — shared micro-interaction wrapper ────────────────────────
// Gives every tappable control the same subtle, physical "give" on press
// instead of the flat opacity-only feedback of a bare TouchableOpacity.
const PressableScale = ({
  onPress, children, style, scaleTo = 0.94, disabled, haptic = true,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  style?: any;
  scaleTo?: number;
  disabled?: boolean;
  haptic?: boolean;
}) => {
  const anim = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(anim, { toValue: scaleTo, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const pressOut = () => Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 9 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale: anim }] }, style]}>
      <TouchableOpacity
        activeOpacity={0.9}
        disabled={disabled}
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={() => { if (haptic) Haptics.selectionAsync().catch(() => {}); onPress?.(); }}
        style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

const MoreIcon = ({ color = C.white, size = 20 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Circle cx="5" cy="12" r="1.8" fill={color} />
    <Circle cx="12" cy="12" r="1.8" fill={color} />
    <Circle cx="19" cy="12" r="1.8" fill={color} />
  </Svg>
);

const SmileIcon = ({ color = C.white, size = 20 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
    <Path d="M8.5 14c.9 1.1 2.1 1.7 3.5 1.7s2.6-.6 3.5-1.7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Circle cx="9" cy="9.5" r="1" fill={color} />
    <Circle cx="15" cy="9.5" r="1" fill={color} />
  </Svg>
);


const Waveform = ({ played = 0.4, seed = 'x' }: { played?: number; seed?: string }) => {
  const bars = React.useMemo(() => seededWaveformBars(seed), [seed]);
  return (
    <View style={wv.container}>
      {bars.map((h, i) => (
        <View key={i} style={[wv.bar, { height: rs(h) }, i / bars.length < played ? wv.barPlayed : wv.barUnplayed]} />
      ))}
    </View>
  );
};
const wv = StyleSheet.create({
  container:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: rs(2) },
  bar:         { flex: 1, borderRadius: rs(2) },
  barPlayed:   { backgroundColor: C.accent },
  barUnplayed: { backgroundColor: 'rgba(14,126,164,0.2)' },
});

// ─── Reaction Strip ───────────────────────────────────────────────────────────
const ReactionStrip = ({
  reactions, onReact, onLongPress,
}: { reactions: Reaction[]; onReact: (emoji: string) => void; onLongPress: () => void }) => {
  if (reactions.length === 0) return null;
  return (
    <View style={rx.strip}>
      {reactions.map(r => (
        <TouchableOpacity key={r.emoji} style={[rx.pill, r.reactedByMe && rx.pillMine]} onPress={() => onReact(r.emoji)} activeOpacity={0.75}>
          <Text style={rx.pillEmoji}>{r.emoji}</Text>
          <Text style={[rx.pillCount, r.reactedByMe && rx.pillCountMine]}>{r.count}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={rx.addBtn} onPress={onLongPress} activeOpacity={0.75}>
        <Text style={rx.addBtnText}>＋</Text>
      </TouchableOpacity>
    </View>
  );
};
const rx = StyleSheet.create({
  strip:         { flexDirection: 'row', flexWrap: 'wrap', gap: rs(5), marginTop: rs(4), paddingLeft: rs(2) },
  pill:          { flexDirection: 'row', alignItems: 'center', gap: rs(3), backgroundColor: C.white, borderWidth: 0.8, borderColor: C.borderMid, borderRadius: rs(20), paddingHorizontal: rs(8), paddingVertical: rs(3) },
  pillMine:      { backgroundColor: C.accentLight, borderColor: C.accent },
  pillEmoji:     { fontSize: fs(14) },
  pillCount:     { fontSize: fs(11), color: C.muted, fontWeight: '600' },
  pillCountMine: { color: C.accent },
  addBtn:        { backgroundColor: C.white, borderWidth: 0.8, borderColor: C.border, borderRadius: rs(20), paddingHorizontal: rs(9), paddingVertical: rs(3), alignItems: 'center', justifyContent: 'center' },
  addBtnText:    { fontSize: fs(14), color: C.muted, lineHeight: fs(18) },
});

// ─── Link Preview Card (WhatsApp-style) ───────────────────────────────────────
const LinkPreviewCard = ({ url }: { url: string }) => {
  const [meta, setMeta] = useState<LinkMeta | null | undefined>(undefined); // undefined = loading
  useEffect(() => {
    let cancelled = false;
    setMeta(undefined);
    fetchLinkPreview(url).then(m => { if (!cancelled) setMeta(m); });
    return () => { cancelled = true; };
  }, [url]);

  const domain = getDomain(url);

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={() => Linking.openURL(url).catch(() => {})} style={lp.wrap}>
      {meta === undefined ? (
        <View style={lp.loadingRow}>
          <ActivityIndicator size="small" color={C.accent} />
          <Text style={lp.loadingText} numberOfLines={1}>{domain}</Text>
        </View>
      ) : (
        <>
          {meta?.image ? (
            <Image source={{ uri: meta.image }} style={lp.thumb} resizeMode="cover" />
          ) : (
            <View style={[lp.thumb, lp.thumbPlaceholder]}><LinkIcon /></View>
          )}
          <View style={lp.textCol}>
            <Text style={lp.title} numberOfLines={2}>{meta?.title ?? domain}</Text>
            {!!meta?.description && <Text style={lp.desc} numberOfLines={2}>{meta.description}</Text>}
            <Text style={lp.domain} numberOfLines={1}>{domain}</Text>
          </View>
        </>
      )}
    </TouchableOpacity>
  );
};
const lp = StyleSheet.create({
  wrap:            { flexDirection: 'row', marginTop: rs(8), backgroundColor: C.accentLight, borderRadius: rs(12), overflow: 'hidden', borderWidth: 0.8, borderColor: C.border },
  loadingRow:       { flexDirection: 'row', alignItems: 'center', gap: rs(8), padding: rs(10) },
  loadingText:      { fontSize: fs(11), color: C.muted, fontWeight: '600', flexShrink: 1 },
  thumb:            { width: rs(64), height: rs(64) },
  thumbPlaceholder: { backgroundColor: C.accentDark, alignItems: 'center', justifyContent: 'center' },
  textCol:          { flex: 1, padding: rs(8), gap: rs(2), justifyContent: 'center' },
  title:            { fontSize: fs(12), color: C.dark, fontWeight: '700', lineHeight: fs(16) },
  desc:             { fontSize: fs(10.5), color: C.muted, lineHeight: fs(14) },
  domain:           { fontSize: fs(9.5), color: C.accent, fontWeight: '700', letterSpacing: 0.2, textTransform: 'uppercase', marginTop: rs(2) },
});
const LinkIcon = ({ color = C.white, size = 20 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Path d="M9 15l6-6M10.5 6.5l1-1a3.5 3.5 0 015 5l-1 1M13.5 17.5l-1 1a3.5 3.5 0 01-5-5l1-1" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ─── Message Bubble ───────────────────────────────────────────────────────────
const MessageBubble = ({
  msg, initials, onReact, onOpenActions, onPreviewImage, isHighlighted, isFirstInGroup = true, isLastInGroup = true,
}: {
  msg: DiaryMessage;
  initials: string;
  onReact: (id: string, emoji: string) => void;
  onOpenActions: (msgId: string, anchor?: { x: number; y: number; width: number; height: number }) => void;
  onPreviewImage: (msg: DiaryMessage) => void;
  isHighlighted?: boolean;
  // NEW — burst-grouping flags: only the last bubble in a consecutive run
  // shows the avatar and gets full corner rounding + a tail; bubbles in the
  // middle of a run sit tight against each other with a sharpened top edge.
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const heartAnim = useRef(new Animated.Value(0)).current;
  const bubbleRef = useRef<View>(null); // NEW — measured to anchor the actions sheet

  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<AudioPlayer | null>(null);
  // Real playback position (0..1) and speed, driven by expo-audio status updates.
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioDurationMsRef = useRef(0);
  const waveformWidthRef = useRef(0);

  // NEW — swipe-left-to-reveal-timestamp (WhatsApp gesture). Horizontal drags
  // shift the bubble left and fade in the timestamp sitting behind it; releasing
  // springs everything back.
  const swipeX = useRef(new Animated.Value(0)).current;
  const SWIPE_MAX = -rs(56);
  const swipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_e, g) => {
        const next = Math.max(SWIPE_MAX, Math.min(0, g.dx));
        swipeX.setValue(next);
      },
      onPanResponderRelease: () => {
        Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 6 }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 6 }).start();
      },
    })
  ).current;

  // NEW — tracks whether THIS message's file is currently downloading/saving
  const [downloading, setDownloading] = useState(false);

  // NEW — real first-frame thumbnail for video messages (falls back to the
  // solid-color placeholder while it's loading or if extraction fails)
  const [videoThumb, setVideoThumb] = useState<string | null>(null);
  useEffect(() => {
    if (msg.type !== 'video' || !msg.mediaUri) return;
    let cancelled = false;
    getVideoThumbnail(msg.mediaUri).then(t => { if (!cancelled) setVideoThumb(t); });
    return () => { cancelled = true; };
  }, [msg.type, msg.mediaUri]);

  // NEW — measures this bubble's on-screen position so the actions sheet can
  // open anchored right beside it instead of dead-centering over the screen
  const openActionsAnchored = () => {
    bubbleRef.current?.measureInWindow((x, y, width, height) => {
      onOpenActions(msg.id, { x, y, width, height });
    });
  };

  const handleLongPress = () => {
    Haptics.selectionAsync().catch(() => {});
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();
    openActionsAnchored();
  };

  // NEW — double-tap-to-heart shortcut (WhatsApp-style). A single tap still
  // performs the bubble's normal action (open reactions / preview image),
  // but if a second tap lands within the window it's treated as a heart react
  // instead, with a small pop animation and haptic feedback.
  const lastTapRef = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTap = (singleTapAction: () => void) => {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      if (singleTapTimer.current) { clearTimeout(singleTapTimer.current); singleTapTimer.current = null; }
      lastTapRef.current = 0;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onReact(msg.id, '❤️');
      heartAnim.setValue(0);
      Animated.sequence([
        Animated.spring(heartAnim, { toValue: 1, useNativeDriver: true, speed: 14 }),
        Animated.timing(heartAnim, { toValue: 0, duration: 250, delay: 250, useNativeDriver: true }),
      ]).start();
    } else {
      lastTapRef.current = now;
      singleTapTimer.current = setTimeout(() => { singleTapAction(); }, 280);
    }
  };

  const handleOpenDoc = () => {
    if (msg.mediaUri) Linking.openURL(msg.mediaUri).catch(() => {});
  };

  const handlePlayAudio = async () => {
    if (!msg.mediaUri) return;
    try {
      // Already loaded: toggle pause/resume instead of reloading.
      if (soundRef.current) {
        if (isPlaying) {
          soundRef.current.pause();
          setIsPlaying(false);
        } else {
          soundRef.current.play();
          setIsPlaying(true);
        }
        return;
      }
      const player = createAudioPlayer({ uri: msg.mediaUri });
      player.setPlaybackRate(playbackRate, 'high');
      soundRef.current = player;
      setIsPlaying(true);
      player.addListener('playbackStatusUpdate', status => {
        if (!status.isLoaded) return;
        audioDurationMsRef.current = status.duration * 1000;
        setPlaybackProgress(status.duration ? status.currentTime / status.duration : 0);
        if (status.didJustFinish) {
          setIsPlaying(false);
          setPlaybackProgress(0);
          player.remove();
          soundRef.current = null;
        }
      });
      player.play();
    } catch {
      setIsPlaying(false);
    }
  };

  // NEW — cycles 1x → 1.5x → 2x → 1x, applied live if a sound is loaded
  const cyclePlaybackRate = async () => {
    const rates = [1, 1.5, 2];
    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(next);
    Haptics.selectionAsync().catch(() => {});
    if (soundRef.current) {
      try { soundRef.current.setPlaybackRate(next, 'high'); } catch {}
    }
  };

  // NEW — drag-to-seek on the waveform; also supports a plain tap-to-seek
  const handleSeek = async (ratio: number) => {
    const clamped = Math.max(0, Math.min(1, ratio));
    setPlaybackProgress(clamped);
    if (soundRef.current && audioDurationMsRef.current > 0) {
      try { soundRef.current.seekTo(clamped * audioDurationMsRef.current / 1000); } catch {}
    }
  };
  const scrubResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 4,
      onPanResponderGrant: e => {
        if (waveformWidthRef.current > 0) handleSeek(e.nativeEvent.locationX / waveformWidthRef.current);
      },
      onPanResponderMove: e => {
        if (waveformWidthRef.current > 0) handleSeek(e.nativeEvent.locationX / waveformWidthRef.current);
      },
    })
  ).current;

  useEffect(() => {
    return () => {
      soundRef.current?.remove();
    };
  }, []);

  // NEW — WhatsApp-style save: images/videos go to the gallery,
  // documents/audio are handed to the OS share sheet ("Save to Files" etc.)
  const handleSaveToDevice = async () => {
    if (!msg.mediaUri || downloading) return;
    setDownloading(true);
    try {
      const extFromUrl = msg.mediaUri.split('?')[0].split('.').pop();
      const fallbackExt = msg.type === 'image' ? 'jpg'
        : msg.type === 'video' ? 'mp4'
        : msg.type === 'audio' ? 'm4a'
        : 'pdf';
      const fileName = msg.fileName || `diary_${msg.id}.${extFromUrl || fallbackExt}`;
      const localUri = FileSystem.documentDirectory + fileName;

      const { uri } = await FileSystem.downloadAsync(msg.mediaUri, localUri);

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri);
    } else {
      Alert.alert('Saved', `File saved: ${fileName}`);
    }
    } catch {
      Alert.alert('Download failed', 'Could not save this file. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  // NEW — grouping-aware corner radii: sharp top-left after the first bubble
  // in a burst, and a tail (instead of a rounded corner) only on the last one
  const groupCorners = {
    borderTopLeftRadius: isFirstInGroup ? rs(18) : rs(6),
    borderBottomLeftRadius: isLastInGroup ? rs(4) : rs(18),
  };

  const renderContent = () => {
    switch (msg.type) {
      case 'text': {
        const linkUrl = getUrlFromText(msg.text);
        return (
          <TouchableOpacity activeOpacity={0.85} onLongPress={handleLongPress} onPress={() => handleTap(openActionsAnchored)}>
            <View style={[mb.textBubble, groupCorners]}>
              <Text style={mb.msgText}>{msg.text}</Text>
              {!!linkUrl && <LinkPreviewCard url={linkUrl} />}
              {/* NEW — inline bottom-right meta (WhatsApp-style, inside the bubble) */}
              <View style={mb.metaInline}>
                {msg.isPinned && <PinIcon size={10} />}
                {msg.isStarred && <StarIcon filled size={10} />}
                <Text style={mb.timeInline}>{msg.timestamp}</Text>
              </View>
              {isLastInGroup && <BubbleTail color={C.bubble} />}
            </View>
          </TouchableOpacity>
        );
      }

      case 'image':
        return (
          <TouchableOpacity activeOpacity={0.85} onLongPress={handleLongPress} onPress={() => handleTap(() => onPreviewImage(msg))}>
            <View style={mb.tailAnchor}>
            <View style={[mb.mediaBubble, groupCorners]}>
              {/* NEW — double-tap heart burst overlay */}
              <Animated.View
                pointerEvents="none"
                style={[
                  mb.heartBurst,
                  {
                    opacity: heartAnim,
                    transform: [{ scale: heartAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.4] }) }],
                  },
                ]}
              >
                <Text style={mb.heartBurstText}>❤️</Text>
              </Animated.View>
              {msg.mediaUri ? (
                <Image source={{ uri: msg.mediaUri }} style={mb.mediaImg} resizeMode="cover" />
              ) : (
                <View style={[mb.mediaImg, mb.mediaPlaceholder]}>
                  <ImageIcon />
                  <Text style={mb.placeholderText}>Photo</Text>
                </View>
              )}
              <View style={mb.expandBadge}><ExpandIcon size={12} /></View>
              {/* NEW — save-to-gallery button, doesn't trigger the fullscreen preview */}
              <TouchableOpacity
                style={mb.downloadBadge}
                onPress={handleSaveToDevice}
                disabled={downloading}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {downloading ? <ActivityIndicator size="small" color={C.white} /> : <DownloadIcon />}
              </TouchableOpacity>
              {/* CHANGED — caption now lives as a gradient scrim directly over the
                  photo (WhatsApp-style) instead of a separate text row below it */}
              {msg.caption ? (
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.65)']} style={mb.captionScrim}>
                  <Text style={mb.captionOverlay} numberOfLines={2}>{msg.caption}</Text>
                </LinearGradient>
              ) : null}
              {/* NEW — corner meta pill (time + pin/star) overlaid on the image */}
              <View style={mb.mediaMetaPill}>
                {msg.isPinned && <PinIcon color={C.white} size={9} />}
                {msg.isStarred && <StarIcon filled color={C.white} size={9} />}
                <Text style={mb.mediaMetaTime}>{msg.timestamp}</Text>
              </View>
            </View>
            {isLastInGroup && <BubbleTail color={C.bubble} />}
            </View>
          </TouchableOpacity>
        );

      case 'audio':
        return (
          <View style={[mb.audioBubble, groupCorners]}>
            <TouchableOpacity activeOpacity={0.85} onLongPress={handleLongPress} onPress={handlePlayAudio} style={mb.audioPlayBtn}>
              {isPlaying ? <PauseIcon color={C.white} size={14} /> : <PlayIcon color={C.white} size={14} />}
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              {msg.text ? <Text style={mb.audioLabel} numberOfLines={1}>{msg.text}</Text> : null}
              {/* NEW — draggable scrub bar (tap or drag anywhere to seek) */}
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: rs(8), marginTop: rs(4) }}
                onLayout={e => { waveformWidthRef.current = e.nativeEvent.layout.width; }}
                {...scrubResponder.panHandlers}
              >
                <Waveform played={playbackProgress} seed={msg.id} />
                {msg.duration ? <Text style={mb.audioDur}>{msg.duration}</Text> : null}
              </View>
            </View>
            {/* NEW — 1x / 1.5x / 2x playback speed toggle */}
            <TouchableOpacity style={mb.speedBadge} onPress={cyclePlaybackRate} activeOpacity={0.75}>
              <Text style={mb.speedBadgeText}>{playbackRate}x</Text>
            </TouchableOpacity>
            {/* NEW — save the voice note as a file, separate from the play tap */}
            <TouchableOpacity
              style={mb.audioDownloadBtn}
              onPress={handleSaveToDevice}
              disabled={downloading}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {downloading ? <ActivityIndicator size="small" color={C.accent} /> : <DownloadIcon />}
            </TouchableOpacity>
            {isLastInGroup && <BubbleTail color={C.bubble} />}
          </View>
        );

      case 'video':
        return (
          <TouchableOpacity activeOpacity={0.85} onLongPress={handleLongPress} onPress={handleOpenDoc}>
            <View style={mb.tailAnchor}>
            <View style={[mb.mediaBubble, groupCorners]}>
              <View style={[mb.mediaImg, mb.videoThumb]}>
                {/* NEW — real extracted first frame when available */}
                {videoThumb ? (
                  <Image source={{ uri: videoThumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <ActivityIndicator color="rgba(255,255,255,0.85)" size="small" style={StyleSheet.absoluteFill} />
                )}
                <View style={mb.videoScrim} />
                <View style={mb.videoPlayCircle}><PlayIcon color={C.white} size={18} /></View>
                {msg.duration ? (
                  <View style={mb.videoDurBadge}><Text style={mb.videoDurText}>{msg.duration}</Text></View>
                ) : null}
                <View style={{ position: 'absolute', top: rs(10), left: rs(10) }}><VideoIcon size={16} /></View>
                {/* NEW — save-to-gallery button for video */}
                <TouchableOpacity
                  style={mb.downloadBadge}
                  onPress={handleSaveToDevice}
                  disabled={downloading}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {downloading ? <ActivityIndicator size="small" color={C.white} /> : <DownloadIcon />}
                </TouchableOpacity>
                {/* NEW — corner meta pill (time + pin/star) overlaid on the thumbnail */}
                <View style={mb.mediaMetaPill}>
                  {msg.isPinned && <PinIcon color={C.white} size={9} />}
                  {msg.isStarred && <StarIcon filled color={C.white} size={9} />}
                  <Text style={mb.mediaMetaTime}>{msg.timestamp}</Text>
                </View>
              </View>
              {msg.caption ? (
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.65)']} style={mb.captionScrim}>
                  <Text style={mb.captionOverlay} numberOfLines={2}>{msg.caption}</Text>
                </LinearGradient>
              ) : null}
            </View>
            {isLastInGroup && <BubbleTail color={C.bubble} />}
            </View>
          </TouchableOpacity>
        );

      case 'document':
        return (
          <TouchableOpacity activeOpacity={0.85} onLongPress={handleLongPress} onPress={handleOpenDoc}>
            <View style={[mb.docBubble, groupCorners]}>
              <View style={mb.docIconWrap}><DocIcon /></View>
              <View style={{ flex: 1, gap: rs(2) }}>
                <Text style={mb.docName} numberOfLines={2}>{msg.fileName ?? msg.text ?? 'Document'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs(4) }}>
                  <Text style={mb.docHint}>Tap to open · </Text>
                  {msg.isPinned && <PinIcon size={9} />}
                  {msg.isStarred && <StarIcon filled size={9} />}
                  <Text style={mb.docTime}>{msg.timestamp}</Text>
                </View>
              </View>
              {/* CHANGED — this button was decorative; now it actually saves the file */}
              <TouchableOpacity
                style={mb.docDownloadBtn}
                onPress={handleSaveToDevice}
                disabled={downloading}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {downloading ? <ActivityIndicator size="small" color={C.accent} /> : <DownloadIcon />}
              </TouchableOpacity>
              {isLastInGroup && <BubbleTail color={C.docBg} />}
            </View>
          </TouchableOpacity>
        );

      default:
        return null;
    }
  };

 return (
    <Animated.View style={[mb.row, !isLastInGroup && mb.rowGrouped, { transform: [{ scale: scaleAnim }] }]}>
      {/* CHANGED — this is a read-only, single-sender diary feed; the header
          already carries the teacher's identity, so a repeated avatar on every
          bubble is just noise. A slim left rail keeps bubble alignment intact
          without redrawing a circle per message. */}

      
      {/* NEW — swipe-left-to-reveal-timestamp wrapper. The timestamp sits behind
          the bubble at rest (opacity driven off the same Animated.Value) and is
          uncovered as the bubble slides left; releasing springs it back. */}
      <View style={mb.swipeContainer}>
        <Animated.Text
          style={[
            mb.swipeTimestamp,
            {
              opacity: swipeX.interpolate({ inputRange: [SWIPE_MAX, SWIPE_MAX * 0.3, 0], outputRange: [1, 0.4, 0] }),
            },
          ]}
        >
          {msg.timestamp}
        </Animated.Text>
        <Animated.View
          {...swipeResponder.panHandlers}
          style={[mb.bubbleWrap, isHighlighted && mb.bubbleWrapHighlighted, { transform: [{ translateX: swipeX }] }]}
          ref={bubbleRef as any}
          collapsable={false}
        >
          {renderContent()}
          <ReactionStrip
            reactions={msg.reactions}
            onReact={emoji => onReact(msg.id, emoji)}
            onLongPress={openActionsAnchored}
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
};

const mb = StyleSheet.create({
  row:             { flexDirection: 'row', gap: 0, alignItems: 'flex-end', marginBottom: rs(14) },
  // NEW — tighter gap between bubbles that belong to the same burst
  rowGrouped:      { marginBottom: rs(2) },
  avatar:          { width: rs(32), height: rs(32), borderRadius: rs(16), backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: rs(20) },
  // NEW — keeps grouped bubbles (no avatar) aligned under the ones that do have one
  avatarSpacer:    { width: rs(32)},
  avatarText:      { fontSize: fs(12), fontWeight: '700', color: C.white },
  bubbleWrap:      { maxWidth: '85%', flexShrink: 1 },
  // NEW — wraps image/video bubbles so the real tail can sit outside their
  // overflow:hidden clipping without being cut off
  tailAnchor:      { position: 'relative' },
  textBubble:      { backgroundColor: C.bubble, borderRadius: rs(18), borderBottomLeftRadius: rs(4), padding: rs(12), paddingHorizontal: rs(14), borderWidth: 0.8, borderColor: C.borderMid },
  msgText:         { fontSize: fs(13), color: C.dark, lineHeight: fs(20) },
  mediaBubble:     { backgroundColor: C.bubble, borderRadius: rs(18), borderBottomLeftRadius: rs(4), padding: rs(8), borderWidth: 0.8, borderColor: C.borderMid, overflow: 'hidden' },
  mediaImg:        { width: SCREEN_W * 0.62, height: SCREEN_W * 0.44, borderRadius: rs(12) },
  mediaPlaceholder:{ alignItems: 'center', justifyContent: 'center', gap: rs(6), backgroundColor: C.accentDark },
  placeholderText: { color: C.white, fontSize: fs(11), fontWeight: '600' },
  expandBadge:     { position: 'absolute', top: rs(16), right: rs(16), width: rs(24), height: rs(24), borderRadius: rs(12), backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  caption:         { fontSize: fs(12), color: C.dark, lineHeight: fs(18), padding: rs(6), paddingHorizontal: rs(8), paddingBottom: rs(4) },
  audioBubble:     { flexDirection: 'row', alignItems: 'center', gap: rs(10), backgroundColor: C.bubble, borderRadius: rs(18), borderBottomLeftRadius: rs(4), padding: rs(12), paddingHorizontal: rs(14), borderWidth: 0.8, borderColor: C.borderMid, minWidth: SCREEN_W * 0.55 },
  audioPlayBtn:    { width: rs(38), height: rs(38), borderRadius: rs(19), backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  audioLabel:      { fontSize: fs(11), color: C.muted, fontWeight: '500' },
  audioDur:        { fontSize: fs(11), color: C.mutedLight, fontWeight: '600', flexShrink: 0 },
  videoThumb:      { alignItems: 'center', justifyContent: 'center', backgroundColor: C.accentDark, overflow: 'hidden' },
  // NEW — faint dark wash over the real thumbnail so the white play icon/badges stay legible
  videoScrim:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.18)' },
  videoPlayCircle: { width: rs(48), height: rs(48), borderRadius: rs(24), backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  videoDurBadge:   { position: 'absolute', bottom: rs(8), right: rs(10), backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: rs(5), paddingHorizontal: rs(6), paddingVertical: rs(2) },
  videoDurText:    { fontSize: fs(10), color: C.white, fontWeight: '600' },
  // Document bubble
  docBubble:       { flexDirection: 'row', alignItems: 'center', gap: rs(10), backgroundColor: C.docBg, borderRadius: rs(14), borderBottomLeftRadius: rs(4), padding: rs(12), borderWidth: 0.8, borderColor: C.borderMid, minWidth: SCREEN_W * 0.55 },
  docIconWrap:     { width: rs(40), height: rs(40), borderRadius: rs(10), backgroundColor: C.accentLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  docName:         { fontSize: fs(12), color: C.dark, fontWeight: '600', lineHeight: fs(17) },
  docHint:         { fontSize: fs(10), color: C.muted },
  docDownloadBtn:  { width: rs(30), height: rs(30), borderRadius: rs(8), backgroundColor: C.accentLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  // NEW — inline bottom-right meta for text bubbles (sits inside the bubble)
  metaInline:      { flexDirection: 'row', alignItems: 'center', gap: rs(3), alignSelf: 'flex-end', marginTop: rs(4) },
  timeInline:      { fontSize: fs(9.5), color: C.mutedLight, fontWeight: '600' },
  // NEW — corner meta pill overlaid on photo/video thumbnails (WhatsApp-style)
  mediaMetaPill:   { position: 'absolute', bottom: rs(8), right: rs(8), flexDirection: 'row', alignItems: 'center', gap: rs(3), backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: rs(10), paddingHorizontal: rs(6), paddingVertical: rs(2) },
  mediaMetaTime:   { fontSize: fs(9.5), color: C.white, fontWeight: '600' },
  // NEW — gradient caption scrim laid directly over the image/video, not a
  // separate text row underneath it
  captionScrim:    { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: rs(10), paddingTop: rs(24), paddingBottom: rs(8) },
  captionOverlay:  { fontSize: fs(12), color: C.white, lineHeight: fs(17), fontWeight: '500' },
  // NEW — 1x/1.5x/2x playback-speed toggle on voice notes
  speedBadge:      { backgroundColor: C.accentLight, borderRadius: rs(10), paddingHorizontal: rs(7), paddingVertical: rs(3), marginLeft: rs(2) },
  speedBadgeText:  { fontSize: fs(10), color: C.accent, fontWeight: '700' },
  docTime:         { fontSize: fs(9.5), color: C.mutedLight, fontWeight: '600' },
  // NEW — swipe-to-reveal-timestamp wrapper + the timestamp label it uncovers
  swipeContainer:  { flex: 1, position: 'relative', alignItems: 'flex-start' },
  swipeTimestamp:  { position: 'absolute', right: rs(4), top: 0, bottom: 0, textAlignVertical: 'center', fontSize: fs(10.5), color: C.mutedLight, fontWeight: '600', paddingTop: rs(14) },
  // NEW — search-result highlight ring
  bubbleWrapHighlighted: { borderRadius: rs(20), borderWidth: 2, borderColor: C.amber, padding: rs(2) },
  // NEW — double-tap heart burst overlay (image bubbles)
  heartBurst:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  heartBurstText:  { fontSize: fs(52) },
  // FIXED — these two were previously (mis)declared in the main `s` StyleSheet
  // even though the JSX references them as `mb.downloadBadge` / `mb.audioDownloadBtn`,
  // so the save-icon buttons on photo/video/audio bubbles rendered unstyled.
  downloadBadge: {
    position: 'absolute',
    bottom: rs(8),
    left: rs(8),
    width: rs(26),
    height: rs(26),
    borderRadius: rs(13),
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioDownloadBtn: {
    width: rs(28),
    height: rs(28),
    borderRadius: rs(8),
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginLeft: rs(4),
  },
});

// ─── Emoji Picker Modal ───────────────────────────────────────────────────────
const EmojiPickerModal = ({
  visible, onClose, onSelectEmoji, currentEmojis,
}: { visible: boolean; onClose: () => void; onSelectEmoji: (emoji: string) => void; currentEmojis: string[] }) => {
  const slideAnim = useRef(new Animated.Value(400)).current;
  const opacAnim  = useRef(new Animated.Value(0)).current;
  const [activeTab, setActiveTab] = useState(0);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
        Animated.timing(opacAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 400, duration: 220, useNativeDriver: true }),
        Animated.timing(opacAnim,  { toValue: 0,   duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const COLS = 6;
  const CELL = (SCREEN_W - rs(32)) / COLS;

  return (
    <Modal transparent visible={visible} statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[ep.overlay, { opacity: opacAnim }]}>
        <TouchableWithoutFeedback onPress={onClose}><View style={StyleSheet.absoluteFill} /></TouchableWithoutFeedback>
        <Animated.View style={[ep.sheet, { transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom + rs(8) }]}>
          <View style={ep.handle} />
          <Text style={ep.title}>React to message</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ep.tabScroll} contentContainerStyle={ep.tabContent}>
            {EMOJI_CATEGORIES.map((cat, i) => (
              <TouchableOpacity key={i} style={[ep.tab, activeTab === i && ep.tabActive]} onPress={() => setActiveTab(i)} activeOpacity={0.75}>
                <Text style={ep.tabIcon}>{cat.icon}</Text>
                <Text style={[ep.tabLabel, activeTab === i && ep.tabLabelActive]}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={ep.grid}>
            {EMOJI_CATEGORIES[activeTab].emojis.map(em => {
              const selected = currentEmojis.includes(em);
              return (
                <TouchableOpacity key={em} style={[ep.emojiBtn, { width: CELL, height: CELL }, selected && ep.emojiBtnSelected]} onPress={() => onSelectEmoji(em)} activeOpacity={0.7}>
                  <Text style={ep.emoji}>{em}</Text>
                  {selected && <View style={ep.selectedDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};
const ep = StyleSheet.create({
  overlay:          { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:            { backgroundColor: C.white, borderTopLeftRadius: rs(24), borderTopRightRadius: rs(24), paddingTop: rs(10), paddingHorizontal: rs(16) },
  handle:           { width: rs(40), height: rs(4), backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: rs(2), alignSelf: 'center', marginBottom: rs(14) },
  title:            { fontSize: fs(13), fontWeight: '700', color: C.muted, textAlign: 'center', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: rs(12) },
  tabScroll:        { flexGrow: 0, marginBottom: rs(12) },
  tabContent:       { gap: rs(6), paddingHorizontal: rs(2) },
  tab:              { flexDirection: 'row', alignItems: 'center', gap: rs(5), paddingHorizontal: rs(12), paddingVertical: rs(7), borderRadius: rs(20), backgroundColor: C.bg },
  tabActive:        { backgroundColor: C.accentLight },
  tabIcon:          { fontSize: fs(14) },
  tabLabel:         { fontSize: fs(11), fontWeight: '600', color: C.muted },
  tabLabelActive:   { color: C.accent },
  grid:             { flexDirection: 'row', flexWrap: 'wrap' },
  emojiBtn:         { alignItems: 'center', justifyContent: 'center', borderRadius: rs(12) },
  emojiBtnSelected: { backgroundColor: C.accentLight },
  emoji:            { fontSize: fs(26) },
  selectedDot:      { position: 'absolute', bottom: rs(4), width: rs(4), height: rs(4), borderRadius: rs(2), backgroundColor: C.accent },
});

// ─── Image Preview Modal (tap-to-view, WhatsApp style) ───────────────────────
// NEW — supports prev/next navigation across all image messages in the chat,
// and a double-tap-to-zoom toggle (1x <-> 2.5x) using only Animated (no extra
// gesture library dependency).
const ImagePreviewModal = ({
  visible, uri, caption, fileName, onClose, onPrev, onNext, hasPrev, hasNext, counterLabel,
}: {
  visible: boolean;
  uri?: string;
  caption?: string;
  fileName?: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  counterLabel?: string;
}) => {
  const insets = useSafeAreaInsets();
  // CHANGED — full pinch-to-zoom + pan-while-zoomed, built on core RN's
  // PanResponder (no extra gesture-handler dependency). Double-tap-to-zoom is
  // preserved as a shortcut on top of the same scale/translate values.
  const zoomAnim = useRef(new Animated.Value(1)).current;
  const translateAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [zoomed, setZoomed] = useState(false);
  const lastTapRef = useRef(0);
  const currentScaleRef = useRef(1);
  const baseScaleRef = useRef(1);
  const pinchStartDistRef = useRef(0);
  const panStartRef = useRef({ x: 0, y: 0 });
  const lastTranslateRef = useRef({ x: 0, y: 0 });

  // Reset zoom/pan whenever the visible image changes
  useEffect(() => {
    zoomAnim.setValue(1);
    translateAnim.setValue({ x: 0, y: 0 });
    setZoomed(false);
    currentScaleRef.current = 1;
    lastTranslateRef.current = { x: 0, y: 0 };
  }, [uri]);

  const snapToScale = (target: number) => {
    currentScaleRef.current = target;
    setZoomed(target > 1.05);
    Animated.spring(zoomAnim, { toValue: target, useNativeDriver: true, speed: 12 }).start();
    if (target <= 1.05) {
      lastTranslateRef.current = { x: 0, y: 0 };
      Animated.spring(translateAnim, { toValue: { x: 0, y: 0 }, useNativeDriver: true, speed: 12 }).start();
    }
  };

  const handleDoubleTapZoom = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      snapToScale(currentScaleRef.current > 1.05 ? 1 : 2.4);
      Haptics.selectionAsync().catch(() => {});
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const getTouchDistance = (touches: any[]) => {
    const [a, b] = touches;
    return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
  };

  const imagePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
      onPanResponderGrant: e => {
        const touches = e.nativeEvent.touches;
        if (touches.length === 2) {
          pinchStartDistRef.current = getTouchDistance(touches);
          baseScaleRef.current = currentScaleRef.current;
        } else {
          panStartRef.current = { ...lastTranslateRef.current };
        }
      },
      onPanResponderMove: (e, g) => {
        const touches = e.nativeEvent.touches;
        if (touches.length === 2) {
          if (pinchStartDistRef.current > 0) {
            const nextScale = Math.max(1, Math.min(4, baseScaleRef.current * (getTouchDistance(touches) / pinchStartDistRef.current)));
            currentScaleRef.current = nextScale;
            zoomAnim.setValue(nextScale);
          }
        } else if (currentScaleRef.current > 1.05) {
          translateAnim.setValue({ x: panStartRef.current.x + g.dx, y: panStartRef.current.y + g.dy });
        }
      },
      onPanResponderRelease: (e, g) => {
        const moved = Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6;
        // A near-stationary single-finger touch is a tap — route to the
        // double-tap-zoom shortcut instead of treating it as a pan/pinch end.
        if (!moved && e.nativeEvent.changedTouches.length <= 1 && pinchStartDistRef.current === 0) {
          handleDoubleTapZoom();
          pinchStartDistRef.current = 0;
          return;
        }
        pinchStartDistRef.current = 0;
        if (currentScaleRef.current <= 1.05) {
          snapToScale(1);
        } else {
          setZoomed(true);
          lastTranslateRef.current = { x: panStartRef.current.x + g.dx, y: panStartRef.current.y + g.dy };
        }
      },
    })
  ).current;

  return (
    <Modal transparent visible={visible} statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={[iv.wrap, { paddingTop: insets.top + rs(10), paddingBottom: insets.bottom + rs(16) }]}>
        <View style={iv.topBar}>
          <TouchableOpacity style={iv.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <CloseIcon />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            {!!fileName && <Text style={iv.fileName} numberOfLines={1}>{fileName}</Text>}
            {!!counterLabel && <Text style={iv.counter}>{counterLabel}</Text>}
          </View>
          <TouchableOpacity
            style={iv.closeBtn}
            onPress={() => uri && Linking.openURL(uri).catch(() => {})}
            activeOpacity={0.8}
          >
            <DownloadIconWhite />
          </TouchableOpacity>
        </View>
        <View style={iv.imgWrap}>
          {/* NEW — previous-image arrow */}
          {!!hasPrev && !zoomed && (
            <TouchableOpacity style={[iv.navBtn, iv.navBtnLeft]} onPress={onPrev} hitSlop={{ top: 20, bottom: 20, left: 10, right: 10 }}>
              <View style={{ transform: [{ rotate: '90deg' }] }}><ChevronDownIcon color={C.white} size={20} /></View>
            </TouchableOpacity>
          )}
          <View
            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
            {...imagePanResponder.panHandlers}
          >
            {uri ? (
              <Animated.Image
                source={{ uri }}
                style={[
                  iv.img,
                  { transform: [{ scale: zoomAnim }, { translateX: translateAnim.x }, { translateY: translateAnim.y }] },
                ]}
                resizeMode="contain"
              />
            ) : (
              <ActivityIndicator color={C.white} size="large" />
            )}
          </View>
          {/* NEW — next-image arrow */}
          {!!hasNext && !zoomed && (
            <TouchableOpacity style={[iv.navBtn, iv.navBtnRight]} onPress={onNext} hitSlop={{ top: 20, bottom: 20, left: 10, right: 10 }}>
              <View style={{ transform: [{ rotate: '-90deg' }] }}><ChevronDownIcon color={C.white} size={20} /></View>
            </TouchableOpacity>
          )}
        </View>
        {!!caption && (
          <View style={iv.captionWrap}><Text style={iv.captionText}>{caption}</Text></View>
        )}
      </View>
    </Modal>
  );
};
const DownloadIconWhite = () => (
  <Svg width={rs(18)} height={rs(18)} viewBox="0 0 24 24" fill="none">
    <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke={C.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
const iv = StyleSheet.create({
  wrap:        { flex: 1, backgroundColor: '#000' },
  topBar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: rs(14), gap: rs(10) },
  closeBtn:    { width: rs(38), height: rs(38), borderRadius: rs(19), backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  fileName:    { color: C.white, fontSize: fs(13), fontWeight: '600', textAlign: 'center' },
  counter:     { color: 'rgba(255,255,255,0.6)', fontSize: fs(10.5), fontWeight: '600', marginTop: rs(1) },
  imgWrap:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  img:         { width: SCREEN_W, height: '100%' },
  captionWrap: { paddingHorizontal: rs(18), paddingTop: rs(10) },
  captionText: { color: C.white, fontSize: fs(13), textAlign: 'center' },
  // NEW — prev/next nav buttons
  navBtn:      { position: 'absolute', top: '50%', marginTop: -rs(20), width: rs(40), height: rs(40), borderRadius: rs(20), backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', zIndex: 6 },
  navBtnLeft:  { left: rs(10) },
  navBtnRight: { right: rs(10) },
});

// ─── Message Actions Modal (long-press: react + star + pin) ──────────────────
const QUICK_REACT = ['❤️', '👍', '😊', '🙏', '👏', '🎉'];

const MessageActionsModal = ({
  visible, msg, anchor, onClose, onReact, onMoreEmojis, onToggleStar, onTogglePin, pinDisabled, onCopyText,
}: {
  visible: boolean;
  msg: DiaryMessage | null;
  // NEW — the pressed bubble's on-screen rect, measured by MessageBubble
  anchor?: { x: number; y: number; width: number; height: number } | null;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onMoreEmojis: () => void;
  onToggleStar: () => void;
  onTogglePin: () => void;
  pinDisabled: boolean;
  onCopyText: () => void;
}) => {
  const insets = useSafeAreaInsets();
  if (!msg) return null;

  // NEW — position the sheet right beside the bubble that was pressed,
  // flipping above/below depending on available space, instead of always
  // dropping a dead-centered modal over the whole screen.
  const SHEET_WIDTH = Math.min(rs(300), SCREEN_W - rs(48));
  const ROW_H = rs(48);
  const rowCount = 2 + (msg.type === 'text' && !!msg.text ? 1 : 0); // star + pin (+ copy)
  const estHeight = rs(66) + rowCount * ROW_H + rs(16);

  let posStyle: { top: number; left: number } = {
    top: Math.max(insets.top + rs(60), (SCREEN_H - estHeight) / 2),
    left: (SCREEN_W - SHEET_WIDTH) / 2,
  };
  if (anchor) {
    const spaceBelow = SCREEN_H - insets.bottom - (anchor.y + anchor.height);
    const openBelow = spaceBelow > estHeight + rs(16);
    const top = openBelow
      ? Math.min(anchor.y + anchor.height + rs(8), SCREEN_H - estHeight - insets.bottom - rs(12))
      : Math.max(anchor.y - estHeight - rs(8), insets.top + rs(8));
    const left = Math.min(Math.max(anchor.x, rs(12)), SCREEN_W - SHEET_WIDTH - rs(12));
    posStyle = { top, left };
  }

  return (
    <Modal transparent visible={visible} statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={am.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={[am.sheet, { width: SHEET_WIDTH, top: posStyle.top, left: posStyle.left }]}>
              <View style={am.quickRow}>
                {QUICK_REACT.map(em => (
                  <TouchableOpacity key={em} style={am.quickBtn} onPress={() => onReact(em)} activeOpacity={0.7}>
                    <Text style={am.quickEmoji}>{em}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={am.quickBtn} onPress={onMoreEmojis} activeOpacity={0.7}>
                  <Text style={am.quickPlus}>＋</Text>
                </TouchableOpacity>
              </View>

              {msg.type === 'text' && !!msg.text && (
                <TouchableOpacity style={am.row} onPress={onCopyText} activeOpacity={0.7}>
                  <CopyIcon />
                  <Text style={am.rowText}>Copy text</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={am.row} onPress={onToggleStar} activeOpacity={0.7}>
                <StarIcon filled={!!msg.isStarred} />
                <Text style={am.rowText}>{msg.isStarred ? 'Remove star' : 'Star message'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[am.row, pinDisabled && !msg.isPinned && am.rowDisabled]}
                onPress={onTogglePin}
                activeOpacity={0.7}
                disabled={pinDisabled && !msg.isPinned}
              >
                <PinIcon color={pinDisabled && !msg.isPinned ? C.mutedLight : C.accent} />
                <Text style={[am.rowText, pinDisabled && !msg.isPinned && am.rowTextDisabled]}>
                  {msg.isPinned ? 'Unpin message' : `Pin message${pinDisabled ? ` (max ${MAX_PINS})` : ''}`}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
const am = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: C.overlay },
  // NEW — absolutely positioned instead of centered; top/left are computed
  // per-open from the pressed bubble's measured position
  sheet:     { position: 'absolute', backgroundColor: C.white, borderRadius: rs(18), paddingTop: rs(14), paddingBottom: rs(10), paddingHorizontal: rs(8), overflow: 'hidden', shadowColor: C.shadow, shadowOffset: { width: 0, height: rs(8) }, shadowOpacity: 0.25, shadowRadius: rs(20), elevation: 14 },
  quickRow:  { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: rs(8), paddingBottom: rs(12), borderBottomWidth: 0.8, borderBottomColor: C.border, marginBottom: rs(4) },
  quickBtn:  { width: rs(38), height: rs(38), alignItems: 'center', justifyContent: 'center' },
  quickEmoji:{ fontSize: fs(24) },
  quickPlus: { fontSize: fs(20), color: C.muted, fontWeight: '600' },
  row:       { flexDirection: 'row', alignItems: 'center', gap: rs(12), paddingHorizontal: rs(14), paddingVertical: rs(13) },
  rowDisabled: { opacity: 0.5 },
  rowText:   { fontSize: fs(13.5), color: C.dark, fontWeight: '600' },
  rowTextDisabled: { color: C.mutedLight },
});

// ─── Header Overflow Menu (Gallery / Starred / Mute, in one clean dropdown) ──
const HeaderMenu = ({
  visible, onClose, onGallery, onStarred, onToggleMute, muted, insetsTop,
}: {
  visible: boolean;
  onClose: () => void;
  onGallery: () => void;
  onStarred: () => void;
  onToggleMute: () => void;
  muted: boolean;
  insetsTop: number;
}) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: visible ? 1 : 0, useNativeDriver: true, speed: 22, bounciness: 6 }).start();
  }, [visible]);
  if (!visible) return null;
  return (
    <Modal transparent visible={visible} statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[
              hm.card,
              {
                top: insetsTop + rs(56),
                opacity: anim,
                transform: [
                  { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                  { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
                ],
              },
            ]}
          >
            <TouchableWithoutFeedback>
              <View>
                <TouchableOpacity style={hm.row} onPress={onGallery} activeOpacity={0.7}>
                  <View style={hm.rowIcon}><ImageIcon color={C.accent} size={16} /></View>
                  <Text style={hm.rowText}>Shared media</Text>
                </TouchableOpacity>
                <TouchableOpacity style={hm.row} onPress={onStarred} activeOpacity={0.7}>
                  <View style={hm.rowIcon}><StarIcon color={C.accent} size={16} /></View>
                  <Text style={hm.rowText}>Starred messages</Text>
                </TouchableOpacity>
                <TouchableOpacity style={hm.row} onPress={onToggleMute} activeOpacity={0.7}>
                  <View style={hm.rowIcon}><MuteIcon muted={muted} color={C.accent} size={16} /></View>
                  <Text style={hm.rowText}>{muted ? 'Unmute notifications' : 'Mute notifications'}</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
const hm = StyleSheet.create({
  card:     { position: 'absolute', right: rs(14), backgroundColor: C.white, borderRadius: rs(16), paddingVertical: rs(6), minWidth: rs(200), shadowColor: C.shadow, shadowOffset: { width: 0, height: rs(8) }, shadowOpacity: 0.22, shadowRadius: rs(20), elevation: 12 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: rs(11), paddingHorizontal: rs(14), paddingVertical: rs(11) },
  rowIcon:  { width: rs(28), height: rs(28), borderRadius: rs(9), backgroundColor: C.accentLight, alignItems: 'center', justifyContent: 'center' },
  rowText:  { fontSize: fs(13), color: C.dark, fontWeight: '600' },
});

const MediaGalleryModal = ({
  visible, messages, onClose, onOpenImage,
}: { visible: boolean; messages: DiaryMessage[]; onClose: () => void; onOpenImage: (msg: DiaryMessage) => void }) => {
  const insets = useSafeAreaInsets();
  const media = messages.filter(m => m.type !== 'text' && m.mediaUri);
  const numCols = 3;
  const tileSize = (SCREEN_W - rs(2) * (numCols + 1)) / numCols;

  // NEW — WhatsApp-style multi-select: long-press (or tap the Select button)
  // to enter select mode, tap tiles to toggle checkmarks, then bulk-save.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  useEffect(() => { if (!visible) { setSelectMode(false); setSelectedIds(new Set()); } }, [visible]);

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const enterSelectMode = (firstId?: string) => {
    setSelectMode(true);
    Haptics.selectionAsync().catch(() => {});
    if (firstId) setSelectedIds(new Set([firstId]));
  };

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };

  const handleBulkSave = async () => {
    if (selectedIds.size === 0 || bulkSaving) return;
    setBulkSaving(true);
    try {
      const items = media.filter(m => selectedIds.has(m.id) && m.mediaUri);
      const localUris: string[] = [];
      for (const item of items) {
        try {
          const extFromUrl = item.mediaUri!.split('?')[0].split('.').pop();
          const fallbackExt = item.type === 'image' ? 'jpg' : item.type === 'video' ? 'mp4' : 'bin';
          const fileName = item.fileName || `diary_${item.id}.${extFromUrl || fallbackExt}`;
          const localUri = FileSystem.documentDirectory + fileName;
          const { uri } = await FileSystem.downloadAsync(item.mediaUri!, localUri);
          localUris.push(uri);
        } catch {}
      }
      const canShare = await Sharing.isAvailableAsync();
      if (canShare && localUris.length > 0) {
        // Share sheet only accepts one URI at a time on most platforms —
        // hand them off sequentially so each can be saved to the gallery/files.
        for (const uri of localUris) { await Sharing.shareAsync(uri); }
      } else {
        Alert.alert('Saved', `${localUris.length} of ${items.length} item(s) saved.`);
      }
    } catch {
      Alert.alert('Save failed', 'Could not save the selected items.');
    } finally {
      setBulkSaving(false);
      exitSelectMode();
    }
  };

  return (
    <Modal transparent visible={visible} statusBarTranslucent animationType="slide" onRequestClose={onClose}>
      <View style={sl.wrap}>
        <StatusBar barStyle="light-content" backgroundColor={C.accent} />
        <LinearGradient
          colors={[C.accentMid, C.accent, C.accentDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[sl.header, { paddingTop: insets.top + rs(10) }]}
        >
          <TouchableOpacity onPress={selectMode ? exitSelectMode : onClose} style={sl.backBtn} activeOpacity={0.8}>
            {selectMode ? <CloseIcon size={18} /> : <BackIcon />}
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={sl.headerTitle}>{selectMode ? `${selectedIds.size} selected` : 'Shared Media'}</Text>
            {!selectMode && <Text style={sl.headerSubtitle}>{media.length} {media.length === 1 ? 'item' : 'items'}</Text>}
          </View>
          {/* NEW — enter/exit select mode from the header */}
          {media.length > 0 && !selectMode && (
            <TouchableOpacity onPress={() => enterSelectMode()} style={gm.selectBtn} activeOpacity={0.8}>
              <Text style={gm.selectBtnText}>Select</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>
        {media.length === 0 ? (
          <View style={sl.empty}>
            <ImageIcon color={C.mutedLight} size={36} />
            <Text style={sl.emptyText}>No media shared yet</Text>
          </View>
        ) : (
          <FlatList
            data={media}
            numColumns={numCols}
            keyExtractor={m => m.id}
            contentContainerStyle={{ padding: rs(2), paddingBottom: selectMode ? rs(80) : rs(2) }}
            renderItem={({ item }) => {
              const isSelected = selectedIds.has(item.id);
              return (
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={{ width: tileSize, height: tileSize, margin: rs(1) }}
                  onLongPress={() => !selectMode && enterSelectMode(item.id)}
                  onPress={() => {
                    if (selectMode) { toggleSelected(item.id); return; }
                    item.type === 'document' ? Linking.openURL(item.mediaUri!) : onOpenImage(item);
                  }}
                >
                  {item.type === 'image' || item.type === 'video' ? (
                    <Image source={{ uri: item.mediaUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <View style={{ flex: 1, backgroundColor: C.docBg, alignItems: 'center', justifyContent: 'center' }}>
                      <DocIcon />
                    </View>
                  )}
                  {item.type === 'video' && (
                    <View style={{ position: 'absolute', top: rs(4), right: rs(4) }}><PlayIcon size={14} /></View>
                  )}
                  {/* NEW — selection checkbox overlay + dim wash when selected */}
                  {selectMode && (
                    <>
                      {isSelected && <View style={gm.selectedWash} />}
                      <View style={[gm.checkbox, isSelected && gm.checkboxChecked]}>
                        {isSelected && <CheckIcon />}
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        )}
        {/* NEW — bulk save bar */}
        {selectMode && (
          <View style={[gm.bottomBar, { paddingBottom: insets.bottom + rs(10) }]}>
            <TouchableOpacity
              style={[gm.saveBtn, selectedIds.size === 0 && gm.saveBtnDisabled]}
              onPress={handleBulkSave}
              disabled={selectedIds.size === 0 || bulkSaving}
              activeOpacity={0.85}
            >
              {bulkSaving ? (
                <ActivityIndicator size="small" color={C.white} />
              ) : (
                <>
                  <DownloadIcon color={C.white} />
                  <Text style={gm.saveBtnText}>Save {selectedIds.size > 0 ? selectedIds.size : ''}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};
const CheckIcon = ({ color = C.white, size = 16 }: { color?: string; size?: number }) => (
  <Svg width={rs(size)} height={rs(size)} viewBox="0 0 24 24" fill="none">
    <Path d="M4 12l6 6L20 6" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
const gm = StyleSheet.create({
  selectBtn:      { paddingHorizontal: rs(12), paddingVertical: rs(7), borderRadius: rs(14), backgroundColor: 'rgba(255,255,255,0.16)' },
  selectBtnText:  { color: C.white, fontSize: fs(12), fontWeight: '700' },
  selectedWash:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(14,126,164,0.35)' },
  checkbox:       { position: 'absolute', top: rs(6), right: rs(6), width: rs(20), height: rs(20), borderRadius: rs(10), borderWidth: 2, borderColor: C.white, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked:{ backgroundColor: C.accent, borderColor: C.accent },
  bottomBar:      { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.white, paddingTop: rs(10), paddingHorizontal: rs(16), borderTopWidth: 0.8, borderTopColor: C.border },
  saveBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs(8), backgroundColor: C.accent, borderRadius: rs(14), paddingVertical: rs(12) },
  saveBtnDisabled:{ backgroundColor: C.mutedLight },
  saveBtnText:    { color: C.white, fontSize: fs(13), fontWeight: '700' },
});

// ─── Starred Messages List Modal ──────────────────────────────────────────────
const StarredListModal = ({
  visible, messages, onClose,
}: { visible: boolean; messages: DiaryMessage[]; onClose: () => void }) => {
  const insets = useSafeAreaInsets();
  const starred = messages.filter(m => m.isStarred);
  return (
    <Modal transparent visible={visible} statusBarTranslucent animationType="slide" onRequestClose={onClose}>
      <View style={sl.wrap}>
        <StatusBar barStyle="light-content" backgroundColor={C.accent} />
        <LinearGradient
          colors={[C.accentMid, C.accent, C.accentDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[sl.header, { paddingTop: insets.top + rs(10) }]}
        >
          <TouchableOpacity onPress={onClose} style={sl.backBtn} activeOpacity={0.8}>
            <BackIcon />
          </TouchableOpacity>
          <View>
            <Text style={sl.headerTitle}>Starred Messages</Text>
            <Text style={sl.headerSubtitle}>{starred.length} {starred.length === 1 ? 'message' : 'messages'}</Text>
          </View>
        </LinearGradient>
        <ScrollView contentContainerStyle={sl.content}>
          {starred.length === 0 ? (
            <View style={sl.empty}>
              <StarIcon color={C.mutedLight} size={36} />
              <Text style={sl.emptyText}>No starred messages yet</Text>
              <Text style={sl.emptySub}>Long-press any message and tap "Star message" to save it here.</Text>
            </View>
          ) : (
            starred.map(m => (
              <View key={m.id} style={sl.item}>
                <StarIcon size={14} />
                <View style={{ flex: 1 }}>
                  <Text style={sl.itemText} numberOfLines={2}>
                    {m.type === 'text' ? (m.text || '—') :
                     m.type === 'image' ? '📷 Photo' :
                     m.type === 'video' ? '🎬 Video' :
                     m.type === 'audio' ? '🎙️ Voice message' :
                     `📄 ${m.fileName ?? 'Document'}`}
                  </Text>
                  <Text style={sl.itemTime}>{m.timestamp}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};
const sl = StyleSheet.create({
  wrap:       { flex: 1, backgroundColor: C.bg },
  header:     { flexDirection: 'row', alignItems: 'center', gap: rs(12), paddingHorizontal: rs(14), paddingBottom: rs(15), shadowColor: C.shadow, shadowOffset: { width: 0, height: rs(4) }, shadowOpacity: 0.28, shadowRadius: rs(14), elevation: 8 },
  backBtn:    { width: rs(36), height: rs(36), borderRadius: rs(18), backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder, alignItems: 'center', justifyContent: 'center' },
  headerTitle:{ color: C.white, fontSize: fs(15.5), fontWeight: '700', letterSpacing: -0.2 },
  headerSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: fs(11), fontWeight: '600', marginTop: rs(1) },
  content:    { padding: rs(14), gap: rs(10) },
  empty:      { alignItems: 'center', paddingTop: rs(60), paddingHorizontal: rs(30), gap: rs(8) },
  emptyText:  { fontSize: fs(14), fontWeight: '700', color: C.dark },
  emptySub:   { fontSize: fs(12), color: C.muted, textAlign: 'center', lineHeight: fs(18) },
  item:       { flexDirection: 'row', gap: rs(10), backgroundColor: C.white, borderRadius: rs(14), padding: rs(12), borderWidth: 0.8, borderColor: C.border, alignItems: 'flex-start' },
  itemText:   { fontSize: fs(13), color: C.dark, fontWeight: '500' },
  itemTime:   { fontSize: fs(10), color: C.mutedLight, marginTop: rs(4) },
});

// ─── Pinned Message Banner ────────────────────────────────────────────────────
const PinnedBanner = ({
  pinned, activeIndex, onPress, onUnpin,
}: { pinned: DiaryMessage[]; activeIndex: number; onPress: () => void; onUnpin: () => void }) => {
  if (pinned.length === 0) return null;
  const m = pinned[activeIndex] ?? pinned[0];
  const label = m.type === 'text' ? (m.text || '—') :
    m.type === 'image' ? '📷 Photo' :
    m.type === 'video' ? '🎬 Video' :
    m.type === 'audio' ? '🎙️ Voice message' :
    `📄 ${m.fileName ?? 'Document'}`;
  return (
    <TouchableOpacity style={pb.wrap} onPress={onPress} activeOpacity={0.85}>
      <PinIcon size={14} />
      <View style={{ flex: 1 }}>
        {pinned.length > 1 && <Text style={pb.count}>Pinned message {activeIndex + 1} of {pinned.length}</Text>}
        <Text style={pb.text} numberOfLines={1}>{label}</Text>
      </View>
      <TouchableOpacity onPress={onUnpin} style={pb.unpinBtn} activeOpacity={0.8}>
        <CloseIcon color={C.muted} size={14} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};
const pb = StyleSheet.create({
  wrap:     { flexDirection: 'row', alignItems: 'center', gap: rs(10), backgroundColor: C.accentLight, paddingHorizontal: rs(14), paddingVertical: rs(9), borderBottomWidth: 0.8, borderBottomColor: C.border },
  count:    { fontSize: fs(9.5), color: C.accent, fontWeight: '700', marginBottom: rs(1) },
  text:     { fontSize: fs(12), color: C.dark, fontWeight: '600' },
  unpinBtn: { padding: rs(4) },
});

// ─── Date Separator ───────────────────────────────────────────────────────────
const DateSeparator = ({ label }: { label: string }) => (
  <View style={ds.wrap}>
    <View style={ds.line} />
    <View style={ds.pill}><Text style={ds.text}>{label}</Text></View>
    <View style={ds.line} />
  </View>
);
const ds = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', marginVertical: rs(10), paddingHorizontal: rs(16) },
  line: { flex: 1, height: 0.8, backgroundColor: C.border },
  pill: { backgroundColor: C.datePill, borderRadius: rs(20), paddingHorizontal: rs(12), paddingVertical: rs(4), marginHorizontal: rs(10) },
  text: { fontSize: fs(10), fontWeight: '600', color: C.accent, letterSpacing: 0.4 },
});

// ─── Unread Divider (WhatsApp-style "N unread messages" strip) ───────────────
const UnreadDivider = () => (
  <View style={ud.wrap}>
    <View style={ud.line} />
    <Text style={ud.text}>Unread messages</Text>
    <View style={ud.line} />
  </View>
);
const ud = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', marginVertical: rs(10), paddingHorizontal: rs(16) },
  line: { flex: 1, height: 0.8, backgroundColor: 'rgba(201,122,58,0.35)' },
  text: { fontSize: fs(10), fontWeight: '700', color: C.amber, letterSpacing: 0.4, marginHorizontal: rs(10), textTransform: 'uppercase' },
});

// ─── Typing Indicator ─────────────────────────────────────────────────────────
const TypingIndicator = ({ initials }: { initials: string }) => {
  const anim = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const loop = () => {
      Animated.stagger(150, anim.map(a =>
        Animated.sequence([
          Animated.timing(a, { toValue: -rs(5), duration: 300, useNativeDriver: true }),
          Animated.timing(a, { toValue: 0,      duration: 300, useNativeDriver: true }),
        ])
      )).start(loop);
    };
    loop();
    return () => anim.forEach(a => a.stopAnimation());
  }, []);
  return (
    <View style={ti.row}>
      <View style={ti.avatar}><Text style={ti.avatarT}>{initials || '?'}</Text></View>
      <View style={ti.bubble}>
        {anim.map((a, i) => <Animated.View key={i} style={[ti.dot, { transform: [{ translateY: a }] }]} />)}
      </View>
    </View>
  );
};
const ti = StyleSheet.create({
  row:    { flexDirection: 'row', gap: rs(8), alignItems: 'flex-end', marginBottom: rs(10) },
  avatar: { width: rs(32), height: rs(32), borderRadius: rs(16), backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  avatarT:{ fontSize: fs(12), fontWeight: '700', color: C.white },
  bubble: { flexDirection: 'row', gap: rs(5), backgroundColor: C.white, borderRadius: rs(18), borderBottomLeftRadius: rs(4), paddingHorizontal: rs(14), paddingVertical: rs(14), borderWidth: 0.8, borderColor: C.border, alignItems: 'center' },
  dot:    { width: rs(7), height: rs(7), borderRadius: rs(4), backgroundColor: C.mutedLight },
});

// ─── New Message Toast ────────────────────────────────────────────────────────
const NewMessageToast = ({
  visible, onPress, label,
}: { visible: boolean; onPress: () => void; label?: string }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: visible ? 1 : 0, tension: 70, friction: 10, useNativeDriver: true }).start();
  }, [visible]);
  return (
    <Animated.View style={[toast.wrap, { opacity: anim, transform: [{ scale: anim }] }]} pointerEvents={visible ? 'auto' : 'none'}>
      <TouchableOpacity style={toast.pill} onPress={onPress} activeOpacity={0.85}>
        {/* NEW — plain toasts (e.g. "Copied") skip the chevron icon */}
        {!label && <ChevronDownIcon />}
        <Text style={toast.text}>{label ?? 'New message'}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};
const toast = StyleSheet.create({
  wrap: { position: 'absolute', bottom: rs(80), alignSelf: 'center', zIndex: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: rs(5), backgroundColor: C.accent, borderRadius: rs(20), paddingHorizontal: rs(16), paddingVertical: rs(8), shadowColor: C.accentDark, shadowOffset: { width: 0, height: rs(3) }, shadowOpacity: 0.3, shadowRadius: rs(6), elevation: 6 },
  text: { fontSize: fs(12), color: C.white, fontWeight: '700' },
});

// ─── Skeleton Loader (shimmer placeholder while diary loads) ─────────────────
const SkeletonRow = ({ wide = false, mine = false }: { wide?: boolean; mine?: boolean }) => {
  const shimmer = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={[sk.row, mine && { justifyContent: 'flex-end' }]}>
      {!mine && <View style={sk.avatar} />}
      <Animated.View style={[sk.bubble, { width: wide ? SCREEN_W * 0.55 : SCREEN_W * 0.38, opacity: shimmer }]} />
    </View>
  );
};
const SkeletonLoader = () => (
  <View style={sk.wrap}>
    <SkeletonRow />
    <SkeletonRow wide />
    <SkeletonRow />
    <SkeletonRow wide />
    <SkeletonRow />
  </View>
);
const sk = StyleSheet.create({
  wrap:   { paddingHorizontal: rs(12), paddingTop: rs(14) },
  row:    { flexDirection: 'row', alignItems: 'flex-end', gap: rs(8), marginBottom: rs(16) },
  avatar: { width: rs(32), height: rs(32), borderRadius: rs(16), backgroundColor: C.border },
  bubble: { height: rs(46), borderRadius: rs(18), backgroundColor: C.border },
});

// ─── Stats Strip (client-side entry-type counts) ──────────────────────────────
const StatsStrip = ({ messages }: { messages: DiaryMessage[] }) => {
  const counts = {
    photo: messages.filter(m => m.type === 'image').length,
    video: messages.filter(m => m.type === 'video').length,
    audio: messages.filter(m => m.type === 'audio').length,
    doc:   messages.filter(m => m.type === 'document').length,
  };
  // CHANGED — icon + count instead of emoji-in-a-pill; muted ink on a flat
  // neutral chip reads as a data summary, not a sticker row
  const chips = [
    counts.photo ? { Icon: ImageIcon, count: counts.photo } : null,
    counts.video ? { Icon: VideoIcon, count: counts.video } : null,
    counts.audio ? { Icon: MicIcon,   count: counts.audio } : null,
    counts.doc   ? { Icon: DocIcon,   count: counts.doc }   : null,
  ].filter(Boolean) as { Icon: any; count: number }[];
  if (chips.length === 0) return null;
  return (
    <View style={st.wrap}>
      {chips.map(({ Icon, count }, i) => (
        <View key={i} style={st.chip}>
          <Icon color={C.muted} size={12} />
          <Text style={st.chipText}>{count}</Text>
        </View>
      ))}
    </View>
  );
};
const st = StyleSheet.create({
  wrap:     { flexDirection: 'row', gap: rs(8), paddingHorizontal: rs(14), paddingTop: rs(8), paddingBottom: rs(2), flexWrap: 'wrap' },
  chip:     { flexDirection: 'row', alignItems: 'center', gap: rs(4), backgroundColor: C.bg, borderRadius: rs(8), paddingHorizontal: rs(9), paddingVertical: rs(5) },
  chipText: { fontSize: fs(11), color: C.muted, fontWeight: '700' },
});

// ─── Online Pulse — soft breathing status dot (replaces the flat online dot) ──
const OnlinePulse = () => {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={op.wrap}>
      <Animated.View
        style={[
          op.ring,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
          },
        ]}
      />
      <View style={op.dot} />
    </View>
  );
};
const op = StyleSheet.create({
  wrap: { position: 'absolute', bottom: 0, right: 0, width: rs(12), height: rs(12), alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: rs(12), height: rs(12), borderRadius: rs(6), backgroundColor: C.success },
  dot:  { width: rs(10), height: rs(10), borderRadius: rs(5), backgroundColor: C.success, borderWidth: 1.5, borderColor: C.white },
});

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = () => (
  <View style={em.wrap}>
    <Text style={em.icon}>📖</Text>
    <Text style={em.title}>No entries yet today</Text>
    <Text style={em.sub}>Your class teacher hasn't posted anything yet. Check back soon!</Text>
  </View>
);
const em = StyleSheet.create({
  wrap:  { alignItems: 'center', paddingTop: rs(60), paddingHorizontal: rs(32) },
  icon:  { fontSize: fs(40), marginBottom: rs(12) },
  title: { fontSize: fs(15), fontWeight: '700', color: C.dark, marginBottom: rs(6) },
  sub:   { fontSize: fs(12), color: C.muted, textAlign: 'center', lineHeight: fs(18) },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const DiaryScreen = ({ route, navigation }: any) => {
  const insets   = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const isAtBottomRef = useRef(true);

  // ── State ──
  const [teacherInfo, setTeacherInfo]     = useState<TeacherInfo | null>(null);
  const [messages, setMessages]           = useState<DiaryMessage[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [showNewToast, setShowNewToast]   = useState(false);
  const [previewMsg, setPreviewMsg]       = useState<DiaryMessage | null>(null);
  const [starredListVisible, setStarredListVisible] = useState(false);
  const [pinnedActiveIdx, setPinnedActiveIdx] = useState(0);
  const [galleryVisible, setGalleryVisible] = useState(false);
  // NEW — in-chat search
  const [searchVisible, setSearchVisible]     = useState(false);
  const [searchQuery, setSearchQuery]         = useState('');
  const [searchResultIds, setSearchResultIds] = useState<string[]>([]);
  const [searchResultIdx, setSearchResultIdx] = useState(0);
  // NEW — mute-this-chat (local, gates the push notification call below)
  const [muted, setMuted] = useState(false);
  // NEW — small "Copied" confirmation toast
  const [copyToastVisible, setCopyToastVisible] = useState(false);
  // NEW — header overflow menu (gallery / starred / mute)
  const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
  // NEW — WhatsApp-style "unread messages" divider + one-time scroll-to-it
  const [unreadDividerId, setUnreadDividerId] = useState<string | null>(null);
  const [unreadResolved, setUnreadResolved] = useState(false);
  const initialScrollDoneRef = useRef(false);

  const roomIdRef      = useRef<number | null>(null);
  const reactionsRef   = useRef<Map<string, Reaction[]>>(new Map());
  const starredRef     = useRef<Set<string>>(new Set());
  const pinnedRef      = useRef<Set<string>>(new Set());
  const prevCountRef   = useRef<number>(0);
  const teacherInfoRef = useRef<TeacherInfo | null>(null);
  const messagePositionsRef = useRef<Map<string, number>>(new Map()); // NEW — for search jump-to
  const mutedRef = useRef(false); // NEW — read inside the poll loop, kept in sync with `muted` state

  // ── Apply locally-persisted star/pin/reaction state onto fetched messages ──
  const applyLocalState = useCallback((list: DiaryMessage[]): DiaryMessage[] => {
    return list.map(m => {
      const savedReactions = reactionsRef.current.get(m.id);
      return {
        ...m,
        reactions: savedReactions ?? m.reactions,
        isStarred: starredRef.current.has(m.id),
        isPinned:  pinnedRef.current.has(m.id),
      };
    });
  }, []);

  // ── Load diary ──
  const loadDiary = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      setError(null);

      const session = await getAuthSession();
      if (!session) throw new Error('Session expired — please log in again.');
      const { token, studentId, institutionId } = session;

      // Resolve teacher info + room once, cache it
     if (!roomIdRef.current || !teacherInfoRef.current) {
      const info = await resolveTeacherInfo(studentId, institutionId, token);
      if (!info) throw new Error("Could not find your class teacher's diary room.");
      roomIdRef.current      = info.roomId;
      teacherInfoRef.current = info;
      setTeacherInfo(info);

      const [savedStars, savedPins, cached, savedMuted] = await Promise.all([
        loadIdSet(starKey(info.roomId)),
        loadIdSet(pinKey(info.roomId)),
        loadCachedMessages(info.roomId),
        loadMuted(info.roomId),
      ]);
      starredRef.current = savedStars;
      pinnedRef.current  = savedPins;
      mutedRef.current   = savedMuted;
      setMuted(savedMuted);

      // Paint cached messages instantly so the screen is never blank on load
      if (cached.length > 0) {
        setMessages(applyLocalState(cached));
        setLoading(false);
        prevCountRef.current = cached.length;
      }
    }

    const fetched = await fetchDiaryMessages(roomIdRef.current, token);
    saveCachedMessages(roomIdRef.current, fetched);
      const withLocalState = applyLocalState(fetched);

      // NEW — WhatsApp-style unread divider: on the very first load, compare
      // against the last-seen timestamp from a previous visit to find where
      // "new since you left" begins, then bump last-seen forward so it isn't
      // shown again until genuinely new messages arrive after this session.
      if (isInitial && roomIdRef.current) {
        const lastSeenIso = await loadLastSeen(roomIdRef.current);
        if (lastSeenIso) {
          const lastSeenMs = new Date(lastSeenIso).getTime();
          const idx = withLocalState.findIndex(m => new Date(m.isoTimestamp).getTime() > lastSeenMs);
          if (idx > 0) setUnreadDividerId(withLocalState[idx].id);
        }
        setUnreadResolved(true);
        const latestIso = withLocalState[withLocalState.length - 1]?.isoTimestamp;
        if (latestIso) saveLastSeen(roomIdRef.current, latestIso);
      }

      // New message toast: if not at bottom and new messages arrived
      const newCount = withLocalState.length - prevCountRef.current;
      if (!isInitial && newCount > 0) {
        if (!isAtBottomRef.current) setShowNewToast(true);

        const latest = withLocalState[withLocalState.length - 1];
        const bodyPreview =
          latest.type === 'text' ? (latest.text || 'New message') :
          latest.type === 'image' ? '📷 Sent a photo' :
          latest.type === 'video' ? '🎬 Sent a video' :
          latest.type === 'audio' ? '🎙️ Sent a voice message' :
          `📄 Sent ${latest.fileName ?? 'a document'}`;

        if (!mutedRef.current) {
          Notifications.scheduleNotificationAsync({
            content: {
              title: teacherInfoRef.current?.name ?? 'Class Diary',
              body: newCount > 1 ? `${newCount} new updates` : bodyPreview,
            },
            trigger: null, // fire immediately
          }).catch(() => {});
        }
      }
      prevCountRef.current = withLocalState.length;
      setMessages(withLocalState);
    } catch (e: any) {
      console.warn('loadDiary error:', e);
      if (isInitial) setUnreadResolved(true);
      if (isInitial && roomIdRef.current) {
        const cached = await loadCachedMessages(roomIdRef.current);
        if (cached.length > 0) {
          setMessages(applyLocalState(cached));
          setError('Showing saved messages — you appear to be offline.');
        } else {
          setError(e?.message ?? 'Could not load the diary right now.');
        }
      } else {
        setError(e?.message ?? 'Could not load the diary right now.');
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [applyLocalState]);

 useEffect(() => {
  Notifications.requestPermissionsAsync().catch(() => {});
  loadDiary(true);
  const interval = setInterval(() => loadDiary(false), POLL_MS);
  return () => clearInterval(interval);
}, [loadDiary]);


  // ── Scroll tracking ──
  const handleScroll = useCallback((e: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    isAtBottomRef.current = distFromBottom < 60;
    if (isAtBottomRef.current) setShowNewToast(false);
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    setShowNewToast(false);
  };

  // ── Actions modal (react / star / pin) ──
  const openActions  = useCallback((msgId: string) => { setActiveMessageId(msgId); setActionsVisible(true); }, []);
  const closeActions = useCallback(() => { setActionsVisible(false); }, []);
  const openMoreEmojis = useCallback(() => { setActionsVisible(false); setPickerVisible(true); }, []);
  const closeEmojiPicker = useCallback(() => { setPickerVisible(false); setActiveMessageId(null); }, []);

  const handleReact = useCallback((msgId: string, emoji: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id !== msgId) return msg;
      const existing = msg.reactions.find(r => r.emoji === emoji);
      let reactions: Reaction[];
      if (existing) {
        if (existing.reactedByMe) {
          reactions = existing.count === 1
            ? msg.reactions.filter(r => r.emoji !== emoji)
            : msg.reactions.map(r => r.emoji === emoji ? { ...r, count: r.count - 1, reactedByMe: false } : r);
        } else {
          reactions = msg.reactions.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, reactedByMe: true } : r);
        }
      } else {
        reactions = [...msg.reactions, { emoji, count: 1, reactedByMe: true }];
      }
      reactionsRef.current.set(msgId, reactions);
      return { ...msg, reactions };
    }));
  }, []);

  const handleQuickReact = useCallback((emoji: string) => {
    if (activeMessageId) handleReact(activeMessageId, emoji);
    closeActions();
  }, [activeMessageId, handleReact, closeActions]);

  const handleSelectEmoji = useCallback((emoji: string) => {
    if (activeMessageId) handleReact(activeMessageId, emoji);
    closeEmojiPicker();
  }, [activeMessageId, handleReact, closeEmojiPicker]);

  const currentEmojis = activeMessageId
    ? (messages.find(m => m.id === activeMessageId)?.reactions.filter(r => r.reactedByMe).map(r => r.emoji) ?? [])
    : [];

  // ── Star toggle (persisted per room) ──
  const handleToggleStar = useCallback(() => {
    if (!activeMessageId || !roomIdRef.current) return;
    const set = starredRef.current;
    if (set.has(activeMessageId)) set.delete(activeMessageId);
    else set.add(activeMessageId);
    saveIdSet(starKey(roomIdRef.current), set);
    setMessages(prev => prev.map(m => m.id === activeMessageId ? { ...m, isStarred: set.has(m.id) } : m));
    closeActions();
  }, [activeMessageId, closeActions]);

  // ── Pin toggle (max MAX_PINS, persisted per room) ──
  const handleTogglePin = useCallback(() => {
    if (!activeMessageId || !roomIdRef.current) return;
    const set = pinnedRef.current;
    if (set.has(activeMessageId)) {
      set.delete(activeMessageId);
    } else {
      if (set.size >= MAX_PINS) { closeActions(); return; }
      set.add(activeMessageId);
    }
    saveIdSet(pinKey(roomIdRef.current), set);
    setMessages(prev => prev.map(m => m.id === activeMessageId ? { ...m, isPinned: set.has(m.id) } : m));
    setPinnedActiveIdx(0);
    closeActions();
  }, [activeMessageId, closeActions]);

  const handleUnpinActive = useCallback((msgId: string) => {
    if (!roomIdRef.current) return;
    pinnedRef.current.delete(msgId);
    saveIdSet(pinKey(roomIdRef.current), pinnedRef.current);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isPinned: false } : m));
    setPinnedActiveIdx(0);
  }, []);

  // ── NEW — Mute this chat (local only; gates the notification call above) ──
  const handleToggleMute = useCallback(() => {
    if (!roomIdRef.current) return;
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    saveMuted(roomIdRef.current, next);
  }, []);

  // ── NEW — Copy message text to clipboard ──
  const handleCopyText = useCallback(async () => {
    if (!activeMessageId) return;
    const m = messages.find(x => x.id === activeMessageId);
    if (!m?.text) return;
    await Clipboard.setStringAsync(m.text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setActionsVisible(false);
    setCopyToastVisible(true);
    setTimeout(() => setCopyToastVisible(false), 1500);
  }, [activeMessageId, messages]);

  // ── NEW — Search: compute matches, then auto-scroll to the active one ──
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) { setSearchResultIds([]); setSearchResultIdx(0); return; }
    const ids = messages.filter(m => m.text?.toLowerCase().includes(q)).map(m => m.id);
    setSearchResultIds(ids);
    setSearchResultIdx(0);
  }, [searchQuery, messages]);

  useEffect(() => {
    if (searchResultIds.length === 0) return;
    const id = searchResultIds[searchResultIdx];
    const y = messagePositionsRef.current.get(id);
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(y - rs(90), 0), animated: true });
    }
  }, [searchResultIdx, searchResultIds]);

  // NEW — once, on first load, jump straight to the unread divider instead of
  // the very bottom (WhatsApp behavior) — waits for that message's on-screen
  // position to be measured via onLayout.
  useEffect(() => {
    if (!unreadDividerId || initialScrollDoneRef.current) return;
    const y = messagePositionsRef.current.get(unreadDividerId);
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(y - rs(90), 0), animated: false });
      initialScrollDoneRef.current = true;
    }
  }, [unreadDividerId, messages]);

  const openSearch  = useCallback(() => setSearchVisible(true), []);
  const closeSearch = useCallback(() => { setSearchVisible(false); setSearchQuery(''); }, []);
  const goPrevResult = useCallback(() => {
    setSearchResultIdx(i => (searchResultIds.length === 0 ? 0 : (i - 1 + searchResultIds.length) % searchResultIds.length));
  }, [searchResultIds.length]);
  const goNextResult = useCallback(() => {
    setSearchResultIdx(i => (searchResultIds.length === 0 ? 0 : (i + 1) % searchResultIds.length));
  }, [searchResultIds.length]);

  const activeMsg = activeMessageId ? messages.find(m => m.id === activeMessageId) ?? null : null;
  const pinnedMessages = messages.filter(m => m.isPinned);

  // ── NEW — image preview prev/next navigation across all image messages ──
  const imageMessages = messages.filter(m => m.type === 'image' && m.mediaUri);
  const previewIdx = previewMsg ? imageMessages.findIndex(m => m.id === previewMsg.id) : -1;
  const handlePreviewPrev = useCallback(() => {
    if (previewIdx > 0) setPreviewMsg(imageMessages[previewIdx - 1]);
  }, [previewIdx, imageMessages]);
  const handlePreviewNext = useCallback(() => {
    if (previewIdx >= 0 && previewIdx < imageMessages.length - 1) setPreviewMsg(imageMessages[previewIdx + 1]);
  }, [previewIdx, imageMessages]);

  // ── Build grouped message list with date separators + unread divider ──
  const groupedItems: Array<
    { type: 'separator'; label: string } | { type: 'message'; msg: DiaryMessage } | { type: 'unread' }
  > = [];
  messages.forEach((msg, idx) => {
    const prev = messages[idx - 1];
    if (!prev || !isSameDay(prev.isoTimestamp, msg.isoTimestamp)) {
      groupedItems.push({ type: 'separator', label: formatDateLabel(msg.isoTimestamp) });
    }
    if (unreadDividerId && msg.id === unreadDividerId) {
      groupedItems.push({ type: 'unread' });
    }
    groupedItems.push({ type: 'message', msg });
  });

  const initials   = teacherInfo?.initials ?? '';
  const headerName = teacherInfo?.name ?? 'Class Teacher';
  const headerSub  = teacherInfo?.className ? `${teacherInfo.className} · Class Diary` : 'Class Diary';

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={C.accent} />

      {/* ── Header ── */}
      <LinearGradient
        colors={[C.accentMid, C.accent, C.accentDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.header, {
          paddingTop: insets.top > 0
            ? insets.top + rs(8)
            : Platform.OS === 'android'
              ? (StatusBar.currentHeight ?? rs(20)) + rs(8)
              : rs(50),
        }]}
      >
        {searchVisible ? (
          // NEW — search now takes over the header bar itself (WhatsApp /
          // Telegram pattern) instead of floating a separate card underneath
          // it. One continuous surface reads as more deliberate, and it's
          // a shorter reach for the thumb since everything stays up top.
          <>
            <PressableScale onPress={closeSearch} style={s.backBtn} haptic={false}>
              <BackIcon />
            </PressableScale>

            <View style={s.searchInputWrap}>
              <SearchIcon color="rgba(255,255,255,0.75)" size={15} />
              <TextInput
                style={s.searchInputInline}
                placeholder="Search in conversation"
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="search"
                selectionColor={C.white}
              />
              {searchQuery.length > 0 && (
                <PressableScale onPress={() => setSearchQuery('')} style={s.searchClearBtn} haptic={false}>
                  <CloseIcon color="rgba(255,255,255,0.8)" size={14} />
                </PressableScale>
              )}
            </View>

            {searchQuery.length > 0 && (
              <Text style={s.searchCountInline} numberOfLines={1}>
                {searchResultIds.length > 0 ? `${searchResultIdx + 1}/${searchResultIds.length}` : '0/0'}
              </Text>
            )}
            <PressableScale onPress={goPrevResult} disabled={searchResultIds.length === 0} style={s.searchNavBtnInline} haptic={false}>
              <View style={{ transform: [{ rotate: '180deg' }] }}>
                <ChevronDownIcon color={searchResultIds.length ? C.white : 'rgba(255,255,255,0.35)'} size={16} />
              </View>
            </PressableScale>
            <PressableScale onPress={goNextResult} disabled={searchResultIds.length === 0} style={s.searchNavBtnInline} haptic={false}>
              <ChevronDownIcon color={searchResultIds.length ? C.white : 'rgba(255,255,255,0.35)'} size={16} />
            </PressableScale>
          </>
        ) : (
          <>
            <PressableScale onPress={() => navigation?.goBack()} style={s.backBtn} haptic={false}>
              <BackIcon />
            </PressableScale>

            <View style={s.headerAvatarWrap}>
              <View style={s.headerAvatar}>
                <Text style={s.headerAvatarText}>{initials || '?'}</Text>
              </View>
              <OnlinePulse />
            </View>

            <View style={s.headerInfo}>
              <Text style={s.headerName} numberOfLines={1}>{headerName}</Text>
              <Text style={s.headerSub} numberOfLines={1}>{headerSub}</Text>
            </View>

            <PressableScale onPress={openSearch} style={s.headerIconBtn}>
              <SearchIcon size={17} />
            </PressableScale>
            <PressableScale onPress={() => setHeaderMenuVisible(true)} style={s.headerIconBtn}>
              <MoreIcon />
            </PressableScale>
          </>
        )}
      </LinearGradient>

      <HeaderMenu
        visible={headerMenuVisible}
        onClose={() => setHeaderMenuVisible(false)}
        onGallery={() => { setHeaderMenuVisible(false); setGalleryVisible(true); }}
        onStarred={() => { setHeaderMenuVisible(false); setStarredListVisible(true); }}
        onToggleMute={() => { handleToggleMute(); setHeaderMenuVisible(false); }}
        muted={muted}
        insetsTop={insets.top}
      />

      {/* NEW — "no matches" hint strip, only shown once the person has
          actually typed something and it came up empty */}
      {searchVisible && searchQuery.trim().length > 0 && searchResultIds.length === 0 && (
        <View style={s.searchEmptyBand}>
          <Text style={s.searchEmptyText}>No messages match "{searchQuery.trim()}"</Text>
        </View>
      )}

      {/* ── Pinned banner ── */}
      <PinnedBanner
        pinned={pinnedMessages}
        activeIndex={pinnedActiveIdx}
        onPress={() => pinnedMessages.length > 0 && setPinnedActiveIdx((pinnedActiveIdx + 1) % pinnedMessages.length)}
        onUnpin={() => pinnedMessages[pinnedActiveIdx] && handleUnpinActive(pinnedMessages[pinnedActiveIdx].id)}
      />

      {/* NEW — Stats strip (entry-type counts, client-side only) */}
      {!loading && <StatsStrip messages={messages} />}

      {/* ── Error banner ── */}
      {error && !loading && (
        <View style={s.errBand}>
          <Text style={s.errText}>⚠️ {error}</Text>
          <TouchableOpacity onPress={() => loadDiary(true)}>
            <Text style={s.errRetry}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Chat Area ── */}
      <View style={{ flex: 1 }}>
        {/* NEW — the tiled-dot wallpaper now actually sits behind the chat,
            instead of just being a defined-but-unused component */}
        <ChatWallpaper />
        {loading ? (
          // CHANGED — shimmering skeleton rows instead of a bare spinner
          <SkeletonLoader />
        ) : (
          <ScrollView
            ref={scrollRef}
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            // CHANGED — don't yank the view to the bottom while we're still
            // waiting to resolve (and jump to) the unread divider on first load
            onContentSizeChange={() => { if (unreadResolved) scrollToBottom(); }}
            onScroll={handleScroll}
            scrollEventThrottle={100}
          >
            {groupedItems.length === 0 ? (
              <EmptyState />
            ) : (
              groupedItems.map((item, idx) => {
                if (item.type === 'separator') return <DateSeparator key={`sep-${idx}`} label={item.label} />;
                if (item.type === 'unread') return <UnreadDivider key={`unread-${idx}`} />;
                return (
                  // CHANGED — wrapped in a View so we can capture each message's
                  // scroll-y position (needed to jump to search results / unread)
                  <View
                    key={item.msg.id}
                    onLayout={e => messagePositionsRef.current.set(item.msg.id, e.nativeEvent.layout.y)}
                  >
                    <MessageBubble
                      msg={item.msg}
                      initials={initials}
                      onReact={handleReact}
                      onOpenActions={openActions}
                      onPreviewImage={setPreviewMsg}
                      isHighlighted={searchVisible && searchResultIds[searchResultIdx] === item.msg.id}
                    />
                  </View>
                );
              })
            )}
            <TypingIndicator initials={initials} />
          </ScrollView>
        )}
      </View>

      {/* ── New Message Toast ── */}
      <NewMessageToast visible={showNewToast} onPress={scrollToBottom} />

      {/* NEW — "Copied" confirmation toast */}
      <NewMessageToast visible={copyToastVisible} onPress={() => setCopyToastVisible(false)} label="Copied to clipboard" />

      {/* ── Message Actions (react / star / pin) ── */}
      <MessageActionsModal
        visible={actionsVisible}
        msg={activeMsg}
        onClose={closeActions}
        onReact={handleQuickReact}
        onMoreEmojis={openMoreEmojis}
        onToggleStar={handleToggleStar}
        onTogglePin={handleTogglePin}
        pinDisabled={pinnedRef.current.size >= MAX_PINS}
        onCopyText={handleCopyText}
      />

      {/* ── Full Emoji Picker ── */}
      <EmojiPickerModal
        visible={pickerVisible}
        onClose={closeEmojiPicker}
        onSelectEmoji={handleSelectEmoji}
        currentEmojis={currentEmojis}
      />

      {/* ── Image / Video Preview ── */}
      <ImagePreviewModal
        visible={!!previewMsg}
        uri={previewMsg?.mediaUri}
        caption={previewMsg?.caption}
        fileName={previewMsg?.type === 'video' ? undefined : undefined}
        onClose={() => setPreviewMsg(null)}
        onPrev={handlePreviewPrev}
        onNext={handlePreviewNext}
        hasPrev={previewIdx > 0}
        hasNext={previewIdx >= 0 && previewIdx < imageMessages.length - 1}
        counterLabel={previewIdx >= 0 ? `${previewIdx + 1} of ${imageMessages.length}` : undefined}
      />

      {/* ── Starred Messages List ── */}
      <StarredListModal
        visible={starredListVisible}
        messages={messages}
        onClose={() => setStarredListVisible(false)}
      />
      <MediaGalleryModal
        visible={galleryVisible}
        messages={messages}
        onClose={() => setGalleryVisible(false)}
        onOpenImage={(m) => { setGalleryVisible(false); setPreviewMsg(m); }}
      />
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg },
  // CHANGED — header is now a LinearGradient; this just supplies layout + a
  // deeper, more deliberate shadow so it reads as elevated chrome, not a flat bar
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: rs(14), paddingBottom: rs(15), gap: rs(10), shadowColor: C.shadow, shadowOffset: { width: 0, height: rs(4) }, shadowOpacity: 0.28, shadowRadius: rs(14), elevation: 8 },
  backBtn:     { width: rs(36), height: rs(36), borderRadius: rs(18), backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  // NEW — wraps avatar + online pulse so the pulse can anchor to its corner
  headerAvatarWrap: { flexShrink: 0 },
  headerAvatar:{ width: rs(40), height: rs(40), borderRadius: rs(20), backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { fontSize: fs(13.5), fontWeight: '800', color: C.white, letterSpacing: 0.2 },
  headerInfo:  { flex: 1, gap: rs(2) },
  headerName:  { fontSize: fs(15.5), fontWeight: '700', color: C.white, letterSpacing: -0.2, textTransform: 'uppercase' },
  headerSub:   { fontSize: fs(11), color: 'rgba(255,255,255,0.75)', fontWeight: '600', letterSpacing: 0.1 },
  // NEW — the two remaining header controls (search, overflow menu)
  headerIconBtn: { width: rs(36), height: rs(36), borderRadius: rs(18), backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  // CHANGED — floating card look instead of a flush inline bar
  // NEW — search lives inline in the header bar now, styled as a frosted
  // glass pill that sits on the same gradient as the rest of the chrome
  searchInputWrap:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: rs(7), backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', borderRadius: rs(18), paddingHorizontal: rs(12), height: rs(36) },
  searchInputInline: { flex: 1, fontSize: fs(13.5), color: C.white, padding: 0, height: '100%' },
  searchClearBtn:    { width: rs(20), height: rs(20), alignItems: 'center', justifyContent: 'center' },
  searchCountInline: { fontSize: fs(11), color: 'rgba(255,255,255,0.85)', fontWeight: '700', flexShrink: 0 },
  searchNavBtnInline:{ width: rs(28), height: rs(28), alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  searchEmptyBand:   { backgroundColor: C.accentLight, paddingHorizontal: rs(16), paddingVertical: rs(8), borderBottomWidth: 0.8, borderBottomColor: C.border },
  searchEmptyText:   { fontSize: fs(11.5), color: C.accentDark, fontWeight: '600' },
  scroll:      { flex: 1 },
  scrollContent:{ paddingHorizontal: rs(12), paddingTop: rs(8), paddingBottom: rs(22) },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: rs(12) },
  loadingText: { fontSize: fs(13), color: C.muted, fontWeight: '500' },
  errBand:     { backgroundColor: '#FFF5F5', paddingHorizontal: rs(16), paddingVertical: rs(10), flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 0.8, borderBottomColor: '#FEB2B2' },
  errText:     { fontSize: fs(12), color: '#E05A5A', flex: 1, fontWeight: '500' },
  errRetry:    { fontSize: fs(12), color: C.accent, fontWeight: '700', marginLeft: rs(12) },
});


export default DiaryScreen;