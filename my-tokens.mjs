const ZERO = '0x0000000000000000000000000000000000000000';
const amount = value => typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value) : null;
const validDecimals = value => Number.isInteger(value) && value >= 0 && value <= 77;
/** Raw base units -> decimal string in the asset's own decimals (18 for ETH, 6 for USDG, 8 for cbBTC). */
export function formatTokenEth(value, precision = 8, decimals = 18) {
  const wei = amount(value);
  if (wei === null || !validDecimals(decimals)) return '조회 불가';
  const scale = 10n ** BigInt(decimals), digits = Math.min(Math.max(1, precision), decimals), whole = wei / scale;
  const fraction = decimals ? (wei % scale).toString().padStart(decimals, '0').slice(0, digits).replace(/0+$/, '') : '';
  if (wei > 0n && whole === 0n && !fraction) return `<0.${'0'.repeat(digits - 1)}1`;
  return `${whole.toLocaleString('en-US')}${fraction ? `.${fraction}` : ''}`;
}
const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('ko-KR', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '시각 미확인';
const list = value => Array.isArray(value) ? value : [];
const address = value => /^0x[a-fA-F0-9]{40}$/.test(value || '') ? value : null;
const short = value => address(value) ? `${value.slice(0, 8)}…${value.slice(-6)}` : '주소 미확인';
const text = value => typeof value === 'string' ? value : '';
const sameAddress = (a, b) => Boolean(address(a)) && text(a).toLowerCase() === text(b).toLowerCase();
const txHash = value => /^0x[a-fA-F0-9]{64}$/.test(value || '') ? value : null;
const pendingClaim = job => ['queued', 'prepared', 'submitted', 'uncertain'].includes(job?.status);
const activeSell = job => ['queued', 'prepared', 'submitted', 'uncertain', 'approved'].includes(job?.status);
const pairOf = part => (address(part?.pairToken) ? part.pairToken : ZERO).toLowerCase();
const ETH_UNIT = Object.freeze({pairToken: ZERO, native: true, currency: 'ETH', decimals: 18});
/** Display unit of a metric, quote or job. Absent fields mean the legacy ETH-only shape; an ERC-20 pair without server-read metadata stays unknown. */
const unitOf = part => {
  const pairToken = pairOf(part), native = pairToken === ZERO;
  const currency = text(part?.currency) || (native ? 'ETH' : '');
  const decimals = validDecimals(part?.decimals) ? part.decimals : native && part?.decimals == null ? 18 : null;
  return {pairToken, native, currency, decimals};
};
const money = (value, unit) => unit.currency && unit.decimals !== null ? `${formatTokenEth(value, 8, unit.decimals)}${amount(value) !== null ? ` ${unit.currency}` : ''}` : '조회 불가';
const exact = (value, unit) => `${formatTokenEth(value, unit.decimals, unit.decimals)} ${unit.currency}`;
/** At-a-glance amount: the exact value trimmed to at most `sig` significant digits (never rounded up, so it never overstates). */
const approx = (value, unit, sig = 5) => {
  if (amount(value) === null || !unit.currency || unit.decimals === null) return '조회 불가';
  const [whole, fraction = ''] = formatTokenEth(value, unit.decimals, unit.decimals).split('.');
  const used = whole === '0' ? 0 : whole.replace(/,/g, '').length;
  const keep = used >= sig ? 0 : Math.min(fraction.length, fraction.match(/^0*/)[0].length + sig - used);
  const cut = fraction.slice(0, keep).replace(/0+$/, '');
  return `${whole}${cut ? `.${cut}` : ''} ${unit.currency}`;
};
/** Launched tokens are 18-decimal ERC-20s; the server may send the read value explicitly. */
const tokenDecimalsOf = part => validDecimals(part?.tokenDecimals) ? part.tokenDecimals : 18;
const tokens = (value, decimals, precision = 4) => formatTokenEth(value, precision, decimals);
const bps = value => Number.isInteger(value) && value >= 0 ? `${(value / 100).toString()}%` : '비율 미확인';
const percentOfSupply = value => /^\d+(\.\d+)?$/.test(text(value)) ? value : null;
const latestJob = (jobs, active) => {
  const byId = new Map();
  for (const job of jobs) {
    if (!job || !text(job.id)) continue;
    const old = byId.get(job.id);
    if (!old || (Date.parse(job.updatedAt) || 0) >= (Date.parse(old.updatedAt) || 0)) byId.set(job.id, job);
  }
  return [...byId.values()].sort((a, b) => Number(active(b)) - Number(active(a)) || (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
};
const claimStatus = {queued:'클레임 접수됨', prepared:'서명 완료 · 전송 대기', submitted:'클레임 전송됨 · 확인 중', uncertain:'전송 결과 확인 중', confirmed:'클레임 완료', failed:'클레임 실패'};
const sellStatus = {queued:'대기 중', prepared:'서명됨', submitted:'전송됨', uncertain:'확인 중', approved:'승인 완료 → 매도 진행', confirmed:'완료', failed:'실패'};
const sellLabel = job => {
  if (job.status === 'submitted') return job.stage === 'approve' ? '승인 전송됨' : '매도 전송됨';
  if (job.status === 'prepared') return job.stage === 'approve' ? '서명됨 · 승인 전송 대기' : '서명됨 · 매도 전송 대기';
  if (job.status === 'confirmed') { const unit = unitOf(job); return `완료: 수령 ${unit.currency && unit.decimals !== null && amount(job.quoteOut) !== null ? exact(job.quoteOut, unit) : '조회 불가'}`; }
  if (job.status === 'failed') return `실패: ${text(job.error) || '사유 미확인'}`;
  return sellStatus[job.status] || '상태 확인 필요';
};
const ponsSellUrl = tokenAddress => `https://www.ponsfamily.com/launchpad/${tokenAddress}`;
const SELL_PERCENTS = [['2500', '25 %'], ['5000', '50 %'], ['7500', '75 %'], ['10000', '100 %']];

export function createMyTokens({api, document = globalThis.document, now = Date.now, assetUrl = value => value,
  confirm = message => typeof globalThis.confirm === 'function' ? globalThis.confirm(message) : false,
  timers = {set: (fn, ms) => globalThis.setTimeout(fn, ms), clear: id => globalThis.clearTimeout(id)}}) {
  const root = document.querySelector('#my-tokens-root');
  const el = (tag, className = '', value = '') => { const node = document.createElement(tag); node.className = className; node.textContent = value; return node; };
  const add = (parent, ...children) => { for (const child of children) if (child) parent.append(child); return parent; };
  const link = (label, url, allowedHost) => {
    try { const parsed = new URL(url); if (parsed.protocol !== 'https:' || parsed.hostname !== allowedHost || parsed.username || parsed.password) return null; }
    catch { return null; }
    const node = el('a', 'text-link', label); node.href = url; node.target = '_blank'; node.rel = 'noopener noreferrer'; return node;
  };
  const explorer = (label, kind, value) => link(label, `https://robinhoodchain.blockscout.com/${kind}/${value}`, 'robinhoodchain.blockscout.com');
  let snapshot = null, error = '', loading = false, lastFetched = null, pending = null, epoch = 0;
  const claimViews = new Map(), sellViews = new Map();
  const heading = el('div', 'page-heading');
  const headingText = add(el('div'), el('div', 'eyebrow', 'MY TOKENS · PONS'), el('h1', '', '내 토큰'), el('p', 'muted', '발행한 토큰의 거래량, 쌓인 크리에이터 수수료, 발행 지갑의 보유 수량을 확인하세요.'));
  const refreshButton = el('button', 'button secondary', '지금 새로고침'); refreshButton.type = 'button'; refreshButton.id = 'my-tokens-refresh';
  refreshButton.addEventListener('click', () => refresh({force:true}));
  add(heading, headingText, refreshButton);
  const status = el('p', 'my-tokens-status muted'); status.id = 'my-tokens-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const stats = el('div', 'my-tokens-stats'); stats.id = 'my-tokens-stats';
  const search = el('input', 'my-tokens-search'); search.type = 'search'; search.id = 'my-tokens-search'; search.placeholder = '티커, 이름 또는 토큰 주소 검색'; search.setAttribute('aria-label', '내 토큰 검색'); search.addEventListener('input', drawRows);
  const caption = el('caption', 'sr-only', '직접 발행한 토큰의 거래량, 청구 가능한 크리에이터 수수료, 발행 지갑의 보유 수량과 매도');
  const table = el('table', 'data-table my-tokens-table'); table.id = 'my-tokens-table';
  const headRow = el('tr');
  for (const name of ['토큰', '누적 거래량', '24h 거래량', '청구 가능 수수료', '수수료 내역 · 조회 상태', '보유 · 매도']) { const th = el('th', '', name); th.scope = 'col'; headRow.append(th); }
  const body = el('tbody'); add(table, caption, add(el('thead'), headRow), body);
  const empty = el('p', 'my-tokens-empty muted'); empty.id = 'my-tokens-empty';
  // Recent sell jobs (all tokens) in the same table style as the token list.
  const sellsBox = el('section', 'panel my-tokens-sells'); sellsBox.id = 'my-tokens-sells'; sellsBox.hidden = true; sellsBox.setAttribute('aria-label', '최근 매도');
  const sellsTable = el('table', 'data-table my-tokens-table my-tokens-sells-table'); sellsTable.id = 'my-tokens-sells-table';
  const sellsHead = el('tr');
  for (const name of ['접수 시각', '토큰', '매도 수량', '수령', '상태', '트랜잭션']) { const th = el('th', '', name); th.scope = 'col'; sellsHead.append(th); }
  const sellsBody = el('tbody'); add(sellsTable, el('caption', 'sr-only', '이 서버에서 접수한 최근 토큰 매도 작업'), add(el('thead'), sellsHead), sellsBody);
  const sellsEmpty = el('p', 'my-tokens-empty muted', '아직 매도 기록이 없습니다.'); sellsEmpty.id = 'my-tokens-sells-empty';
  add(sellsBox, el('h2', 'my-tokens-sells-title', '최근 매도'), add(el('div', 'my-tokens-table-wrap'), sellsTable), sellsEmpty);
  const note = el('div', 'my-tokens-note muted'); note.id = 'my-tokens-note';
  add(root, heading, status, stats, search, add(el('div', 'panel my-tokens-table-wrap'), table), empty, sellsBox, note);

  function metric(value, unit = ETH_UNIT) {
    const usable = amount(value) !== null && unit.currency && unit.decimals !== null;
    const node = el('strong', usable ? '' : 'my-tokens-missing', usable ? formatTokenEth(value, 8, unit.decimals) : '조회 불가');
    if (usable) { node.append(el('small', '', ` ${unit.currency}`)); node.title = exact(value, unit); }
    return node;
  }
  function stat(label, value, description, unit = ETH_UNIT) {
    return add(el('div', 'stat-card'), el('div', 'stat-label', label), unit ? add(el('div', 'stat-value'), metric(value, unit)) : el('div', 'stat-value', value), el('div', 'stat-description', description));
  }
  // Escrow balances are per recipient, escrow and pair asset; the same combination shares one claim.
  function sameRecipient(a, b) {
    return address(a?.recipientAddress) && address(a?.escrowAddress)
      && a.recipientAddress.toLowerCase() === text(b?.recipientAddress).toLowerCase()
      && a.escrowAddress.toLowerCase() === text(b?.escrowAddress).toLowerCase()
      && pairOf(a) === pairOf(b);
  }
  function jobFor(token) {
    const jobs = [...list(snapshot?.claims?.items), ...[...claimViews.values()].map(view => view.job)].filter(job => job && (job.launchId === token.launchId || sameRecipient(job, token.fees)));
    return latestJob(jobs, pendingClaim)[0];
  }
  // Sells are signed by the launch wallet (token.creatorAddress); claims share that wallet's nonce sequence, so each blocks the other.
  const sameWallet = (job, token) => job?.launchId === token.launchId || sameAddress(job?.walletAddress, token.creatorAddress);
  function sellJobFor(token) {
    const jobs = [...list(snapshot?.sells?.items), ...[...sellViews.values()].map(view => view.job)].filter(job => job && sameWallet(job, token));
    return latestJob(jobs, activeSell)[0];
  }
  function claimBlocked(token) {
    if (!snapshot?.claims?.canClaim) return text(snapshot?.claims?.reason) || '클레임은 운영자 권한이 필요합니다.';
    if (error || snapshot.stale || snapshot.status === 'stale' || token.fees?.stale) return '새로고침 후 수수료를 확인하세요.';
    if (amount(token.fees?.claimableWei) === null) return '수수료 조회 후 청구할 수 있습니다.';
    if (amount(token.fees?.claimableWei) === 0n) return '청구 가능한 수수료가 없습니다.';
    if (pendingClaim(jobFor(token))) return '이 수령 지갑의 클레임을 처리 중입니다.';
    if (activeSell(sellJobFor(token))) return '이 지갑의 토큰 매도를 처리 중입니다. 완료 후 클레임할 수 있습니다.';
    for (const [launchId, view] of claimViews) {
      if (['submitting', 'uncertain'].includes(view.phase) && (launchId === token.launchId || sameRecipient(view.quote, token.fees))) return '이 수령 지갑의 실행 결과를 확인 중입니다.';
    }
    for (const [launchId, view] of sellViews) {
      if (['submitting', 'uncertain'].includes(view.phase) && (launchId === token.launchId || sameWallet(view.quote, token))) return '이 지갑의 매도 실행 결과를 확인 중입니다.';
    }
    return '';
  }
  function quoteBlocked(quote, token) {
    if (!text(quote?.quoteId) || quote.launchId !== token.launchId || quote.chainId !== 4663 || quote.scope !== 'recipient'
      || !address(quote.recipientAddress) || !address(quote.escrowAddress) || amount(quote.claimableWei) === null) return '클레임 견적을 확인할 수 없습니다.';
    if (quote.pairToken != null && !address(quote.pairToken)) return '클레임 견적을 확인할 수 없습니다.';
    if (pairOf(quote) !== pairOf(token.fees)) return '클레임 견적의 페어 자산이 이 토큰과 다릅니다. 금액과 가스비를 다시 확인하세요.';
    const unit = unitOf(quote);
    if (!unit.currency || unit.decimals === null) return '클레임 견적의 자산 단위를 확인할 수 없습니다.';
    if (!quote.canClaim || amount(quote.claimableWei) === 0n) return text(quote.reason) || '청구 가능한 수수료가 없습니다.';
    if (amount(quote.maxGasCostWei) === null) return '클레임 견적을 확인할 수 없습니다.';
    if (!(Date.parse(quote.expiresAt) > now())) return '견적이 만료되었습니다. 금액과 가스비를 다시 확인하세요.';
    return '';
  }
  function action(label, kind, token, handler, disabled = false) {
    const node = el('button', `button secondary my-token-claim-action ${kind === 'execute' ? 'my-token-claim-execute' : ''}`, label);
    node.type = 'button'; node.disabled = disabled; node.setAttribute('data-claim-action', kind); node.setAttribute('data-launch-id', token.launchId);
    node.addEventListener('click', () => node.disabled ? undefined : handler());
    return node;
  }
  function drawClaim(token, cell) {
    if (!snapshot?.claims) return;
    const view = claimViews.get(token.launchId), job = jobFor(token);
    const section = el('div', 'my-token-claim');
    const blocked = claimBlocked(token), busy = ['previewing', 'submitting', 'checking'].includes(view?.phase);
    const uncertain = view?.phase === 'uncertain';
    const reviewing = view?.phase === 'review' || view?.phase === 'submitting' || uncertain;
    if (!reviewing) {
      add(section, action(view?.phase === 'previewing' ? '금액·가스 조회 중…' : '수수료 클레임', 'preview', token, () => previewClaim(token), busy || Boolean(blocked)));
      if (blocked) section.append(el('small', 'muted', blocked));
    }
    if (reviewing && view.quote) {
      const quote = view.quote, invalid = quoteBlocked(quote, token), unit = unitOf(quote);
      const label = unit.currency || '단위 미확인';
      const review = el('div', 'my-token-claim-review'); review.setAttribute('aria-label', `${text(token.symbol)} 수수료 클레임 확인`);
      add(review, el('strong', '', '클레임 확인'), el('p', '', `이 지갑에 쌓인 전체 수수료(${label})를 수령합니다. 같은 지갑의 다른 토큰 수수료도 포함되며${unit.native ? '' : ` (${label} 페어 토큰만 해당)`}, 커브에 남은 수수료는 제외됩니다.`),
        el('p', '', `예상 수령액 ${unit.currency && unit.decimals !== null ? exact(quote.claimableWei, unit) : '조회 불가'}`), el('p', '', `최대 가스비 ${formatTokenEth(quote.maxGasCostWei, 18)} ETH`),
        el('small', 'muted', `실행 전 추가로 쌓인 수수료도 함께 수령하며, 실제 수령액은 완료 후 표시됩니다.${unit.native ? '' : ` 수령 자산은 ${label}이며 가스비는 ETH로 지불합니다.`}`));
      const recipient = address(quote.recipientAddress);
      if (recipient) review.append(explorer(`수령 지갑 ${recipient} ↗`, 'address', recipient));
      add(review, el('small', 'muted', `견적 유효 시각 ${date(quote.expiresAt)} · Robinhood Chain`));
      if (invalid && !uncertain) review.append(el('p', 'error-text', invalid));
      if (uncertain) add(review, el('p', 'error-text', '실행 응답을 받지 못했습니다. 같은 요청으로 접수 여부를 다시 확인하세요. 중복 클레임을 생성하지 않습니다.'),
        action('같은 요청으로 다시 확인', 'retry', token, () => submitClaim(token, true), busy || !snapshot?.claims?.canClaim));
      else {
        add(review, action(view.phase === 'submitting' ? '클레임 접수 중…' : '클레임 실행', 'execute', token, () => submitClaim(token), busy || Boolean(invalid) || Boolean(blocked) || Boolean(view.rejection)),
          action('금액·가스 다시 확인', 'requote', token, () => previewClaim(token), busy || Boolean(blocked)),
          action('취소', 'cancel', token, () => { claimViews.delete(token.launchId); drawRows(); }, busy));
      }
      section.append(review);
    }
    if (view?.error) section.append(el('p', 'error-text', view.error));
    if (job) {
      const detail = el('div', `my-token-claim-job ${job.status === 'confirmed' ? 'my-token-claim-success' : ''}`);
      detail.setAttribute('role', 'status'); detail.setAttribute('aria-live', 'polite');
      detail.append(el('strong', '', claimStatus[job.status] || '클레임 상태 확인 필요'));
      if (job.status === 'confirmed') {
        const unit = unitOf(job);
        detail.append(el('span', '', `수령 완료 ${unit.currency && unit.decimals !== null ? exact(job.claimedWei, unit) : '조회 불가'}`));
        if (amount(job.actualCostWei) !== null) detail.append(el('span', '', `실제 가스비 ${formatTokenEth(job.actualCostWei, 18)} ETH`));
      }
      if (txHash(job.txHash)) detail.append(explorer('클레임 트랜잭션 ↗', 'tx', job.txHash));
      if (text(job.error)) detail.append(el('p', 'error-text', job.error));
      if (pendingClaim(job)) detail.append(action(view?.phase === 'checking' ? '상태 조회 중…' : '진행 상태 확인', 'status', token, () => checkClaim(token, job), busy));
      section.append(detail);
    }
    cell.append(section);
  }
  async function previewClaim(token) {
    if (claimBlocked(token) || ['previewing', 'submitting', 'checking', 'uncertain'].includes(claimViews.get(token.launchId)?.phase)) return;
    const generation = epoch, view = {phase:'previewing', error:''}; claimViews.set(token.launchId, view); drawRows();
    try {
      const quote = await api(`/api/owned-tokens/${encodeURIComponent(token.launchId)}/claims/preview`, {method:'POST', body:{}});
      if (generation !== epoch || claimViews.get(token.launchId) !== view) return;
      Object.assign(view, {phase:'review', quote, idempotencyKey:`creator-fee-claim:${quote.quoteId}`});
    } catch (reason) { if (generation === epoch) Object.assign(view, {phase:'idle', error:reason?.message || '클레임 견적 조회에 실패했습니다.'}); }
    finally { if (generation === epoch) drawRows(); }
  }
  async function submitClaim(token, retry = false) {
    const view = claimViews.get(token.launchId);
    if (!view || (retry ? view.phase !== 'uncertain' : view.phase !== 'review') || !snapshot?.claims?.canClaim) return;
    const invalid = retry ? '' : view.rejection || quoteBlocked(view.quote, token) || claimBlocked(token);
    if (invalid) { view.error = invalid; drawRows(); return; }
    const generation = epoch; view.phase = 'submitting'; view.error = ''; drawRows();
    try {
      const job = await api(`/api/owned-tokens/${encodeURIComponent(token.launchId)}/claims`, {method:'POST', body:{quoteId:view.quote.quoteId}, headers:{'Idempotency-Key':view.idempotencyKey}});
      if (generation !== epoch || claimViews.get(token.launchId) !== view) return;
      if (!text(job?.id) || !Object.hasOwn(claimStatus, job.status) || job.quoteId !== view.quote.quoteId) throw new Error('접수 결과를 확인할 수 없습니다. 같은 요청으로 다시 확인하세요.');
      Object.assign(view, {phase:'status', job}); drawRows();
      await refresh({force:true});
    } catch (reason) {
      if (generation === epoch) {
        const conflict = ['CLAIM_QUOTE_USED', 'CLAIM_IDEMPOTENCY_CONFLICT', 'CLAIM_ALREADY_PENDING'].includes(reason?.code);
        const rejected = reason?.status >= 400 && reason.status < 500 && reason.status !== 408 && !conflict;
        const message = reason?.message || '클레임 접수 여부를 확인할 수 없습니다.';
        Object.assign(view, {phase:rejected ? 'review' : 'uncertain', error:message, rejection:rejected ? message : ''});
        if (conflict) await refresh({force:true});
      }
    }
    finally { if (generation === epoch) drawRows(); }
  }
  async function checkClaim(token, job) {
    const previous = claimViews.get(token.launchId);
    if (['previewing', 'submitting', 'checking'].includes(previous?.phase)) return;
    const generation = epoch, view = {...previous, phase:'checking', job, error:''}; claimViews.set(token.launchId, view); drawRows();
    try {
      const result = await api(`/api/creator-fee-claims/${encodeURIComponent(job.id)}`);
      if (generation !== epoch || claimViews.get(token.launchId) !== view) return;
      if (result?.id !== job.id || !Object.hasOwn(claimStatus, result.status)) throw new Error('클레임 상태 응답을 확인할 수 없습니다.');
      Object.assign(view, {phase:'status', job:result}); drawRows();
      if (result.status === 'confirmed') await refresh({force:true});
    } catch (reason) { if (generation === epoch) Object.assign(view, {phase:previous?.phase === 'uncertain' ? 'uncertain' : 'status', error:reason?.message || '클레임 상태 조회에 실패했습니다.'}); }
    finally { if (generation === epoch) drawRows(); }
  }

  // ---- Token sell (launch-wallet holding → Pons V2 bonding curve) ----
  function sellBlocked(token) {
    if (!snapshot?.sells?.canSell) return text(snapshot?.sells?.reason) || '매도는 운영자 권한이 필요합니다.';
    const holding = token.holding, balance = amount(holding?.balanceWei);
    if (balance === null) return '보유 수량 조회 후 매도할 수 있습니다.';
    if (holding.graduated) return '졸업한 토큰은 커브에서 매도할 수 없습니다. Pons에서 매도하세요.';
    if (balance === 0n) return '보유한 토큰이 없습니다.';
    if (error || snapshot.stale || snapshot.status === 'stale' || holding.stale) return '새로고침 후 보유 수량을 확인하세요.';
    if (activeSell(sellJobFor(token))) return '이 지갑의 매도를 처리 중입니다.';
    if (pendingClaim(jobFor(token))) return '이 지갑의 수수료 클레임을 처리 중입니다. 완료 후 매도할 수 있습니다.';
    for (const [launchId, view] of sellViews) {
      if (['submitting', 'uncertain'].includes(view.phase) && (launchId === token.launchId || sameWallet(view.quote, token))) return '이 지갑의 매도 실행 결과를 확인 중입니다.';
    }
    for (const [launchId, view] of claimViews) {
      if (['submitting', 'uncertain'].includes(view.phase) && (launchId === token.launchId || sameRecipient(view.quote, token.fees))) return '이 지갑의 클레임 실행 결과를 확인 중입니다.';
    }
    return '';
  }
  function sellQuoteBlocked(quote, token) {
    if (!text(quote?.quoteId) || (quote.launchId != null && quote.launchId !== token.launchId) || (quote.chainId != null && quote.chainId !== 4663)
      || (quote.walletAddress != null && !address(quote.walletAddress)) || (quote.pairToken != null && quote.pairToken !== '' && !address(quote.pairToken))
      || [quote.tokensIn, quote.quoteOut, quote.minQuoteOut].some(value => amount(value) === null)) return '매도 견적을 확인할 수 없습니다.';
    const unit = unitOf(quote);
    if (!unit.currency || unit.decimals === null) return '매도 견적의 자산 단위를 확인할 수 없습니다.';
    if (!quote.canSell || amount(quote.tokensIn) === 0n) return text(quote.reason) || '매도할 수량이 없습니다.';
    if (amount(quote.maxGasCostWei) === null) return '매도 견적을 확인할 수 없습니다.';
    if (!(Date.parse(quote.expiresAt) > now())) return '견적이 만료되었습니다. 미리보기를 다시 실행하세요.';
    return '';
  }
  function sellAction(label, kind, token, handler, disabled = false) {
    const node = el('button', `button secondary my-token-sell-action ${kind === 'execute' ? 'my-token-claim-execute my-token-sell-execute' : ''}`, label);
    node.type = 'button'; node.disabled = disabled; node.setAttribute('data-sell-action', kind); node.setAttribute('data-launch-id', token.launchId);
    node.addEventListener('click', () => node.disabled ? undefined : handler());
    return node;
  }
  const remaining = expiresAt => {
    const ms = Date.parse(expiresAt) - now();
    if (!(ms > 0)) return '만료됨 · 미리보기를 다시 실행하세요';
    const seconds = Math.ceil(ms / 1000);
    return `남은 시간 ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  };
  function stopClock(view) { if (view?.clockTimer) { timers.clear(view.clockTimer); view.clockTimer = null; } }
  function stopPoll(view) { if (view?.timer) { timers.clear(view.timer); view.timer = null; } }
  // One-second countdown on the quote expiry; only the countdown text changes until expiry, which redraws to disable execution.
  function startClock(token, view) {
    if (view.clockTimer) return;
    const generation = epoch;
    view.clockTimer = timers.set(() => {
      view.clockTimer = null;
      if (generation !== epoch || sellViews.get(token.launchId) !== view || view.phase !== 'review' || !view.quote) return;
      if (Date.parse(view.quote.expiresAt) > now()) { if (view.clock) view.clock.textContent = remaining(view.quote.expiresAt); startClock(token, view); }
      else drawRows();
    }, 1000);
  }
  function confirmText(token, quote) {
    const unit = unitOf(quote), symbol = text(token.symbol) || '이 토큰';
    return [`${symbol} ${tokens(quote.tokensIn, tokenDecimalsOf(quote))}개를 Pons 본딩 커브에 매도합니다.`,
      `예상 수령 ${exact(quote.quoteOut, unit)} · 최소 수령 ${exact(quote.minQuoteOut, unit)} (이보다 적으면 거래가 되돌려집니다)`,
      `발행 지갑 ${text(quote.walletAddress) || text(token.creatorAddress) || '주소 미확인'}에서 실제 Robinhood 메인넷 트랜잭션 ${quote.approveNeeded ? '2건(승인 1회 + 매도 1회)' : '1건(매도 1회)'}을 전송합니다. 가스비 상한 ${formatTokenEth(quote.maxGasCostWei, 18)} ETH.`,
      '전송 후에는 취소할 수 없습니다. 계속할까요?'].join('\n');
  }
  function drawHolding(token, section) {
    const holding = token.holding, balance = amount(holding?.balanceWei), tokenAddress = address(token.tokenAddress);
    // A fresh read failure arrives as holding:null + holdingError; a stale restore keeps the last holding with holding.error.
    const holdingError = text(holding ? holding.error : token.holdingError);
    if (!holding && !holdingError) return;
    const line = el('div', 'my-token-holding'); line.setAttribute('data-holding', token.launchId);
    if (balance === null) line.append(el('span', 'my-tokens-missing', '보유 수량 조회 불가'));
    else if (balance === 0n) line.append(el('span', 'muted', '보유 없음'));
    else {
      const share = percentOfSupply(holding.percentOfSupply);
      add(line, el('strong', '', `보유 ${tokens(holding.balanceWei, tokenDecimalsOf(holding), 2)} ${text(token.symbol)}`.trim()), el('span', '', ` (${share === null ? '비율 미확인' : `${share}% of supply`})`));
      if (holding.graduated) {
        line.append(el('span', 'my-token-holding-graduated', ' · 졸업됨 · 커브 매도 불가'));
        if (tokenAddress) line.append(link('Pons에서 매도 ↗', ponsSellUrl(tokenAddress), 'www.ponsfamily.com'));
      } else {
        const unit = unitOf(holding), value = approx(holding.valueWei, unit), node = el('span', '', ` · 지금 전량 매도 시 약 ${value}`);
        if (value !== '조회 불가') node.title = exact(holding.valueWei, unit);
        line.append(node);
      }
    }
    if (holdingError) line.append(el('span', 'error-text', holdingError));
    section.append(line);
  }
  function drawSellError(view, token, target) {
    if (!view?.error) return;
    target.append(el('p', 'error-text', view.error));
    if (view.errorCode === 'TOKEN_SELL_GRADUATED') {
      const tokenAddress = address(token.tokenAddress);
      target.append(el('small', 'muted', '이 토큰은 졸업해 본딩 커브에서 매도할 수 없습니다.'));
      if (tokenAddress) target.append(link('Pons에서 매도 ↗', ponsSellUrl(tokenAddress), 'www.ponsfamily.com'));
    }
    if (view.errorCode === 'TOKEN_SELL_WALLET_BUSY') target.append(el('small', 'muted', '이 발행 지갑에서 수수료 클레임 또는 매도가 이미 진행 중입니다. 같은 지갑의 nonce를 공유하므로 완료 후 다시 시도하세요.'));
  }
  function drawSellReview(token, view, panel) {
    const quote = view.quote, invalid = sellQuoteBlocked(quote, token), unit = unitOf(quote), blocked = sellBlocked(token);
    const busy = view.phase === 'submitting', uncertain = view.phase === 'uncertain', expired = !(Date.parse(quote.expiresAt) > now());
    const review = el('div', 'my-token-claim-review my-token-sell-review'); review.setAttribute('aria-label', `${text(token.symbol)} 매도 확인`);
    const decimals = tokenDecimalsOf(quote), symbol = text(token.symbol);
    const line = (label, value) => add(el('p', ''), el('span', 'my-token-sell-label', `${label} `), el('strong', '', value));
    add(review, el('strong', '', '매도 확인'),
      line('매도 수량', `${tokens(quote.tokensIn, decimals)} ${symbol}`.trim()),
      line('예상 수령', unit.currency && unit.decimals !== null ? exact(quote.quoteOut, unit) : '조회 불가'),
      el('p', '', `총액 ${money(quote.grossQuoteOut, unit)} · 수수료 ${money(quote.feeWei, unit)} (${bps(quote.feeBps)}) · 크리에이터 세금 ${money(quote.taxWei, unit)} (${bps(quote.creatorTaxBps)})`),
      line('최소 수령', `${unit.currency && unit.decimals !== null ? exact(quote.minQuoteOut, unit) : '조회 불가'} (슬리피지 ${bps(quote.slippageBps)})`),
      line('트랜잭션', quote.approveNeeded ? '승인 1회 + 매도 1회, 총 2건' : '매도 1건'),
      line('가스 상한', `${formatTokenEth(quote.maxGasCostWei, 18)} ETH${quote.approve && amount(quote.approve.maxGasCostWei) !== null ? ` (승인 ${formatTokenEth(quote.approve.maxGasCostWei, 18)} + 매도 ${formatTokenEth(quote.sell?.maxGasCostWei, 18)})` : ''}${quote.sell?.estimated === false ? ' · 매도 가스는 승인 확정 후 실측' : ''}`));
    const clock = el('span', `my-token-sell-clock ${expired ? 'error-text' : 'muted'}`, remaining(quote.expiresAt)); view.clock = clock;
    add(review, add(el('p', ''), el('span', 'my-token-sell-label', '견적 만료 '), el('strong', '', date(quote.expiresAt)), el('span', '', ' · '), clock));
    const wallet = address(quote.walletAddress) || address(token.creatorAddress);
    if (wallet) review.append(explorer(`발행 지갑 ${short(wallet)} ↗`, 'address', wallet));
    review.append(el('small', 'muted', `수령 자산은 ${unit.currency || '단위 미확인'}이며 가스비는 ETH로 지불합니다. 실제 수령액은 완료 후 표시됩니다. · Robinhood Chain`));
    if (invalid && !uncertain) review.append(el('p', 'error-text', invalid));
    if (uncertain) add(review, el('p', 'error-text', '실행 응답을 받지 못했습니다. 같은 요청으로 접수 여부를 다시 확인하세요. 중복 매도를 생성하지 않습니다.'),
      sellAction('같은 요청으로 다시 확인', 'retry', token, () => submitSell(token, true), busy || !snapshot?.sells?.canSell));
    else add(review, sellAction(busy ? '매도 접수 중…' : '매도 실행', 'execute', token, () => submitSell(token), busy || Boolean(invalid) || Boolean(blocked) || Boolean(view.rejection)),
      sellAction('다시 견적', 'requote', token, () => previewSell(token), busy || Boolean(blocked)));
    if (view.phase === 'review' && !expired) startClock(token, view);
    panel.append(review);
  }
  function drawSell(token, cell) {
    const section = el('div', 'my-token-sell'); section.setAttribute('data-sell', token.launchId);
    drawHolding(token, section);
    if (!snapshot?.sells) { cell.append(section); return; }
    const view = sellViews.get(token.launchId), job = sellJobFor(token), balance = amount(token.holding?.balanceWei);
    const blocked = sellBlocked(token), busy = ['previewing', 'submitting', 'checking'].includes(view?.phase);
    if (balance !== 0n && !view?.open) {
      add(section, sellAction('매도', 'open', token, () => openSell(token), Boolean(blocked)));
      if (blocked) section.append(el('small', 'muted', blocked));
    }
    if (view?.open) {
      const panel = el('div', 'my-token-sell-panel'); panel.setAttribute('aria-label', `${text(token.symbol)} 매도`);
      const percent = el('select', 'my-token-sell-percent'); percent.setAttribute('data-sell-field', 'percent'); percent.setAttribute('aria-label', '매도 비율');
      for (const [value, label] of SELL_PERCENTS) { const option = el('option', '', label); option.value = value; percent.append(option); }
      percent.value = view.percentBps; percent.disabled = busy;
      percent.addEventListener('change', () => { view.percentBps = percent.value; });
      const slippage = el('input', 'my-token-sell-slippage'); slippage.type = 'number'; slippage.min = '0.01'; slippage.max = '20'; slippage.step = '0.01'; slippage.setAttribute('data-sell-field', 'slippage'); slippage.setAttribute('aria-label', '슬리피지 (%)');
      slippage.value = view.slippage; slippage.disabled = busy;
      slippage.addEventListener('input', () => { view.slippage = slippage.value; });
      add(panel, el('strong', '', `${text(token.symbol)} 매도`.trim()),
        add(el('div', 'my-token-sell-fields'), add(el('label', 'my-token-sell-field', '비율 '), percent), add(el('label', 'my-token-sell-field', '슬리피지 (%) '), slippage)),
        el('small', 'muted', '미리보기는 서명·전송 없이 현재 커브 준비금으로 정확한 수령액을 계산합니다. 견적은 2분간 유효합니다.'));
      const reviewing = ['review', 'submitting', 'uncertain'].includes(view.phase) && view.quote;
      if (!reviewing) add(panel, sellAction(view.phase === 'previewing' ? '견적 조회 중…' : '미리보기', 'preview', token, () => previewSell(token), busy || Boolean(blocked)));
      add(panel, sellAction('닫기', 'close', token, () => closeSell(token), busy || view.phase === 'uncertain'));
      if (reviewing) drawSellReview(token, view, panel);
      drawSellError(view, token, panel);
      section.append(panel);
    } else drawSellError(view, token, section);
    if (job) {
      const detail = el('div', `my-token-claim-job my-token-sell-job ${job.status === 'confirmed' ? 'my-token-claim-success' : ''}`);
      detail.setAttribute('role', 'status'); detail.setAttribute('aria-live', 'polite'); detail.setAttribute('data-sell-job', text(job.id));
      detail.append(el('strong', '', `매도 ${sellLabel(job)}`));
      if (amount(job.tokensIn) !== null) detail.append(el('span', '', `수량 ${tokens(job.tokensIn, tokenDecimalsOf(job))} ${text(token.symbol)}`.trim()));
      if (job.status === 'confirmed' && amount(job.actualCostWei) !== null) detail.append(el('span', '', `실제 가스비 ${formatTokenEth(job.actualCostWei, 18)} ETH`));
      if (txHash(job.approveTxHash)) detail.append(explorer('승인 트랜잭션 ↗', 'tx', job.approveTxHash));
      if (txHash(job.sellTxHash)) detail.append(explorer('매도 트랜잭션 ↗', 'tx', job.sellTxHash));
      if (activeSell(job)) {
        detail.append(sellAction(view?.phase === 'checking' ? '상태 조회 중…' : view?.timer ? '5초마다 상태 갱신 중' : '진행 상태 확인', 'status', token, () => checkSell(token, job), busy || Boolean(view?.timer)));
        // queued, or approved with the sell stage still unsigned (e.g. parked by a paused policy); the server answers 409 TOKEN_SELL_CANNOT_CANCEL once signed.
        if (['queued', 'approved'].includes(job.status) && snapshot.sells.canSell) detail.append(sellAction('접수 취소', 'cancel-job', token, () => cancelSell(token, job), busy));
      }
      section.append(detail);
    }
    cell.append(section);
  }
  function openSell(token) {
    if (sellBlocked(token)) return;
    const previous = sellViews.get(token.launchId);
    if (['previewing', 'submitting', 'checking', 'uncertain'].includes(previous?.phase)) return;
    sellViews.set(token.launchId, {...previous, open:true, phase:'idle', quote:null, error:'', errorCode:'', rejection:'', percentBps: previous?.percentBps || '10000', slippage: previous?.slippage ?? '2'});
    drawRows();
  }
  function closeSell(token) {
    const view = sellViews.get(token.launchId);
    if (!view || ['previewing', 'submitting', 'checking', 'uncertain'].includes(view.phase)) return;
    stopClock(view);
    Object.assign(view, {open:false, phase: view.job ? 'status' : 'idle', quote:null, error:'', errorCode:'', rejection:''});
    drawRows();
  }
  async function previewSell(token) {
    const view = sellViews.get(token.launchId);
    if (!view?.open || sellBlocked(token) || ['previewing', 'submitting', 'checking', 'uncertain'].includes(view.phase)) return;
    const percentBps = Number(view.percentBps), slippageBps = Math.round(Number(view.slippage) * 100);
    if (!Number.isInteger(percentBps) || percentBps < 1 || percentBps > 10000) { Object.assign(view, {error:'매도 비율을 선택하세요.', errorCode:''}); drawRows(); return; }
    if (!Number.isInteger(slippageBps) || slippageBps < 1 || slippageBps > 2000) { Object.assign(view, {error:'슬리피지는 0.01 %에서 20 % 사이여야 합니다.', errorCode:''}); drawRows(); return; }
    const generation = epoch; stopClock(view);
    Object.assign(view, {phase:'previewing', quote:null, error:'', errorCode:'', rejection:''}); drawRows();
    try {
      const quote = await api(`/api/owned-tokens/${encodeURIComponent(token.launchId)}/sells/preview`, {method:'POST', body:{percentBps, slippageBps}});
      if (generation !== epoch || sellViews.get(token.launchId) !== view) return;
      Object.assign(view, {phase:'review', quote});
    } catch (reason) { if (generation === epoch) Object.assign(view, {phase:'idle', error:reason?.message || '매도 견적 조회에 실패했습니다.', errorCode:text(reason?.code)}); }
    finally { if (generation === epoch) drawRows(); }
  }
  async function submitSell(token, retry = false) {
    const view = sellViews.get(token.launchId);
    if (!view || (retry ? view.phase !== 'uncertain' : view.phase !== 'review') || !snapshot?.sells?.canSell) return;
    const invalid = retry ? '' : view.rejection || sellQuoteBlocked(view.quote, token) || sellBlocked(token);
    if (invalid) { Object.assign(view, {error:invalid, errorCode:''}); drawRows(); return; }
    if (!retry && confirm(confirmText(token, view.quote)) !== true) return;
    const generation = epoch; stopClock(view);
    Object.assign(view, {phase:'submitting', error:'', errorCode:''}); drawRows();
    try {
      const job = await api(`/api/owned-tokens/${encodeURIComponent(token.launchId)}/sells`, {method:'POST', body:{quoteId:view.quote.quoteId}, headers:{'Idempotency-Key':view.quote.quoteId}});
      if (generation !== epoch || sellViews.get(token.launchId) !== view) return;
      if (!text(job?.id) || !Object.hasOwn(sellStatus, job.status) || (job.quoteId != null && job.quoteId !== view.quote.quoteId)) throw new Error('접수 결과를 확인할 수 없습니다. 같은 요청으로 다시 확인하세요.');
      Object.assign(view, {phase:'status', job, quote:null, open:false, rejection:''}); drawRows();
      pollSell(token, view);
      await refresh({force:true});
    } catch (reason) {
      if (generation === epoch) {
        const code = text(reason?.code);
        const conflict = ['TOKEN_SELL_QUOTE_USED', 'TOKEN_SELL_IDEMPOTENCY_CONFLICT', 'TOKEN_SELL_ALREADY_PENDING'].includes(code);
        const rejected = reason?.status >= 400 && reason.status < 500 && reason.status !== 408 && !conflict;
        const message = reason?.message || '매도 접수 여부를 확인할 수 없습니다.';
        Object.assign(view, {phase:rejected ? 'review' : 'uncertain', error:message, errorCode:code, rejection:rejected ? message : ''});
        if (conflict || code === 'TOKEN_SELL_WALLET_BUSY') await refresh({force:true});
      }
    }
    finally { if (generation === epoch) drawRows(); }
  }
  // Poll the durable job every 5 s until it is confirmed or failed; the timer never re-sends the sell.
  function pollSell(token, view) {
    stopPoll(view);
    if (!activeSell(view.job)) return;
    const generation = epoch;
    view.timer = timers.set(async () => {
      view.timer = null;
      if (generation !== epoch || sellViews.get(token.launchId) !== view) return;
      await fetchSell(token, view);
      if (generation !== epoch || sellViews.get(token.launchId) !== view) return;
      if (activeSell(view.job)) pollSell(token, view);
      else await refresh({force:true});
      if (generation === epoch) drawRows();
    }, 5000);
  }
  async function fetchSell(token, view) {
    const generation = epoch, job = view.job;
    try {
      const result = await api(`/api/token-sells/${encodeURIComponent(job.id)}`);
      if (generation !== epoch || sellViews.get(token.launchId) !== view) return;
      if (result?.id !== job.id || !Object.hasOwn(sellStatus, result.status)) throw new Error('매도 상태 응답을 확인할 수 없습니다.');
      Object.assign(view, {job:result, error:'', errorCode:''});
    } catch (reason) { if (generation === epoch) Object.assign(view, {error:reason?.message || '매도 상태 조회에 실패했습니다.', errorCode:text(reason?.code)}); }
    finally { if (generation === epoch) drawRows(); }
  }
  async function checkSell(token, job) {
    const previous = sellViews.get(token.launchId);
    if (['previewing', 'submitting', 'checking'].includes(previous?.phase) || previous?.timer) return;
    const generation = epoch, view = {...previous, phase:'checking', job, error:'', errorCode:''}; sellViews.set(token.launchId, view); drawRows();
    await fetchSell(token, view);
    if (generation !== epoch || sellViews.get(token.launchId) !== view) return;
    view.phase = previous?.phase === 'uncertain' ? 'uncertain' : 'status';
    if (view.job?.status === 'confirmed') await refresh({force:true});
    if (generation === epoch) drawRows();
  }
  async function cancelSell(token, job) {
    const previous = sellViews.get(token.launchId);
    if (['previewing', 'submitting', 'checking'].includes(previous?.phase) || !snapshot?.sells?.canSell) return;
    const generation = epoch, view = {...previous, phase:'checking', job, error:'', errorCode:''}; sellViews.set(token.launchId, view); drawRows();
    try {
      const result = await api(`/api/token-sells/${encodeURIComponent(job.id)}/cancel`, {method:'POST', body:{}});
      if (generation !== epoch || sellViews.get(token.launchId) !== view) return;
      if (result?.id === job.id && Object.hasOwn(sellStatus, result.status)) view.job = result;
      view.phase = 'status'; stopPoll(view); drawRows();
      await refresh({force:true});
    } catch (reason) { if (generation === epoch) Object.assign(view, {phase:'status', error:reason?.message || '매도 취소에 실패했습니다.', errorCode:text(reason?.code)}); }
    finally { if (generation === epoch) drawRows(); }
  }
  function drawSells() {
    sellsBox.hidden = !snapshot?.sells;
    sellsBody.replaceChildren();
    if (!snapshot?.sells) return;
    const symbols = new Map(list(snapshot.tokens).map(token => [token.launchId, token]));
    const items = latestJob([...list(snapshot.sells.items), ...[...sellViews.values()].map(view => view.job)], activeSell).slice(0, 20);
    for (const job of items) {
      const token = symbols.get(job.launchId), unit = unitOf(job), row = el('tr'); row.setAttribute('data-sell-id', text(job.id));
      const name = add(el('td'), el('strong', 'my-token-symbol', text(token?.symbol) || short(job.tokenAddress)));
      if (address(job.walletAddress)) name.append(el('small', 'muted', `발행 지갑 ${short(job.walletAddress)}`));
      const state = add(el('td', job.status === 'confirmed' ? 'my-token-claim-success' : ''), el('strong', '', sellLabel(job)));
      if (job.status !== 'failed' && text(job.error)) state.append(el('span', 'error-text', job.error));
      const links = el('td');
      if (txHash(job.approveTxHash)) links.append(explorer('승인 ↗', 'tx', job.approveTxHash));
      if (txHash(job.sellTxHash)) links.append(explorer('매도 ↗', 'tx', job.sellTxHash));
      add(row, el('td', 'muted', date(job.createdAt)), name, el('td', 'my-token-number', `${tokens(job.tokensIn, tokenDecimalsOf(job))} ${text(token?.symbol)}`.trim()),
        el('td', 'my-token-number', job.status === 'confirmed' ? money(job.quoteOut, unit) : '—'), state, links);
      sellsBody.append(row);
    }
    sellsEmpty.hidden = items.length > 0;
  }
  function draw() {
    refreshButton.disabled = loading;
    refreshButton.textContent = loading ? '조회 중…' : '지금 새로고침';
    const tokens = list(snapshot?.tokens), totals = snapshot?.totals || {};
    const stale = snapshot?.stale || snapshot?.status === 'stale' || error;
    status.textContent = error ? `갱신 실패: ${error}${snapshot ? ` · 마지막 성공 조회 ${date(snapshot.at)}` : ''}`
      : snapshot ? `${stale ? '마지막 성공 데이터 · ' : snapshot.status === 'partial' || snapshot.status === 'unavailable' ? '일부 데이터 조회 불가 · ' : ''}${date(snapshot.at)} 기준 · 이 화면에서 30초마다 갱신${loading ? ' · 갱신 중…' : ''}` : loading ? '내 발행 기록과 온체인 수수료를 조회하고 있습니다…' : '아직 조회한 데이터가 없습니다.';
    status.className = `my-tokens-status ${error || stale || snapshot?.status === 'unavailable' ? 'error-text' : 'muted'}`;
    stats.replaceChildren();
    const n = tokens.length;
    const byCurrency = list(totals.byCurrency).filter(entry => text(entry?.currency) && validDecimals(entry.decimals));
    add(stats,
      stat('내 발행 토큰', String(totals.tokenCount ?? n), '이 서버에서 실제 발행이 확정된 토큰', null),
      stat('누적 거래량', totals.volumeLifetimeWei, `조회 가능한 토큰 합계 · ${totals.volumeAvailableCount ?? 0}/${n}개 · ETH 페어`),
      stat('24h 거래량', totals.volume24hWei, '최근 24시간 · 조회 가능한 범위 · ETH 페어'),
      stat('청구 가능한 크리에이터 수수료', totals.claimableWei, `현재 청구 가능한 잔액 · ${totals.feesAvailableCount ?? 0}/${n}개 조회 · ETH 페어`));
    if (byCurrency.length) {
      // One compact line per pair asset (ETH first); amounts stay in that asset's own units and are never converted.
      const box = el('div', 'my-tokens-by-currency'); box.id = 'my-tokens-by-currency'; box.setAttribute('role', 'list'); box.setAttribute('aria-label', '페어 자산별 합계');
      for (const entry of byCurrency) {
        const unit = unitOf(entry), line = el('div', 'my-tokens-currency-line'); line.setAttribute('role', 'listitem'); line.setAttribute('data-currency', unit.currency);
        add(line, el('strong', '', unit.currency), el('span', 'muted', ` · ${Number.isInteger(entry.tokenCount) ? entry.tokenCount : 0}개 토큰`),
          ...[['누적 거래량', entry.volumeLifetime], ['24h', entry.volume24h], ['청구 가능', entry.claimable], ['누적 발생', entry.accrued]].map(([label, value]) => el('span', '', ` · ${label} ${money(value, unit)}`)));
        box.append(line);
      }
      stats.append(box);
    }
    note.replaceChildren(el('p', '', '거래량은 표시된 Pons 거래 범위의 매수·매도 합계입니다. 청구 가능 수수료는 에스크로 잔액입니다. 아직 커브에 남아 있는 금액과 이미 청구한 금액은 별도로 표시합니다.'));
    for (const message of list(snapshot?.notes)) if (text(message)) note.append(el('p', '', message));
    if (tokens.some(token => !unitOf(token.volume).native || !unitOf(token.fees).native)) note.append(el('p', '', 'ERC-20 페어 토큰(주식 토큰·USDG·cbBTC 등)으로 발행한 토큰의 금액은 해당 페어 자산 단위입니다. 상단 ETH 합계에는 포함하지 않으며 자산별 합계 줄에 따로 표시합니다. 클레임도 그 자산으로 수령하고 가스비만 ETH로 지불합니다.'));
    if (tokens.some(token => (token.fees?.claimableScope || token.fees?.scope) === 'recipient')) note.append(el('p', '', '수령 지갑 기준 수수료에는 같은 지갑의 다른 토큰 수수료가 포함될 수 있습니다. 합계는 같은 지갑을 중복 계산하지 않습니다.'));
    if (tokens.some(token => token.fees?.accruedScope === 'curve')) note.append(el('p', '', '본딩 커브 누적 발생은 해당 토큰의 커브에서 발생한 금액입니다. 수령 지갑의 청구 내역과 집계 범위가 다를 수 있습니다.'));
    if (tokens.some(token => token.holding)) note.append(el('p', '', '보유 수량은 발행 지갑이 들고 있는 그 토큰(개발자 매수분)이며, 전량 매도 예상액은 현재 커브 준비금 기준의 수수료 차감 후 금액입니다. 매도는 운영자가 미리보기 후 직접 실행할 때만 전송하며 자동으로 매도하지 않습니다. 졸업한 토큰은 커브에서 팔 수 없고 Pons에서 매도합니다.'));
    drawRows();
  }
  function drawRows() {
    const query = text(search.value).trim().toLowerCase();
    const tokens = list(snapshot?.tokens).filter(token => [token.name, token.symbol, token.tokenAddress].some(value => text(value).toLowerCase().includes(query)));
    body.replaceChildren();
    for (const token of tokens) {
      const volume = token.volume || {}, fees = token.fees || {}, volumeUnit = unitOf(volume), feeUnit = unitOf(fees);
      const row = el('tr'); row.setAttribute('data-token', text(token.tokenAddress));
      const identity = el('div', 'my-token-identity');
      if (/^\/assets\/tokens\/[a-fA-F0-9-]+\.(png|svg)$/.test(token.imageUrl || '')) {
        const image = el('img', 'my-token-image'); image.src = assetUrl(token.imageUrl); image.alt = `${text(token.symbol)} 토큰 이미지`; image.loading = 'lazy'; image.width = 48; image.height = 48;
        image.addEventListener('error', () => { image.hidden = true; }); identity.append(image);
      }
      const title = add(el('div'), el('strong', 'my-token-symbol', text(token.symbol) || '티커 없음'), el('span', 'my-token-name muted', text(token.name)));
      if (!feeUnit.native || !volumeUnit.native) title.append(el('span', 'my-token-pair', `${feeUnit.currency || volumeUnit.currency || '단위 미확인'} 페어`));
      const tokenAddress = address(token.tokenAddress);
      if (tokenAddress) title.append(explorer(short(tokenAddress), 'token', tokenAddress));
      add(identity, title);
      const tokenCell = add(el('td'), identity, link('Pons에서 보기 ↗', token.launchpadUrl, 'www.ponsfamily.com'));
      const volumeCell = add(el('td', 'my-token-number'), metric(volume.lifetimeWei, volumeUnit), el('small', 'muted', text(volume.scope)));
      const recentCell = add(el('td', 'my-token-number'), metric(volume.volume24hWei, volumeUnit));
      const claimableScope = fees.claimableScope || fees.scope;
      const claimedScope = fees.claimedScope || fees.scope;
      const feeCell = add(el('td', 'my-token-number my-token-fee'), metric(fees.claimableWei, feeUnit), el('small', 'muted', claimableScope === 'recipient' ? `수령 지갑 합산${feeUnit.native ? '' : ` · ${feeUnit.currency || '단위 미확인'} 기준`}` : claimableScope === 'token' ? '이 토큰의 청구 가능 잔액' : '수수료 범위 미확인'));
      drawClaim(token, feeCell);
      const detail = el('td', 'my-token-detail');
      add(detail, el('span', '', `${fees.accruedScope === 'curve' ? '본딩 커브 누적 발생' : '누적 발생'} ${money(fees.accruedWei, feeUnit)}`), el('span', '', `${claimedScope === 'recipient' ? '수령 지갑에서 이미 청구' : '이미 청구'} ${money(fees.claimedWei, feeUnit)}`));
      if (Object.hasOwn(fees, 'pendingWei')) detail.append(el('span', '', `커브에 남은 수수료 ${money(fees.pendingWei, feeUnit)} · 에스크로 이체 전`));
      const recipient = address(fees.recipientAddress || token.creatorAddress);
      if (recipient) detail.append(explorer(`수령 지갑 ${short(recipient)} ↗`, 'address', recipient));
      const issues = [...new Set([...list(token.errors), volume.error, fees.error].filter(value => text(value)))];
      for (const message of issues) detail.append(el('span', 'error-text', message));
      const audit = add(el('details', 'my-token-source'), el('summary', '', '조회 기준'));
      add(audit, el('p', 'muted', `거래량 ${date(volume.asOf)}${volume.asOfBlock != null ? ` · 블록 ${volume.asOfBlock}` : ''}`), el('p', 'muted', `수수료 ${date(fees.asOf)}${fees.asOfBlock != null ? ` · 블록 ${fees.asOfBlock}` : ''}`));
      if (text(volume.source)) audit.append(el('p', 'muted', volume.source));
      if (text(fees.source)) audit.append(el('p', 'muted', fees.source));
      detail.append(audit);
      const sellCell = el('td', 'my-token-sell-cell');
      drawSell(token, sellCell);
      add(row, tokenCell, volumeCell, recentCell, feeCell, detail, sellCell); body.append(row);
    }
    empty.hidden = tokens.length > 0;
    empty.textContent = query ? '검색에 맞는 토큰이 없습니다.' : loading && !snapshot ? '토큰을 불러오는 중입니다…' : error && !snapshot ? '발행 기록을 불러오지 못했습니다. 새로고침으로 다시 조회하세요.' : snapshot && !list(snapshot.tokens).length ? '아직 이 서버에서 발행이 확정된 토큰이 없습니다.' : '조회 결과를 기다리고 있습니다.';
    drawSells();
  }
  function refresh({force = false} = {}) {
    if (pending) return pending;
    if (!force && lastFetched !== null && now() - lastFetched < 30_000) { draw(); return Promise.resolve(snapshot); }
    const generation = epoch;
    loading = true; error = ''; draw();
    const task = (async () => {
      try {
        const result = await api(`/api/owned-tokens${force ? '?refresh=true' : ''}`);
        if (generation === epoch) {
          snapshot = result; lastFetched = now();
          for (const view of claimViews.values()) {
            if (view.phase !== 'uncertain') continue;
            const job = list(result?.claims?.items).find(item => item.quoteId === view.quote?.quoteId);
            if (job && Object.hasOwn(claimStatus, job.status)) Object.assign(view, {phase:'status', job, error:''});
          }
          for (const [launchId, view] of sellViews) {
            if (view.phase !== 'uncertain') continue;
            const job = list(result?.sells?.items).find(item => item.quoteId != null ? item.quoteId === view.quote?.quoteId : item.launchId === launchId && activeSell(item));
            if (job && Object.hasOwn(sellStatus, job.status)) { Object.assign(view, {phase:'status', job, quote:null, open:false, error:'', errorCode:''}); stopClock(view); }
          }
        }
        return result;
      } catch (reason) { if (generation === epoch) error = reason?.message || '데이터 요청에 실패했습니다.'; }
      finally { if (generation === epoch) { loading = false; pending = null; draw(); } }
    })();
    pending = task;
    return task;
  }
  function reset() {
    epoch++; snapshot = null; error = ''; loading = false; lastFetched = null; pending = null; claimViews.clear();
    for (const view of sellViews.values()) { stopClock(view); stopPoll(view); }
    sellViews.clear(); search.value = ''; draw();
  }
  return {render: () => refresh(), refresh, reset};
}
