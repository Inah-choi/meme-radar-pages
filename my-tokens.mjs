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
const pendingClaim = job => ['queued', 'prepared', 'submitted', 'uncertain'].includes(job?.status);
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
const claimStatus = {queued:'클레임 접수됨', prepared:'서명 완료 · 전송 대기', submitted:'클레임 전송됨 · 확인 중', uncertain:'전송 결과 확인 중', confirmed:'클레임 완료', failed:'클레임 실패'};

export function createMyTokens({api, document = globalThis.document, now = Date.now, assetUrl = value => value}) {
  const root = document.querySelector('#my-tokens-root');
  const el = (tag, className = '', value = '') => { const node = document.createElement(tag); node.className = className; node.textContent = value; return node; };
  const add = (parent, ...children) => { for (const child of children) if (child) parent.append(child); return parent; };
  const link = (label, url, allowedHost) => {
    try { const parsed = new URL(url); if (parsed.protocol !== 'https:' || parsed.hostname !== allowedHost || parsed.username || parsed.password) return null; }
    catch { return null; }
    const node = el('a', 'text-link', label); node.href = url; node.target = '_blank'; node.rel = 'noopener noreferrer'; return node;
  };
  let snapshot = null, error = '', loading = false, lastFetched = null, pending = null, epoch = 0;
  const claimViews = new Map();
  const heading = el('div', 'page-heading');
  const headingText = add(el('div'), el('div', 'eyebrow', 'MY TOKENS · PONS'), el('h1', '', '내 토큰'), el('p', 'muted', '발행한 토큰의 거래량과 쌓인 크리에이터 수수료를 확인하세요.'));
  const refreshButton = el('button', 'button secondary', '지금 새로고침'); refreshButton.type = 'button'; refreshButton.id = 'my-tokens-refresh';
  refreshButton.addEventListener('click', () => refresh({force:true}));
  add(heading, headingText, refreshButton);
  const status = el('p', 'my-tokens-status muted'); status.id = 'my-tokens-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const stats = el('div', 'my-tokens-stats'); stats.id = 'my-tokens-stats';
  const search = el('input', 'my-tokens-search'); search.type = 'search'; search.id = 'my-tokens-search'; search.placeholder = '티커, 이름 또는 토큰 주소 검색'; search.setAttribute('aria-label', '내 토큰 검색'); search.addEventListener('input', drawRows);
  const caption = el('caption', 'sr-only', '직접 발행한 토큰의 거래량과 청구 가능한 크리에이터 수수료');
  const table = el('table', 'data-table my-tokens-table'); table.id = 'my-tokens-table';
  const headRow = el('tr');
  for (const name of ['토큰', '누적 거래량', '24h 거래량', '청구 가능 수수료', '수수료 내역 · 조회 상태']) { const th = el('th', '', name); th.scope = 'col'; headRow.append(th); }
  const body = el('tbody'); add(table, caption, add(el('thead'), headRow), body);
  const empty = el('p', 'my-tokens-empty muted'); empty.id = 'my-tokens-empty';
  const note = el('div', 'my-tokens-note muted'); note.id = 'my-tokens-note';
  add(root, heading, status, stats, search, add(el('div', 'panel my-tokens-table-wrap'), table), empty, note);

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
    const latest = new Map();
    for (const job of jobs) {
      const old = latest.get(job.id);
      if (!old || (Date.parse(job.updatedAt) || 0) >= (Date.parse(old.updatedAt) || 0)) latest.set(job.id, job);
    }
    return [...latest.values()].sort((a, b) => Number(pendingClaim(b)) - Number(pendingClaim(a)) || (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))[0];
  }
  function claimBlocked(token) {
    if (!snapshot?.claims?.canClaim) return text(snapshot?.claims?.reason) || '클레임은 운영자 권한이 필요합니다.';
    if (error || snapshot.stale || snapshot.status === 'stale' || token.fees?.stale) return '새로고침 후 수수료를 확인하세요.';
    if (amount(token.fees?.claimableWei) === null) return '수수료 조회 후 청구할 수 있습니다.';
    if (amount(token.fees?.claimableWei) === 0n) return '청구 가능한 수수료가 없습니다.';
    if (pendingClaim(jobFor(token))) return '이 수령 지갑의 클레임을 처리 중입니다.';
    for (const [launchId, view] of claimViews) {
      if (['submitting', 'uncertain'].includes(view.phase) && (launchId === token.launchId || sameRecipient(view.quote, token.fees))) return '이 수령 지갑의 실행 결과를 확인 중입니다.';
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
      if (recipient) review.append(link(`수령 지갑 ${recipient} ↗`, `https://robinhoodchain.blockscout.com/address/${recipient}`, 'robinhoodchain.blockscout.com'));
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
      if (/^0x[a-fA-F0-9]{64}$/.test(job.txHash || '')) detail.append(link('클레임 트랜잭션 ↗', `https://robinhoodchain.blockscout.com/tx/${job.txHash}`, 'robinhoodchain.blockscout.com'));
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
      if (tokenAddress) title.append(link(short(tokenAddress), `https://robinhoodchain.blockscout.com/token/${tokenAddress}`, 'robinhoodchain.blockscout.com'));
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
      if (recipient) detail.append(link(`수령 지갑 ${short(recipient)} ↗`, `https://robinhoodchain.blockscout.com/address/${recipient}`, 'robinhoodchain.blockscout.com'));
      const issues = [...new Set([...list(token.errors), volume.error, fees.error].filter(value => text(value)))];
      for (const message of issues) detail.append(el('span', 'error-text', message));
      const audit = add(el('details', 'my-token-source'), el('summary', '', '조회 기준'));
      add(audit, el('p', 'muted', `거래량 ${date(volume.asOf)}${volume.asOfBlock != null ? ` · 블록 ${volume.asOfBlock}` : ''}`), el('p', 'muted', `수수료 ${date(fees.asOf)}${fees.asOfBlock != null ? ` · 블록 ${fees.asOfBlock}` : ''}`));
      if (text(volume.source)) audit.append(el('p', 'muted', volume.source));
      if (text(fees.source)) audit.append(el('p', 'muted', fees.source));
      detail.append(audit);
      add(row, tokenCell, volumeCell, recentCell, feeCell, detail); body.append(row);
    }
    empty.hidden = tokens.length > 0;
    empty.textContent = query ? '검색에 맞는 토큰이 없습니다.' : loading && !snapshot ? '토큰을 불러오는 중입니다…' : error && !snapshot ? '발행 기록을 불러오지 못했습니다. 새로고침으로 다시 조회하세요.' : snapshot && !list(snapshot.tokens).length ? '아직 이 서버에서 발행이 확정된 토큰이 없습니다.' : '조회 결과를 기다리고 있습니다.';
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
        }
        return result;
      } catch (reason) { if (generation === epoch) error = reason?.message || '데이터 요청에 실패했습니다.'; }
      finally { if (generation === epoch) { loading = false; pending = null; draw(); } }
    })();
    pending = task;
    return task;
  }
  function reset() { epoch++; snapshot = null; error = ''; loading = false; lastFetched = null; pending = null; claimViews.clear(); search.value = ''; draw(); }
  return {render: () => refresh(), refresh, reset};
}
