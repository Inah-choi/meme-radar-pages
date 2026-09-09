import {createRadarReview} from './radar-review.mjs';
import {createBangerRadar} from './banger-radar.mjs';
import {API_ORIGIN} from './deployment-config.mjs';
import {normalizeApiOrigin, readApiSession, saveApiSession, forgetApiSession, apiRequestUrl, backendAssetUrl} from './api-connection.mjs';
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [
  ...parent.querySelectorAll(selector),
];
const initialConnection = readApiSession(sessionStorage, location.origin, API_ORIGIN);
const state = {
  key: initialConnection.key,
  apiOrigin: initialConnection.apiOrigin,
  overview: null,
  candidates: [],
  hotPosts: null,
  hotOffset: 0,
  hotLimit: 50,
  hotLoading: false,
  hotError: "",
  hotQuery: null,
  launches: [],
  page: "radar",
  favorite: false,
  selected: null,
  draft: null,
  draftDirty: false,
  simulation: null,
  manualLaunch: null,
  draftActionPending: false,
  draftStatusError: '',
  policyDirty: false,
  refreshing: false,
  fetchingCandidates: 0,
  detailRequest: 0,
  lastSync: null,
  observations: [],
  observationTotal: null,
  observationOffset: 0,
  observationLimit: 50,
  archiveRequest: 0,
  archiveLoading: false,
  capture: null,
  market: null,
  marketError: "",
  gapOnly: true,
};
const reviewRadar = createRadarReview({api,onOpenCandidate:openCandidate,onNavigatePosts:()=>{
  $('#candidate-view').value='posts';return fetchCandidates().catch(error=>toast(error.message,true));
}});
const bangerRadar = createBangerRadar({api,onOpenCandidate:openCandidate,toast});
const labels = {
  radar: "밈 레이더",
  bangers: "뱅어 레이더",
  market: "온체인 시장",
  launches: "발행 관리",
  collectors: "수집 소스",
  archive: "X 보관함",
  policy: "자동화 정책",
  integration: "API 연동",
};
const statusLabels = {
  healthy: "정상",
  ok: "정상",
  active: "정상",
  success: "성공",
  available: "접근 가능",
  limited: "접근 제한",
  rate_limited: "요청 제한",
  degraded: "부분 제한",
  partial: "부분 수집",
  blocked: "접근 제한",
  unavailable: "사용 불가",
  disabled: "비활성",
  error: "오류",
  failed: "실패",
  pending: "대기",
  waiting: "첫 수집 대기",
  idle: "대기",
  running: "수집 중",
  collecting: "수집 중",
  queued: "발행 대기",
  prepared: "서명 저장",
  uncertain: "온체인 확인 필요",
  tradable: "거래 개시 완료",
  reserved: "예산 예약",
  simulating: "시뮬레이션",
  simulated: "모의 평가",
  signing: "서명 중",
  submitted: "전송됨",
  broadcasting: "전송 중",
  confirming: "확인 중",
  confirmed: "발행 완료",
  deployed: "발행 완료",
  paper: "PAPER 기록",
  paper_completed: "PAPER 기록",
  held: "보류",
  blocked_policy: "정책 보류",
  rejected: "정책 제외",
  cancelled: "취소",
  unknown: "결과 확인 중",
  recovering: "복구 중",
  unconnected: "DEX 미연결",
  paused: "일시정지",
  emergency: "긴급 정지",
  not_modified: "변경 없음",
  cached: "캐시 응답",
  busy: "수집 중",
};
const componentLabels = {
  growth: "언급 증가",
  growthRate: "언급 증가율",
  acceleration: "증가 가속도",
  authors: "고유 작성자",
  uniqueAuthors: "고유 작성자",
  sourceDiversity: "출처 다양성",
  burst: "기준선 대비 급증",
  diversity: "출처 다양성",
  novelty: "새로움",
  remixability: "변형 가능성",
  memeability: "반복·변형 가능성",
  repetition: "반복 가능성",
  velocity: "확산 속도",
  duplicatePenalty: "기존 토큰 중복 위험",
  duplication: "유사 토큰 중복",
  tokenOverlap: "유사 토큰 중복",
  similarity: "유사 토큰 중복",
  momentum: "확산 추세",
  intervalGrowth: "6시간 구간 증가",
  freshness: "데이터 신선도",
  independence: "출처 독립성",
};
const kindLabels = {
  phrase: "반복 문구",
  neologism: "신조어",
  character: "캐릭터",
  image: "이미지",
  event: "사건",
  joke: "커뮤니티 농담",
  community_joke: "커뮤니티 농담",
  topic: "소재",
  meme: "밈 소재",
  token: "토큰명 언급",
  trend: "트렌드",
};
// One shared label map for every metric key the item contract allows.
const metricLabels = {
  views: "조회",
  likes: "좋아요",
  comments: "댓글",
  replies: "답글",
  reposts: "재게시",
  shares: "공유",
  quotes: "인용",
  bookmarks: "북마크",
  score: "점수",
  upvotes: "추천",
  downvotes: "비추천",
  searches: "검색량",
  holders: "보유자",
  boosts: "부스트",
  transactions24h: "24h 거래",
  buyers24h: "24h 매수자",
  sellers24h: "24h 매도자",
  postCount: "게시물",
  accounts: "계정",
  uses: "사용",
  captions: "캡션",
  participants: "시청자",
  images: "이미지",
  rank: "순위",
  marketCapUsd: "시가총액",
  fdvUsd: "FDV",
  volume24hUsd: "24h 거래량",
  liquidityUsd: "유동성",
};
const USD_METRICS = new Set(["marketCapUsd", "fdvUsd", "volume24hUsd", "liquidityUsd"]);
const historyMetricPriority = [
  "likes", "reposts", "replies", "views", "comments", "score",
  "upvotes", "searches", "holders", "marketCapUsd", "volume24hUsd",
];
const provenanceLabels = {
  "browser-json": "브라우저 수신 JSON",
  "public-html": "공개 HTML 표본",
  rss: "공개 RSS",
  hn: "공식 공개 API",
  "geckoterminal-pools": "GeckoTerminal 공개 API",
  "dexscreener-tokens": "DexScreener 공개 API",
  "pumpfun-coins": "pump.fun 공개 API",
  "blockscout-tokens": "Blockscout 탐색기 API",
  "bluesky-feed": "Bluesky 공개 API",
  "bluesky-trends": "Bluesky 공개 API",
  "mastodon-statuses": "Mastodon 공개 API",
  "mastodon-tags": "Mastodon 공개 API",
  "mastodon-links": "Mastodon 공개 API",
  "lemmy-posts": "Lemmy 공개 API",
  "fourchan-catalog": "4chan 공개 API",
  "google-trends-rss": "Google Trends RSS",
  "coingecko-trending": "CoinGecko 공개 API",
  "coingecko-markets": "CoinGecko 공개 API",
  "wikipedia-topviews": "Wikimedia 공개 API",
};
const chainLabels = {
  robinhood: "Robinhood Chain",
  "robinhood-testnet": "Robinhood Chain Testnet",
  solana: "Solana",
  eth: "Ethereum",
  ethereum: "Ethereum",
  base: "Base",
  bsc: "BNB Chain",
  arbitrum: "Arbitrum",
  polygon_pos: "Polygon",
  polygon: "Polygon",
  avalanche: "Avalanche",
  optimism: "Optimism",
  tron: "Tron",
  sui: "Sui",
  ton: "TON",
  hyperliquid: "Hyperliquid",
  abstract: "Abstract",
};
const listingLabels = {
  new_pool: "새 풀",
  trending: "트렌딩",
  top_volume: "거래량 상위",
  boosted: "부스트",
  profile: "프로필",
  launchpad_new: "런치패드 신규",
  launchpad_top: "런치패드 시총 상위",
  launchpad_live: "런치패드 라이브",
  market_top: "밈 시장 거래량 상위",
  explorer_holders: "탐색기 보유자 상위",
  coingecko_trending: "CoinGecko 트렌딩",
};
const categoryLabels = {
  "onchain-robinhood": "온체인 · Robinhood",
  "onchain-other": "온체인 · 타체인",
  social: "소셜",
  community: "커뮤니티",
  news: "뉴스",
  "meme-db": "밈 DB",
  trend: "트렌드",
};
// Fallback only for collector rows that predate the `category` field.
const kindCategories = {
  "geckoterminal-pools": "onchain-other",
  "dexscreener-tokens": "onchain-other",
  "pumpfun-coins": "onchain-other",
  "blockscout-tokens": "onchain-robinhood",
  "coingecko-trending": "onchain-other",
  "coingecko-markets": "onchain-other",
  "bluesky-feed": "social",
  "bluesky-trends": "trend",
  "mastodon-statuses": "social",
  "mastodon-tags": "trend",
  "mastodon-links": "news",
  "lemmy-posts": "community",
  "fourchan-catalog": "community",
  "google-trends-rss": "trend",
  "wikipedia-topviews": "trend",
};
const externalLinkLabels = {
  twitter: "X",
  telegram: "Telegram",
  website: "웹사이트",
  discord: "Discord",
  other: "링크",
};

function node(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined && text !== null) item.textContent = String(text);
  return item;
}
function append(parent, ...items) {
  for (const item of items)
    if (item !== undefined && item !== null)
      parent.append(
        item instanceof Node ? item : document.createTextNode(String(item)),
      );
  return parent;
}
function clear(selector) {
  const target = typeof selector === "string" ? $(selector) : selector;
  target.replaceChildren();
  return target;
}
function list(value) {
  return Array.isArray(value) ? value : [];
}
function display(value, fallback = "—") {
  return value === undefined || value === null || value === ""
    ? fallback
    : String(value);
}
function finite(value) {
  return (
    value !== null &&
    value !== undefined &&
    value !== "" &&
    Number.isFinite(Number(value))
  );
}
function trimDecimal(value, digits) {
  return Number(value)
    .toFixed(digits)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
}
function scaled(abs, unit) {
  const v = abs / unit;
  return v >= 100
    ? String(Math.round(v))
    : v >= 10
      ? trimDecimal(v, 1)
      : trimDecimal(v, 2);
}
function compactNumber(value) {
  if (!finite(value)) return null;
  const n = Number(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1e9) return `${sign}${scaled(abs, 1e9)}B`;
  if (abs >= 1e6) return `${sign}${scaled(abs, 1e6)}M`;
  if (abs >= 1e3) return `${sign}${scaled(abs, 1e3)}K`;
  if (abs === 0) return "0";
  return `${sign}${abs >= 1 ? trimDecimal(abs, 2) : abs.toLocaleString("en-US", { maximumSignificantDigits: 3 })}`;
}
function compactUsd(value) {
  const text = compactNumber(value);
  if (text === null) return null;
  return text.startsWith("−") ? `−$${text.slice(1)}` : `$${text}`;
}
function priceUsd(value) {
  if (!finite(value)) return null;
  const n = Number(value);
  return `$${
    n >= 1
      ? n.toLocaleString("en-US", { maximumFractionDigits: 2 })
      : n.toLocaleString("en-US", { maximumSignificantDigits: 3 })
  }`;
}
function countText(value) {
  return finite(value)
    ? Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 2 })
    : null;
}
function formatMetric(key, value, { compact = false } = {}) {
  if (!finite(value)) return null;
  if (USD_METRICS.has(key)) return compactUsd(value);
  if (key === "rank") return `#${Math.round(Number(value))}`;
  const text = compact ? compactNumber(value) : countText(value);
  // Google Trends reports approximate lower bounds ("200,000+"); keep that meaning.
  return key === "searches" ? `${text}+` : text;
}
function metricText(key, value, options) {
  return `${metricLabels[key] || key} ${formatMetric(key, value, options)}`;
}
function metricEntries(metrics) {
  if (!metrics || typeof metrics !== "object") return [];
  const keys = [
    ...Object.keys(metricLabels),
    ...Object.keys(metrics)
      .filter((key) => !(key in metricLabels))
      .sort(),
  ];
  // Metrics are counts (≥ 0); signed values such as price change live in `market`.
  return keys
    .filter((key) => finite(metrics[key]) && Number(metrics[key]) >= 0)
    .map((key) => [key, Number(metrics[key])]);
}
function signedPercent(value) {
  if (!finite(value)) return null;
  const n = Number(value);
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
}
function deltaNode(value) {
  if (!finite(value)) return node("span", "muted", "—");
  const n = Number(value);
  return node(
    "span",
    `delta${n > 0 ? " up" : n < 0 ? " down" : ""}`,
    signedPercent(n),
  );
}
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isRobinhoodChain(chain) {
  return /^robinhood/.test(String(chain || "").toLowerCase());
}
function itemChain(item) {
  const market =
    item?.market && typeof item.market === "object" ? item.market : {};
  return String(market.chain || item?.chain || "").toLowerCase();
}
function chainLabelFor(item) {
  const market =
    item?.market && typeof item.market === "object" ? item.market : {};
  if (market.chainLabel) return String(market.chainLabel);
  const chain = itemChain(item);
  return chain ? chainLabels[chain] || chain : null;
}
function chainPill(item) {
  const label = chainLabelFor(item);
  if (!label) return null;
  return node(
    "span",
    `pill${isRobinhoodChain(itemChain(item)) ? " success" : " info"}`,
    label,
  );
}
function listingPill(listing) {
  return listing
    ? node("span", "pill", listingLabels[listing] || String(listing))
    : null;
}
function hostLabel(url) {
  try {
    const host = new URL(String(url)).hostname.replace(/^www\./, "");
    if (host.endsWith("geckoterminal.com")) return "GeckoTerminal";
    if (host.endsWith("dexscreener.com")) return "DexScreener";
    if (host.endsWith("pump.fun")) return "pump.fun";
    if (host.endsWith("coingecko.com")) return "CoinGecko";
    if (host.endsWith("chain.robinhood.com")) return "탐색기";
    return host;
  } catch {
    return "원문";
  }
}
function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function percent(value) {
  return Math.max(0, Math.min(100, number(value)));
}
function date(value, seconds = false) {
  if (!value) return "아직 없음";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "알 수 없음"
    : d.toLocaleString("ko-KR", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        ...(seconds ? { second: "2-digit" } : {}),
      });
}
function ago(value) {
  if (!value) return "관측 시각 없음";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "관측 시각 없음";
  const diff = Math.max(0, Date.now() - time);
  if (diff < 60_000) return "방금 관측";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${Math.floor(diff / 86_400_000)}일 전`;
}
function short(value) {
  const text = display(value, "미설정");
  return text.length > 19 ? `${text.slice(0, 9)}…${text.slice(-6)}` : text;
}
function weiToEth(value, maxDecimals = 6) {
  try {
    if (value === null || value === undefined) return "—";
    const amount = BigInt(value);
    const sign = amount < 0n ? "-" : "";
    const absolute = amount < 0n ? -amount : amount;
    const whole = absolute / 10n ** 18n;
    const decimal = (absolute % 10n ** 18n)
      .toString()
      .padStart(18, "0")
      .slice(0, maxDecimals)
      .replace(/0+$/, "");
    if (whole === 0n && absolute > 0n && !decimal)
      return `${sign}<0.${"0".repeat(maxDecimals - 1)}1`;
    return `${sign}${whole}${decimal ? `.${decimal}` : ""}`;
  } catch {
    return "—";
  }
}
function exactEth(value) {
  return weiToEth(value ?? "0", 18);
}
function ethToWei(value) {
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,18})?$/.test(text))
    throw new Error(
      "ETH 예산은 0 이상의 숫자이며 소수점 아래 18자리까지 입력할 수 있습니다.",
    );
  const [whole, fraction = ""] = text.split(".");
  return (
    BigInt(whole) * 10n ** 18n +
    BigInt(fraction.padEnd(18, "0"))
  ).toString();
}
function validUrl(value, sameOriginOnly = false) {
  if (!value) return null;
  try {
    const asset = String(value).startsWith('/assets/tokens/')
      ? backendAssetUrl(String(value), state.apiOrigin || location.origin, location.origin) : null;
    if (String(value).startsWith('/assets/tokens/') && !asset) return null;
    const url = new URL(asset || String(value), location.origin);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    if (sameOriginOnly && url.origin !== location.origin) return null;
    return url.href;
  } catch {
    return null;
  }
}
function httpsUrl(value) {
  const safe = validUrl(value);
  return safe && safe.startsWith("https:") ? safe : null;
}
function externalLink(label, url, className = "text-link") {
  const safe = validUrl(url);
  if (!safe) return node("span", "muted", `${label} · 링크 없음`);
  const link = node("a", className, label);
  link.href = safe;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}
function toast(message, error = false) {
  const item = node("div", `toast${error ? " error" : ""}`, message);
  $("#toasts").append(item);
  window.setTimeout(() => item.remove(), 6000);
}
function actionButton(text, handler, className = "button subtle") {
  const button = node("button", className, text);
  button.type = "button";
  button.addEventListener("click", () => busy(button, handler));
  return button;
}
async function busy(button, handler) {
  if (button.disabled) return;
  const draftAction = Boolean(button.closest('#draft-section'));
  if (draftAction && state.draftActionPending) return;
  if (draftAction) state.draftActionPending = true;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  try {
    await handler();
  } catch (error) {
    const inline = button
      .closest("#draft-section")
      ?.querySelector("#draft-error");
    if (inline) inline.textContent = error.message;
    toast(error.message, true);
  } finally {
    if (draftAction) state.draftActionPending = false;
    button.disabled =
      button.id === "emergency-button" &&
      Boolean(state.overview?.policy?.emergencyStop);
    button.removeAttribute("aria-busy");
  }
}
async function api(path, options = {}) {
  const requestOrigin = state.apiOrigin, requestKey = state.key;
  const target = apiRequestUrl(path, requestOrigin || location.origin, location.origin);
  const headers = {
    Accept: "application/json",
    ...(state.key ? { Authorization: `Bearer ${state.key}` } : {}),
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
  };
  let response;
  try {
    response = await fetch(target, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal || AbortSignal.timeout(30_000),
      credentials: 'omit',
      redirect: 'error',
    });
  } catch (error) {
    throw new Error(
      error.name === "TimeoutError"
        ? "서버 응답이 지연되고 있습니다. 요청 상태를 확인한 뒤 다시 시도하세요."
        : "서버에 연결할 수 없습니다. 서버와 네트워크 상태를 확인하세요.",
    );
  }
  const result = await response.json().catch(() => ({}));
  if (state.apiOrigin !== requestOrigin || state.key !== requestKey)
    throw new Error('서버 연결이 변경되어 이전 요청 결과를 무시했습니다.');
  if (!response.ok) {
    if (response.status === 401) {
      disconnect(false);
    }
    const raw =
      result.error?.message ||
      result.error ||
      result.message ||
      `요청 실패 (${response.status})`;
    const reasons =
      result.reasons || result.error?.details?.reasons || result.error?.details;
    const detail = Array.isArray(reasons)
      ? reasons
          .map((v) =>
            typeof v === "string"
              ? v
              : `${v.path?.join(".") || ""} ${v.message || ""}`,
          )
          .join(" · ")
      : reasons?.reason || "";
    const error = new Error(
      `${typeof raw === "string" ? raw : JSON.stringify(raw)}${detail ? ` · ${detail}` : ""}`,
    );
    if(typeof result.error?.code==='string')error.code=result.error.code;
    error.status=response.status;
    if(result.error?.details!==undefined)error.details=result.error.details;
    throw error;
  }
  return result;
}
function disconnect(notify = true) {
  state.key = "";
  state.fetchingCandidates++;
  state.hotPosts = null;
  state.hotOffset = 0;
  state.hotLoading = false;
  reviewRadar.reset();
  bangerRadar.reset();
  state.archiveRequest++;
  state.observations = [];
  state.observationTotal = null;
  state.observationOffset = 0;
  state.capture = null;
  forgetApiSession(sessionStorage, state.apiOrigin, location.origin);
  $("#workspace").hidden = true;
  $("#login-screen").hidden = false;
  $("#api-key").value = "";
  if ($("#candidate-dialog").open) $("#candidate-dialog").close();
  if (notify) toast("운영자 세션 연결을 해제했습니다.");
}
function updateAlert() {
  const overview = state.overview;
  if (!overview) return;
  const policy = overview.policy || {};
  const alerts = [];
  if (policy.emergencyStop)
    alerts.push(
      "긴급 정지 활성화: 모든 신규 발행과 전송이 차단됩니다. 이미 전송된 트랜잭션은 온체인 상태를 계속 확인해야 합니다.",
    );
  else if (policy.paused)
    alerts.push(
      "자동화가 일시정지되었습니다. 재개 전 정책과 네트워크 상태를 확인하세요.",
    );
  if (policy.mode === "AUTO")
    alerts.push(
      `${policy.network === "mainnet" ? "메인넷" : "테스트넷"} AUTO 활성화: 허용된 정책에 따라 실제 트랜잭션이 자동 전송됩니다.`,
    );
  if (state.lastError) alerts.push(state.lastError);
  $("#global-alert").textContent = alerts.join(" ");
  $("#global-alert").hidden = alerts.length === 0;
}
function badge(status, text) {
  const key = String(status || "idle").toLowerCase();
  const style = [
    "healthy",
    "ok",
    "active",
    "success",
    "available",
    "confirmed",
    "deployed",
    "paper",
    "paper_completed",
  ].includes(key)
    ? "success"
    : ["error", "failed", "emergency"].includes(key)
      ? "error"
      : [
            "warning",
            "limited",
            "degraded",
            "partial",
            "blocked",
            "held",
            "rejected",
            "disabled",
            "unavailable",
            "paused",
          ].includes(key)
        ? "warning"
        : "";
  return node(
    "span",
    `pill ${style}`,
    text || statusLabels[key] || display(status, "대기"),
  );
}
function statCard(
  label,
  value,
  description,
  { unit, lime = false, icon = "↗", budget = false } = {},
) {
  const card = node("div", `stat-card${budget ? " budget-stat" : ""}`);
  append(
    card,
    append(
      node("div", "stat-label"),
      node("span", "", label),
      node("span", "stat-icon", icon),
    ),
  );
  const val = node("div", `stat-value${lime ? " lime" : ""}`, value);
  if (unit) val.append(node("small", "", unit));
  append(card, val, node("div", "stat-description", description));
  return card;
}

async function refresh({ silent = false } = {}) {
  if (!state.key || state.refreshing) return;
  state.refreshing = true;
  // /api/market is only polled on the pages that show it (radar strip, market page).
  const marketLimit =
    state.page === "market" ? 30 : state.page === "radar" ? 8 : null;
  try {
    const results = await Promise.allSettled([
      api("/api/overview"),
      state.page === "launches" ? api("/api/launches") : Promise.resolve(null),
      marketLimit
        ? api(`/api/market?limit=${marketLimit}`)
        : Promise.resolve(null),
    ]);
    if (results[0].status === "rejected") throw results[0].reason;
    const incoming = results[0].value;
    if (
      number(state.overview?.policy?.version) > number(incoming.policy?.version)
    )
      incoming.policy = state.overview.policy;
    state.overview = incoming;
    state.launches = list(state.overview.launches);
    if (results[1].status === "fulfilled" && results[1].value)
      state.launches = list(results[1].value.items);
    if (results[2].status === "fulfilled" && results[2].value) {
      state.market = results[2].value;
      state.marketError = "";
    } else if (results[2].status === "rejected")
      state.marketError = `온체인 시장 데이터 갱신 실패: ${results[2].reason.message}`;
    state.lastSync = new Date().toISOString();
    state.lastError = "";
    renderOverview();
    await refreshDraftStatus();
    if (state.page === "radar") await fetchCandidates();
    if (state.page === "archive") await fetchArchive();
    if (state.page === "bangers") await bangerRadar.refresh({ silent: true });
    if (results[1].status === "rejected") throw results[1].reason;
  } catch (error) {
    state.lastError = `갱신 실패: ${error.message} 마지막 성공 데이터를 표시합니다.`;
    if (!silent) toast(error.message, true);
    updateAlert();
    $("#footer-sync").textContent = "연결 확인 필요";
  } finally {
    state.refreshing = false;
  }
}
function renderOverview() {
  const o = state.overview || {};
  const p = o.policy || {};
  const n = o.network || {};
  const b = o.budget || {};
  const collectors = list(o.collectors);
  $("#network-pill").textContent = (
    p.network ||
    n.network ||
    "testnet"
  ).toUpperCase();
  $("#network-pill").className =
    `pill${p.network === "mainnet" ? " warning" : ""}`;
  $("#mode-pill").textContent = p.mode || "PAPER";
  $("#mode-pill").className = `pill mode${p.mode === "AUTO" ? " warning" : ""}`;
  $("#pause-button").textContent =
    p.paused || p.emergencyStop ? "자동화 재개" : "자동화 일시정지";
  $("#emergency-button").textContent = p.emergencyStop
    ? "긴급 정지 중"
    : "긴급 정지";
  $("#emergency-button").disabled = Boolean(p.emergencyStop);
  $("#sidebar-network").textContent =
    `${(p.network || n.network || "testnet").toUpperCase()} · ${n.chainId ? `Chain ${n.chainId}` : "설정 필요"}${n.dryRun ? " · DRY RUN" : ""}`;
  $("#sidebar-balance").textContent = `${weiToEth(n.balanceWei)} ETH`;
  $("#footer-sync").textContent =
    `${new Date(state.lastSync || Date.now()).toLocaleTimeString("ko-KR", { hour12: false })} 동기화`;
  const good = collectors.filter(
    (c) =>
      !isXCollector(c) &&
      ["healthy", "ok", "active", "available", "success"].includes(
        String(c.status).toLowerCase(),
      ),
  ).length;
  const xCoverage = collectorCoverage(collectors);
  $("#radar-status").textContent =
    `X ${xCoverage.enabledXAccounts}계정 중 ${xCoverage.withPostsXAccounts}계정 공개 글 반환 · 보조 소스 ${good}개 응답 성공`;
  const dates = collectors
    .map((c) => c.lastCollectedAt)
    .filter(Boolean)
    .sort();
  $("#radar-updated").textContent = dates.length
    ? `마지막 수집 ${date(dates.at(-1))}`
    : "아직 수집 기록이 없습니다";
  if (o.pipeline) {
    const pending = list(o.pipeline.queues).filter(q => ['queued', 'running'].includes(q.state)).reduce((n, q) => n + number(q.count), 0);
    $("#radar-updated").textContent += ` · 관측 이력 ${number(o.pipeline.observationCount).toLocaleString('ko-KR')}건 · 처리 대기 ${pending}건 · 미복구 구간 ${number(o.pipeline.openGaps)}개`;
  }
  if (o.creativeAuto?.enabled) {
    $("#radar-updated").textContent += ` · 창작 자동 선별 ${number(o.creativeAuto.eligible)} / ${number(o.creativeAuto.examined)}개 통과`;
  }
  renderStats();
  renderCollectors();
  renderLaunches();
  renderMarketViews();
  renderLiquidityOverview(o);
  const hook = o.webhooks || {};
  const webhook = clear("#webhook-status");
  append(
    webhook,
    node("span", "", hook.enabled ? "◎" : "ⓘ"),
    append(
      node("div"),
      node(
        "strong",
        "",
        hook.enabled ? "서명된 webhook 연결됨" : "서명된 webhook 설정 필요",
      ),
      node(
        "p",
        "",
        `전송 대기 ${hook.pending ?? 0}건 · 재시도 소진 ${hook.failed ?? 0}건. 서버의 WEBHOOK_URL과 WEBHOOK_SECRET을 설정하고 수신 측에서 서명과 타임스탬프를 검증하세요.`,
      ),
    ),
  );
  if (!state.policyDirty) fillPolicy(p);
  updateAlert();
}
function renderStats() {
  if ($('#candidate-view')?.value === 'review') { reviewRadar.renderStats(); return; }
  if ($('#candidate-view')?.value === 'posts') { renderHotStats(); return; }
  const o = state.overview || {};
  const materialsView = $('#candidate-view')?.value === 'materials';
  const p = o.policy || {};
  const b = o.budget || {};
  const counts = o.counts || {};
  const candidateCount =
    $("#data-filter").value === "demo"
      ? (counts.demoCandidates ?? state.candidates.length)
      : $("#data-filter").value === "all"
        ? number(counts.candidates) + number(counts.demoCandidates)
        : (counts.candidates ??
          counts.totalCandidates ??
          state.candidates.length);
  const eligible =
    counts.eligible ??
    counts.eligibleCandidates ??
    state.candidates.filter(
      (c) =>
        number(c.score) >= number(p.minScore) &&
        number(c.confidence) >= number(p.minConfidence) &&
        !list(c.exclusions).length,
    ).length;
  const active = state.launches.filter((l) =>
    [
      "queued",
      "reserved",
      "signing",
      "submitted",
      "confirming",
      "broadcasting",
      "simulating",
      "unknown",
      "recovering",
      "prepared",
      "uncertain",
    ].includes(l.status),
  ).length;
  const stats = clear("#stats-grid");
  append(
    stats,
    statCard(
      materialsView ? '발굴 소재' : $("#data-filter").value === "demo" ? "데모 후보" : "관측된 후보",
      Number(materialsView ? state.candidates.length : candidateCount).toLocaleString("ko-KR"),
      materialsView ? '현재 필터의 원문 기반 AI 소재' : "수집된 공개 데이터에서 추출",
      { unit: "개", icon: "◎" },
    ),
    statCard(
      materialsView ? '확산 조짐' : "정책 기준 충족",
      Number(materialsView ? state.candidates.filter(c => c.discoveryStage === 'spreading').length : eligible).toLocaleString("ko-KR"),
      materialsView ? '최근 1시간에 독립 작성자 2명 이상' : "발행 직전 정책을 다시 확인합니다",
      { unit: "개", lime: true, icon: "↗" },
    ),
    statCard(
      "진행 중인 발행",
      active.toLocaleString("ko-KR"),
      `${p.mode || "PAPER"} 모드 · 오늘 ${b.count ?? 0} / ${p.maxDailyLaunches ?? 0}건`,
      { unit: "건", icon: "◷" },
    ),
    statCard(
      "남은 일일 예산",
      weiToEth(b.remainingWei),
      "가스 비용 · 예약 금액 제외",
      { unit: "ETH", budget: true, icon: "◈" },
    ),
  );
  const gapCount =
    o.market?.gaps ?? (state.market ? list(state.market.gaps).length : null);
  if (!materialsView) stats.append(
    statCard(
      "Robinhood 갭",
      gapCount == null ? "—" : Number(gapCount).toLocaleString("ko-KR"),
      gapCount == null
        ? "온체인 시장 데이터를 아직 불러오지 않았습니다"
        : "타체인에서 뜨지만 Robinhood 목록에 없는 토큰",
      {
        unit: gapCount == null ? undefined : "개",
        icon: "◈",
        lime: number(gapCount) > 0,
      },
    ),
  );
  $("#nav-count").textContent = counts.candidates ?? candidateCount;
}

async function fetchCandidates({ offset } = {}) {
  if (!state.key) return;
  const version = ++state.fetchingCandidates;
  const view = $('#candidate-view').value;
  syncRadarView();
  if (view === 'review') return reviewRadar.fetch(offset === undefined ? {} : {offset});
  reviewRadar.deactivate();
  if (view === 'posts') return fetchHotPosts({ version, offset:offset??state.hotOffset });
  const params = new URLSearchParams({
    q: $("#candidate-search").value,
    sort: $("#sort-filter").value,
    minScore: $("#score-filter").value,
    data: $("#data-filter").value,
    view: $('#candidate-view').value,
  });
  if (state.favorite) params.set("favorites", "true");
  const result = await api(`/api/candidates?${params}`);
  if (version !== state.fetchingCandidates) return;
  state.candidates = list(result.items);
  renderGapStrip();
  renderCandidates();
  renderStats();
}

function syncRadarView() {
  const hot = $('#candidate-view').value === 'posts';
  const review = $('#candidate-view').value === 'review';
  for (const id of ['candidate-search-field','candidate-data-field','candidate-score-field','candidate-sort-field','favorite-tabs','candidate-table-wrap']) $(`#${id}`).hidden = hot||review;
  for (const id of ['hot-search-field','hot-window-field','hot-sort-field','hot-posts','hot-pagination']) $(`#${id}`).hidden = !hot;
  for (const id of ['review-search-field','review-stage-field','review-sort-field','review-board','review-pagination','review-discover-posts']) $(`#${id}`).hidden = !review;
  $('#candidate-empty').hidden = hot || review || state.candidates.length > 0;
  if (!hot) { $('#hot-posts-empty').hidden = true; $('#hot-posts-error').hidden = true; }
  $('#radar-list-title').textContent = review?'자동 발행 소재':hot ? '지금 반응이 큰 게시물' : ({materials:'선점 소재',tokens:'기존 토큰 동향',all:'전체 관측'})[$('#candidate-view').value] || '발견된 소재';
  $('#radar-list-description').textContent = review?(state.overview?.creativeAuto?.enabled
    ? '실제 반응이 있는 원문 → 한 장면의 농담 → 영어 이름·이미지 → 예산 내 자동 발행'
    : '수집 → AI 소재·영문 구상 → 정책 판단 → 자동 발행'):hot
    ? '인기순은 조회수·반응·게시 시각을 함께 비교합니다. AI 분석 전 원문도 표시합니다.'
    : '원문에서 찾은 소재와 확산의 근거를 확인합니다. 소재별 상세 정보에서 발행 구상을 검토할 수 있습니다.';
  $('#radar-scope-note').textContent = review?'관측 원문과 영어 구상을 기존 자동화 정책에 연결합니다.':hot ? '수집된 공개 게시물 안에서 비교합니다. X 전체 인기 순위가 아닙니다.' : '점수는 밈 신호의 강도이며 수익 확률이 아닙니다.';
  renderGapStrip();
  renderStats();
}
function hotMetric(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
function hotMetricText(value) {
  const metric = hotMetric(value);
  return metric === null ? '미제공' : metric.toLocaleString('ko-KR');
}
function hotWindowLabel() {
  return ({6:'최근 6시간',24:'최근 24시간',168:'최근 7일'})[$('#hot-window-filter').value] || '선택 기간';
}
function renderHotStats() {
  const result = state.hotPosts, coverage = result?.coverage || {}, stats = clear('#stats-grid');
  const total = hotMetric(result?.total);
  append(stats,
    statCard('표시 대상 게시물', total === null ? '—' : total.toLocaleString('ko-KR'), `${hotWindowLabel()} · 현재 검색 조건`, {unit:'개',lime:true,icon:'◎'}),
    statCard('조회수 제공', hotMetric(coverage.withViews) === null ? '—' : hotMetricText(coverage.withViews), '선택 기간에 조회수를 확보한 게시물', {unit:'개',icon:'◉'}),
    statCard('반응 수치 제공', hotMetric(coverage.withEngagement) === null ? '—' : hotMetricText(coverage.withEngagement), '선택 기간에 반응 수치를 확보한 게시물', {unit:'개',icon:'↗'}),
    statCard('누적 보관 게시물', hotMetric(coverage.storedPosts) === null ? '—' : hotMetricText(coverage.storedPosts), '기간 밖을 포함한 수집 공개 게시물', {unit:'개',icon:'▤'}),
  );
  $('#nav-count').textContent = total === null ? '—' : total.toLocaleString('ko-KR');
}
function hotPostCard(item, rank) {
  const card = node('article','hot-post-card'); card.setAttribute('role','listitem');
  const safe = validUrl(item.url);
  const content = node('div','hot-post-content');
  const source = String(item.sourceFamily || item.sourceId || (safe ? hostLabel(safe) : '출처 미제공')).slice(0,100);
  const author = String(item.author || '작성자 미제공').slice(0,100);
  const metadata = append(node('div','hot-post-meta'), node('span','hot-post-rank',String(rank).padStart(2,'0')),
    node('strong','',author), node('span','hot-post-source',source),
    node('span','',item.publishedAt ? `게시 ${ago(item.publishedAt).replace('방금 관측','방금')}` : '게시 시각 미제공'));
  const title = String(item.title || '').trim(), text = String(item.text || '').trim();
  append(content,metadata);
  if (title && title !== text && !text.startsWith(title)) content.append(node('h3','hot-post-title',title.slice(0,220)));
  content.append(node('p','hot-post-excerpt',text.slice(0,1000) || title.slice(0,1000) || '텍스트 없이 수집된 게시물입니다.'));
  const metrics = node('div','hot-post-metrics');
  for (const [key,label] of [['views','조회수'],['likes','좋아요'],['reposts','재게시'],['replies','답글']]) {
    const value = hotMetric(item.metrics?.[key]);
    const metric = append(node('div',`hot-post-metric${value === null ? ' missing' : ''}`),node('span','',label),node('strong','',hotMetricText(value)));
    metrics.append(metric);
  }
  content.append(metrics);
  const popularity = item.popularity || {}, deltas = [];
  for (const [key,label] of [['viewsDelta','조회'],['engagementDelta','반응']]) {
    const value = hotMetric(popularity[key]);
    if (value !== null) deltas.push(`${label} +${value.toLocaleString('ko-KR')}`);
  }
  const footer = node('div','hot-post-footer');
  if (deltas.length) {
    const minutes = hotMetric(popularity.deltaMinutes), interval = minutes ? minutes < 1 ? '1분 미만' : `${Math.round(minutes)}분` : '두 관측';
    footer.append(node('span','hot-post-growth',`${deltas.join(' · ')} · ${interval} 간격 관측`));
  } else footer.append(node('span','muted','증가량 비교 자료 없음'));
  footer.append(node('span','hot-post-observed',`수집 ${ago(item.observedAt || item.collectedAt).replace('방금 관측','방금')}`));
  footer.append(externalLink('원문 보기 ↗',item.url));
  content.append(footer);card.append(content);
  const image = [item.imageUrl,...list(item.imageUrls)].map(httpsUrl).find(Boolean);
  if (image) {
    const thumbnail = node('img','hot-post-thumbnail');thumbnail.src=image;thumbnail.alt='게시물 첨부 이미지';thumbnail.loading='lazy';thumbnail.referrerPolicy='no-referrer';thumbnail.width=132;thumbnail.height=132;
    thumbnail.addEventListener('error',()=>thumbnail.remove(),{once:true});card.append(thumbnail);
  }
  return card;
}
function renderHotPosts() {
  if ($('#candidate-view').value !== 'posts') return;
  const result = state.hotPosts, items = list(result?.items), total = hotMetric(result?.total), posts = clear('#hot-posts');
  posts.setAttribute('aria-busy',String(state.hotLoading));
  for (const [index,item] of items.entries()) posts.append(hotPostCard(item,state.hotOffset+index+1));
  $('#candidate-total').textContent = total === null ? '—' : `${total.toLocaleString('ko-KR')}개`;
  const empty = clear('#hot-posts-empty'); empty.hidden = items.length > 0 || Boolean(state.hotError);
  if (!empty.hidden) append(empty,node('span','empty-icon','◎'),node('strong','',state.hotLoading?'게시물을 불러오는 중입니다':'이 조건에 맞는 게시물이 없습니다'),
    node('p','',state.hotLoading?'수집된 원문과 반응 수치를 확인하고 있습니다.':'기간을 늘리거나 검색어를 바꿔보세요. 수집된 공개 게시물만 표시하며, 미제공 수치는 채우지 않습니다.'));
  const error = $('#hot-posts-error');error.hidden=!state.hotError;error.textContent=state.hotError;
  const coverage = result?.coverage || {}, windowPosts = hotMetric(coverage.windowPosts);
  $('#results-label').textContent = total === null ? '게시물 관측 데이터를 불러오는 중' : `${total.toLocaleString('ko-KR')}개 중 ${items.length ? state.hotOffset+1 : 0}–${state.hotOffset+items.length} 표시 · ${hotWindowLabel()} 수집 원문 ${windowPosts === null ? '—' : windowPosts.toLocaleString('ko-KR')}개${coverage.inputTruncated ? ` · 최근 저장 ${hotMetricText(coverage.scanLimit)}건 내 표본` : ''}`;
  $('#hot-page-label').textContent = total ? `${Math.floor(state.hotOffset/state.hotLimit)+1} / ${Math.ceil(total/state.hotLimit)}` : '—';
  $('#hot-previous').disabled=state.hotLoading||state.hotOffset===0;
  $('#hot-next').disabled=state.hotLoading||total===null||state.hotOffset+items.length>=total;
  renderHotStats();
}
async function fetchHotPosts({ version, offset }) {
  const params=new URLSearchParams({q:$('#hot-search').value,sort:$('#hot-sort-filter').value,hours:$('#hot-window-filter').value,limit:String(state.hotLimit),offset:String(Math.max(0,offset))});
  const query=JSON.stringify([params.get('q'),params.get('sort'),params.get('hours')]);
  if(state.hotQuery!==query){state.hotPosts=null;state.hotOffset=Math.max(0,offset);state.hotQuery=query;}
  state.hotLoading=true;state.hotError='';renderHotPosts();
  try {
    const result=await api(`/api/radar/posts?${params}`);
    if(version!==state.fetchingCandidates||$('#candidate-view').value!=='posts')return;
    state.hotPosts=result;state.hotOffset=number(result.offset);state.hotLimit=number(result.limit)||50;
  } catch(error) {
    if(version!==state.fetchingCandidates||$('#candidate-view').value!=='posts')return;
    state.hotError=`게시물 갱신 실패: ${error.message}${state.hotPosts?' · 마지막으로 받은 결과를 표시합니다.':''}`;
  } finally {
    if(version===state.fetchingCandidates&&$('#candidate-view').value==='posts'){state.hotLoading=false;renderHotPosts();}
  }
}
function sparkline(
  timeline,
  { width = 100, height = 32, detail = false } = {},
) {
  const rows = list(timeline).filter((point) =>
    Number.isFinite(Number(point.count)),
  );
  if (rows.length < 2) return node("span", "trend-no-data", "추이 데이터 부족");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    `언급 추이: ${rows.map((point) => point.count).join(", ")}`,
  );
  svg.classList.add("sparkline");
  const max = Math.max(1, ...rows.map((point) => Number(point.count)));
  const padding = detail ? 16 : 3;
  const points = rows.map((point, index) => [
    padding + (index / (rows.length - 1)) * (width - padding * 2),
    height - padding - (Number(point.count) / max) * (height - padding * 2),
  ]);
  if (detail)
    for (let level = 0; level < 4; level++) {
      const line = document.createElementNS(svg.namespaceURI, "line");
      const y = padding + (level * (height - padding * 2)) / 3;
      for (const [key, value] of Object.entries({
        x1: padding,
        x2: width - padding,
        y1: y,
        y2: y,
        stroke: "#2b3c48",
        "stroke-width": 1,
        "stroke-dasharray": "3 4",
      }))
        line.setAttribute(key, String(value));
      svg.append(line);
    }
  const area = document.createElementNS(svg.namespaceURI, "polygon");
  area.setAttribute(
    "points",
    `${padding},${height - padding} ${points.map((p) => p.join(",")).join(" ")} ${width - padding},${height - padding}`,
  );
  area.setAttribute("fill", detail ? "#c3f6640e" : "#c3f66409");
  svg.append(area);
  const path = document.createElementNS(svg.namespaceURI, "polyline");
  path.setAttribute("points", points.map((point) => point.join(",")).join(" "));
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#b6df70");
  path.setAttribute("stroke-width", detail ? "2.5" : "1.8");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  return svg;
}
function candidateState(candidate) {
  if (candidate.isDemo) return node("span", "pill demo", "데모");
  if (candidate.policyDecision)
    return candidate.policyDecision.allowed
      ? badge("healthy", "기준 충족")
      : badge("held", "발행 보류");
  if (list(candidate.exclusions).length) return badge("held", "발행 제외");
  const p = state.overview?.policy || {};
  if (
    number(candidate.score) < number(p.minScore) ||
    number(candidate.confidence) < number(p.minConfidence) ||
    number(candidate.independentSources) < number(p.minIndependentSources)
  )
    return badge("pending", "관측 중");
  return badge("healthy", "검토 가능");
}
function renderCandidates() {
  const tbody = clear("#candidate-rows");
  $("#candidate-total").textContent = state.candidates.length;
  $("#candidate-empty").hidden = state.candidates.length > 0;
  $("#results-label").textContent =
    `${state.candidates.length}개 후보 표시 · ${$("#data-filter").selectedOptions[0].textContent}`;
  if (!state.candidates.length) {
    const empty = clear("#candidate-empty");
    append(
      empty,
      node("span", "empty-icon", "◎"),
      node(
        "strong",
        "",
        state.favorite
          ? "관심 후보를 저장해 보세요"
          : "아직 조건에 맞는 소재가 없습니다",
      ),
      node(
        "p",
        "",
        state.favorite
          ? "후보의 별표를 눌러 관심 목록에 저장할 수 있습니다."
          : $('#candidate-view').value === 'materials'
            ? '원천 계정의 글·이미지에서 발굴한 새 소재가 여기에 표시됩니다. 한 계정에서만 발견된 소재도 초기 발견으로 남깁니다.'
            : "지금 수집을 실행하거나 검색·점수 필터를 조정하세요. 원문을 충분히 확보한 소재부터 표시됩니다.",
      ),
    );
  }
  for (const candidate of state.candidates) {
    const tr = node("tr");
    tr.tabIndex = 0;
    tr.setAttribute("aria-label", `${candidate.title} 상세 보기`);
    tr.addEventListener("click", () => openCandidate(candidate.id));
    tr.addEventListener("keydown", (event) => {
      if (event.target === tr && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        openCandidate(candidate.id);
      }
    });
    const titleCell = node("td");
    const avatar = node(
      "span",
      "candidate-avatar",
      String(candidate.title || "?").slice(0, 2),
    );
    const hues = [94, 165, 205, 35, 270];
    const hue =
      hues[
        Math.abs(
          String(candidate.id)
            .split("")
            .reduce((a, c) => a + c.charCodeAt(0), 0),
        ) % hues.length
      ];
    avatar.style.background = `hsl(${hue} 25% 20% / .7)`;
    avatar.style.color = `hsl(${hue} 45% 77%)`;
    const info = node("div");
    append(
      info,
      node("span", "candidate-title", candidate.title),
      append(
        node("div", "candidate-meta"),
        node(
          "span",
          "",
          kindLabels[candidate.kind] || candidate.kind || "밈 소재",
        ),
        node("span", "", "·"),
        node("span", "", ago(candidate.lastSeenAt)),
        candidate.isDemo ? node("span", "pill demo", "DEMO") : null,
        candidate.materialDiscovery ? node('span', 'pill info', ({seed:'초기 발견',spreading:'확산 조짐',established:'기존 소재',uncertain:'검증 대기'})[candidate.discoveryStage] || 'AI 발굴') : null,
        candidate.robinhoodChain?.status === "launched"
          ? node("span", "pill warning", "RH 발행됨")
          : null,
        list(candidate.crossChainTokens).length
          ? node(
              "span",
              "pill info",
              `타체인 ${list(candidate.crossChainTokens).length}`,
            )
          : null,
      ),
    );
    append(
      titleCell,
      append(node("div", "candidate-title-cell"), avatar, info),
    );
    const trend = append(
      node("td"),
      append(node("div", "trend-cell"), sparkline(candidate.timeline)),
    );
    const score = node(
      "span",
      `score-number${number(candidate.score) >= 75 ? " high" : ""}`,
      Math.round(number(candidate.score)),
    );
    score.append(node("small", "", "/100"));
    const confidence = node("div", "confidence-wrap");
    const track = node("span", "confidence-track");
    const bar = node("span");
    bar.style.width = `${percent(candidate.confidence)}%`;
    append(track, bar);
    append(
      confidence,
      track,
      node("span", "", `${Math.round(number(candidate.confidence))}%`),
    );
    const sources = node(
      "span",
      "source-count",
      candidate.independentSources ?? 0,
    );
    sources.append(node("small", "", "개"));
    const favorite = node(
      "button",
      `favorite-button${candidate.favorite ? " selected" : ""}`,
      candidate.favorite ? "★" : "☆",
    );
    favorite.type = "button";
    favorite.setAttribute(
      "aria-label",
      candidate.favorite ? "관심 후보에서 제거" : "관심 후보에 저장",
    );
    favorite.setAttribute("aria-pressed", String(Boolean(candidate.favorite)));
    favorite.addEventListener("click", (event) => {
      event.stopPropagation();
      busy(favorite, async () => {
        await api(`/api/candidates/${encodeURIComponent(candidate.id)}`, {
          method: "PATCH",
          body: { favorite: !candidate.favorite },
        });
        await fetchCandidates();
      });
    });
    append(
      tr,
      titleCell,
      trend,
      append(node("td"), score),
      append(node("td"), confidence),
      append(node("td"), sources),
      append(node("td"), candidateState(candidate)),
      append(node("td"), favorite),
    );
    tbody.append(tr);
  }
}

function isXCollector(collector) {
  return collector.kind === "x-html" || collector.family === "x.com";
}
function collectorMatchesStatus(collector, status) {
  const current = String(collector.status || "waiting").toLowerCase();
  const disabled = collector.enabled === false || current === "disabled";
  if (status === "disabled") return disabled;
  if (status === "all") return true;
  if (disabled) return false;
  if (status === "posts") return number(collector.itemCount) > 0;
  if (status === "limited")
    return ["limited", "partial", "degraded", "blocked", "unavailable"].includes(
      current,
    );
  if (status === "error") return ["error", "failed", "blocked", "rate_limited"].includes(current);
  if (status === "waiting") return !collector.lastCollectedAt;
  return false;
}
function collectorCoverage(collectors) {
  const accounts = collectors.filter(isXCollector);
  const enabled = accounts.filter(
    (item) => !collectorMatchesStatus(item, "disabled"),
  );
  return {
    xAccounts: accounts.length,
    enabledXAccounts: enabled.length,
    observedXAccounts: enabled.filter((item) => item.lastCollectedAt).length,
    withPostsXAccounts: enabled.filter((item) =>
      collectorMatchesStatus(item, "posts"),
    ).length,
    limitedXAccounts: enabled.filter((item) =>
      collectorMatchesStatus(item, "limited"),
    ).length,
    errorXAccounts: enabled.filter((item) =>
      collectorMatchesStatus(item, "error"),
    ).length,
    waitingXAccounts: enabled.filter((item) =>
      collectorMatchesStatus(item, "waiting"),
    ).length,
    ...state.overview?.collectionCoverage,
  };
}
function collectorBadge(collector) {
  if (collectorMatchesStatus(collector, "disabled")) return badge("disabled");
  if (collector.status === "rate_limited") return badge("warning", "요청 제한");
  if (collectorMatchesStatus(collector, "error"))
    return badge("error", collector.status === "blocked" ? "접근 차단" : "요청 오류");
  if (["running", "collecting"].includes(collector.status))
    return badge(collector.status);
  if (!collector.lastCollectedAt) return badge("waiting");
  if (isXCollector(collector) && number(collector.itemCount) > 0)
    return badge("partial", `공개 표본 ${collector.itemCount}개`);
  if (isXCollector(collector) && collectorMatchesStatus(collector, "limited"))
    return badge("limited", "공개 글 미확보");
  if (isXCollector(collector)) return badge("limited", "공개 글 0개");
  if (["ok", "not_modified", "cached"].includes(String(collector.status).toLowerCase()))
    return badge("ok", `${statusLabels[String(collector.status).toLowerCase()]} · ${number(collector.itemCount)}개`);
  return badge(collector.status);
}
function collectorCategory(collector) {
  if (collector.category) return String(collector.category);
  if (isXCollector(collector)) return null;
  const fallback = kindCategories[String(collector.kind || "")];
  if (!fallback) return null;
  if (fallback.startsWith("onchain"))
    return isRobinhoodChain(collector.chain)
      ? "onchain-robinhood"
      : "onchain-other";
  return fallback;
}
function collectorMatchesKind(collector, kind) {
  const category = collectorCategory(collector);
  if (kind === "x") return isXCollector(collector);
  if (kind === "robinhood")
    return String(collector.accountCategory || "").startsWith("robinhood_");
  if (kind === "onchain") return String(category || "").startsWith("onchain");
  if (kind === "community")
    return ["social", "community", "meme-db"].includes(category);
  if (kind === "news") return category === "news";
  if (kind === "trend") return category === "trend";
  if (kind === "other") return !isXCollector(collector) && !category;
  return true;
}
function renderCollectors() {
  const target = clear("#collector-grid");
  const collectors = list(state.overview?.collectors);
  const coverage = collectorCoverage(collectors);
  const summary = clear("#collector-summary");
  const others = collectors.filter((item) => !isXCollector(item));
  const otherActive = others.filter(
    (item) => !collectorMatchesStatus(item, "disabled"),
  );
  const otherOk = otherActive.filter((item) =>
    ["ok", "not_modified", "cached", "healthy", "active", "success", "available"].includes(
      String(item.status || "").toLowerCase(),
    ),
  ).length;
  const otherLimited = otherActive.filter((item) =>
    collectorMatchesStatus(item, "limited"),
  ).length;
  const otherError = otherActive.filter((item) =>
    collectorMatchesStatus(item, "error"),
  ).length;
  for (const [label, value, detail] of [
    ["지정 X 계정", coverage.xAccounts, `활성 ${coverage.enabledXAccounts}개`],
    ["요청 시도", coverage.observedXAccounts, "한 번 이상 요청한 활성 계정"],
    ["공개 글 반환", coverage.withPostsXAccounts, "최근 수집 표본 1개 이상"],
    ["범위 · 접근 제한", coverage.limitedXAccounts, "일부 글을 확보한 경우 포함"],
    ["요청 오류", coverage.errorXAccounts, "재시도 대기 포함"],
    ["첫 수집 대기", coverage.waitingXAccounts, "순환 수집 대상으로 대기"],
    ["보조 소스", others.length, `활성 ${otherActive.length}개 · 온체인·커뮤니티·뉴스·트렌드`],
    ["응답 성공", otherOk, "최근 요청이 정상 응답한 보조 소스"],
    ["제한·부분", otherLimited, "부분 수집 · 접근 제한 보조 소스"],
    ["요청 오류", otherError, "재시도 대기 중인 보조 소스"],
  ])
    append(
      summary,
      append(
        node("div", "panel collector-summary-card"),
        node("span", "", label),
        node("strong", "", display(value, "—")),
        node("small", "muted", detail),
      ),
    );
  const limits = [];
  if (coverage.cycleRequestLimit != null)
    limits.push(`한 순환에 X 계정 최대 ${coverage.cycleRequestLimit}개`);
  if (coverage.minimumRequestGapMs != null)
    limits.push(
      `X 요청 사이 최소 ${number(coverage.minimumRequestGapMs) / 1000}초`,
    );
  $("#collector-schedule").textContent =
    `${limits.length ? `${limits.join(" · ")}. ` : ""}계정별 다음 수집 시각에 따라 순차 요청합니다. 공개 글 반환과 범위 제한 수는 중복될 수 있습니다.`;
  const query = $("#collector-search").value.trim().toLocaleLowerCase();
  const kind = $("#collector-kind-filter").value;
  const status = $("#collector-status-filter").value;
  const filtered = collectors.filter((collector) => {
    if (!collectorMatchesKind(collector, kind)) return false;
    if (!collectorMatchesStatus(collector, status)) return false;
    return (
      !query ||
      [
        collector.id,
        collector.name,
        collector.handle,
        collector.displayName,
        collector.accountCategory,
        collector.accountCategoryLabel,
        collector.family,
        collector.kind,
        collector.category,
        categoryLabels[collectorCategory(collector)],
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(query.replace(/^@/, ""))
    );
  });
  $("#collector-results").textContent = `${collectors.length}개 소스 중 ${filtered.length}개 표시`;
  if (!filtered.length) {
    target.append(
      node(
        "div",
        "panel empty-state",
        collectors.length
          ? "조건에 맞는 수집 소스가 없습니다."
          : "수집기 상태가 아직 없습니다. 서버 수집기 설정을 확인하세요.",
      ),
    );
    return;
  }
  for (const collector of filtered) {
    const card = node("article", "panel collector-card");
    append(
      card,
      append(
        node("div", "collector-heading"),
        node(
          "h2",
          "",
          isXCollector(collector) && collector.handle
            ? collector.displayName || `@${collector.handle}`
            : collector.name || collector.id,
        ),
        collectorBadge(collector),
      ),
    );
    if (isXCollector(collector)) {
      const metadata = node("div", "collector-account");
      if (collector.handle)
        metadata.append(externalLink(`@${collector.handle} ↗`, collector.url));
      if (collector.accountCategoryLabel || collector.accountCategory)
        metadata.append(
          node("span", "pill", collector.accountCategoryLabel || collector.accountCategory),
        );
      if (collector.accountPriority != null)
        metadata.append(
          node("span", "muted", `우선순위 ${collector.accountPriority}`),
        );
      card.append(metadata);
    } else {
      const metadata = node("div", "collector-account");
      const category = collectorCategory(collector);
      if (category)
        metadata.append(
          node(
            "span",
            `pill${category === "onchain-robinhood" ? " success" : ""}`,
            categoryLabels[category] || category,
          ),
        );
      if (collector.kind) metadata.append(node("span", "muted", collector.kind));
      if (validUrl(collector.url))
        metadata.append(
          externalLink(
            `${collector.family || hostLabel(collector.url)} ↗`,
            collector.url,
          ),
        );
      if (number(collector.intervalSeconds) > 0)
        metadata.append(
          node(
            "span",
            "muted",
            `주기 ${Math.max(1, Math.round(number(collector.intervalSeconds) / 60))}분`,
          ),
        );
      card.append(metadata);
    }
    append(
      card,
      node(
        "p",
        "collector-coverage",
        typeof collector.coverage === "string"
          ? collector.coverage
          : JSON.stringify(collector.coverage ?? "수집 범위 정보 없음"),
      ),
    );
    const stats = node("div", "collector-stats");
    for (const [label, value] of [
      ["마지막 요청", date(collector.lastCollectedAt)],
      ["마지막 응답 성공", date(collector.lastSuccessAt)],
      [
        "다음 수집",
        collectorMatchesStatus(collector, "disabled")
          ? "비활성"
          : date(collector.nextRunAt),
      ],
      [
        "응답 지연",
        collector.latencyMs == null ? "첫 응답 전" : `${collector.latencyMs} ms`,
      ],
      [
        "최근 수집 표본",
        !collector.lastCollectedAt
          ? "첫 수집 전"
          : `${number(collector.itemCount)}개`,
      ],
      ["연속 요청 오류", `${number(collector.consecutiveErrors)}회`],
    ])
      append(stats, append(node("div", "", label), node("strong", "", value)));
    card.append(stats);
    if (collectorMatchesStatus(collector, "error"))
      card.append(
        node(
          "p",
          "collector-retry",
          collector.nextRunAt
            ? "재시도는 다음 수집 시각 이후 순환 순서에 따라 실행됩니다."
            : "재시도 예약 시각이 없습니다. 수집기 설정을 확인하세요.",
        ),
      );
    if (collector.error)
      card.append(
        node(
          "p",
          "collector-error",
          typeof collector.error === "string"
            ? collector.error
            : JSON.stringify(collector.error),
        ),
      );
    target.append(card);
  }
}
function observationProvenance(item) {
  const origin = String(item.origin || "");
  if (provenanceLabels[origin]) return provenanceLabels[origin];
  if (origin.startsWith("mastodon-")) return "Mastodon 공개 API";
  if (origin.startsWith("coingecko-")) return "CoinGecko 공개 API";
  if (origin.startsWith("bluesky-")) return "Bluesky 공개 API";
  const family = item.sourceFamily || item.sourceId;
  return family ? `공개 수집 경로 (${family})` : "공개 수집 경로";
}
function imageFeatureView(features) {
  if (!features || typeof features !== "object" || !features.hash) return null;
  const view = node("div", "image-feature-note");
  append(
    view,
    node("strong", "", `이미지 특징${features.algorithm ? ` · ${features.algorithm}` : ""}`),
    node("code", "", String(features.hash)),
    node("p", "", "시각적 유사성을 비교하는 보조 특징입니다. 같은 캐릭터나 의미의 밈이라는 판정은 아닙니다."),
  );
  return view;
}
// Author line for cards: source-given author → publisher → source family. Never a placeholder.
function authorText(item) {
  if (item.author || item.authorId) return String(item.author || item.authorId);
  if (item.publisher) return `발행 ${item.publisher}`;
  const family = item.sourceFamily || item.sourceId;
  return family ? String(family) : null;
}
function dateMeta(item, seconds = false) {
  const meta = node("div", "evidence-meta");
  for (const [label, value] of [
    ["게시", item.publishedAt],
    ["최초 관측", item.firstSeenAt],
    ["수집", item.collectedAt],
  ])
    if (value) meta.append(node("span", "", `${label} ${date(value, seconds)}`));
  return meta.childElementCount ? meta : null;
}
function metricsLine(item) {
  const entries = metricEntries(item.metrics);
  return entries.length
    ? node(
        "p",
        "evidence-metrics",
        entries.map(([key, value]) => metricText(key, value)).join(" · "),
      )
    : null;
}
function marketLine(item) {
  const market = item.market;
  if (!market || typeof market !== "object") return null;
  const parts = [];
  const chain = chainLabelFor(item);
  if (chain) parts.push(`체인 ${chain}`);
  if (finite(market.priceUsd)) parts.push(`가격 ${priceUsd(market.priceUsd)}`);
  if (finite(market.priceChange24hPct))
    parts.push(`24h ${signedPercent(market.priceChange24hPct)}`);
  if (finite(market.marketCapUsd))
    parts.push(`시총 ${compactUsd(market.marketCapUsd)}`);
  else if (finite(market.fdvUsd)) parts.push(`FDV ${compactUsd(market.fdvUsd)}`);
  if (finite(market.liquidityUsd))
    parts.push(`유동성 ${compactUsd(market.liquidityUsd)}`);
  if (finite(market.holders)) parts.push(`보유자 ${countText(market.holders)}`);
  if (market.listing)
    parts.push(listingLabels[market.listing] || String(market.listing));
  return parts.length ? node("p", "evidence-market", parts.join(" · ")) : null;
}
function externalLinksRow(item, className = "external-links") {
  const links = list(item.externalLinks).filter(
    (link) => link && typeof link === "object" && httpsUrl(link.url),
  );
  if (!links.length) return null;
  const row = node("div", className);
  for (const link of links.slice(0, 8))
    row.append(
      externalLink(`${externalLinkLabels[link.type] || "링크"} ↗`, link.url),
    );
  return row;
}
function originEnrichmentView(item) {
  const result = item.originEnrichment && typeof item.originEnrichment === "object" ? item.originEnrichment : null;
  const job = item.originEnrichmentJob;
  if (!result && !job) return null;
  const section = node("section", "origin-enrichment");
  section.setAttribute("aria-label", "감시 계정 AI 분석");
  const stale = !!result && job?.resultIsCurrent === false;
  let status = "분석 결과 없음", tone = "warning";
  if (job?.state === "queued") status = job.retrying ? "재시도 대기" : "분석 대기";
  else if (job?.state === "running") status = job.leaseExpired ? "재시작 대기" : "분석 중";
  else if (job?.state === "failed") { status = "처리 실패"; tone = "error"; }
  else if (stale) status = "결과 갱신 필요";
  else if (result?.status === "ready") { status = "AI 분석 완료"; tone = "success"; }
  else if (result?.status === "local_features_only") status = "AI 미연결 · 로컬 특징만";
  else if (result?.status === "model_error") { status = "AI 응답 오류"; tone = "error"; }
  append(section, append(node("div", "origin-enrichment-heading"),
    node("strong", "", "감시 계정 AI"), node("span", `pill ${tone}`, status)));
  if (stale) section.append(node("p", "origin-enrichment-note", "아래는 이전 자료의 분석 결과입니다. 새 자료의 결과는 아직 없습니다."));
  if (typeof result?.summary === "string" && result.summary.trim())
    section.append(node("p", "origin-enrichment-summary", result.summary.slice(0, 2000)));
  else if (result?.status === "ready") section.append(node("p", "origin-enrichment-note", "AI 응답에 요약문이 포함되지 않았습니다."));
  const labels = list(result?.labels).filter(value => typeof value === "string" && value.trim()).slice(0, 20);
  if (labels.length) {
    const tags = node("div", "origin-enrichment-labels");
    for (const label of labels) tags.append(node("span", "pill", label.slice(0, 100)));
    section.append(tags);
  }
  if (!stale && result?.materialsVersion === 1) {
    const materials = list(result.materials).slice(0, 3);
    if (!materials.length) section.append(node('p', 'origin-enrichment-note', '이번 원문에서 새 발행 소재를 제안하지 않았습니다.'));
    for (const material of materials) {
      const card = node('div', 'detail-section');
      append(card, node('strong', '', material.name), node('p', '', material.whyNow),
        actionButton('발굴 소재 보기', async () => {
          $('#candidate-view').value = material.novelty === 'established' ? 'all' : 'materials';
          $('#candidate-search').value = material.name;
          $('#score-filter').value = '0';
          $('#data-filter').value = 'real';
          state.favorite = false;
          $$('#favorite-tabs button').forEach(button => {
            const selected = button.dataset.favorite === 'false';
            button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected));
          });
          location.hash = 'radar'; await fetchCandidates();
        }, 'text-button'));
      section.append(card);
    }
  }
  if (result) {
    const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
    const evidence = Array.isArray(result.evidenceIds) ? new Set(result.evidenceIds.filter(value => typeof value === "string")).size : null;
    const links = list(result.context?.links);
    const missing = list(result.context?.missingContext).filter(value => value && typeof value === "object").slice(0, 20);
    const parts = [evidence === null ? "분석 자료 수 미기록" : `분석 자료 ${evidence}개`];
    if (count(result.imageCount) !== null) parts.push(`이미지 특징 확보 ${result.imageCount}개`);
    if (count(result.imageErrors) > 0) parts.push(`이미지 특징 실패 ${result.imageErrors}개`);
    section.append(node("p", "origin-enrichment-counts", parts.join(" · ")));
    const relations = { quote: "인용 원문", repost: "재게시 원문", reply: "답글 부모", same_author_recent: "같은 계정 최근 글" };
    section.append(node("p", "origin-enrichment-counts", Array.isArray(result.context?.links) ? Object.entries(relations)
      .map(([key, label]) => `${label} ${new Set(links.filter(link => link?.relation === key && typeof link.itemId === "string").map(link => link.itemId)).size}개`).join(" · ") : "연결 맥락 수 미기록"));
    if (missing.length) {
      const details = node("details", "origin-enrichment-missing");
      details.append(node("summary", "", `누락·미확인 정보 ${missing.length}건`));
      const reasons = {
        not_in_local_store: "보관함에 원문 없음", not_available_as_of_analysis: "분석 시점에 사용할 수 없음",
        related_context_limit: "이번 분석의 자료 수 한도", not_a_public_x_post: "사용 가능한 X 원문 아님",
        no_matching_prior_post_in_bounded_local_window: "조회 범위에 이전 글 없음", author_identity_missing: "작성자 정보 없음",
        no_relationship_metadata_observed: "인용·재게시·답글 관계 정보 미수신", no_supported_public_image_url_observed: "지원하는 이미지 주소 미수신",
      };
      const entries = node("ul", "");
      for (const entry of missing) entries.append(node("li", "", `${relations[entry.relation] || ({main_images:"첨부 이미지",reply_quote_repost:"원문 관계"})[entry.relation] || "추가 맥락"}: ${reasons[entry.reason] || "확보 여부 확인 필요"}`));
      details.append(entries); section.append(details);
    }
    section.append(node("p", "origin-enrichment-note", "로컬 보관 자료의 해석입니다. 이미지 특징 수는 AI가 이미지를 읽었는지 확인한 수치가 아닙니다."));
    if (result.at) section.append(node("p", "origin-enrichment-note", `${stale ? "이전 분석" : "분석"} ${date(result.at, true)}`));
  }
  if (job?.retrying || job?.state === "failed") section.append(node("p", "origin-enrichment-note", job.state === "failed"
    ? `분석 작업이 실패했습니다. 시도 ${job.attempts ?? 0}회. 원문은 보관되어 있습니다.`
    : `분석 중 오류가 발생해 재시도 대기 중입니다.${job.nextRunAt ? ` 다음 시도 ${date(job.nextRunAt, true)}` : ""}`));
  return section;
}
function observationCard(item) {
  const card = node("article", "panel observation-card");
  const heading = node("div", "observation-heading");
  const author = authorText(item);
  if (author) heading.append(node("strong", "", author));
  heading.append(node("span", "pill", observationProvenance(item)));
  append(
    card,
    heading,
    externalLink(
      `${item.title || String(item.text || "").slice(0, 110) || "원문 보기"} ↗`,
      item.url,
      "observation-title",
    ),
  );
  if (item.text) card.append(node("p", "observation-text", item.text));
  const context = item.collectionContext || {};
  const contextLine = [
    context.kind ? `관측 위치 ${context.kind}` : null,
    context.handle ? `계정 @${String(context.handle).replace(/^@/, "")}` : null,
    context.listId ? `List ${context.listId}` : null,
  ].filter(Boolean).join(" · ");
  if (contextLine) card.append(node("p", "observation-context", contextLine));
  append(
    card,
    dateMeta(item, true),
    metricsLine(item),
    marketLine(item),
    externalLinksRow(item),
  );
  if (item.imageUrl) card.append(externalLink("첨부 이미지 원문 ↗", item.imageUrl));
  append(card, imageFeatureView(item.imageFeatures));
  append(card, originEnrichmentView(item));
  if (item.origin === "browser-json")
    card.append(node("p", "observation-notice", "이 원문은 브라우저가 수신한 JSON에서 확보했습니다. 다른 이용자에게도 공개된 글인지 확인한 결과는 아닙니다."));
  return card;
}
function renderCaptureStatus() {
  const target = clear("#capture-status");
  const capture = state.capture;
  if (!capture) {
    target.append(node("div", "panel collector-summary-card", "브라우저 수신 상태를 아직 확인하지 못했습니다."));
    clear("#capture-lists");
    return;
  }
  const browser = capture.browser || {};
  for (const [label, value, description] of [
    ["수집 전용 키", capture.ingestConfigured ? "설정됨" : "설정 필요", "확장 설치와 X 페이지 열기는 별도입니다"],
    ["실제 JSON 수신", `${browser.captures ?? 0}회`, browser.captures > 0 ? `마지막 수신 ${date(browser.lastReceivedAt)}` : "확장에서 받은 기록이 아직 없습니다"],
    ["JSON에서 확보한 원문", `${browser.posts ?? 0}개`, browser.lastObservedAt ? `마지막 관측 ${date(browser.lastObservedAt)}` : "브라우저에서 X List나 프로필을 열어 관측하세요"],
  ])
    append(target, append(node("div", "panel collector-summary-card"),
      node("span", "", label), node("strong", "", value), node("small", "muted", description)));
  const listTarget = clear("#capture-lists");
  if (browser.lastPageUrl)
    listTarget.append(externalLink("최근 관측한 X 페이지 ↗", browser.lastPageUrl));
  if (list(capture.lists).length) {
    listTarget.append(node("span", "muted", "관측된 Lists"));
    for (const item of capture.lists)
      listTarget.append(actionButton(`List ${item.listId} · ${item.posts ?? 0}개`, async () => {
        $("#archive-list").value = String(item.listId);
        await fetchArchive({ offset: 0 });
      }, "button subtle small"));
  } else listTarget.append(node("span", "muted", "아직 관측된 X List가 없습니다."));
}
function renderArchive() {
  const target = clear("#archive-items");
  if (state.observations.length) {
    for (const item of state.observations) target.append(observationCard(item));
  } else {
    target.append(node("div", "panel empty-state", state.archiveLoading
      ? "보관된 원문을 불러오는 중입니다."
      : "조건에 맞는 X 원문이 없습니다. 검색·계정·List·핵심·생태계 AI 필터를 확인하거나 수집된 원문이 쌓일 때까지 기다리세요."));
  }
  $("#archive-items").setAttribute("aria-busy", String(state.archiveLoading));
  const first = state.observations.length ? state.observationOffset + 1 : 0;
  const last = state.observationOffset + state.observations.length;
  $("#archive-results").textContent = state.observationTotal == null
    ? "보관된 원문 수 확인 중"
    : `${state.observationTotal.toLocaleString("ko-KR")}개 중 ${first}–${state.observations.length ? last : 0}개 표시`;
  $("#archive-page").textContent = `${Math.floor(state.observationOffset / state.observationLimit) + 1} 페이지`;
  $("#archive-previous").disabled = state.archiveLoading || state.observationOffset === 0;
  $("#archive-next").disabled = state.archiveLoading || state.observationTotal == null || last >= state.observationTotal;
}
async function fetchArchive({ offset = state.observationOffset } = {}) {
  if (!state.key) return;
  const request = ++state.archiveRequest;
  state.archiveLoading = true;
  renderArchive();
  const params = new URLSearchParams({
    limit: String(state.observationLimit),
    offset: String(offset),
  });
  for (const [key, value] of [
    ["q", $("#archive-search").value.trim()],
    ["handle", $("#archive-handle").value.trim().replace(/^@/, "")],
    ["listId", $("#archive-list").value.trim()],
  ]) if (value) params.set(key, value);
  if ($("#archive-origin-only").checked) params.set("originOnly", "true");
  try {
    const results = await Promise.allSettled([
      api(`/api/observations?${params}`),
      api("/api/capture-status"),
    ]);
    if (request !== state.archiveRequest) return;
    const observationError = $("#archive-error");
    if (results[0].status === "fulfilled") {
      const result = results[0].value;
      state.observations = list(result.items);
      state.observationTotal = number(result.total);
      state.observationOffset = number(result.offset);
      state.observationLimit = number(result.limit) || 50;
      observationError.hidden = true;
      observationError.textContent = "";
    } else {
      observationError.hidden = false;
      observationError.textContent = `원문 검색 실패: ${results[0].reason.message} 마지막 성공 결과가 있으면 유지합니다.`;
    }
    const captureError = $("#capture-error");
    if (results[1].status === "fulfilled") {
      state.capture = results[1].value;
      captureError.hidden = true;
      captureError.textContent = "";
    } else {
      captureError.hidden = false;
      captureError.textContent = `수집 상태 확인 실패: ${results[1].reason.message}`;
    }
    renderCaptureStatus();
  } finally {
    if (request === state.archiveRequest) {
      state.archiveLoading = false;
      renderArchive();
    }
  }
}
// Historical transactions always use the network stored on their own launch record.
const NETWORK_EXPLORERS = Object.freeze({
  testnet: "https://explorer.testnet.chain.robinhood.com",
  mainnet: "https://robinhoodchain.blockscout.com",
});
function explorerFor(network) {
  return Object.hasOwn(NETWORK_EXPLORERS, network)
    ? NETWORK_EXPLORERS[network]
    : null;
}
function explorerLink(network, kind, value) {
  const base = explorerFor(network);
  const valid =
    kind === "tx"
      ? /^0x[a-fA-F0-9]{64}$/.test(value || "")
      : kind === "address" && /^0x[a-fA-F0-9]{40}$/.test(value || "");
  return base && valid ? `${base}/${kind}/${value}` : null;
}
function liquidityTokenCount(value) {
  try { return /^(?:0|[1-9][0-9]*)$/.test(String(value)) ? BigInt(value).toLocaleString('ko-KR') : '미제공'; } catch { return '미제공'; }
}
function ponsFeeText(launchpad={},english=false) {
  const bps=value=>Number.isFinite(value)&&value>=0?`${(value/100).toLocaleString(english?'en-US':'ko-KR',{maximumFractionDigits:2})}%`:english?'unavailable':'미제공';
  const fees=english?`Base trading fee ${bps(launchpad.baseFeeBps)} · Creator share of the base fee ${bps(launchpad.creatorFeeShareBps)} · Additional creator tax ${bps(launchpad.creatorTaxBps)}`:`기본 거래 수수료 ${bps(launchpad.baseFeeBps)} · 기본 수수료 중 창작자 몫 ${bps(launchpad.creatorFeeShareBps)} · 별도 창작자 세율 ${bps(launchpad.creatorTaxBps)}`;
  const snipe=Number.isFinite(launchpad.snipeTaxStartBps)&&Number.isFinite(launchpad.snipeTaxSeconds)?english?` · Initial buy-tax setting ${bps(launchpad.snipeTaxStartBps)} / ${launchpad.snipeTaxSeconds}s (RPC values)`:` · 초기 매수세 설정 ${bps(launchpad.snipeTaxStartBps)} / ${launchpad.snipeTaxSeconds}초 (RPC 조회값)`:'';
  return fees+snipe;
}
function suppliedLaunchpadUrl(value) {
  try { const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null; } catch { return null; }
}
function liquidityPercentInput(value) {
  const text=String(value??'').trim();if(!text)return null;
  if(!/^(?:[1-9]|[1-9][0-9]|100)$/.test(text))throw new Error('유동성 공급 비율은 1–100의 정수로 입력하거나 비워 두세요.');
  return Number(text);
}
function renderLiquidityOverview(overview) {
  const dex=overview.dex||{},policy=overview.policy||{},budget=dex.budget||{};
  const network=overview.network||{},pons=network.launchProtocol==='pons-v2';
  $('#liquidity-policy-panel').hidden=pons;
  if(pons){
    const launchpad=network.launchpad||{};
    $('#dex-policy-status').textContent='Pons V2 · 별도 LP 공급 미적용';$('#dex-policy-status').className='pill info';
    $('#liquidity-budget-panel').hidden=true;
    $('#launch-flow-title').textContent='Pons V2 · 본딩 커브에서 생성과 거래';
    $('#dex-launch-status').textContent=`${liquidityTokenCount(launchpad.supply)}개 토큰 전량을 본딩 커브에 배치합니다. 지정 발행 지갑은 창작자이자 수수료 수령 주소이며 초기 매수는 0 ETH입니다. 발행 수수료 ${weiToEth(launchpad.launchFeeWei,18)} ETH + 가스${network.configured===false?` · 연결 확인 필요: ${network.error||'설정 미완료'}`:''}`;
    $('#launch-fee-note').textContent=`${ponsFeeText(launchpad)}. 창작자 수수료는 에스크로에 적립되어 별도 청구가 필요합니다. 지갑에 즉시 자동 입금되지 않습니다.`;
    return;
  }
  $('#launch-flow-title').textContent='토큰 배포와 거래 개시는 별도 단계입니다.';
  $('#launch-fee-note').textContent='현재 토큰에는 별도 개발자 수수료가 없습니다. 거래 수수료 수익은 DEX 규칙과 LP 지분에 따라 결정되며, 개발자 지갑 자동 지급 기능은 없습니다.';
  const connected=['enabled','connected'].includes(dex.status);
  $('#dex-policy-status').textContent=dex.manualEnabled?'DEX 수동 공급 활성':connected?'DEX 연결됨':'DEX 설정 확인';
  $('#dex-policy-status').className=`pill ${dex.manualEnabled?'success':'warning'}`;
  $('#liquidity-budget-panel').hidden=false;
  const percent=policy.liquidityTokenPercent;
  const byPercent=Number.isInteger(percent)&&percent>=1&&percent<=100;
  append(clear('#liquidity-budget'),
    statCard('유동성 사용 비용',weiToEth(budget.spentWei),'공급 ETH와 확인된 가스 비용',{unit:'ETH',budget:true}),
    statCard('유동성 예약 비용',weiToEth(budget.reservedWei),'진행 중 공급 ETH와 가스 예약',{unit:'ETH',budget:true}),
    statCard('남은 유동성 예산',weiToEth(budget.remainingWei),`집계일 ${budget.date||todayLocal()}`,{unit:'ETH',budget:true,lime:true}),
    statCard(byPercent?'공급할 토큰 비율':'공급할 토큰 수량',byPercent?String(percent):liquidityTokenCount(policy.liquidityTokenAmount),byPercent?'각 토큰의 실제 고정 공급량 기준':'건별 고정 수량',{unit:byPercent?'%':'개',budget:true}));
  $('#liquidity-plan-summary').textContent=`토큰당 공급 ETH ${weiToEth(policy.liquidityEthWei,18)} ETH · ${byPercent?`공급량의 ${percent}%`: `${liquidityTokenCount(policy.liquidityTokenAmount)}개 토큰`} · 건별 총한도 ${weiToEth(policy.maxLiquidityPerLaunchWei,18)} ETH (공급 ETH + 가스)`;
  const mode=overview.network?.dryRun===true?'DRY_RUN · 실제 전송 없음':overview.network?.dryRun===false?'실제 전송 설정':'DRY_RUN 상태 미확인';
  $('#dex-launch-status').textContent=`${dex.manualEnabled?'수동 유동성 요청 활성':dex.reason||'유동성 설정과 정책을 확인하세요.'} · ${mode}. 토큰 생성 후 발행 지갑의 ETH·토큰 잔액과 별도 예산을 다시 검사합니다.`;
}
function liquidityPresentation(launch, jobs = []) {
  const job = jobs.find(
    (item) =>
      item.id === launch.liquidity?.jobId || item.launchId === launch.id,
  );
  const jobIsNewer =
    job?.updatedAt &&
    launch.updatedAt &&
    Date.parse(job.updatedAt) > Date.parse(launch.updatedAt);
  const status =
    job &&
    (!launch.liquidityStatus ||
      launch.liquidityStatus === "unconnected" ||
      jobIsNewer)
      ? job.status
      : launch.liquidityStatus || launch.tradingStatus || "unconnected";
  // Only the backend's explicit trading confirmation can mark a token tradable.
  const tradable = launch.tradingStatus === "tradable";
  const states = {
    unconnected: ["unavailable", "DEX 미연결"],
    queued: ["pending", "유동성 대기"],
    pending: ["pending", "유동성 진행 중"],
    prepared: ["pending", "유동성 서명 저장"],
    submitted: ["pending", "유동성 온체인 확인"],
    uncertain: ["warning", "유동성 결과 확인 필요"],
    unknown: ["warning", "유동성 결과 확인 필요"],
    held: ["held", "유동성 보류"],
    failed: ["error", "유동성 실패"],
    cancelled: ["held", "유동성 취소"],
    confirmed: ["warning", "거래 개시 상태 확인 필요"],
  };
  const [badgeStatus, label] = tradable
    ? ["success", "거래 개시 완료"]
    : states[status] || ["warning", "유동성 상태 확인 필요"];
  const stageLabels = {
    approve: "토큰 사용 승인",
    addLiquidity: "유동성 공급",
  };
  const stepLabels = {
    prepared: "서명 저장",
    submitted: "전송됨",
    pending: "확인 대기",
    uncertain: "결과 확인 필요",
    confirmed: "온체인 확인 완료",
    failed: "온체인 실패",
  };
  const steps = (Array.isArray(job?.steps) ? job.steps : []).map((step) => ({
    label: `${stageLabels[step.stage] || step.stage || "거래"} · ${stepLabels[step.status] || step.status || "대기"}`,
    txHash: step.txHash,
    url: explorerLink(launch.network, "tx", step.txHash),
    pairAddress: step.pairAddress,
  }));
  const reasons = [
    ...new Set(
      [
        launch.liquidity?.reason,
        launch.liquidity?.error,
        job?.reason,
        job?.error,
      ].filter(Boolean),
    ),
  ];
  if (status === "failed" && !reasons.length)
    reasons.push(
      "온체인 유동성 거래가 실패했습니다. 단계별 트랜잭션을 확인하세요.",
    );
  const pairAddress =
    launch.liquidity?.pairAddress ||
    job?.pairAddress ||
    steps.findLast((step) => step.pairAddress)?.pairAddress;
  return {
    job,
    status,
    badgeStatus,
    label,
    tradable,
    reasons,
    steps,
    stage: job?.stage ? stageLabels[job.stage] || job.stage : null,
    txHash: launch.liquidity?.txHash,
    txUrl: explorerLink(launch.network, "tx", launch.liquidity?.txHash),
    pairAddress,
    pairUrl: explorerLink(launch.network, "address", pairAddress),
    recipient: job?.recipient || launch.draft?.recipient || null,
    signerAddress: job?.signerAddress || job?.expectedSignerAddress || job?.issuerWallet || launch.issuerWallet || null,
    liquidityBalance: launch.liquidity?.liquidityBalance ?? job?.liquidityBalance ?? null,
  };
}
async function requestLaunchLiquidity(launch) {
  if(launch.launchProtocol==='pons-v2')throw new Error('Pons V2 토큰은 본딩 커브 거래를 사용하므로 별도 V2 유동성 공급 요청이 적용되지 않습니다.');
  const requests=state.liquidityRequests ||= {};
  if(requests[launch.id]?.pending)return;
  requests[launch.id]={pending:true,error:''};renderLaunches();
  try {
    const job=await api(`/api/launches/${encodeURIComponent(launch.id)}/liquidity`,{method:'POST',body:{execution:'manual'},signal:AbortSignal.timeout(180000)});
    if(state.overview){state.overview.dex ||= {};state.overview.dex.jobs=[job,...list(state.overview.dex.jobs).filter(item=>item.id!==job.id&&item.launchId!==launch.id)];}
    toast(`유동성 작업 ${short(job.id)} · ${statusLabels[job.status]||job.status}`);
    await refresh();
  } catch(error){requests[launch.id].error=error.message;throw error;}
  finally {requests[launch.id].pending=false;renderLaunches();}
}
function renderLiquidityCell(launch, jobs) {
  if(launch.launchProtocol==='pons-v2'){
    const tradable=launch.tradingStatus==='tradable',venue=launch.tradingVenue==='pons-uniswap-v4'?'V4 풀':'본딩 커브',cell=append(node('td'),badge(tradable?'success':'pending',tradable?`Pons ${venue} 거래 활성`:'Pons 거래 상태 확인 중'));
    cell.append(node('span','launch-reason','Pons V2 · 별도 V2 유동성 공급 미적용'));
    if(launch.curveAddress)cell.append(externalLink(`본딩 커브 ${short(launch.curveAddress)} ↗`,explorerLink(launch.network,'address',launch.curveAddress),'launch-link'));
    if(launch.creatorFeeRecipient)cell.append(externalLink(`창작자 수수료 수령 ${short(launch.creatorFeeRecipient)} ↗`,explorerLink(launch.network,'address',launch.creatorFeeRecipient),'launch-link'));
    const launchpadUrl=suppliedLaunchpadUrl(launch.launchpadUrl);if(launchpadUrl)cell.append(externalLink('Pons에서 보기 ↗',launchpadUrl,'launch-link'));
    return cell;
  }
  const view = liquidityPresentation(launch, jobs);
  const cell = append(node("td"), badge(view.badgeStatus, view.label));
  if (view.stage)
    cell.append(
      node(
        "span",
        "launch-reason",
        `${view.tradable ? "완료 단계" : "현재 단계"}: ${view.stage}`,
      ),
    );
  for (const step of view.steps) {
    cell.append(node("span", "launch-reason", step.label));
    if (step.txHash)
      cell.append(
        externalLink(`TX ${short(step.txHash)} ↗`, step.url, "launch-link"),
      );
  }
  if (view.txHash && !view.steps.some((step) => step.txHash === view.txHash)) {
    cell.append(
      externalLink(
        `유동성 TX ${short(view.txHash)} ↗`,
        view.txUrl,
        "launch-link",
      ),
    );
  }
  for (const reason of view.reasons)
    cell.append(
      node(
        "span",
        "launch-reason",
        typeof reason === "string" ? reason : JSON.stringify(reason),
      ),
    );
  if (view.pairAddress)
    cell.append(
      externalLink(
        `페어 ${short(view.pairAddress)} ↗`,
        view.pairUrl,
        "launch-link",
      ),
    );
  if (launch.tokenAddress && ['confirmed','deployed'].includes(launch.status) && !view.tradable)
    cell.append(
      node("span", "launch-reason", "토큰 생성 완료 · 유동성 확인 후 거래 개시"),
    );
  const settings=view.job?.settings;
  if(settings)cell.append(node('span','launch-reason',`공급 계획: ${weiToEth(settings.ethAmountWei,18)} ETH + ${liquidityTokenCount(settings.tokenAmount)}개 토큰${view.job.tokenPercent!=null?` (공급량의 ${view.job.tokenPercent}%)`:''}`));
  if(view.job?.reservedWei!=null)cell.append(node('span','launch-reason',`남은 예약: ${weiToEth(view.job.reservedWei,18)} ETH · 공급 ETH와 가스 포함`));
  if(view.signerAddress)cell.append(externalLink(`공급 지갑 ${short(view.signerAddress)} ↗`,explorerLink(launch.network,'address',view.signerAddress),'launch-link'));
  if(view.recipient)cell.append(externalLink(`LP 수령 ${short(view.recipient)} ↗`,explorerLink(launch.network,'address',view.recipient),'launch-link'));
  if(view.liquidityBalance!=null)cell.append(node('span','launch-reason',`확인된 LP 잔액: ${weiToEth(view.liquidityBalance,18)} LP`));
  const request=state.liquidityRequests?.[launch.id],dex=state.overview?.dex||{};
  if(!view.job&&!view.tradable&&launch.execution==='live'&&['confirmed','deployed'].includes(launch.status)&&launch.tokenAddress){
    const launchButton=actionButton(request?.pending?'유동성 요청 중…':'유동성 공급 요청',()=>requestLaunchLiquidity(launch),'button secondary small');
    launchButton.disabled=Boolean(request?.pending)||dex.canRequestLiquidity===false||dex.manualEnabled!==true;
    launchButton.title=dex.canRequestLiquidity===false?'관리자 권한이 필요합니다.':dex.manualEnabled!==true?dex.reason||'유동성 설정·정지 상태·네트워크 조건을 확인하세요.':'설정된 ETH와 토큰 수량으로 공급합니다. 잔액·가스·예산을 요청 시 다시 검사합니다.';
    cell.append(launchButton);
  }
  if(request?.error)cell.append(node('span','error-text',request.error));
  return cell;
}
function renderLaunches() {
  const o = state.overview || {};
  const b = o.budget || {};
  const p = o.policy || {};
  const n = o.network || {};
  const subtitle = $('#page-launches .page-heading .muted');
  if (subtitle) subtitle.textContent = n.launchProtocol === 'pons-v2'
    ? 'Pons V2에서 토큰·본딩 커브 생성과 거래 상태를 추적합니다.'
    : '토큰 생성과 유동성 공급을 나누어 거래 개시까지 추적합니다.';
  append(
    clear("#launch-budget"),
    statCard(
      "오늘 사용 비용",
      weiToEth(b.spentWei),
      n.launchProtocol==='pons-v2'?"온체인 확인된 발행 수수료와 가스":"온체인 확인된 가스 비용",
      { unit: "ETH", budget: true },
    ),
    statCard(
      "예약된 비용",
      weiToEth(b.reservedWei),
      "진행 중 발행의 원자적 예약",
      { unit: "ETH", budget: true },
    ),
    statCard(
      "남은 예산",
      weiToEth(b.remainingWei),
      `일일 한도 ${weiToEth(p.maxDailyCostWei)} ETH`,
      { unit: "ETH", lime: true, budget: true },
    ),
    statCard(
      "오늘 발행 수",
      `${b.count ?? 0} / ${p.maxDailyLaunches ?? 0}`,
      `예산 집계일 ${b.date || todayLocal()}`,
      { unit: "건" },
    ),
  );
  const wallet = clear("#wallet-card");
  append(wallet, node("h2", "", "네트워크 · 발행 지갑"));
  const grid = node("div", "wallet-grid");
  grid.style.marginTop = "20px";
  const rotating = n.walletMode === "rotating" || o.walletLaunchLimit?.mode === "rotating";
  const pairs = [
    [
      "네트워크",
      `${n.network || p.network || "testnet"} · Chain ID ${n.chainId || "미설정"}`,
    ],
    ['발행 경로',n.launchProtocol==='pons-v2'?'Pons V2 · 본딩 커브':'ERC-20 Factory · V2 유동성 별도'],
    ...(rotating
      ? [
          ["발행 방식", "발행마다 새 파생 지갑 · 지갑당 평생 1개"],
          ...(n.launchProtocol==='pons-v2'?[['지정 지갑 역할','창작자·수수료 수령 · 토큰 전량은 본딩 커브']]:[["권한 서명 주소", n.authorityAddress || "LAUNCH_AUTHORITY_PRIVATE_KEY 미설정"]]),
          ["가스 지급 주소", n.funderAddress || "미설정"],
          ["가스 지급 잔액", `${weiToEth(n.funderBalanceWei)} ETH`],
        ]
      : [
          ["지갑 주소", n.walletAddress || "서버 서명 지갑 미설정"],
          ["지갑 잔액", `${weiToEth(n.balanceWei)} ETH`],
        ]),
    ["Factory 주소", (n.launchProtocol==='pons-v2'?n.launchpad?.factoryAddress:n.factoryAddress) || "Factory 주소 설정 필요"],
    ["RPC", n.rpcUrl || "RPC 미설정"],
    ["추가 발행 권한", "없음 · 고정 공급량 ERC-20"],
  ];
  for (const [label, value] of pairs)
    append(
      grid,
      append(
        node("div"),
        node("span", "muted", label),
        node(label.includes("주소") ? "code" : "strong", "", value),
      ),
    );
  append(wallet, grid);
  if (o.walletLaunchLimit?.mode === "rotating") {
    const quota = o.walletLaunchLimit;
    const pool = quota.pool || {};
    const reason = {
      WALLET_POOL_NOT_CONFIGURED: "LAUNCH_WALLET_MNEMONIC이 없어 파생 지갑을 만들 수 없습니다.",
      SIGNER_OR_FACTORY_NOT_CONFIGURED: "권한 서명 키 또는 검증된 Factory가 없습니다.",
    }[quota.reason] || (quota.allowed ? "새 발행마다 다음 인덱스의 지갑을 배정하고 가스를 입금합니다." : quota.reason || "발행 가능 상태를 확인해야 합니다.");
    wallet.append(node("p", quota.allowed ? "chart-help" : "wallet-error",
      `발행 지갑 풀: 사용 ${pool.used ?? 0} · 진행 ${(pool.assigned ?? 0) + (pool.funding ?? 0) + (pool.funded ?? 0)} · 취소 ${pool.abandoned ?? 0} · 다음 인덱스 ${pool.nextIndex ?? 0} · 누적 가스 입금 ${weiToEth(pool.fundedWei)} ETH. ${reason}`));
    if (Array.isArray(pool.recent) && pool.recent.length) {
      const list = node("ul", "wallet-pool-list");
      for (const row of pool.recent.slice(0, 5))
        list.append(append(node("li"), node("code", "", `#${row.walletIndex} ${row.address}`), node("span", "muted", ` ${row.state}${row.fundingWei && row.fundingWei !== "0" ? ` · 입금 ${weiToEth(row.fundingWei)} ETH` : ""}`)));
      wallet.append(list);
    }
  } else if (o.walletLaunchLimit) {
    const quota = o.walletLaunchLimit;
    const reason = {
      WALLET_REQUIRED: '서명 지갑을 설정해야 합니다.',
      WALLET_ALREADY_USED: '이 지갑은 이미 발행했거나 발행 요청을 처리 중입니다.',
      WALLET_RESERVATION_NOT_FOUND: '이 지갑의 발행 예약을 확인하지 못했습니다.',
    }[quota.reason] || (quota.allowed ? '현재 지갑의 발행 한도가 남아 있습니다.' : '발행 가능 상태를 확인해야 합니다.');
    wallet.append(node('p', quota.allowed ? 'chart-help' : 'wallet-error',
      `발행 제한: 지갑당 1개(네트워크별 누적). ${reason} LAUNCH_WALLET_MNEMONIC을 설정하면 발행마다 새 지갑을 사용합니다.`));
  }
  if (o.image) {
    const image = o.image;
    wallet.append(node("p", image.enabled ? "chart-help" : "muted",
      image.enabled
        ? `토큰 이미지: ${image.provider}${image.model ? ` (${image.model})` : ""} · ${image.provider === 'source' ? '원본 공개 URL + 로컬 미리보기' : `저장 ${image.host || "로컬 파일만"}`} · ${image.required || n.launchProtocol === 'pons-v2' ? "실제 발행 전 이미지 준비 확인 필수" : "이미지 없이도 발행 가능"}`
        : `토큰 이미지 준비 기능 미설정${image.error ? ` (${image.error})` : ""} · ${n.launchProtocol === 'pons-v2' ? 'Pons 발행에는 공개 이미지 URL이 필요합니다.' : '메타데이터에는 기본 기하학 이미지가 들어갑니다.'}`));
  }
  if (n.error) wallet.append(node("p", "wallet-error", n.error));
  const rows = clear("#launch-rows");
  $("#launch-count").textContent = `${state.launches.length}건`;
  $("#launch-empty").hidden = state.launches.length > 0;
  for (const launch of state.launches) {
    const tr = node("tr");
    const job = append(
      node("td"),
      node(
        "strong",
        "launch-name",
        launch.draft?.name ||
          state.candidates.find((c) => c.id === launch.candidateId)?.title ||
          "토큰 발행",
      ),
      launch.draft?.isDemo ? node("span", "pill demo", "DEMO") : null,
      node("span", "launch-id", short(launch.id)),
      node(
        "div",
        "launch-time",
        `${date(launch.createdAt)} · ${(launch.network || p.network || "").toUpperCase()}`,
      ),
    );
    const status = append(node("td"), badge(launch.status));
    if (['queued', 'held'].includes(launch.status) && !launch.txHash && !launch.tokenAddress) {
      const cancel = node('button', 'button secondary small', '미서명 발행 취소');
      cancel.addEventListener('click', () => busy(cancel, async () => {
        await api(`/api/launches/${encodeURIComponent(launch.id)}/cancel`, { method: 'POST', body: {} });
        await refresh();
      }));
      status.append(cancel);
    }
    const reasons =
      launch.reason || launch.error || list(launch.reasons).join(" · ");
    if (reasons)
      status.append(
        node(
          "span",
          "launch-reason",
          typeof reasons === "string" ? reasons : JSON.stringify(reasons),
        ),
      );
    const chain = node("td");
    const recordNetwork = launch.network;
    if (launch.txHash)
      chain.append(
        externalLink(
          `TX ${short(launch.txHash)} ↗`,
          explorerLink(recordNetwork, "tx", launch.txHash),
          "launch-link",
        ),
      );
    if (launch.tokenAddress)
      chain.append(
        externalLink(
          `토큰 ${short(launch.tokenAddress)} ↗`,
          explorerLink(recordNetwork, "address", launch.tokenAddress),
          "launch-link",
        ),
      );
    if (!launch.txHash && !launch.tokenAddress)
      chain.append(node("span", "muted", "전송 기록 없음"));
    const settled = ["confirmed", "failed", "deployed"].includes(launch.status);
    const paper = launch.execution === "paper" || launch.status === "paper";
    const costs = append(
      node("td"),
      node(
        "span",
        "",
        `${weiToEth(settled ? launch.actualCostWei : launch.estimatedCostWei)} ETH`,
      ),
      node(
        "div",
        "launch-time",
        paper
          ? "PAPER 계획 비용 · 미전송"
          : launch.launchProtocol==='pons-v2'
            ? settled?'발행 수수료 + 실제 가스':'발행 수수료 + 예상 가스'
            : settled ? "실제 가스 비용" : "예상 비용",
      ),
    );
    const trading = renderLiquidityCell(launch, list(o.dex?.jobs));
    append(tr, job, status, chain, costs, trading);
    rows.append(tr);
  }
}

function fillPolicy(policy) {
  policy = {
    recipientMode: "fixed",
    liquidityTokenAmount: "1000000",
    liquidityTokenPercent: null,
    liquiditySlippageBps: 50,
    liquidityDeadlineSeconds: 300,
    maxLiquidityPerLaunchWei: "0",
    liquidityEthWei: "1000000000000000",
    ...policy,
  };
  const form = $("#policy-form");
  for (const [key, value] of Object.entries(policy)) {
    const field = form.elements.namedItem(key);
    if (!field) continue;
    if (key === "mode") field.value = value;
    else if (field.type === "checkbox") field.checked = Boolean(value);
    else if (key === "forbiddenKeywords") field.value = list(value).join(", ");
    else field.value = value ?? "";
  }
  for (const [name, key] of [
    ["maxPerLaunchEth", "maxPerLaunchWei"],
    ["maxDailyCostEth", "maxDailyCostWei"],
    ["maxLiquidityDailyEth", "maxLiquidityDailyWei"],
    ["maxLiquidityPerLaunchEth", "maxLiquidityPerLaunchWei"],
    ["liquidityEthAmount", "liquidityEthWei"],
  ])
    form.elements.namedItem(name).value = exactEth(policy[key]);
  $("#policy-version").textContent = `POLICY v${policy.version ?? "—"}`;
  updatePolicyRecipientMode();
}
function updatePolicyRecipientMode() {
  const issuer = $("#policy-form").elements.namedItem("recipientMode").value === "issuer";
  $("#policy-fixed-recipient").hidden = issuer;
  $("#policy-recipient-help").textContent = issuer
    ? "각 발행 지갑이 토큰을 수령합니다. 서버에 지갑 순환용 니모닉이 필요하며 수령 주소는 발행 지갑 배정 시 확정됩니다. 유동성도 해당 발행 지갑이 서명하고 LP 지분을 수령합니다. 새 초안과 그 발행에 적용되며 기존 초안과 고정된 발행 정보는 바뀌지 않습니다."
    : "고정 공통 주소가 토큰을 수령합니다. 수령 방식은 새 초안과 그 발행에 적용되며 기존 초안과 고정된 발행 정보는 바뀌지 않습니다.";
}
async function savePolicy(event) {
  event.preventDefault();
  const button = $("#policy-form button[type=submit]");
  await busy(button, async () => {
    const form = $("#policy-form");
    const values = new FormData(form);
    const payload = {
      mode: values.get("mode"),
      network: values.get("network"),
      recipientMode: values.get("recipientMode") || "fixed",
      recipient: String(values.get("recipient") || "").trim(),
      supply: String(values.get("supply") || "").trim(),
      forbiddenKeywords: String(values.get("forbiddenKeywords") || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
      liquidityEnabled: values.has("liquidityEnabled"),
      maxPerLaunchWei: ethToWei(values.get("maxPerLaunchEth")),
      maxDailyCostWei: ethToWei(values.get("maxDailyCostEth")),
      maxLiquidityDailyWei: ethToWei(values.get("maxLiquidityDailyEth")),
      maxLiquidityPerLaunchWei: ethToWei(
        values.get("maxLiquidityPerLaunchEth"),
      ),
      liquidityEthWei: ethToWei(values.get("liquidityEthAmount")),
      liquidityTokenAmount: String(values.get("liquidityTokenAmount") || "0"),
      liquidityTokenPercent: liquidityPercentInput(values.get('liquidityTokenPercent')),
    };
    for (const key of [
      "minScore",
      "minConfidence",
      "minIndependentSources",
      "maxDataAgeSeconds",
      "maxDailyLaunches",
      "minLaunchIntervalSeconds",
      "maxConsecutiveErrors",
      "liquiditySlippageBps",
      "liquidityDeadlineSeconds",
    ])
      payload[key] = Number(values.get(key));
    try {
      const policy = await api("/api/policies", {
        method: "PATCH",
        body: payload,
      });
      state.policyDirty = false;
      $("#policy-error").textContent = "";
      $("#policy-dirty").textContent =
        "저장 시 새 정책 버전과 감사 기록이 생성됩니다.";
      if (state.overview) state.overview.policy = policy;
      renderOverview();
      fillPolicy(policy);
      toast(`정책 v${policy.version} 저장 · ${policy.mode} 모드`);
      await refresh();
    } catch (error) {
      $("#policy-error").textContent = error.message;
      throw error;
    }
  });
}

async function openCandidate(id) {
  const request = ++state.detailRequest;
  state.selected = null;
  state.draft = null;
  state.simulation = null;
  state.manualLaunch = null;
  state.draftStatusError = '';
  clear("#candidate-detail").append(
    node("div", "empty-state", "후보의 원문과 분석 근거를 불러오는 중…"),
  );
  if (!$("#candidate-dialog").open) $("#candidate-dialog").showModal();
  try {
    const result = await api(`/api/candidates/${encodeURIComponent(id)}`);
    if (request !== state.detailRequest) return;
    state.selected = result.candidate
      ? {
          ...result.candidate,
          evidence: result.evidence || result.candidate.evidence,
        }
      : result;
    state.draft = result.latestDraft || null;
    state.draftDirty = false;
    renderDetail();
  } catch (error) {
    clear("#candidate-detail").append(
      node("div", "empty-state", error.message),
    );
  }
}
function renderDetail() {
  const c = state.selected;
  if (!c) return;
  const pons=state.overview?.network?.launchProtocol==='pons-v2';
  const body = node("div", "drawer-body");
  const title = node("h2", "", c.title);
  title.id = "detail-title";
  const favorite = actionButton(
    c.favorite ? "★" : "☆",
    async () => {
      const result = await api(`/api/candidates/${encodeURIComponent(c.id)}`, {
        method: "PATCH",
        body: { favorite: !c.favorite },
      });
      c.favorite = result.favorite ?? !c.favorite;
      renderDetail();
      await fetchCandidates();
    },
    `icon-button favorite-button${c.favorite ? " selected" : ""}`,
  );
  favorite.setAttribute(
    "aria-label",
    c.favorite ? "관심 후보에서 제거" : "관심 후보로 저장",
  );
  append(body, append(node("div", "detail-title-line"), title, favorite));
  if (c.description)
    body.append(node("p", "detail-description", c.description));
  const tags = append(
    node("div", "detail-tags"),
    node(
      "span",
      `pill${c.isDemo ? " demo" : " success"}`,
      c.isDemo ? "DEMO · 데모 데이터" : "REAL · 실제 관측",
    ),
    node("span", "pill", kindLabels[c.kind] || c.kind || "밈 소재"),
    node("span", "muted", `최초 관측 ${date(c.firstSeenAt)}`),
    node("span", "muted", `최근 관측 ${date(c.lastSeenAt)}`),
  );
  body.append(tags);
  if (c.materialDiscovery) {
    const material = c.materialDiscovery, section = node('section', 'detail-section');
    const stages = { seed: '초기 발견 · 최근 확산 확인 전', spreading: '확산 조짐', established: '이미 알려진 소재', uncertain: '추가 근거 필요' };
    append(section, node('h3', '', stages[c.discoveryStage] || '게시글에서 발굴한 소재'),
      node('p', '', material.whyNow || ''), node('p', '', material.remixHook ? `반복·패러디 포인트: ${material.remixHook}` : ''),
      node('p', 'chart-help', `원천 AI가 제안한 소재입니다. 모델 확신은 ${({low:'낮음',medium:'보통',high:'높음'})[material.modelConfidence] || '미확인'}이며 미래 유행의 확률을 뜻하지 않습니다.`));
    if (material.visualDescription) section.append(node('p', '', `이미지 맥락: ${material.visualDescription}`));
    if (material.tokenProposal) {
      const proposal = material.tokenProposal;
      append(section, node('h4', '', '토큰 발행 구상'),
        node('p', '', `${proposal.name} · $${proposal.symbol}`), node('p', '', proposal.description),
        node('p', 'chart-help', proposal.imagePrompt ? `이미지 제작 구상: ${proposal.imagePrompt}` : '이미지 제작 구상 없음'),
        node('p', 'chart-help', '아래 토큰 초안에 이 이름·티커·설명을 반영합니다. 기존 토큰 중복과 실제 발행 조건은 별도로 확인합니다.'));
    }
    body.append(section);
  }
  if (c.tokenMentions) {
    const section = node('section', 'detail-section');
    append(section, node('h3', '', `$${c.tokenMentions.symbol} 언급 집계`),
      node('p', '', `고유 원문 ${c.tokenMentions.mentionCount ?? list(c.evidenceIds).length}개 · 작성자 ${c.uniqueAuthors ?? 0}명 · 출처 ${c.independentSources ?? 0}곳`),
      node('p', 'chart-help', '같은 게시글의 재수집은 한 건으로 셉니다. 이름이 같은 자산의 체인·컨트랙트는 아래 시장 자료에서 따로 확인합니다.'));
    body.append(section);
  }
  if (c.kind === 'token') {
    const section = node('section', 'detail-section');
    append(section, node('h3', '', '시장·생태계 AI'));
    const enriched = c.discoveryEnrichment;
    if (enriched?.summary) append(section, node('p', '', enriched.summary),
      node('p', 'chart-help', `분석 ${date(enriched.at)} · 원문과 시장 관측을 바탕으로 한 보조 설명`));
    else section.append(node('p', 'muted', ({ queued: '분석 대기 중', running: '원문·이미지·시장 맥락 분석 중', failed: '분석 재시도 한도 도달' })[c.discoveryJob?.state] || '최근 원문과 작성자가 충분히 모이면 분석합니다.'));
    const listings = list(c.discoveryContext?.marketListings);
    if (listings.length) {
      section.append(node('h4', '', '같은 이름으로 관측된 시장 자료'));
      for (const listing of listings) {
        const row = node('p');
        append(row, node('span', '', `${listing.chain || '체인 미확인'} · ${listing.tokenSymbol || listing.symbol || c.title} · `),
          externalLink('시장 원문 ↗', listing.url), node('span', 'muted', ` · 관측 ${date(listing.observedAt)}`));
        if (listing.tokenAddress || listing.address) row.append(node('code', 'launch-reason', listing.tokenAddress || listing.address));
        section.append(row);
      }
      section.append(node('p', 'chart-help', '이름·심볼이 일치한 자료입니다. 원문에 주소 근거가 없으면 동일 자산으로 확정하거나 시가총액을 합산하지 않습니다.'));
    } else section.append(node('p', 'chart-help', '현재 수집한 시장 목록에는 이름·심볼이 정확히 일치하는 항목이 없습니다.'));
    body.append(section);
  }
  const scores = node("div", "detail-scores");
  for (const [label, value, unit] of [
    ["신호 점수", Math.round(number(c.score)), "/100"],
    ["데이터 신뢰도", Math.round(number(c.confidence)), "%"],
    ["독립 출처", c.independentSources ?? 0, "개"],
  ])
    append(
      scores,
      append(
        node("div", "detail-score"),
        node("span", "", label),
        append(node("strong", "", value), node("small", "", unit)),
      ),
    );
  body.append(scores);
  if (c.memeRelevance && c.rawSignalScore != null) {
    const section = node('section', 'detail-section');
    append(section, node('h3', '', '밈 적합도와 점수'),
      node('p', '', `확산 원점수 ${Math.round(number(c.rawSignalScore))} × 밈 적합도 ${Math.round(number(c.memeRelevance.score))}% = ${Math.round(number(c.score))}점`));
    if (list(c.memeRelevance.reasons).length) section.append(stringList(c.memeRelevance.reasons));
    body.append(section);
  }
  const exclusions = [
    ...new Set([...list(c.exclusions), ...list(c.policyDecision?.reasons)]),
  ];
  if (exclusions.length) {
    const section = node("section", "detail-section exclusions");
    append(
      section,
      node("h3", "", "현재 발행 제외 사유"),
      stringList(exclusions),
    );
    body.append(section);
  }
  const reason = node("section", "detail-section");
  append(reason, node("h3", "", "왜 이 소재를 감지했나요?"));
  if (list(c.reasons).length) reason.append(stringList(c.reasons));
  else
    reason.append(
      node(
        "p",
        "",
        "감지 근거가 충분히 제공되지 않았습니다. 자동 발행 판단은 서버 정책 검사를 따릅니다.",
      ),
    );
  if (list(c.aliases).length)
    reason.append(
      node("p", "chart-help", `표현 변형: ${c.aliases.join(" · ")}`),
    );
  body.append(reason);
  const chart = node("section", "detail-section");
  append(chart, node("h3", "", "시간대별 언급 추이"));
  const timeline = list(c.timeline);
  if (timeline.length >= 2) {
    const graph = append(
      node("div", "detail-chart"),
      sparkline(timeline, { width: 570, height: 170, detail: true }),
      append(
        node("div", "chart-caption"),
        node("span", "", date(timeline[0].time)),
        node("span", "", date(timeline.at(-1).time)),
      ),
    );
    chart.append(graph);
  } else
    chart.append(
      node("p", "", "시간대별 비교에 필요한 관측 데이터가 아직 부족합니다."),
    );
  append(
    chart,
    node(
      "div",
      "chart-help",
      `실제로 수집된 언급 수 · 고유 작성자 ${c.uniqueAuthors ?? 0}명 · 수집 누락으로 전체 확산량과 다를 수 있습니다.`,
    ),
  );
  body.append(chart);
  if (list(c.burstWindows).length) {
    const section = node('section', 'detail-section');
    append(section, node('h3', '', '최근 1·5·15분 변화'));
    const table = node('table', 'data-table');
    const head = node('tr');
    for (const label of ['구간', '관측된 새 글', '새 작성자', '좋아요 증가', '급증 판단']) head.append(node('th', '', label));
    table.append(append(node('thead'), head));
    const rows = node('tbody');
    const metric = value => value == null ? '—' : Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
    for (const window of c.burstWindows) {
      const row = node('tr');
      for (const value of [`${window.minutes}분`, metric(window.observedMentions), metric(window.newAuthors),
        metric(window.metricDeltas?.likes?.delta), window.baselineSufficient ? `${metric(window.burstScore)} / 100` : '비교 자료 부족']) row.append(node('td', '', value));
      rows.append(row);
    }
    table.append(rows); section.append(append(node('div', 'table-wrap'), table));
    section.append(node('p', 'chart-help', '완료된 시간 구간의 수집 표본을 비교합니다. 수집 범위가 달라지거나 과거 자료가 부족하면 급증 점수를 계산하지 않습니다. 반응 수 증가는 비교 가능한 관측이 있는 게시글만 포함합니다.'));
    body.append(section);
  }
  if (c.memeCluster) {
    const section = node('section', 'detail-section');
    const methods = { text_overlap: '비슷한 문구', embedding_cosine: '의미 벡터 유사성', image_dhash: '비슷한 이미지' };
    append(section, node('h3', '', '같은 소재의 표현과 확산 관계'),
      node('p', '', `관련 원문 ${list(c.memeCluster.memberItemIds).length}개 · 표현·이미지 연결 ${list(c.memeCluster.links).length}개 · 인용·재게시 등 관계 ${list(c.memeCluster.relationships).length}개`));
    if (list(c.memeCluster.methods).length) section.append(node('p', 'chart-help', `연결 근거: ${c.memeCluster.methods.map(method => methods[method] || method).join(' · ')}`));
    if (c.memeCluster.hasEmbeddingEvidence) section.append(node('p', 'chart-help', '의미가 가까운 표현을 연결한 결과입니다. 다국어 밈을 정확히 구분하는지는 별도 검증이 필요합니다.'));
    body.append(section);
  }
  if (list(c.observationHistory).length) {
    const section = node('section', 'detail-section');
    append(section, node('h3', '', '최근 관측 이력'));
    const table = node('table', 'data-table');
    const history = c.observationHistory.slice(0, 12);
    // Metric columns follow what the rows actually carry, in a fixed priority order.
    const present = new Set(history.flatMap(observation => metricEntries(observation.metrics).map(([key]) => key)));
    const columns = [...historyMetricPriority.filter(key => present.has(key)), ...[...present].filter(key => !historyMetricPriority.includes(key)).sort()].slice(0, 4);
    const head = node('tr');
    for (const label of ['관측 시각', '작성자/발행', ...(columns.length ? columns.map(key => metricLabels[key] || key) : ['출처'])]) head.append(node('th', '', label));
    table.append(append(node('thead'), head));
    const rows = node('tbody');
    for (const observation of history) {
      const row = node('tr'), metrics = observation.metrics || {};
      const cells = [date(observation.observedAt), authorText(observation) || '—'];
      if (columns.length) cells.push(...columns.map(key => finite(metrics[key]) ? formatMetric(key, metrics[key]) : '—'));
      else cells.push(observation.sourceId || observation.sourceFamily || '—');
      for (const value of cells) row.append(node('td', '', String(value)));
      rows.append(row);
    }
    table.append(rows); section.append(append(node('div', 'table-wrap'), table));
    section.append(node('p', 'chart-help', '같은 게시글을 다시 읽은 기록도 보존합니다. 관측 횟수는 게시글 수나 도달한 사람 수가 아닙니다.'));
    body.append(section);
  }
  if (c.enrichment?.summary) {
    body.append(append(node('section', 'detail-section'), node('h3', '', '소재 설명'),
      node('p', '', c.enrichment.summary), node('p', 'chart-help', 'AI가 작성한 보조 설명입니다. 원문 근거와 함께 확인하세요.')));
  }
  if (c.burst && typeof c.burst === "object") {
    const burst = c.burst;
    const section = node("section", "detail-section burst-section");
    append(
      section,
      append(node("h3", ""), node("span", "", "기준선 대비 언급 급증"),
        badge(burst.baselineSufficient ? "available" : "pending",
          burst.baselineSufficient ? "기준선 확보" : "기준선 학습 중")),
      node("p", "", burst.reason || (burst.baselineSufficient
        ? "과거 관측된 언급량을 기준으로 최근 증가를 비교합니다."
        : "비교에 필요한 과거 관측 데이터가 아직 부족합니다.")),
    );
    if (burst.baselineSufficient) {
      const values = node("div", "burst-values");
      for (const [label, value, unit] of [
        ["기준 언급량", burst.baselineMean, ""],
        ["기준선 대비 편차 (z)", burst.zScore, ""],
        ["기준 초과 언급", burst.excessMentions, "개"],
        ["급증 점수", burst.burstScore, "/100"],
        ["급증 신뢰도", burst.confidence, "%"],
      ]) {
        const numeric = value == null || value === "" ? null : Number(value);
        append(values, append(node("div"), node("span", "muted", label),
          node("strong", "", numeric !== null && Number.isFinite(numeric)
            ? `${numeric.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}${unit}`
            : "—")));
      }
      section.append(values);
    }
    section.append(node("p", "chart-help", "수집된 표본의 변화이며 전체 X 확산량이나 수익 확률을 뜻하지 않습니다."));
    body.append(section);
  }
  const components = node("section", "detail-section");
  append(components, node("h3", "", "점수 구성"));
  const bars = node("div", "components");
  for (const [key, value] of Object.entries(c.components || {})) {
    if (key === 'duplicatePenalty') continue;
    const numeric = typeof value === "object" ? value?.score : value;
    if (!Number.isFinite(Number(numeric))) continue;
    const bar = node("span");
    bar.style.width = `${percent(numeric)}%`;
    append(
      bars,
      append(
        node("div"),
        append(
          node("div", "component-label"),
          node("span", "", componentLabels[key] || key),
          node("span", "", Number(numeric).toFixed(1)),
        ),
        append(node("div", "component-track"), bar),
      ),
    );
  }
  append(
    components,
    bars,
    node(
      "div",
      "chart-help",
      "신호 점수와 데이터 신뢰도는 별개입니다. 점수는 수익이나 가격 상승의 확률이 아닙니다.",
    ),
  );
  body.append(components);
  const similarity = node("section", "detail-section");
  append(similarity, node("h3", "", "기존 유사 토큰 · 중복 검사"));
  if (c.components?.duplicatePenalty != null) similarity.append(node('p', 'chart-help',
    `기존 토큰 중복 위험: ${Number(c.components.duplicatePenalty).toFixed(1)}. 소재의 확산 신호와 별도로 발행 가능 여부에 반영합니다.`));
  if (list(c.similarTokens).length)
    similarity.append(
      stringList(
        c.similarTokens.map((t) =>
          typeof t === "string"
            ? t
            : `${t.name || t.symbol || t.address || "유사 토큰"}${t.source ? ` · ${t.source}` : ""}`,
        ),
      ),
    );
  else
    similarity.append(
      node(
        "p",
        "",
        "확인된 유사 토큰 기록이 없습니다. 외부 토큰 목록의 범위는 제한되며 전체 시장에 중복이 없다는 뜻은 아닙니다.",
      ),
    );
  body.append(similarity);
  const robinhoodSection = robinhoodChainSection(c);
  if (robinhoodSection) body.append(robinhoodSection);
  const evidence = node("section", "detail-section");
  append(
    evidence,
    node("h3", "", "원문 근거 "),
    node(
      "p",
      "",
      `수집 원문 ${list(c.evidence).length}개 · 표시된 반응 수는 각 출처가 실제로 제공한 값입니다.`,
    ),
  );
  for (const item of list(c.evidence)) {
    const card = node("article", "evidence-card");
    const head = node("div", "evidence-head");
    head.append(
      node(
        "span",
        "",
        item.sourceId || item.source || item.sourceFamily || "출처 기록 없음",
      ),
    );
    const author = authorText(item);
    if (author) head.append(node("span", "", author));
    append(
      card,
      head,
      externalLink(
        `${item.title || String(item.text || "").slice(0, 85) || "원문 보기"} ↗`,
        item.url,
        "",
      ),
    );
    if (item.text)
      card.append(node("p", "evidence-text", String(item.text).slice(0, 1600)));
    if (item.origin)
      card.append(node("p", "observation-context", observationProvenance(item)));
    append(
      card,
      dateMeta(item),
      metricsLine(item),
      marketLine(item),
      externalLinksRow(item),
      imageFeatureView(item.imageFeatures),
    );
    evidence.append(card);
  }
  if (!list(c.evidence).length)
    evidence.append(
      node(
        "p",
        "chart-help",
        "연결된 원문 증거가 없습니다. 필수 데이터가 부족한 후보는 발행할 수 없습니다.",
      ),
    );
  body.append(evidence);
  const draftSection = node("section", "draft-section");
  draftSection.id = "draft-section";
  const draftRecipient = node("input");
  draftRecipient.id = "draft-recipient";
  draftRecipient.placeholder = "0x…";
  draftRecipient.autocomplete = "off";
  const recipientField = append(
    node("label", "initial-recipient"),
    "Token recipient address",
    draftRecipient,
  );
  recipientField.hidden = pons || state.overview?.policy?.recipientMode === "issuer"
    || Boolean(state.overview?.policy?.recipient);
  append(
    draftSection,
    append(
      node("div", "section-title"),
      node("h3", "", "Token draft"),
      node("span", "pill", "ERC-20"),
    ),
    node(
      "p",
      "muted",
      pons?"Pons V2 places the fixed supply in its bonding curve. The assigned launch wallet is the creator and fee recipient. Fees accrue in escrow and require a separate claim. Initial buy: 0 ETH.":"Prepare the token name, symbol, description and image in English, then review the policy and cost simulation.",
    ),
    recipientField,
    actionButton(
      "Create draft ↗",
      async () => {
        state.draft = await api("/api/token-drafts", {
          method: "POST",
          body: {
            candidateId: c.id,
            ...(!pons && state.overview?.policy?.recipientMode !== "issuer" && draftRecipient.value.trim()
              ? { recipient: draftRecipient.value.trim() }
              : {}),
          },
        });
        state.draftDirty = false;
        state.simulation = null;
        state.manualLaunch = null;
        state.draftStatusError = '';
        renderDraft();
        toast("Token draft created.");
      },
      "button primary",
    ),
    node(
      "p",
      "draft-admin-note",
      pons?"Pons V2 · Bonding-curve trading after confirmation · Public image URL required":"Fixed supply · No mint authority after deployment · Trading setup is separate",
    ),
  );
  body.append(draftSection);
  clear("#candidate-detail").append(body);
  if (state.draft) renderDraft();
}
function tokenListItem(token, { showChain = true } = {}) {
  const li = node("li", "token-list-item");
  const label = `${token.name || token.tokenName || token.symbol || token.tokenSymbol || token.address || "토큰"}${
    (token.symbol || token.tokenSymbol) && (token.name || token.tokenName)
      ? ` ($${token.symbol || token.tokenSymbol})`
      : ""
  }`;
  append(
    li,
    validUrl(token.url) ? externalLink(`${label} ↗`, token.url) : node("span", "", label),
    showChain ? chainPill(token) : null,
    finite(token.marketCapUsd)
      ? node("span", "muted", `시총 ${compactUsd(token.marketCapUsd)}`)
      : null,
    token.source || token.sourceId
      ? node("span", "muted", `출처 ${token.source || token.sourceId}`)
      : null,
    token.listedAt ? node("span", "muted", `목록 ${date(token.listedAt)}`) : null,
  );
  return li;
}
function robinhoodChainSection(c) {
  const rc = c.robinhoodChain && typeof c.robinhoodChain === "object" ? c.robinhoodChain : null;
  const crossChain = list(c.crossChainTokens).filter((token) => token && typeof token === "object");
  if (!rc && !crossChain.length) return null;
  const section = node("section", "detail-section");
  append(section, node("h3", "", "Robinhood 체인 현황"));
  if (rc) {
    const launched = rc.status === "launched";
    append(
      section,
      append(
        node("div", "detail-status-line"),
        badge(launched ? "warning" : "success", launched ? "Robinhood 체인 발행됨" : "Robinhood 체인 미발행 · 갭"),
        node(
          "span",
          "muted",
          `수집된 Robinhood 목록 ${number(rc.registrySize).toLocaleString("ko-KR")}개와 대조${rc.checkedAt ? ` · ${date(rc.checkedAt)}` : ""}`,
        ),
      ),
    );
    const matches = list(rc.matches).filter((token) => token && typeof token === "object");
    if (matches.length) {
      const ul = node("ul", "token-list");
      for (const token of matches) ul.append(tokenListItem(token, { showChain: false }));
      section.append(ul);
    }
  }
  if (crossChain.length) {
    append(
      section,
      node("p", "", `다른 체인에서 같은 이름·심볼로 관측된 토큰 ${crossChain.length}개 (참고 정보 · 점수와 제외 판단에 영향 없음)`),
    );
    const ul = node("ul", "token-list");
    for (const token of crossChain) ul.append(tokenListItem(token));
    section.append(ul);
  }
  section.append(
    node(
      "p",
      "chart-help",
      "Robinhood 상태는 수집된 GeckoTerminal·DexScreener·Blockscout 테스트넷 목록과의 이름·심볼 대조이며 전체 체인 검색이 아닙니다.",
    ),
  );
  return section;
}
function stringList(items) {
  const ul = node("ul");
  for (const item of items)
    ul.append(
      node(
        "li",
        "",
        typeof item === "string"
          ? item
          : item?.message || item?.reason || JSON.stringify(item),
      ),
    );
  return ul;
}
function normalizeDraftEnglishPunctuation(value) {
  return String(value).replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"')
    .replace(/[\u2010-\u2015\u2212]/g,'-').replace(/\u2026/g,'...').replace(/\u00A0/g,' ');
}
function draftMetadataError(name, value) {
  if (['name','description'].includes(name)) value=normalizeDraftEnglishPunctuation(value);
  if (name === 'name' && (!value.trim() || value.length>64 || /[^\x20-\x7E]/.test(value))) return 'Use 1–64 English letters, numbers or punctuation for the token name. A name cannot contain only spaces.';
  if (name === 'description' && (value.length>400 || /[^\x09\x0A\x0D\x20-\x7E]/.test(value))) return 'Write the token description in English, using at most 400 characters.';
  if (name === 'symbol' && value && !/^[A-Z0-9]{2,12}$/.test(value)) return 'Use 2–12 uppercase letters or numbers for the ticker.';
  if (name === 'imageSeed' && (value.length>64 || !/^[A-Za-z0-9_-]*$/.test(value))) return 'Use up to 64 English letters, numbers, underscores or hyphens for the image variation key.';
  return '';
}
function draftInput(form, label, name, value, full = false, textarea = false) {
  const wrapper = node("label", full ? "full-span" : "");
  wrapper.append(document.createTextNode(label));
  const input = node(textarea ? "textarea" : "input");
  input.name = name;
  input.value = value ?? "";
  input.placeholder = ({name:'Sleepy Goose',symbol:'SGOOSE',supply:'1000000000',recipient:'0x...',description:'An original community meme inspired by a sleepy goose.',imageSeed:'original'})[name] || '';
  if (['name','symbol','description','imageSeed'].includes(name)) {
    input.lang = 'en';
    const validate = () => input.setCustomValidity(draftMetadataError(name,input.value));
    input.addEventListener('input',validate);validate();
  }
  if (["name", "symbol", "supply"].includes(name)) input.required = true;
  if (name === "supply") {
    input.inputMode = "numeric";
    input.pattern = "[0-9]+";
  }
  if (name === "symbol") { input.maxLength = 12; input.pattern = '[A-Z0-9]{2,12}'; }
  if (name === "imageSeed") input.maxLength = 64;
  if (name === "description") input.maxLength = 400;
  if (name === "name") input.maxLength = 64;
  input.autocomplete = "off";
  append(wrapper, input);
  form.append(wrapper);
  return input;
}
function draftRecipientInput(form, draft, {pons=false,creatorAddress=''}={}) {
  const issuer = draft.recipientMode === "issuer";
  const input = draftInput(form, pons?"Creator / fee recipient · assigned launch wallet":issuer ? "Recipient address · per launch wallet" : "Recipient address", "recipient", pons?creatorAddress:draft.recipient);
  if (issuer || pons) {
    input.disabled = true;
    input.placeholder = "Assigned with the launch wallet";
  }
}
function manualExecutionNotice() {
  const policy=state.overview?.policy||{},network=state.overview?.network||{};
  const target=network.network||policy.network;
  const dryRun=network.dryRun===true?'DRY_RUN=true · no transaction broadcast':network.dryRun===false?'DRY_RUN=false · real transaction broadcast when checks pass':'DRY_RUN status unavailable';
  const readiness=network.configured===false?` Network not ready: ${network.error||'factory or RPC configuration is incomplete'}.`:network.error?` Network error: ${network.error}.`:'';
  const launchpad=network.launchpad||{},pons=network.launchProtocol==='pons-v2';
  const provider=pons?` Pons V2 · Launch fee ${weiToEth(launchpad.launchFeeWei,18)} ETH (transaction value) + gas estimated in simulation. Initial buy: 0 ETH. ${ponsFeeText(launchpad,true)}.`:'';
  return `Manual request: ${target?String(target).toUpperCase():'network unavailable'}${network.chainId?` · Chain ${network.chainId}`:''} · ${dryRun}. Automation remains ${policy.mode||'unavailable'}.${provider}${readiness} Pause, emergency, network, wallet and budget checks still apply.`;
}
async function requestManualLaunch(saved, key) {
  const form=$('#draft-form'),selected=state.selected,sessionKey=state.key,detailRequest=state.detailRequest,revision=state.draftRevision||0;
  const retryUntil=Date.now()+150000,signal=AbortSignal.timeout(180000);
  const current=()=>Boolean(sessionKey)&&state.key===sessionKey&&state.draft?.id===saved.id&&state.selected===selected&&state.detailRequest===detailRequest&&$('#draft-form')===form&&$('#candidate-dialog')?.open&&(state.draftRevision||0)===revision;
  const checkCurrent=()=>{if(!current()){const error=new Error('Stopped waiting because the draft or session changed. No further automatic launch request will be sent.');error.code='MANUAL_LAUNCH_WAIT_CANCELLED';throw error;}};
  for(;;){
    checkCurrent();
    try{return await api('/api/launches',{method:'POST',headers:{'Idempotency-Key':key},body:{draftId:saved.id,execution:'manual'},signal});}
    catch(error){
      if(error.code!=='IMAGE_PENDING'||error.status!==409||Date.now()>=retryUntil)throw error;
      checkCurrent();
      await new Promise(resolve=>setTimeout(resolve,Math.min(2000,retryUntil-Date.now())));
      checkCurrent();
      if(Date.now()>=retryUntil)throw error;
    }
  }
}
function draftArtwork(draft) {
  const preview=node('div','draft-preview');preview.id='draft-artwork';
  const imageUrl=validUrl(draft.imageUrl),generated=draft.image||null,isSource=generated?.provider==='source',pons=state.overview?.network?.launchProtocol==='pons-v2';
  if(imageUrl){const image=node('img');image.alt=`${draft.name} token image preview`;image.loading='lazy';image.src=`${imageUrl}${imageUrl.includes('?')?'&':'?'}v=${encodeURIComponent(draft.updatedAt||draft.id)}`;image.addEventListener('error',()=>image.remove(),{once:true});preview.append(image);}
  const imageState=!generated?.status?pons?'Pons V2 requires a public image URL. Prepare an image before requesting launch.':'The token image is prepared automatically from the draft. The original geometric image is used until artwork is available.':generated.status==='ready'?
    `${isSource?'Captured source image':'Generated image'}${generated.provider?` · ${generated.provider}`:''}${generated.host?` · ${generated.host}`:''}${generated.metadataImage?' · Image included in token metadata.':pons?' · No public image URL; Pons V2 cannot use the local geometric preview.':' · No public image URL; metadata uses the geometric image.'}`:
    generated.status==='error'?`Image preparation failed: ${generated.error||'unknown error'}.`:
    `Image preparation ${generated.status==='queued'?'queued':'in progress'}. Preview and metadata update automatically.`;
  append(preview,node('p',generated?.status==='error'?'wallet-error':'',imageState));
  if(pons)preview.append(node('p','chart-help','Pons V2 requires a publicly accessible image URL; a local preview alone is insufficient. The server checks the URL before launch.'));
  if(isSource&&generated.sourceUrl)preview.append(externalLink('Source image ↗',generated.sourceUrl));
  if(isSource&&generated.sourcePostUrl)preview.append(externalLink('Source post ↗',generated.sourcePostUrl));
  const imageActionLabel=isSource?'Refresh source image':generated?.status==='ready'?'Regenerate image':'Prepare image';
  const regenerate=actionButton(imageActionLabel,async()=>{
    const saved=await saveDraft();
    regenerate.textContent='Preparing image…';
    let result;
    try { result=await api(`/api/token-drafts/${encodeURIComponent(saved.id)}/image`,{method:'POST',body:{force:saved.image?.status==='ready'},signal:AbortSignal.timeout(180000)}); }
    finally { regenerate.textContent=imageActionLabel; }
    if(state.draft?.id!==saved.id)return;
    state.draft=result.draft;state.draftStatusError='';
    if(!state.draftDirty)renderDraft();else replaceDraftArtwork();
  },'button subtle');preview.append(regenerate);
  if(draft.imagePrompt&&!isSource)append(preview,node('p','chart-help',`Image prompt: ${draft.imagePrompt}`),node('p','chart-help',generated?.status==='ready'?'The preview was generated from this prompt.':'Generated artwork uses this English prompt.'));
  return preview;
}
function replaceDraftArtwork() {
  const current=$('#draft-artwork');if(current&&state.draft)current.replaceWith(draftArtwork(state.draft));
}
async function refreshDraftStatus() {
  const draft=state.draft,form=$('#draft-form');
  if(!draft||!form||state.draftActionPending||!$('#candidate-dialog')?.open)return;
  const launch=state.manualLaunch;
  const results=await Promise.allSettled([api(`/api/token-drafts/${encodeURIComponent(draft.id)}`),launch?.id?api(`/api/launches/${encodeURIComponent(launch.id)}`):Promise.resolve(null)]);
  if(state.draft?.id!==draft.id||$('#draft-form')!==form||state.draftActionPending)return;
  const errors=[];
  if(results[0].status==='fulfilled'){
    state.draft=results[0].value;
    // The saved model may refresh, but an operator's unsaved form stays intact.
    replaceDraftArtwork();
  }else errors.push(`Image status refresh failed: ${results[0].reason.message}`);
  if(results[1].status==='fulfilled'&&results[1].value)state.manualLaunch=results[1].value;
  else if(results[1].status==='rejected')errors.push(`Launch status refresh failed: ${results[1].reason.message}`);
  state.draftStatusError=errors.join(' ');
  const note=$('#draft-execution-note');if(note)note.textContent=manualExecutionNotice();
  renderSimulation();
}
function renderDraft() {
  const draft = state.draft;
  const section = $("#draft-section");
  if (!draft || !section) return;
  const network=state.overview?.network||{},pons=network.launchProtocol==='pons-v2',ponsSupply=network.launchpad?.supply;
  clear(section);
  append(
    section,
    append(
      node("div", "section-title"),
      node("h3", "", "Edit token draft"),
      node("span", "pill", pons?"Pons V2":"ERC-20"),
    ),
    node(
      "p",
      "muted",
      `Draft ${short(draft.id)} · Candidate ${short(draft.candidateId)}`,
    ),
  );
  const form = node("form", "draft-form");
  form.id = "draft-form";
  const fields = node("div", "form-grid");
  draftInput(fields, "Token name", "name", draft.name);
  draftInput(fields, "Ticker / symbol", "symbol", draft.symbol);
  const supply=draftInput(fields, pons?"Fixed supply (tokens) · entirely to bonding curve":"Fixed supply (tokens)", "supply", draft.supply);
  if(pons){supply.readOnly=true;if(ponsSupply&&draft.supply!==ponsSupply)supply.setCustomValidity(`Pons V2 requires ${ponsSupply} tokens. Create a new Pons draft to keep this saved draft unchanged.`);}
  draftRecipientInput(fields, draft, {pons,creatorAddress:state.manualLaunch?.creatorFeeRecipient||state.simulation?.estimate?.creatorFeeRecipient||state.simulation?.estimate?.walletAddress||''});
  draftInput(fields, "Token description", "description", draft.description, true, true);
  draftInput(
    fields,
    "Image variation key (original geometric image)",
    "imageSeed",
    draft.imageSeed || "",
    true,
  );
  append(form, fields);
  if(pons){
    append(form,node('p','chart-help',`Pons V2 supply: ${ponsSupply||'unavailable'} tokens, all placed in the bonding curve. The launch wallet is the creator and fee recipient; fees accrue in escrow and require a separate claim. Initial buy: 0 ETH.`));
    if(ponsSupply&&draft.supply!==ponsSupply)form.append(actionButton('Create new Pons draft',async()=>{
      const created=await api('/api/token-drafts',{method:'POST',body:{candidateId:draft.candidateId,supply:ponsSupply}});
      if(state.draft?.id!==draft.id)return;state.draft=created;state.draftDirty=false;state.simulation=null;state.manualLaunch=null;renderDraft();
    },'button subtle'));
  }
  form.append(draftArtwork(draft));
  const actions = node("div", "draft-actions");
  const save = node("button", "button subtle", "Save draft");
  save.type = "submit";
  actions.append(save);
  const simulate = actionButton(
    "Simulate manual launch",
    async () => {
      const saved=await saveDraft();
      const result = await api("/api/launches/simulate", {
        method: "POST",
        body: { draftId: saved.id, execution: 'manual' },
      });
      if(state.draft?.id!==saved.id)return;
      state.simulation=result;
      renderSimulation();
    },
    "button subtle",
  );
  actions.append(simulate);
  const launch = actionButton(
    "Request launch ↗",
    async () => {
      const saved=await saveDraft();
      const storageKey = `observatory-manual-launch-${saved.id}`;
      let key = sessionStorage.getItem(storageKey);
      if (!key) {
        key = crypto.randomUUID();
        sessionStorage.setItem(storageKey, key);
      }
      launch.textContent='Preparing image and launch…';
      let result;
      try { result = await requestManualLaunch(saved,key); }
      finally { launch.textContent='Request launch ↗'; }
      if(state.draft?.id===saved.id){state.manualLaunch=result;state.simulation=null;state.draftStatusError='';renderSimulation();}
      toast(
        `발행 작업 ${short(result.id)} · ${statusLabels[result.status] || result.status || "요청 접수"}`,
      );
      await refresh();
    },
    "button primary",
  );
  actions.append(launch);
  const executionNote=node('p','draft-admin-note',manualExecutionNotice());executionNote.id='draft-execution-note';
  append(
    form,
    actions,
    executionNote,
  );
  const error = node("p", "error-text");
  error.id = "draft-error";
  error.setAttribute("role", "alert");
  form.append(error);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    busy(save, async () => {
      await saveDraft();
      renderDraft();
      toast("Draft saved.");
    });
  });
  form.addEventListener("input", () => {
    state.draftDirty = true;
    state.draftRevision = (state.draftRevision||0)+1;
    state.simulation = null;
    renderSimulation();
  });
  append(section, form);
  renderSimulation();
}
async function saveDraft() {
  const form = $("#draft-form");
  if (!form || !state.draft) throw new Error("Create a token draft first.");
  if (!form.reportValidity())
    throw new Error("Check the required draft fields and use English for token metadata.");
  const pons = state.overview?.network?.launchProtocol === 'pons-v2';
  const needsIssuerBinding = pons && (state.draft.recipientMode !== 'issuer' || state.draft.recipient !== '');
  if (!state.draftDirty && !needsIssuerBinding) return state.draft;
  const draftId=state.draft.id,revision=state.draftRevision||0;
  const values = new FormData(form);
  const payload = Object.fromEntries(
    [...values.entries()].map(([key, value]) => [key, ['name','description'].includes(key) ? normalizeDraftEnglishPunctuation(String(value).trim()) : String(value).trim()]),
  );
  if (pons) Object.assign(payload, { recipientMode: 'issuer', recipient: '' });
  try {
    const result = await api(
      `/api/token-drafts/${encodeURIComponent(draftId)}`,
      { method: "PATCH", body: payload },
    );
    if(state.draft?.id!==draftId||$('#draft-form')!==form)throw new Error('The open draft changed. Open the saved draft before requesting execution.');
    state.draft = result;
    if((state.draftRevision||0)!==revision)throw new Error('Draft fields changed while saving. Save the latest edits before requesting execution.');
    state.draftDirty = false;
    $("#draft-error").textContent = "";
    return result;
  } catch (error) {
    if($('#draft-form')===form)$("#draft-error").textContent = error.message;
    throw error;
  }
}
function renderSimulation() {
  $("#simulation-result")?.remove();
  const result=state.simulation,launch=state.manualLaunch;
  if(!result&&!launch&&!state.draftStatusError)return;
  const denied=result?.allowed===false||['held','blocked_policy','failed','rejected','cancelled'].includes(launch?.status);
  const box=node('div',`simulation-result${denied?' denied':''}`);box.id='simulation-result';
  if(result){
    box.append(node('h4','',result.allowed===true?'Manual launch simulation passed':result.allowed===false?'Manual launch held · check conditions':'Manual launch simulation'));
    if(result.network||typeof result.dryRun==='boolean')box.append(node('p','',`${result.network?String(result.network).toUpperCase():'Network unavailable'} · ${result.dryRun===true?'DRY_RUN=true · no transaction broadcast':result.dryRun===false?'DRY_RUN=false':'DRY_RUN unavailable'}`));
    if(list(result.reasons).length)box.append(stringList(result.reasons));
    if(list(result.advisories).length)append(box,node('p','muted','Automation ranking notes · manual launch does not use these ranking gates'),stringList(result.advisories));
    const estimate=result.estimate;
    if(estimate&&typeof estimate==='object'){
      const cost=estimate.costWei??estimate.estimatedCostWei??estimate.maxCostWei??estimate.totalCostWei;
      if(result.launchProtocol==='pons-v2'||estimate.launchProtocol==='pons-v2'||(!result.launchProtocol&&state.overview?.network?.launchProtocol==='pons-v2')){
        append(box,node('p','','Pons V2 · Initial buy: 0 ETH'),node('p','',`Transaction value · launch fee: ${weiToEth(estimate.launchFeeWei,18)} ETH`),node('p','',`Estimated gas: ${weiToEth(estimate.gasCostWei,18)} ETH`),node('p','',`Maximum fee + gas: ${weiToEth(estimate.maxCostWei,18)} ETH`));
      }else box.append(node('p','',`Estimated gas cost ${weiToEth(cost)} ETH${estimate.gas||estimate.gasEstimate?` · Gas ${estimate.gas||estimate.gasEstimate}`:''}`));
      if(estimate.warning)box.append(node('p','',estimate.warning));
      if(estimate.kind)box.append(node('p','',estimate.kind==='paper-model'?'Model estimate · no RPC simulation':'RPC simulation result'));
      if(estimate.error||estimate.rpcError)box.append(node('p','',estimate.error||estimate.rpcError));
    }else if(estimate)box.append(node('p','',`Cost estimate: ${display(estimate)}`));
    box.append(node('p','',`Policy v${result.policyVersion??'—'} · Execution checks run again before sending.`));
  }
  if(launch){
    append(box,node('h4','','Manual launch request'),node('p','',`Job ${launch.id} · ${launch.status||'status unavailable'}${launch.network?` · ${String(launch.network).toUpperCase()}`:''}`));
    if(launch.tokenAddress&&['confirmed','deployed'].includes(launch.status))box.append(node('p','',launch.launchProtocol==='pons-v2'?launch.tradingStatus==='tradable'?`Pons V2 생성 확인 · ${launch.tradingVenue==='pons-uniswap-v4'?'V4 풀':'본딩 커브'} 거래 활성`:'Pons V2 생성 확인 · 거래 상태 확인 중':launch.tradingStatus==='tradable'?'토큰 생성 완료 · 유동성 확인 · 거래 개시 완료':'토큰 생성 완료 · 거래 개시를 위한 유동성은 아직 확인되지 않았습니다.'));
    const reason=launch.error||launch.reason;
    if(reason)box.append(node('p','error-text',typeof reason==='string'?reason:reason.message||JSON.stringify(reason)));
    if(list(launch.reasons).length)box.append(stringList(launch.reasons));
    if(launch.txHash)append(box,node('p','',`Transaction hash: ${launch.txHash}`),externalLink('View transaction ↗',explorerLink(launch.network,'tx',launch.txHash)));
    if(launch.tokenAddress)append(box,node('p','',`Token address: ${launch.tokenAddress}`),externalLink('View token ↗',explorerLink(launch.network,'address',launch.tokenAddress)));
    if(launch.launchProtocol==='pons-v2'){
      if(launch.curveAddress)box.append(externalLink('View bonding curve ↗',explorerLink(launch.network,'address',launch.curveAddress)));
      if(launch.creatorFeeRecipient)append(box,node('p','',`Creator / fee recipient: ${launch.creatorFeeRecipient}`),externalLink('View creator wallet ↗',explorerLink(launch.network,'address',launch.creatorFeeRecipient)));
      const url=suppliedLaunchpadUrl(launch.launchpadUrl);if(url)box.append(externalLink('View on Pons ↗',url));
    }
    if(!launch.txHash)box.append(node('p','muted','No transaction hash reported yet.'));
    const management=node('a','text-link','Launch management ↗');management.href='#launches';box.append(management);
  }
  if(state.draftStatusError)box.append(node('p','error-text',state.draftStatusError));
  $('#draft-section')?.append(box);
}

// ---- 온체인 시장 (market page + radar gap strip) ----
function renderMarketViews() {
  renderGapStrip();
  renderMarket();
}
function tokenCell(item, { chain = true, link = false } = {}) {
  const cell = node("div", "token-cell");
  const image = validUrl(item.imageUrl);
  if (image && image.startsWith("https:")) {
    const img = node("img");
    img.src = image;
    img.alt = "";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.width = 24;
    img.height = 24;
    img.addEventListener("error", () => img.remove(), { once: true });
    cell.append(img);
  }
  const market = item.market && typeof item.market === "object" ? item.market : {};
  const symbol = item.tokenSymbol || market.tokenSymbol;
  const address = item.tokenAddress || market.tokenAddress;
  const name =
    item.tokenName || market.tokenName || item.title || (address ? short(address) : "토큰");
  const text = node("div", "token-text");
  append(
    text,
    link && validUrl(item.url)
      ? externalLink(`${name} ↗`, item.url, "token-name")
      : node("span", "token-name", name),
    symbol ? node("span", "token-symbol", `$${symbol}`) : null,
    chain ? chainPill(item) : null,
  );
  cell.append(text);
  if (symbol && item.itemRole === 'token_listing') text.append(actionButton('토큰명 언급 찾기', async () => {
    $('#candidate-view').value = 'tokens';
    $('#candidate-search').value = symbol;
    $('#score-filter').value = '0';
    $('#data-filter').value = 'real';
    state.favorite = false;
    $$('#favorite-tabs button').forEach(button => {
      const selected = button.dataset.favorite === 'false';
      button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected));
    });
    location.hash = 'radar';
    await fetchCandidates();
  }, 'text-button'));
  return cell;
}
function usdCell(value) {
  return node("td", "", compactUsd(value) ?? "—");
}
function linksCell(item) {
  const wrap = node("div", "link-cell");
  if (validUrl(item.url))
    wrap.append(externalLink(`${hostLabel(item.url)} ↗`, item.url));
  for (const link of list(item.externalLinks)
    .filter((entry) => entry && typeof entry === "object" && httpsUrl(entry.url))
    .slice(0, 4))
    wrap.append(
      externalLink(`${externalLinkLabels[link.type] || "링크"} ↗`, link.url),
    );
  if (!wrap.childElementCount) wrap.append(node("span", "muted", "링크 없음"));
  return append(node("td"), wrap);
}
function poolRow(item, { listing = false } = {}) {
  const market = item.market && typeof item.market === "object" ? item.market : {};
  const metrics = item.metrics && typeof item.metrics === "object" ? item.metrics : {};
  const tr = node("tr");
  tr.append(append(node("td"), tokenCell(item)));
  if (listing)
    tr.append(
      append(node("td"), listingPill(market.listing) || node("span", "muted", "—")),
    );
  const created = market.poolCreatedAt || item.publishedAt;
  tr.append(
    created
      ? append(node("td"), node("div", "", date(created)), node("div", "launch-time", ago(created)))
      : node("td", "", "—"),
  );
  // Each column shows only the field it is labelled with; FDV and market cap are not interchangeable.
  tr.append(
    usdCell(market.fdvUsd ?? metrics.fdvUsd),
    usdCell(market.liquidityUsd ?? metrics.liquidityUsd),
    usdCell(market.volume24hUsd ?? metrics.volume24hUsd),
  );
  const buys = market.buys24h;
  const sells = market.sells24h;
  tr.append(
    node(
      "td",
      "",
      finite(buys) || finite(sells)
        ? `${finite(buys) ? countText(buys) : "—"} / ${finite(sells) ? countText(sells) : "—"}`
        : "—",
    ),
  );
  tr.append(linksCell(item));
  return tr;
}
function robinhoodStatusCell(on) {
  const cell = node("td");
  if (!on || typeof on !== "object") return append(cell, badge("pending", "대조 전"));
  if (on.status === "launched") {
    cell.append(badge("warning", "발행됨"));
    const matches = list(on.matches).filter((m) => m && typeof m === "object");
    const linked = matches.find((m) => validUrl(m.url));
    if (linked)
      cell.append(
        externalLink(
          `${linked.tokenSymbol ? `$${linked.tokenSymbol}` : linked.tokenName || "Robinhood 목록"} ↗`,
          linked.url,
          "launch-link",
        ),
      );
    else if (matches.length)
      cell.append(
        node(
          "span",
          "launch-reason",
          matches.map((m) => m.tokenSymbol || m.tokenName).filter(Boolean).join(", "),
        ),
      );
    return cell;
  }
  return append(cell, badge("success", "미발행 · 갭"));
}
function gapRow(item) {
  const market = item.market && typeof item.market === "object" ? item.market : {};
  const metrics = item.metrics && typeof item.metrics === "object" ? item.metrics : {};
  const tr = node("tr");
  tr.append(append(node("td"), tokenCell(item, { chain: false, link: true })));
  tr.append(append(node("td"), chainPill(item) || node("span", "muted", "—")));
  tr.append(usdCell(market.marketCapUsd ?? metrics.marketCapUsd));
  tr.append(append(node("td"), deltaNode(market.priceChange24hPct)));
  const reactions = ["comments", "boosts", "participants", "holders", "transactions24h"]
    .filter((key) => finite(metrics[key]))
    .map((key) => metricText(key, metrics[key]));
  tr.append(node("td", "", reactions.length ? reactions.join(" · ") : "—"));
  tr.append(
    append(
      node("td"),
      node("div", "", item.sourceName || item.publisher || item.sourceId || "—"),
      listingPill(market.listing),
    ),
  );
  tr.append(robinhoodStatusCell(item.onRobinhood));
  return tr;
}
function testnetRow(item) {
  const market = item.market && typeof item.market === "object" ? item.market : {};
  const metrics = item.metrics && typeof item.metrics === "object" ? item.metrics : {};
  const tr = node("tr");
  tr.append(append(node("td"), tokenCell(item, { chain: false })));
  tr.append(node("td", "", item.tokenSymbol || market.tokenSymbol || "—"));
  const holders = market.holders ?? metrics.holders;
  tr.append(node("td", "", finite(holders) ? countText(holders) : "—"));
  tr.append(
    append(
      node("td"),
      validUrl(item.url) ? externalLink("탐색기 ↗", item.url) : node("span", "muted", "링크 없음"),
    ),
  );
  return tr;
}
function trendBlock(group) {
  const block = node("div", "trend-block");
  append(block, node("h3", "", group.name || group.sourceId || "트렌드"));
  const items = list(group.items).slice(0, 10);
  if (!items.length) {
    block.append(node("p", "muted", "항목 없음"));
    return block;
  }
  const ol = node("ol");
  items.forEach((item, index) => {
    const metrics = item.metrics && typeof item.metrics === "object" ? item.metrics : {};
    const key = ["searches", "views", "postCount", "uses", "accounts", "marketCapUsd", "volume24hUsd", "rank"]
      .find((candidate) => finite(metrics[candidate]));
    const title = item.title || item.tokenName || String(item.text || "").slice(0, 60) || "제목 없는 항목";
    const li = node("li");
    append(
      li,
      append(
        node("span", "trend-title"),
        node("span", "trend-rank", String(index + 1)),
        validUrl(item.url) ? externalLink(`${title} ↗`, item.url, "") : node("span", "", title),
      ),
      key ? node("span", "trend-metric", metricText(key, metrics[key], { compact: true })) : null,
    );
    ol.append(li);
  });
  block.append(ol);
  return block;
}
function fillTable(tbodySelector, emptySelector, rows, emptyText) {
  const tbody = clear(tbodySelector);
  for (const row of rows) tbody.append(row);
  const empty = $(emptySelector);
  empty.hidden = rows.length > 0;
  empty.textContent = rows.length ? "" : emptyText;
}
function renderGapStrip() {
  const panel = $("#gap-panel");
  const gaps = list(state.market?.gaps)
    .filter((item) => item && typeof item === "object")
    .slice(0, 6);
  panel.hidden = ['materials','posts','review'].includes($('#candidate-view')?.value) || !gaps.length;
  const strip = clear("#gap-strip");
  if (!gaps.length) return;
  $("#gap-panel-count").textContent =
    `${number(state.overview?.market?.gaps ?? list(state.market?.gaps).length).toLocaleString("ko-KR")}개`;
  for (const item of gaps) {
    const market = item.market && typeof item.market === "object" ? item.market : {};
    const metrics = item.metrics && typeof item.metrics === "object" ? item.metrics : {};
    const card = node("article", "gap-card");
    const source = [
      item.sourceName || item.publisher || item.sourceId,
      market.listing ? listingLabels[market.listing] || market.listing : null,
    ].filter(Boolean).join(" · ");
    append(
      card,
      tokenCell(item, { link: true }),
      append(
        node("div", "gap-card-line"),
        node("span", "muted", "시총"),
        node("strong", "", compactUsd(market.marketCapUsd ?? metrics.marketCapUsd) ?? "—"),
      ),
      append(node("div", "gap-card-line"), node("span", "muted", "24h"), deltaNode(market.priceChange24hPct)),
      source ? node("div", "gap-card-source", source) : null,
    );
    const link = node("a", "text-link", "온체인 시장 보기 ↗");
    link.href = "#market";
    card.append(link);
    strip.append(card);
  }
}
function renderMarket() {
  const m = state.market && typeof state.market === "object" ? state.market : null;
  const rh = m?.robinhood && typeof m.robinhood === "object" ? m.robinhood : {};
  const newPools = list(rh.newPools).filter((item) => item && typeof item === "object");
  const trending = list(rh.trending).filter((item) => item && typeof item === "object");
  const testnet = list(rh.testnetTokens).filter((item) => item && typeof item === "object");
  const gaps = list(m?.gaps).filter((item) => item && typeof item === "object");
  const crossChain = list(m?.crossChain).filter((item) => item && typeof item === "object");
  const trends = list(m?.trends).filter((group) => group && typeof group === "object");
  const coverage = m?.coverage && typeof m.coverage === "object" ? m.coverage : {};
  const trendCount = trends.reduce((total, group) => total + list(group.items).length, 0);
  const value = (count) => (m ? Number(count).toLocaleString("ko-KR") : "—");
  const unit = m ? "개" : undefined;
  append(
    clear("#market-stats"),
    statCard("Robinhood 새 풀 (48h)", value(newPools.length), "GeckoTerminal robinhood 네트워크 · 수집 시점 표본", { unit, icon: "◈" }),
    statCard("Robinhood 트렌딩 풀", value(trending.length), "트렌딩 · 부스트 · 거래량 상위", { unit, icon: "↗", lime: trending.length > 0 }),
    statCard("타체인 갭 후보", value(gaps.length), "다른 체인에서 뜨지만 Robinhood 목록에 없는 토큰", { unit, icon: "◎" }),
    statCard("문화 트렌드 항목", value(trendCount), "검색 · 위키 · 소셜 트렌드 수집 항목", { unit, icon: "≡" }),
  );
  const error = $("#market-error");
  error.hidden = !state.marketError;
  error.textContent = state.marketError || "";
  $("#market-updated").textContent = !m
    ? state.marketError
      ? "온체인 시장 데이터를 불러오지 못했습니다."
      : "온체인 시장 데이터를 불러오는 중"
    : [
        coverage.newestCollectedAt
          ? `최근 수집 ${date(coverage.newestCollectedAt)}`
          : "아직 수집된 온체인 목록이 없습니다",
        `온체인 목록 ${number(coverage.tokenListings).toLocaleString("ko-KR")}개`,
        `트렌드 ${number(coverage.trendItems).toLocaleString("ko-KR")}개`,
        `Robinhood 등록부 ${number(rh.registrySize).toLocaleString("ko-KR")}개`,
      ].join(" · ");
  const sources = clear("#market-sources");
  for (const source of list(rh.sources).filter((entry) => entry && typeof entry === "object")) {
    const status = String(source.status || "waiting").toLowerCase();
    sources.append(
      badge(
        ["ok", "not_modified", "cached"].includes(status) ? "ok" : status,
        `${source.name || source.id} · ${statusLabels[status] || status}${finite(source.itemCount) ? ` · ${countText(source.itemCount)}개` : ""}`,
      ),
    );
  }
  fillTable(
    "#market-new-pools",
    "#market-new-empty",
    newPools.map((item) => poolRow(item)),
    "아직 수집된 Robinhood 새 풀이 없습니다. 지금 수집을 실행하세요.",
  );
  fillTable(
    "#market-trending",
    "#market-trending-empty",
    trending.map((item) => poolRow(item, { listing: true })),
    "아직 수집된 Robinhood 트렌딩·거래량 상위 풀이 없습니다.",
  );
  const gapSource = state.gapOnly ? gaps : crossChain;
  fillTable(
    "#market-gaps",
    "#market-gaps-empty",
    gapSource.map(gapRow),
    state.gapOnly
      ? "갭 조건(시총 $20K 이상 또는 트렌딩·부스트, Robinhood 목록에 없음)에 맞는 토큰이 아직 없습니다."
      : "아직 수집된 타체인 토큰 목록이 없습니다.",
  );
  $("#market-gap-count").textContent = `${gapSource.length}개`;
  const trendGrid = clear("#market-trends");
  if (trends.length) for (const group of trends) trendGrid.append(trendBlock(group));
  else
    trendGrid.append(
      node(
        "div",
        "empty-state",
        "아직 수집된 트렌드 항목이 없습니다. Google Trends·Wikipedia·Bluesky·Mastodon 소스가 첫 수집을 마치면 표시됩니다.",
      ),
    );
  fillTable(
    "#market-testnet",
    "#market-testnet-empty",
    testnet.map(testnetRow),
    "아직 수집된 Robinhood 테스트넷 토큰이 없습니다.",
  );
}

function navigate() {
  window.scrollTo({ top: 0, behavior: "instant" });
  const page = location.hash.slice(1);
  state.page = labels[page] ? page : "radar";
  $$(".page").forEach(
    (item) => (item.hidden = item.id !== `page-${state.page}`),
  );
  $$("#main-nav .nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.page === state.page);
    if (item.dataset.page === state.page)
      item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  $("#breadcrumb-page").textContent = labels[state.page];
  document.title = `${labels[state.page]} · Meme Observatory`;
  if (state.page === "market") renderMarket();
  if (state.page === "bangers" && state.key) bangerRadar.render();
  if (state.key) refresh({ silent: true });
}
function updateApiConnectionLinks(input = state.apiOrigin) {
  let origin;
  try { origin = normalizeApiOrigin(input, location.origin); } catch {}
  for (const link of $$('[data-api-link]')) {
    if (origin) {
      link.href = apiRequestUrl(link.dataset.apiLink, origin, location.origin);
      link.removeAttribute('aria-disabled');
    } else {
      link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true');
    }
  }
  $('#api-connection-label').textContent = origin ? `연결 대상 · ${origin}` : '올바른 백엔드 URL을 입력하세요.';
}
$('#api-origin').value = initialConnection.apiInput;
$('#login-error').textContent = initialConnection.error;
updateApiConnectionLinks();
$('#api-origin').addEventListener('input', () => updateApiConnectionLinks($('#api-origin').value));
$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#login-form button");
  await busy(button, async () => {
    const key = $("#api-key").value.trim();
    if (!key) return;
    try {
      const origin = normalizeApiOrigin($('#api-origin').value, location.origin);
      state.apiOrigin = origin;
      state.key = key;
      updateApiConnectionLinks(origin);
      const overview = await api("/api/overview");
      saveApiSession(sessionStorage, {apiOrigin: origin, key}, location.origin, API_ORIGIN);
      state.overview = overview;
      state.lastSync = new Date().toISOString();
      $("#login-screen").hidden = true;
      $("#workspace").hidden = false;
      $("#login-error").textContent = "";
      $("#api-key").value = "";
      renderOverview();
      navigate();
    } catch (error) {
      state.key = "";
      $("#login-error").textContent = error.message;
    }
  });
});
$("#logout-button").addEventListener("click", () => disconnect());
$("#close-detail").addEventListener("click", () =>
  $("#candidate-dialog").close(),
);
$("#candidate-dialog").addEventListener("click", (event) => {
  if (event.target === $("#candidate-dialog")) {
    const rect = event.target.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      event.target.close();
  }
});
$("#candidate-dialog").addEventListener("close", () => {
  state.detailRequest++;
});
async function collectNow() {
  const result = await api("/api/collectors/run", { method: "POST", body: {} });
  toast(
    result.message ||
      "수집을 실행했습니다. 소스 상태와 후보 목록을 갱신합니다.",
  );
  await refresh();
}
for (const selector of ["#collect-button", "#collect-sources-button"])
  $(selector).addEventListener("click", () => busy($(selector), collectNow));
$("#pause-button").addEventListener("click", () =>
  busy($("#pause-button"), async () => {
    const paused =
      state.overview?.policy?.paused || state.overview?.policy?.emergencyStop;
    const policy = await api(
      paused ? "/api/automation/resume" : "/api/automation/pause",
      { method: "POST", body: { emergency: false } },
    );
    if (state.overview) state.overview.policy = policy;
    renderOverview();
    toast(
      paused
        ? "자동화를 재개했습니다. 설정된 정책을 적용합니다."
        : "자동화를 일시정지했습니다.",
    );
    await refresh();
  }),
);
$("#emergency-button").addEventListener("click", () =>
  busy($("#emergency-button"), async () => {
    const policy = await api("/api/automation/pause", {
      method: "POST",
      body: { emergency: true },
    });
    if (state.overview) state.overview.policy = policy;
    renderOverview();
    toast(
      "긴급 정지했습니다. 이미 전송된 트랜잭션은 발행 기록에서 확인하세요.",
    );
    await refresh();
  }),
);
for (const item of $$("[data-refresh]"))
  item.addEventListener("click", () => busy(item, () => refresh()));
for (const item of $$("#favorite-tabs button"))
  item.addEventListener("click", () => {
    state.favorite = item.dataset.favorite === "true";
    $$("#favorite-tabs button").forEach((tab) => {
      const active = tab === item;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-pressed", String(active));
    });
    fetchCandidates().catch((error) => toast(error.message, true));
  });
let searchTimeout;
$("#candidate-search").addEventListener("input", () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(
    () => fetchCandidates().catch((error) => toast(error.message, true)),
    250,
  );
});
for (const selector of ["#candidate-view", "#data-filter", "#score-filter", "#sort-filter"])
  $(selector).addEventListener("change", () =>
    fetchCandidates().catch((error) => toast(error.message, true)),
  );
let hotSearchTimeout;
$('#hot-search').addEventListener('input',()=>{
  clearTimeout(hotSearchTimeout);hotSearchTimeout=setTimeout(()=>fetchCandidates({offset:0}).catch(error=>toast(error.message,true)),250);
});
for(const selector of ['#hot-window-filter','#hot-sort-filter']) $(selector).addEventListener('change',()=>fetchCandidates({offset:0}).catch(error=>toast(error.message,true)));
for(const [selector,direction] of [['#hot-previous',-1],['#hot-next',1]]) $(selector).addEventListener('click',()=>{
  if($(selector).disabled)return;
  return fetchCandidates({offset:Math.max(0,state.hotOffset+direction*state.hotLimit)}).catch(error=>toast(error.message,true));
});
$("#collector-search").addEventListener("input", renderCollectors);
for (const selector of ["#collector-kind-filter", "#collector-status-filter"])
  $(selector).addEventListener("change", renderCollectors);
$("#gap-only-toggle").addEventListener("change", () => {
  state.gapOnly = $("#gap-only-toggle").checked;
  renderMarket();
});
let archiveSearchTimeout;
function searchArchive() {
  clearTimeout(archiveSearchTimeout);
  return fetchArchive({ offset: 0 });
}
$("#archive-origin-only").addEventListener("change", () =>
  searchArchive().catch((error) => toast(error.message, true)),
);
$("#archive-search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  searchArchive().catch((error) => toast(error.message, true));
});
for (const selector of ["#archive-search", "#archive-handle", "#archive-list"])
  $(selector).addEventListener("input", () => {
    clearTimeout(archiveSearchTimeout);
    archiveSearchTimeout = setTimeout(
      () => searchArchive().catch((error) => toast(error.message, true)),
      300,
    );
  });
$("#archive-refresh").addEventListener("click", () =>
  busy($("#archive-refresh"), () => fetchArchive()),
);
for (const [selector, direction] of [["#archive-previous", -1], ["#archive-next", 1]])
  $(selector).addEventListener("click", () => {
    if ($(selector).disabled) return;
    fetchArchive({ offset: Math.max(0, state.observationOffset + direction * state.observationLimit) })
      .catch((error) => toast(error.message, true));
  });
$("#policy-form").addEventListener("submit", savePolicy);
$("#policy-form").addEventListener("input", () => {
  updatePolicyRecipientMode();
  state.policyDirty = true;
  $("#policy-dirty").textContent = "저장하지 않은 변경 사항이 있습니다.";
});
window.addEventListener("hashchange", navigate);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && state.key) refresh({ silent: true });
});
window.setInterval(() => {
  if (!document.hidden && state.key) refresh({ silent: true });
}, 8000);
if (state.key) {
  $("#login-screen").hidden = true;
  $("#workspace").hidden = false;
  navigate();
} else navigate();
