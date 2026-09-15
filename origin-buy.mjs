// 원본 매수 레인 화면. 서버의 GET /api/origin-buy 결과(신호·매수 저널·캡·설정)를 그대로 보여 주고,
// 운영자는 신호 하나를 지금 매수(POST …/buy, Idempotency-Key)하며 관리자는 레인을 일시 중지·재개한다.
// 모든 값은 textContent로만 그린다(서버·X 원문·토큰 이름은 신뢰하지 않는 데이터).
const ZERO = '0x0000000000000000000000000000000000000000';
const amount = value => typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value) : null;
const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' ? value : '';
const address = value => /^0x[a-fA-F0-9]{40}$/.test(value || '') ? value : null;
const txHash = value => /^0x[a-fA-F0-9]{64}$/.test(value || '') ? value : null;
const short = value => address(value) ? `${value.slice(0, 8)}…${value.slice(-6)}` : '주소 미확인';
const handle = value => /^[A-Za-z0-9_]{1,15}$/.test(value || '') ? value : null;
const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '시각 미확인';
const integer = value => Number.isFinite(value) ? Math.round(value).toLocaleString('en-US') : '—';
const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
/** wei → ETH with up to `digits` decimals, never rounded up. */
export function formatEth(value, digits = 6) {
  const wei = amount(value); if (wei === null) return '조회 불가';
  const scale = 10n ** 18n, whole = wei / scale, fraction = (wei % scale).toString().padStart(18, '0').slice(0, digits).replace(/0+$/, '');
  return `${whole.toLocaleString('en-US')}${fraction ? `.${fraction}` : ''} ETH`;
}
export function formatSignedEth(value, digits = 6) {
  if (typeof value !== 'string' || !/^-?\d+$/.test(value)) return '확인 불가';
  const wei = BigInt(value);
  return `${wei < 0n ? '-' : wei > 0n ? '+' : ''}${formatEth((wei < 0n ? -wei : wei).toString(), digits)}`;
}
/** Token base units → decimal string (18 decimals unless the server read another), 4 decimals shown. */
export function formatTokens(value, decimals = 18, digits = 4) {
  const raw = amount(value); if (raw === null || !Number.isInteger(decimals) || decimals < 0 || decimals > 77) return '—';
  const scale = 10n ** BigInt(decimals), whole = raw / scale;
  const fraction = decimals ? (raw % scale).toString().padStart(decimals, '0').slice(0, Math.min(digits, decimals)).replace(/0+$/, '') : '';
  return `${whole.toLocaleString('en-US')}${fraction ? `.${fraction}` : ''}`;
}
const usd = value => Number.isFinite(value) ? (value >= 1e6 ? `$${(value / 1e6).toFixed(2)}M` : value >= 1e3 ? `$${(value / 1e3).toFixed(1)}k` : `$${value.toFixed(0)}`) : '미확인';
export const SIGNAL_STATES = Object.freeze({ detected: '감지됨', planned: '계획됨', held: '보류', buying: '매수 진행', bought: '매수 기록', failed: '실패', skipped: '건너뜀' });
export const BUY_STATES = Object.freeze({ paper: 'PAPER 기록', queued: '대기', prepared: '서명됨', submitted: '전송됨', uncertain: '확인 중', confirmed: '완료', failed: '실패' });
export const ROUTES = Object.freeze({ 'pons-curve': 'Pons 커브', 'uniswap-v4-single': 'Uniswap V4 · ETH 페어', 'uniswap-v4-multi': 'Uniswap V4 · 2홉' });
export const HOLD_LABELS = Object.freeze({
  ORIGIN_BUY_TOO_LATE: 'FDV 상한 초과(이미 늦음)', ORIGIN_BUY_LIQUIDITY_LOW: '유동성 부족(수요 미확인)', ORIGIN_BUY_MARKET_UNKNOWN: '시장 데이터 대기(상장 전)', ORIGIN_BUY_SCORE_BELOW_MIN: '점수 미달', ORIGIN_BUY_DISABLED: '레인 비활성', ORIGIN_BUY_MODE_WATCH: 'WATCH 모드', ORIGIN_BUY_PAUSED: '일시 중지',
  ORIGIN_BUY_HOUR_CAP: '시간당 한도', ORIGIN_BUY_DAY_CAP: '일별 한도', ORIGIN_BUY_DAILY_WEI_CAP: '일일 금액 한도', ORIGIN_BUY_WALLET_UNSET: '매수 지갑 미설정', ORIGIN_BUY_NOT_FUNDED: '지갑 잔액 부족',
  ORIGIN_BUY_DUPLICATE: '이미 매수', ORIGIN_BUY_KEY_COOLDOWN: '쿨다운', ORIGIN_BUY_PAIR_ROUTE_UNKNOWN: '페어 경로 없음', ORIGIN_BUY_CURVE_PAIR_UNSUPPORTED: 'ERC-20 페어 커브(미지원)', ORIGIN_BUY_POOL_EMPTY: '풀 유동성 없음',
  ORIGIN_BUY_ROUTE_UNAVAILABLE: '매수 경로 없음', ORIGIN_BUY_SIMULATION_FAILED: '시뮬레이션 실패', ORIGIN_BUY_DAILY_BUDGET: '일일 예산 부족', ORIGIN_BUY_SOCIAL_MATCH_REQUIRED: '프로필 일치 필요', ORIGIN_BUY_REVERTED: '체인에서 실패',
  ORIGIN_BUY_PROVENANCE_UNVERIFIED: '원본 연결 미확인', ORIGIN_BUY_PROVENANCE_REQUIRED: '원본 연결 확인 필요', ORIGIN_BUY_AUTHOR_CA_REQUIRED: '저자 원문에 정확한 CA 없음', ORIGIN_BUY_SOURCE_NOT_ORIGINAL: '원문 게시물이 아님', ORIGIN_BUY_MULTIPLE_CA_POST: '원문에 여러 CA', ORIGIN_BUY_MULTI_CA_AUTHOR: '여러 토큰을 올리는 계정', ORIGIN_BUY_PROMOTIONAL_SOURCE: '광고성 원문',
  ORIGIN_BUY_SOURCE_TIME_INVALID: '원문 시각 미확인', ORIGIN_BUY_SOURCE_STALE: '오래된 원문', ORIGIN_BUY_SOURCE_UNAVAILABLE: '원문 조회 불가', ORIGIN_BUY_POST_STALE: '진입 가능 원문 시간 초과', ORIGIN_BUY_TOKEN_STALE: '토큰 발행 시각 조건 미달', ORIGIN_BUY_TOKEN_AGE_UNKNOWN: '발행 시각 대기', ORIGIN_BUY_TOKEN_TOO_OLD: '토큰 발행 후 시간 초과', ORIGIN_BUY_TOKEN_TIME_INVALID: '발행 시각 오류',
  ORIGIN_BUY_MARKET_STALE: '최신 시장 데이터 대기', ORIGIN_BUY_LIQUIDITY_UNKNOWN: '유동성 조회 대기', ORIGIN_BUY_LIVE_DISABLED: '실거래 잠금', ORIGIN_BUY_POLICY_PAUSED: '전체 매매 일시 중지', ORIGIN_BUY_EMERGENCY_STOP: '긴급 정지',
  ORIGIN_BUY_POSITION_CAP: '동시 보유 한도', ORIGIN_BUY_LOSS_LIMIT: '일일 실현 손실 한도', ORIGIN_BUY_EXIT_UNAVAILABLE: '매도 경로 준비 대기', ORIGIN_BUY_EXIT_UNVERIFIED: '매도 경로 검증 미완료', ORIGIN_BUY_EXIT_EXPIRED: '매도 검증 견적 만료', ORIGIN_BUY_ROUND_TRIP_COST: '왕복 거래비용 상한 초과', ORIGIN_BUY_EXIT_GAS_NOT_FUNDED: '매도 가스 잔액 부족', ORIGIN_BUY_EXIT_GAS_BUDGET: '매도 가스 예산 부족',
  ORIGIN_BUY_WALLET_BUSY: '지갑의 다른 거래 처리 중', ORIGIN_BUY_NONCE_OCCUPIED: '거래 순번 사용 중', ORIGIN_BUY_QUOTE_EXPIRED: '매수 견적 만료', ORIGIN_BUY_INVALID_QUOTE: '매수 견적 검증 실패', ORIGIN_BUY_POLICY_CHANGED: '매수 조건 변경', ORIGIN_BUY_LEASE_LOST: '지갑 처리 잠금 만료',
  ORIGIN_EXIT_UNAVAILABLE: '청산 서비스 연결 안 됨', ORIGIN_EXIT_DISABLED: '실매도 잠금', ORIGIN_EXIT_STOPPED: '청산 서비스 중지', ORIGIN_EXIT_WALLET_BUSY: '지갑의 다른 거래 처리 중', ORIGIN_EXIT_NOT_FUNDED: '매도 가스 잔액 부족', ORIGIN_EXIT_GAS_BUDGET: '매도 가스 예산 부족', ORIGIN_EXIT_INVALID_QUOTE: '매도 견적 검증 실패', ORIGIN_EXIT_REVERTED: '매도 거래 실패', ORIGIN_EXIT_RPC_ERROR: '매도 네트워크 조회 실패',
  ORIGIN_EXIT_POSITION_CHANGED: '잔여 포지션 변경', ORIGIN_EXIT_POSITION_CLOSED: '이미 전량 청산', ORIGIN_EXIT_POSITION_NOT_FOUND: '포지션 조회 불가', ORIGIN_EXIT_POSITION_MISMATCH: '매도 수량 확인 필요', ORIGIN_EXIT_INVALID_AMOUNT: '매도 수량 오류', ORIGIN_EXIT_LEASE_LOST: '지갑 처리 잠금 만료', ORIGIN_EXIT_NONCE_OCCUPIED: '거래 순번 사용 중',
  ORIGIN_SELL_QUOTE_EXPIRED: '매도 견적 만료', ORIGIN_SELL_QUOTE_CHANGED: '매도 견적 변경', ORIGIN_SELL_BALANCE_CHANGED: '토큰 잔액 변경', ORIGIN_SELL_NONCE_CHANGED: '지갑 거래 순번 변경', ORIGIN_SELL_SIMULATION_FAILED: '매도 시뮬레이션 실패', ORIGIN_SELL_RPC_OPERATION_FAILED: '매도 네트워크 요청 실패', ORIGIN_SELL_ROUTE_CHANGED: '매도 경로 변경', ORIGIN_SELL_LIVE_DISABLED: '실매도 잠금', ORIGIN_SELL_RECEIPT_MISMATCH: '매도 영수증 확인 필요', ORIGIN_SELL_QUOTE_TOO_SMALL: '매도 수령액 부족',
});
const methodLabel = { contract_in_post: '본문 CA', profile_handle: '프로필 링크' };
const reasonLabel = reason => {
  const [kind, detail] = String(reason).split(':');
  const labels = { social_match: '프로필 일치', social_other_author: '프로필은 다른 계정', exact_ca_in_own_post: '저자 본문 정확한 CA', verified_author_ca_fast_entry: '직접 CA 확인·조회수 대기 없음', provenance_unverified: HOLD_LABELS[detail] ?? '원본 연결 미확인', maker_traits: `원작자 특성 ${detail ?? ''}`.trim(), views: `조회 ${detail}`, velocity: `속도 ${detail}`, name_echo: `동명 토큰 ${detail}개`, names_token: '토큰 이름 언급', single_ca_author: 'CA 1개 계정', multi_ca_author: `CA ${detail}개 계정(광고 의심)`, posted_at_launch: '발행 직후 게시', shill: '광고성 문구' };
  return labels[kind] ?? String(reason);
};

export function formatExitRules(rules = {}) {
  const pct = n => finite(n) === null ? '미설정' : `${Number((Number(n) / 100).toFixed(2))}%`;
  const multiple = n => finite(n) === null ? '미설정' : `${Number((1 + Number(n) / 10000).toFixed(2))}x`;
  const hold = finite(rules.maxHoldSeconds) === null ? '미설정' : `${Number((Number(rules.maxHoldSeconds) / 3600).toFixed(2))}시간`;
  return `${multiple(rules.takeProfitBps)}에서 ${pct(rules.takeProfitSellBps)} 익절 · -${pct(rules.stopLossBps)} 손절 · ${multiple(rules.trailingActivationBps)} 도달 후 고점 대비 ${pct(rules.trailingStopBps)} 하락 시 청산 · 최대 ${hold}`;
}

const POSITION_STATES = { open: '보유 중', closing: '청산 진행', closed: '전량 청산', attention: '확인 필요' };
const EXIT_REASONS = { operator: '운영자 전량 매도', take_profit: '부분 익절', stop_loss: '손절', trailing_stop: '고점 하락 청산', time_exit: '보유 시간 종료' };

export function createOriginBuy({ api, document = globalThis.document, toast = () => {}, now = () => Date.now(), confirm = message => typeof globalThis.confirm === 'function' ? globalThis.confirm(message) : false, randomId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}` }) {
  const root = document.querySelector('#origin-buy-root');
  const el = (tag, className = '', value = '') => { const node = document.createElement(tag); if (className) node.className = className; if (value !== '') node.textContent = value; return node; };
  const add = (parent, ...children) => { for (const child of children) if (child) parent.append(child); return parent; };
  const link = (label, url, allowedHost) => {
    try { const parsed = new URL(url); if (parsed.protocol !== 'https:' || parsed.hostname !== allowedHost || parsed.username || parsed.password) return null; } catch { return null; }
    const node = el('a', 'text-link', label); node.href = url; node.target = '_blank'; node.rel = 'noopener noreferrer'; return node;
  };
  const explorer = (label, kind, value) => link(label, `https://robin.etherscan.io/${kind}/${value}`, 'robin.etherscan.io');
  const xLink = (label, url) => link(label, url, 'x.com');
  let snapshot = null, error = '', loading = false, pendingKey = null, epoch = 0;

  const heading = el('div', 'page-heading');
  add(heading, add(el('div'), el('div', 'eyebrow', 'ORIGIN BUY · CANONICAL TOKEN'), el('h1', '', '원본 매수'), el('p', 'muted', '저자 원문의 정확한 CA와 토큰 프로필을 함께 확인한 뒤 매수하고, 포지션별 청산 규칙을 적용합니다. 점수는 수익 예측이 아닙니다.')));
  const refreshButton = el('button', 'button secondary', '지금 새로고침'); refreshButton.type = 'button'; refreshButton.id = 'origin-buy-refresh';
  refreshButton.addEventListener('click', () => refresh({ force: true }));
  add(heading, refreshButton);
  const status = el('p', 'origin-buy-status muted'); status.id = 'origin-buy-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const panel = el('section', 'panel origin-buy-panel'); panel.id = 'origin-buy-panel';
  const panelHead = el('div', 'panel-heading');
  const pill = el('span', 'pill', '확인 중'); pill.id = 'origin-buy-pill';
  const summary = el('p', 'muted'); summary.id = 'origin-buy-summary';
  add(panelHead, add(el('div'), add(el('h2', '', '레인 상태 '), pill), summary));
  const actions = el('div', 'hot-lane-actions');
  const pauseButton = el('button', 'button small subtle', '일시 중지 (60분)'); pauseButton.type = 'button'; pauseButton.id = 'origin-buy-pause'; pauseButton.disabled = true;
  const resumeButton = el('button', 'button small subtle', '재개'); resumeButton.type = 'button'; resumeButton.id = 'origin-buy-resume'; resumeButton.disabled = true;
  pauseButton.addEventListener('click', () => control('pause'));
  resumeButton.addEventListener('click', () => control('resume'));
  add(actions, pauseButton, resumeButton);
  add(panelHead, actions);
  const settings = el('div', 'origin-buy-settings'); settings.id = 'origin-buy-settings';
  const review = el('p', 'origin-buy-review muted'); review.id = 'origin-buy-review';
  add(panel, panelHead, settings, review);
  const signalsBox = el('section', 'panel origin-buy-signals'); signalsBox.setAttribute('aria-label', '원본 매수 신호');
  const signalsTable = el('table', 'data-table origin-buy-table'); signalsTable.id = 'origin-buy-signals';
  const signalsHead = el('tr');
  for (const name of ['점수', '토큰', '원작자 게시물', '시장 · 근거', '상태', '매수']) { const th = el('th', '', name); th.scope = 'col'; signalsHead.append(th); }
  const signalsBody = el('tbody'); add(signalsTable, el('caption', 'sr-only', '최근 24시간 원본 매수 신호(점수순)'), add(el('thead'), signalsHead), signalsBody);
  const signalsEmpty = el('p', 'origin-buy-empty muted', '최근 24시간 동안 감지된 신호가 없습니다.'); signalsEmpty.id = 'origin-buy-signals-empty';
  add(signalsBox, el('h2', 'origin-buy-title', '신호 · 최근 24시간'), add(el('div', 'origin-buy-table-wrap'), signalsTable), signalsEmpty);
  const buysBox = el('section', 'panel origin-buy-buys'); buysBox.setAttribute('aria-label', '원본 매수 기록');
  const buysTable = el('table', 'data-table origin-buy-table'); buysTable.id = 'origin-buy-buys';
  const buysHead = el('tr');
  for (const name of ['접수 시각', '토큰', '경로', '매수액', '예상 → 실수령', '상태', '트랜잭션']) { const th = el('th', '', name); th.scope = 'col'; buysHead.append(th); }
  const buysBody = el('tbody'); add(buysTable, el('caption', 'sr-only', '원본 매수 저널(PAPER 기록과 실매수)'), add(el('thead'), buysHead), buysBody);
  const buysEmpty = el('p', 'origin-buy-empty muted', '아직 매수 기록이 없습니다. PAPER 모드에서는 경로·견적·비용만 기록됩니다.'); buysEmpty.id = 'origin-buy-buys-empty';
  add(buysBox, el('h2', 'origin-buy-title', '매수 기록'), add(el('div', 'origin-buy-table-wrap'), buysTable), buysEmpty);
  const holdingsBox = el('section', 'panel origin-buy-holdings'); holdingsBox.setAttribute('aria-label', '원본 토큰 포지션과 청산');
  const holdingsSummary = el('p', 'muted origin-buy-holdings-summary'); holdingsSummary.id = 'origin-buy-holdings-summary';
  const rulesSummary = el('p', 'origin-buy-rules muted'); rulesSummary.id = 'origin-buy-exit-rules';
  const positionsGrid = el('div', 'origin-buy-position-grid'); positionsGrid.id = 'origin-buy-positions';
  const positionsEmpty = el('p', 'origin-buy-empty muted', '관리 중인 포지션이 없습니다. 신규 전략의 PAPER 매수와 확인된 실매수가 여기에 표시됩니다.'); positionsEmpty.id = 'origin-buy-positions-empty';
  const ordersTable = el('table', 'data-table origin-buy-table origin-buy-exit-table'); ordersTable.id = 'origin-buy-exits';
  const ordersHead = el('tr');
  for (const name of ['접수 시각', '토큰 · 실행', '매도 수량 · 이유', '수령액 · 가스', '상태']) { const th = el('th', '', name); th.scope = 'col'; ordersHead.append(th); }
  const ordersBody = el('tbody'); add(ordersTable, el('caption', 'sr-only', '원본 포지션 청산 주문'), add(el('thead'), ordersHead), ordersBody);
  const ordersEmpty = el('p', 'origin-buy-empty muted', '아직 청산 주문이 없습니다.'); ordersEmpty.id = 'origin-buy-exits-empty';
  add(holdingsBox, el('h2', 'origin-buy-title', '포지션 · 청산'), holdingsSummary, rulesSummary, positionsGrid, positionsEmpty, el('h3', 'origin-buy-title', '청산 주문'), add(el('div', 'origin-buy-table-wrap'), ordersTable), ordersEmpty);
  const note = el('p', 'origin-buy-note muted', 'PAPER 포지션과 청산 손익은 매도 견적을 이용한 모의 결과이며 자산을 전송하지 않습니다. 실매도 수령액을 확인하지 못하면 실현손익은 확인 불가로 표시합니다. 표시된 견적은 매도 요청 시 다시 확인합니다.');
  add(root, heading, status, panel, signalsBox, holdingsBox, buysBox, note);

  function paused(lane) { const until = Date.parse(lane?.pausedUntil || ''); return Number.isFinite(until) && until > now(); }
  function liveBuyAllowed(lane) { return lane?.liveAllowed === true && lane?.liveBlocked !== true && lane?.available === true && lane?.enabled === true && !paused(lane) && !lane.paused && !lane.emergencyStop && lane.mode === 'AUTO'; }
  function buyAllowed(signal) { return snapshot?.canBuy === true && snapshot.available === true && snapshot.enabled === true && !paused(snapshot) && !snapshot.paused && !snapshot.emergencyStop && (snapshot.mode === 'PAPER' || liveBuyAllowed(snapshot)) && signal.data?.provenance?.verified === true && finite(signal.score) !== null && signal.score >= (snapshot.settings?.minScore ?? 60) && ['detected', 'planned', 'held'].includes(signal.state); }
  function sellAllowed(position) { return (snapshot?.canSell ?? snapshot?.canBuy) === true && snapshot?.holdings?.available === true && uuid(position.id) && ['open', 'attention'].includes(position.status) && (amount(position.remainingTokens) ?? 0n) > 0n && (position.execution === 'paper' || position.execution === 'live' && snapshot.holdings.liveAllowed === true); }
  function drawSettings(lane) {
    settings.replaceChildren();
    const s = lane.settings ?? {}, caps = lane.caps ?? {};
    const item = (label, value) => add(el('div', 'origin-buy-setting'), el('span', 'origin-buy-setting-label', label), el('strong', '', value));
    add(settings,
      item('모드 / 실행', `${text(lane.mode) || '—'} · ${lane.mode === 'AUTO' ? liveBuyAllowed(lane) ? '실매수 허용' : '실거래 잠금·조건 미충족' : '기록만'}`),
      item('건당 매수', formatEth(s.buyWei)),
      item('시간당 / 일별', `${caps.hour?.used ?? '—'} / ${caps.hour?.max ?? '—'} · ${caps.day?.used ?? '—'} / ${caps.day?.max ?? '—'}`),
      item('일일 금액', `${formatEth(caps.dayWei?.used ?? '0')} / ${formatEth(caps.dayWei?.max)}`),
      item('점수 하한 / FDV 상한', `${s.minScore ?? '—'}점 · ${usd(s.maxFdvUsd)}`),
      item('원문 / 시장 유효 시간', `${s.maxEntryAgeSeconds ?? '—'}초 / ${s.maxMarketAgeSeconds ?? '—'}초`),
      item('보유 / 일일 손실 한도', `${s.maxOpenPositions ?? '—'}개 · ${formatEth(s.dailyLossLimitWei)}`),
      item('매수 지갑', lane.wallet ? `#${lane.wallet.index} ${short(lane.wallet.address)}` : lane.walletMode === 'rotating' ? '미설정 (policy.originBuy.walletIndex)' : text(lane.walletMode) || '—'));
  }
  function signalRow(signal) {
    const data = signal.data ?? {}, post = data.post ?? {}, market = data.market ?? {}, tokenAddress = address(signal.tokenAddress);
    const tr = el('tr', `origin-buy-row state-${text(signal.state)}`);
    const scoreCell = el('td', 'origin-buy-score'); add(scoreCell, el('strong', '', String(Number.isFinite(signal.score) ? signal.score : '—')), el('small', '', `/100`));
    const tokenCell = el('td', 'origin-buy-token');
    add(tokenCell, el('strong', '', text(signal.symbol) || text(signal.name) || '이름 미확인'), el('span', 'origin-buy-line muted', text(signal.name) && signal.name !== signal.symbol ? signal.name : ''),
      tokenAddress ? explorer(short(tokenAddress), 'token', tokenAddress) : el('span', 'muted', '주소 미확인'));
    const postCell = el('td', 'origin-buy-post');
    const author = handle(signal.author);
    add(postCell, author ? xLink(`@${author}`, `https://x.com/${author}`) : el('span', 'muted', '작성자 미확인'),
      el('span', 'origin-buy-line muted', `${methodLabel[post.method] ?? '—'} · ${date(post.publishedAt)}`),
      el('span', 'origin-buy-excerpt', text(post.text).replace(/\s+/g, ' ').slice(0, 140)),
      post.url && /^https:\/\/(?:www\.)?x\.com\//.test(post.url) ? xLink('원문 ↗', post.url) : null);
    const marketCell = el('td', 'origin-buy-market');
    add(marketCell, el('strong', '', `FDV ${usd(finite(market.fdvUsd))}`),
      el('span', `origin-buy-provenance ${data.provenance?.verified === true ? 'verified' : 'unverified'}`, data.provenance?.verified === true ? '원본 연결 확인 · 저자 CA + 프로필' : post.method === 'profile_handle' ? '프로필 링크만 확인 · 자동 매수 제외' : '원본 연결 미확인 · 자동 매수 제외'),
      el('span', 'origin-buy-line muted', `속도 ${data.velocity?.viewsPerMin != null ? `${integer(data.velocity.viewsPerMin)}/min` : '—'} · 조회 ${integer(data.velocity?.views)} · 동명 ${integer(data.nameEchoCount)}개`),
      el('span', 'origin-buy-reasons', list(data.reasons).map(reasonLabel).join(' · ')));
    const stateCell = el('td', 'origin-buy-state');
    add(stateCell, el('strong', '', SIGNAL_STATES[signal.state] ?? text(signal.state)), signal.heldCode ? el('span', 'origin-buy-line origin-buy-hold', HOLD_LABELS[signal.heldCode] ?? signal.heldCode) : null,
      signal.retryAt ? el('span', 'origin-buy-line muted', `재시도 ${date(signal.retryAt)}`) : null, el('span', 'origin-buy-line muted', `갱신 ${date(signal.updatedAt)}`));
    const buyCell = el('td', 'origin-buy-action-cell');
    const canBuy = buyAllowed(signal);
    const button = el('button', 'button small origin-buy-action', snapshot?.mode === 'AUTO' ? '지금 매수' : '지금 기록(PAPER)'); button.type = 'button';
    button.disabled = !canBuy || Boolean(pendingKey);
    button.title = !snapshot?.canBuy ? '운영자 권한이 필요합니다.' : data.provenance?.verified !== true ? '저자 원문의 정확한 CA와 토큰 프로필 확인이 필요합니다.' : snapshot?.mode === 'AUTO' && !liveBuyAllowed(snapshot) ? '실거래 잠금 또는 실행 조건을 확인하세요.' : !canBuy ? '점수·상태·레인 조건을 만족하지 않습니다.' : snapshot?.mode === 'AUTO' ? '최신 원문·시장·매도 경로와 한도를 재검증해 실매수합니다.' : 'PAPER 모드: 경로·견적만 기록합니다.';
    button.addEventListener('click', () => buyNow(signal));
    add(buyCell, button);
    add(tr, scoreCell, tokenCell, postCell, marketCell, stateCell, buyCell);
    return tr;
  }
  function buyRow(buy) {
    const tr = el('tr', `origin-buy-row status-${text(buy.status)}`);
    const routed = buy.data?.routed ?? {}, quote = buy.data?.quote ?? {}, decimals = Number.isInteger(routed.decimals) ? routed.decimals : 18;
    const tokenAddress = address(routed.tokenAddress ?? quote.tokenAddress ?? buy.signalKey);
    add(tr, el('td', '', date(buy.createdAt)),
      add(el('td', 'origin-buy-token'), el('strong', '', text(routed.symbol) || short(tokenAddress)), tokenAddress ? explorer(short(tokenAddress), 'token', tokenAddress) : null),
      add(el('td'), el('span', '', ROUTES[buy.route] ?? text(buy.route)), el('span', 'origin-buy-line muted', `${buy.execution === 'live' ? '실매수' : 'PAPER'} · ${text(buy.trigger)}`)),
      add(el('td', 'origin-buy-number'), el('strong', '', formatEth(buy.quoteInWei)), el('span', 'origin-buy-line muted', `가스 상한 ${formatEth(quote.maxGasCostWei, 7)}`)),
      add(el('td', 'origin-buy-number'), el('span', '', `${formatTokens(buy.expectedTokensOut, decimals)} → ${buy.tokensOut ? formatTokens(buy.tokensOut, decimals) : '—'}`), el('span', 'origin-buy-line muted', `바닥 ${formatTokens(buy.minTokensOut, decimals)}`)),
      add(el('td'), el('strong', '', BUY_STATES[buy.status] ?? text(buy.status)), buy.errorCode ? el('span', 'origin-buy-line origin-buy-hold', HOLD_LABELS[buy.errorCode] ?? buy.errorCode) : null, buy.actualCostWei && buy.actualCostWei !== '0' ? el('span', 'origin-buy-line muted', `실비용 ${formatEth(buy.actualCostWei, 7)}`) : null),
      add(el('td'), txHash(buy.txHash) ? explorer(`${buy.txHash.slice(0, 10)}…`, 'tx', buy.txHash) : el('span', 'muted', buy.execution === 'live' ? '전송 전' : '없음(PAPER)')));
    return tr;
  }
  function positionCard(position) {
    const paper = position.execution === 'paper', tokenAddress = address(position.tokenAddress), decimals = Number.isInteger(position.decimals) ? position.decimals : 18, closedPosition = position.status === 'closed' || amount(position.remainingTokens) === 0n;
    const mark = position.mark ?? {}, markAt = Date.parse(mark.asOf ?? mark.at ?? ''), expiry = Date.parse(mark.expiresAt ?? '');
    const quoteApplies = amount(mark.tokensQuoted) !== null && mark.tokensQuoted === position.remainingTokens && (amount(position.remainingTokens) ?? 0n) > 0n;
    const current = quoteApplies && amount(mark.minNetWei) !== null && Number.isFinite(markAt) && markAt <= now() && Number.isFinite(expiry) && expiry > now() && !position.errorCode;
    const age = Number.isFinite(markAt) && markAt <= now() ? `${Math.floor((now() - markAt) / 1000)}초 전` : '시각 미확인';
    const card = el('article', `origin-buy-position ${paper ? 'paper' : 'live'}`); card.setAttribute('data-position-id', position.id);
    const title = el('div', 'origin-buy-position-head');
    add(title, add(el('div'), el('h3', '', text(position.symbol) || short(tokenAddress)), tokenAddress ? explorer(short(tokenAddress), 'token', tokenAddress) : null), el('span', `pill ${paper ? 'demo' : position.status === 'attention' ? 'warning' : ''}`, `${paper ? 'PAPER 모의' : '실자산'} · ${POSITION_STATES[position.status] ?? text(position.status)}`));
    const facts = el('div', 'origin-buy-position-facts');
    const fact = (label, value, detail = '') => add(el('div'), el('span', 'origin-buy-setting-label', label), el('strong', '', value), detail ? el('span', 'origin-buy-line muted', detail) : null);
    const initial = formatTokens(position.initialTokens, decimals), remaining = formatTokens(position.remainingTokens, decimals);
    const partial = amount(position.remainingTokens) !== null && amount(position.initialTokens) !== null && amount(position.remainingTokens) > 0n && amount(position.remainingTokens) < amount(position.initialTokens);
    const multiple = !quoteApplies || finite(mark.multipleBps) === null ? '배수 미확인' : `${(mark.multipleBps / 10000).toFixed(2)}x`;
    const pnl = position.proceedsKnown === false || position.realizedPnlWei == null ? '확인 불가 · 수령액 미확인' : formatSignedEth(position.realizedPnlWei, 7);
    add(facts,
      fact('남은 토큰', remaining, `최초 ${initial}${partial ? ' · 부분 청산 후 잔여' : ''}`),
      fact('진입 비용', formatEth(position.entryCostWei, 7), `매수 가스 포함 · 잔여 원가 ${formatEth(position.remainingCostWei, 7)}`),
      fact(`${paper ? '모의 ' : ''}${current ? '현재' : '마지막'} 매도 견적 · 가스 차감`, closedPosition ? '잔여 토큰 없음' : quoteApplies ? formatEth(mark.minNetWei, 7) : '잔여 수량 재견적 대기', closedPosition ? '청산 완료' : `보수적 순회수 · 잔여 원가 대비 ${multiple}`),
      fact(paper ? '모의 실현손익' : '실현손익', pnl, `누적 수령 ${position.proceedsKnown === false ? '확인 불가' : formatEth(position.proceedsWei, 7)} · 매도 가스 ${formatEth(position.exitGasWei, 7)}`));
    const quoteStatus = el('p', `origin-buy-quote-status ${current || closedPosition ? 'muted' : 'origin-buy-hold'}`, closedPosition ? `${paper ? '모의 ' : ''}전량 청산 완료 · 수령액과 실현손익은 아래 청산 주문 기준입니다.` : mark.at ? `${age} 견적 · ${!quoteApplies ? '수량 변경 또는 미확인·재견적 필요' : current ? `유효(만료 ${date(mark.expiresAt)})` : Number.isFinite(expiry) && expiry <= now() ? '만료·재견적 필요' : '현재성 미확인'} · ${date(mark.asOf ?? mark.at)}${paper ? ' · 모의 견적, 전송 없음' : ''}` : '아직 매도 견적이 없습니다. 순회수액과 배수는 확인 전입니다.');
    const positionRules = el('p', 'origin-buy-rules muted', `이 포지션 규칙: ${formatExitRules(position.rules ?? snapshot.settings)}${position.takeProfitDone ? ' · 부분 익절 완료' : ''}`);
    const sell = el('button', 'button small origin-position-sell', paper ? '잔여 전량 모의 청산' : '잔여 전량 실매도'); sell.type = 'button'; sell.disabled = !sellAllowed(position) || Boolean(pendingKey);
    sell.title = (snapshot.canSell ?? snapshot.canBuy) !== true ? '운영자 권한이 필요합니다.' : position.execution === 'live' && snapshot.holdings?.liveAllowed !== true ? '실매도 잠금 또는 실행 조건을 확인하세요.' : !['open', 'attention'].includes(position.status) ? '청산 중이거나 이미 전량 청산했습니다.' : '남은 토큰 전량의 새 견적을 확인해 청산합니다.';
    sell.addEventListener('click', () => sellNow(position));
    add(card, title, facts, quoteStatus, positionRules, position.errorCode ? el('p', 'origin-buy-hold', HOLD_LABELS[position.errorCode] ?? position.errorCode) : null, add(el('div', 'origin-buy-position-footer'), el('span', 'muted', `진입 ${date(position.openedAt)}${position.closedAt ? ` · 종료 ${date(position.closedAt)}` : ''}`), sell));
    return card;
  }
  function exitRow(order) {
    const position = list(snapshot.holdings?.positions).find(p => p.id === order.positionId), paper = order.execution === 'paper', decimals = position?.decimals ?? 18;
    const received = order.quoteOutWei == null ? '수령액 확인 불가' : formatEth(order.quoteOutWei, 7);
    const state = BUY_STATES[order.status] ?? text(order.status);
    const stateCell = add(el('td'), el('strong', '', `${paper ? 'PAPER 모의 · ' : ''}${state}`), order.errorCode ? el('span', 'origin-buy-line origin-buy-hold', HOLD_LABELS[order.errorCode] ?? order.errorCode) : null);
    for (const stage of list(order.stages)) if (txHash(stage.txHash)) add(stateCell, explorer(`${stage.stage === 'sell' ? '매도' : '승인'} ${stage.txHash.slice(0, 10)}…`, 'tx', stage.txHash));
    return add(el('tr'), el('td', '', date(order.createdAt)), add(el('td'), el('strong', '', text(position?.symbol) || '토큰'), el('span', 'origin-buy-line muted', paper ? '모의 청산 · 전송 없음' : '실매도')),
      add(el('td'), el('strong', '', formatTokens(order.tokensIn, decimals)), el('span', 'origin-buy-line muted', EXIT_REASONS[order.reason] ?? text(order.reason))),
      add(el('td'), el('strong', '', received), el('span', 'origin-buy-line muted', `견적 바닥 ${formatEth(order.minQuoteOutWei, 7)} · ${paper ? '가정 가스' : '실제 가스'} ${formatEth(order.actualCostWei, 7)}`)), stateCell);
  }
  function drawHoldings(lane) {
    const holdings = lane.holdings;
    holdingsSummary.textContent = !holdings?.available ? '청산 서비스가 연결되지 않았습니다. 신규 매수 전 매도 경로 확인이 필요합니다.' : `${holdings.enabled ? '자동 청산 켜짐' : '자동 청산 꺼짐'} · ${holdings.liveAllowed === true ? '실매도 실행 허용' : '실매도 잠금'} · 마지막 확인 ${date(holdings.heartbeat?.at)}${holdings.heartbeat?.errors ? ` · 확인 오류 ${integer(holdings.heartbeat.errors)}건` : ''}`;
    rulesSummary.textContent = `새 포지션 기본 규칙: ${formatExitRules(lane.settings)}. 각 포지션은 진입 시 저장된 규칙을 따릅니다.`;
    const positions = list(holdings?.positions), orders = list(holdings?.orders);
    positionsGrid.replaceChildren(...positions.map(positionCard)); positionsEmpty.hidden = positions.length > 0;
    ordersBody.replaceChildren(...orders.map(exitRow)); ordersEmpty.hidden = orders.length > 0;
  }
  function draw() {
    const lane = snapshot;
    if (!lane) { status.textContent = error || (loading ? '원본 매수 상태를 불러오는 중입니다.' : '아직 불러오지 않았습니다.'); return; }
    const isPaused = paused(lane);
    pill.textContent = !lane.available ? '연결 안 됨' : !lane.enabled ? '비활성' : isPaused ? '일시 중지' : lane.emergencyStop ? '긴급 정지' : lane.paused ? '전역 정지' : lane.mode === 'AUTO' ? liveBuyAllowed(lane) ? '실매수 가능' : 'AUTO · 실거래 잠금' : `${lane.mode} · 기록만`;
    pill.className = `pill ${!lane.available || lane.emergencyStop ? 'error' : !lane.enabled || isPaused || lane.paused || lane.mode === 'AUTO' && !liveBuyAllowed(lane) ? 'warning' : liveBuyAllowed(lane) ? 'success' : 'demo'}`;
    summary.textContent = !lane.available ? '이 서버에는 원본 매수 공급자가 연결되지 않았습니다(메인넷·Pons V2·지갑 니모닉 필요).'
      : !lane.enabled ? '레인이 꺼져 있습니다. 신호는 계속 감지·점수화되지만 매수·기록은 하지 않습니다. 자동화 정책에서 originBuy.enabled를 켜세요.'
      : isPaused ? `${date(lane.pausedUntil)}까지 일시 중지 상태입니다.` : lane.mode === 'AUTO' ? liveBuyAllowed(lane) ? '원본 연결·최신 시장·매도 경로·한도를 모두 통과한 신호를 실매수합니다.' : 'AUTO 설정이지만 현재 실거래 잠금 또는 실행 조건으로 매수할 수 없습니다.' : '조건을 만족하는 신호의 경로·견적·비용만 기록합니다(전송 없음).';
    pauseButton.disabled = lane.canPause !== true || !lane.available || isPaused || loading;
    resumeButton.disabled = lane.canPause !== true || !lane.available || !isPaused || loading;
    drawSettings(lane);
    const r = lane.review;
    review.textContent = r ? `사후 검토 ${date(r.at)} · 최근 ${r.days}일 매수 ${r.buys}건: win ${r.verdicts?.win ?? 0} · flat ${r.verdicts?.flat ?? 0} · loss ${r.verdicts?.loss ?? 0} · dead ${r.verdicts?.dead ?? 0} · 보류로 놓친 것 ${r.missed ?? 0}건${list(r.issueCounts).length ? ` · 반복 문제: ${list(r.issueCounts).slice(0, 3).map(([issue, count]) => `${issue} ${count}건`).join(', ')}` : ''} (npm run origin:review)` : '사후 검토 기록이 아직 없습니다 (레인이 켜져 있으면 매시간 자동 기록, 또는 npm run origin:review).';
    const signals = list(lane.signals);
    signalsBody.replaceChildren(...signals.map(signalRow));
    signalsEmpty.hidden = signals.length > 0;
    const buys = list(lane.buys);
    buysBody.replaceChildren(...buys.map(buyRow));
    buysEmpty.hidden = buys.length > 0;
    drawHoldings(lane);
    const marketStatus = lane.marketRefresh;
    status.textContent = error ? `${error} 마지막 데이터를 표시합니다.` : `${signals.length}개 신호 · ${buys.length}건 기록 · 마지막 틱 ${date(lane.lastTickAt)}${marketStatus ? ` · CA 시장 조회 ${marketStatus.inFlight ?? 0}건 진행 / ${marketStatus.queued ?? 0}건 대기` : ''}${loading ? ' · 갱신 중' : ''}`;
  }
  async function refresh({ force = false } = {}) {
    if (loading && !force) return;
    loading = true; const mine = ++epoch; draw();
    try { const next = await api('/api/origin-buy'); if (mine !== epoch) return; snapshot = next; error = ''; }
    catch (failure) { if (mine !== epoch) return; error = failure?.message || '원본 매수 상태를 불러오지 못했습니다.'; }
    finally { if (mine === epoch) { loading = false; draw(); } }
  }
  async function control(action) {
    if (snapshot?.canPause !== true) return;
    pauseButton.disabled = resumeButton.disabled = true;
    try { await api(`/api/origin-buy/${action}`, { method: 'POST', body: action === 'pause' ? { minutes: 60 } : {} }); toast(action === 'pause' ? '원본 매수 레인을 60분 동안 일시 중지했습니다.' : '원본 매수 레인을 재개했습니다.'); }
    catch (failure) { toast(failure?.message || '요청에 실패했습니다.', true); }
    await refresh({ force: true });
  }
  async function buyNow(signal) {
    if (!buyAllowed(signal) || pendingKey) return;
    const label = `${text(signal.symbol) || short(signal.tokenAddress)} (${signal.score}점, @${text(signal.author) || '?'})`;
    const live = snapshot.mode === 'AUTO';
    if (!confirm(live ? `${label}을(를) ${formatEth(snapshot.settings?.buyWei)}로 지금 실매수합니다. 캡·쿨다운·FDV 상한은 그대로 적용됩니다. 계속할까요?` : `${label}의 경로·견적·비용을 PAPER로 기록합니다(전송 없음). 계속할까요?`)) return;
    pendingKey = signal.key; draw();
    try {
      const result = await api(`/api/origin-buy/signals/${signal.key}/buy`, { method: 'POST', body: {}, headers: { 'Idempotency-Key': `ui-${randomId()}` } });
      const buy = result?.buy ?? null;
      toast(buy ? `${BUY_STATES[buy.status] ?? buy.status}: ${ROUTES[buy.route] ?? buy.route} · ${formatEth(buy.quoteInWei)} → 예상 ${formatTokens(buy.expectedTokensOut, buy.data?.routed?.decimals ?? 18)}` : '요청을 접수했습니다.');
    } catch (failure) { toast(failure?.message || '매수 요청에 실패했습니다.', true); }
    finally { pendingKey = null; }
    await refresh({ force: true });
  }
  async function sellNow(position) {
    if (!sellAllowed(position) || pendingKey) return;
    const paper = position.execution === 'paper', label = text(position.symbol) || short(position.tokenAddress), qty = formatTokens(position.remainingTokens, position.decimals ?? 18);
    if (!confirm(paper ? `${label}의 남은 ${qty}개 전량을 PAPER 모의 청산합니다. 새 매도 견적의 바닥과 가스 상한을 적용하며 실제 자산은 전송하지 않습니다. 계속할까요?` : `${label}의 남은 ${qty}개 전량을 실매도합니다. 새 견적으로 승인·매도 거래를 전송하며 가스가 발생합니다. 계속할까요?`)) return;
    pendingKey = `sell:${position.id}`; draw();
    try {
      const result = await api(`/api/origin-buy/positions/${encodeURIComponent(position.id)}/sell`, { method: 'POST', body: {}, headers: { 'Idempotency-Key': `ui-exit-${randomId()}` } });
      toast(`${paper ? 'PAPER 모의 청산' : '실매도'}: ${BUY_STATES[result?.status] ?? (text(result?.status) || '접수')}${result?.status === 'confirmed' ? ` · 수령 ${result.quoteOutWei == null ? '확인 불가' : formatEth(result.quoteOutWei, 7)}` : ''}`, result?.status === 'failed');
    } catch (failure) { toast(failure?.message || '청산 요청에 실패했습니다.', true); }
    finally { pendingKey = null; }
    await refresh({ force: true });
  }
  function render() { draw(); return refresh(); }
  function reset() { snapshot = null; error = ''; loading = false; pendingKey = null; epoch++; signalsBody.replaceChildren(); buysBody.replaceChildren(); settings.replaceChildren(); positionsGrid.replaceChildren(); ordersBody.replaceChildren(); positionsEmpty.hidden = ordersEmpty.hidden = false; holdingsSummary.textContent = ''; rulesSummary.textContent = ''; review.textContent = ''; pill.textContent = '확인 중'; pill.className = 'pill'; summary.textContent = ''; pauseButton.disabled = resumeButton.disabled = true; draw(); }
  return { render, refresh, reset };
}
