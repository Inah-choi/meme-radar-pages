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
/** wei → ETH with up to `digits` decimals, never rounded up. */
export function formatEth(value, digits = 6) {
  const wei = amount(value); if (wei === null) return '조회 불가';
  const scale = 10n ** 18n, whole = wei / scale, fraction = (wei % scale).toString().padStart(18, '0').slice(0, digits).replace(/0+$/, '');
  return `${whole.toLocaleString('en-US')}${fraction ? `.${fraction}` : ''} ETH`;
}
/** Token base units → decimal string (18 decimals unless the server read another), 4 decimals shown. */
export function formatTokens(value, decimals = 18, digits = 4) {
  const raw = amount(value); if (raw === null || !Number.isInteger(decimals) || decimals < 0 || decimals > 77) return '—';
  const scale = 10n ** BigInt(decimals), whole = raw / scale;
  const fraction = decimals ? (raw % scale).toString().padStart(decimals, '0').slice(0, Math.min(digits, decimals)).replace(/0+$/, '') : '';
  return `${whole.toLocaleString('en-US')}${fraction ? `.${fraction}` : ''}`;
}
const usd = value => Number.isFinite(value) ? (value >= 1e6 ? `$${(value / 1e6).toFixed(2)}M` : value >= 1e3 ? `$${(value / 1e3).toFixed(1)}k` : `$${value.toFixed(0)}`) : 'FDV 미확인';
export const SIGNAL_STATES = Object.freeze({ detected: '감지됨', planned: '계획됨', held: '보류', buying: '매수 진행', bought: '매수 기록', failed: '실패', skipped: '건너뜀' });
export const BUY_STATES = Object.freeze({ paper: 'PAPER 기록', queued: '대기', prepared: '서명됨', submitted: '전송됨', uncertain: '확인 중', confirmed: '완료', failed: '실패' });
export const ROUTES = Object.freeze({ 'pons-curve': 'Pons 커브', 'uniswap-v4-single': 'Uniswap V4 · ETH 페어', 'uniswap-v4-multi': 'Uniswap V4 · 2홉' });
export const HOLD_LABELS = Object.freeze({
  ORIGIN_BUY_TOO_LATE: 'FDV 상한 초과(이미 늦음)', ORIGIN_BUY_SCORE_BELOW_MIN: '점수 미달', ORIGIN_BUY_DISABLED: '레인 비활성', ORIGIN_BUY_MODE_WATCH: 'WATCH 모드', ORIGIN_BUY_PAUSED: '일시 중지',
  ORIGIN_BUY_HOUR_CAP: '시간당 한도', ORIGIN_BUY_DAY_CAP: '일별 한도', ORIGIN_BUY_DAILY_WEI_CAP: '일일 금액 한도', ORIGIN_BUY_WALLET_UNSET: '매수 지갑 미설정', ORIGIN_BUY_NOT_FUNDED: '지갑 잔액 부족',
  ORIGIN_BUY_DUPLICATE: '이미 매수', ORIGIN_BUY_KEY_COOLDOWN: '쿨다운', ORIGIN_BUY_PAIR_ROUTE_UNKNOWN: '페어 경로 없음', ORIGIN_BUY_CURVE_PAIR_UNSUPPORTED: 'ERC-20 페어 커브(미지원)', ORIGIN_BUY_POOL_EMPTY: '풀 유동성 없음',
  ORIGIN_BUY_ROUTE_UNAVAILABLE: '매수 경로 없음', ORIGIN_BUY_SIMULATION_FAILED: '시뮬레이션 실패', ORIGIN_BUY_DAILY_BUDGET: '일일 예산 부족', ORIGIN_BUY_SOCIAL_MATCH_REQUIRED: '프로필 일치 필요', ORIGIN_BUY_REVERTED: '체인에서 실패',
});
const methodLabel = { contract_in_post: '본문 CA', profile_handle: '프로필 링크' };
const reasonLabel = reason => {
  const [kind, detail] = String(reason).split(':');
  const labels = { social_match: '프로필 일치', social_other_author: '프로필은 다른 계정', maker_traits: `원작자 특성 ${detail ?? ''}`.trim(), views: `조회 ${detail}`, velocity: `속도 ${detail}`, name_echo: `동명 토큰 ${detail}개`, names_token: '토큰 이름 언급', single_ca_author: 'CA 1개 계정', multi_ca_author: `CA ${detail}개 계정(광고 의심)`, posted_at_launch: '발행 직후 게시', shill: '광고성 문구' };
  return labels[kind] ?? String(reason);
};

export function createOriginBuy({ api, document = globalThis.document, toast = () => {}, confirm = message => typeof globalThis.confirm === 'function' ? globalThis.confirm(message) : false, randomId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}` }) {
  const root = document.querySelector('#origin-buy-root');
  const el = (tag, className = '', value = '') => { const node = document.createElement(tag); if (className) node.className = className; if (value !== '') node.textContent = value; return node; };
  const add = (parent, ...children) => { for (const child of children) if (child) parent.append(child); return parent; };
  const link = (label, url, allowedHost) => {
    try { const parsed = new URL(url); if (parsed.protocol !== 'https:' || parsed.hostname !== allowedHost || parsed.username || parsed.password) return null; } catch { return null; }
    const node = el('a', 'text-link', label); node.href = url; node.target = '_blank'; node.rel = 'noopener noreferrer'; return node;
  };
  const explorer = (label, kind, value) => link(label, `https://robinhoodchain.blockscout.com/${kind}/${value}`, 'robinhoodchain.blockscout.com');
  const xLink = (label, url) => link(label, url, 'x.com');
  let snapshot = null, error = '', loading = false, pendingKey = null, epoch = 0;

  const heading = el('div', 'page-heading');
  add(heading, add(el('div'), el('div', 'eyebrow', 'ORIGIN BUY · CANONICAL TOKEN'), el('h1', '', '원본 매수'), el('p', 'muted', '같은 이름 토큰이 난립할 때 원작자가 올린 토큰을 골라 소액으로 삽니다. 점수는 관측된 정황이며 수익 예측이 아닙니다.')));
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
  add(panel, panelHead, settings);
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
  const note = el('p', 'origin-buy-note muted', '매수는 네이티브 ETH로만 하며(Pons 커브 buy 또는 Uniswap V4 Universal Router), 매도는 이 화면이 하지 않습니다. 실매수는 AUTO 모드·레인 활성·매수 지갑 설정이 모두 있어야 합니다.');
  add(root, heading, status, panel, signalsBox, buysBox, note);

  function paused(lane) { const until = Date.parse(lane?.pausedUntil || ''); return Number.isFinite(until) && until > Date.now(); }
  function drawSettings(lane) {
    settings.replaceChildren();
    const s = lane.settings ?? {}, caps = lane.caps ?? {};
    const item = (label, value) => add(el('div', 'origin-buy-setting'), el('span', 'origin-buy-setting-label', label), el('strong', '', value));
    add(settings,
      item('모드 / 실행', `${text(lane.mode) || '—'} · ${lane.mode === 'AUTO' ? '실매수' : '기록만'}`),
      item('건당 매수', formatEth(s.buyWei)),
      item('시간당 / 일별', `${caps.hour?.used ?? '—'} / ${caps.hour?.max ?? '—'} · ${caps.day?.used ?? '—'} / ${caps.day?.max ?? '—'}`),
      item('일일 금액', `${formatEth(caps.dayWei?.used ?? '0')} / ${formatEth(caps.dayWei?.max)}`),
      item('점수 하한 / FDV 상한', `${s.minScore ?? '—'}점 · ${usd(s.maxFdvUsd)}`),
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
    add(marketCell, el('strong', '', `FDV ${usd(Number(market.fdvUsd))}`),
      el('span', 'origin-buy-line muted', `속도 ${data.velocity?.viewsPerMin != null ? `${integer(data.velocity.viewsPerMin)}/min` : '—'} · 조회 ${integer(data.velocity?.views)} · 동명 ${integer(data.nameEchoCount)}개`),
      el('span', 'origin-buy-reasons', list(data.reasons).map(reasonLabel).join(' · ')));
    const stateCell = el('td', 'origin-buy-state');
    add(stateCell, el('strong', '', SIGNAL_STATES[signal.state] ?? text(signal.state)), signal.heldCode ? el('span', 'origin-buy-line origin-buy-hold', HOLD_LABELS[signal.heldCode] ?? signal.heldCode) : null,
      signal.retryAt ? el('span', 'origin-buy-line muted', `재시도 ${date(signal.retryAt)}`) : null, el('span', 'origin-buy-line muted', `갱신 ${date(signal.updatedAt)}`));
    const buyCell = el('td', 'origin-buy-action-cell');
    const canBuy = snapshot?.canBuy === true && ['detected', 'planned', 'held'].includes(signal.state);
    const button = el('button', 'button small origin-buy-action', snapshot?.mode === 'AUTO' ? '지금 매수' : '지금 기록(PAPER)'); button.type = 'button';
    button.disabled = !canBuy || pendingKey === signal.key || !snapshot?.available;
    button.title = !snapshot?.canBuy ? '운영자 권한이 필요합니다.' : !canBuy ? '이미 매수했거나 진행 중입니다.' : snapshot?.mode === 'AUTO' ? '레인 조건(캡·쿨다운·FDV 상한)을 그대로 적용해 실매수합니다.' : 'PAPER 모드: 경로·견적만 기록합니다.';
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
  function draw() {
    const lane = snapshot;
    if (!lane) { status.textContent = error || (loading ? '원본 매수 상태를 불러오는 중입니다.' : '아직 불러오지 않았습니다.'); return; }
    const isPaused = paused(lane);
    pill.textContent = !lane.available ? '연결 안 됨' : !lane.enabled ? '비활성' : isPaused ? '일시 중지' : lane.emergencyStop ? '긴급 정지' : lane.paused ? '전역 정지' : lane.mode === 'AUTO' ? '실매수 가능' : `${lane.mode} · 기록만`;
    pill.className = `pill ${!lane.available || lane.emergencyStop ? 'error' : !lane.enabled || isPaused || lane.paused ? 'warning' : lane.mode === 'AUTO' ? 'success' : 'demo'}`;
    summary.textContent = !lane.available ? '이 서버에는 원본 매수 공급자가 연결되지 않았습니다(메인넷·Pons V2·지갑 니모닉 필요).'
      : !lane.enabled ? '레인이 꺼져 있습니다. 신호는 계속 감지·점수화되지만 매수·기록은 하지 않습니다. 자동화 정책에서 originBuy.enabled를 켜세요.'
      : isPaused ? `${date(lane.pausedUntil)}까지 일시 중지 상태입니다.` : lane.mode === 'AUTO' ? '조건을 만족하는 신호를 자동으로 실매수합니다.' : '조건을 만족하는 신호의 경로·견적·비용만 기록합니다(전송 없음).';
    pauseButton.disabled = lane.canPause !== true || !lane.available || isPaused || loading;
    resumeButton.disabled = lane.canPause !== true || !lane.available || !isPaused || loading;
    drawSettings(lane);
    const signals = list(lane.signals);
    signalsBody.replaceChildren(...signals.map(signalRow));
    signalsEmpty.hidden = signals.length > 0;
    const buys = list(lane.buys);
    buysBody.replaceChildren(...buys.map(buyRow));
    buysEmpty.hidden = buys.length > 0;
    status.textContent = error ? `${error} 마지막 데이터를 표시합니다.` : `${signals.length}개 신호 · ${buys.length}건 기록 · 마지막 틱 ${date(lane.lastTickAt)}${loading ? ' · 갱신 중' : ''}`;
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
    if (snapshot?.canBuy !== true || pendingKey) return;
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
  function render() { draw(); return refresh(); }
  function reset() { snapshot = null; error = ''; loading = false; pendingKey = null; epoch++; signalsBody.replaceChildren(); buysBody.replaceChildren(); settings.replaceChildren(); draw(); }
  return { render, refresh, reset };
}
