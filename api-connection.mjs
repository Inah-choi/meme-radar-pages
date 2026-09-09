// A connection is chosen explicitly in the login form or deployment file. Never
// read connection targets or credentials from the page URL, query or fragment.
export const API_ORIGIN_STORAGE = 'observatory-api-origin';
export const API_DEPLOYMENT_ORIGIN_STORAGE = 'observatory-api-deployment-origin';
export const API_SELECTION_MODE_STORAGE = 'observatory-api-selection-mode';
const LEGACY_KEY = 'observatory-key';
const fail = () => { throw new Error('백엔드 URL은 경로·인증정보 없이 HTTPS 서버 주소를 입력하세요. 로컬 HTTP는 localhost만 사용할 수 있습니다.'); };
const get = (storage, key) => { try { return storage?.getItem(key) ?? null; } catch { return null; } };
const set = (storage, key, value) => { try { storage?.setItem(key, value); } catch {} };
const remove = (storage, key) => { try { storage?.removeItem(key); } catch {} };

export function normalizeApiOrigin(input, pageOrigin) {
  const value = typeof input === 'string' ? input.trim() : '';
  const candidate = value || pageOrigin;
  if (typeof candidate !== 'string' || !/^https?:\/\/[^/?#\\\s]+\/?$/i.test(candidate)) fail();
  let url; try { url = new URL(candidate); } catch { fail(); }
  const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      url.protocol !== 'https:' && !(url.protocol === 'http:' && (loopback || url.origin === pageOrigin))) fail();
  return url.origin;
}

export function apiSessionKey(apiOrigin, pageOrigin) {
  return `${LEGACY_KEY}:${encodeURIComponent(normalizeApiOrigin(apiOrigin, pageOrigin))}`;
}

export function readApiSession(storage, pageOrigin, deploymentOrigin = '') {
  const saved = get(storage, API_ORIGIN_STORAGE);
  const mode = get(storage, API_SELECTION_MODE_STORAGE), previous = get(storage, API_DEPLOYMENT_ORIGIN_STORAGE);
  let apiOrigin, currentDefault, oldDefault = null, invalid = false, changedDefault = false, followsDefault = false;
  try {
    currentDefault = normalizeApiOrigin(deploymentOrigin, pageOrigin);
    const savedOrigin = saved === null ? null : normalizeApiOrigin(saved, pageOrigin);
    if (previous !== null) { try { oldDefault = normalizeApiOrigin(previous, pageOrigin); } catch {} }
    // A recorded override stays an override even if a later deployment happens
    // to use that same origin. Unmarked legacy choices are inferred only when
    // they match the known previous default (or the current default on first use).
    followsDefault = saved === null || mode === 'default' || mode !== 'override' && savedOrigin === (oldDefault ?? currentDefault);
    changedDefault = followsDefault && oldDefault !== null && oldDefault !== currentDefault;
    apiOrigin = followsDefault ? currentDefault : savedOrigin;
  } catch { apiOrigin = normalizeApiOrigin('', pageOrigin); invalid = true; }
  if (changedDefault) {
    remove(storage, apiSessionKey(oldDefault, pageOrigin));
    remove(storage, apiSessionKey(apiOrigin, pageOrigin));
  }
  let key = invalid || changedDefault ? '' : get(storage, apiSessionKey(apiOrigin, pageOrigin)) || '';
  // Existing local sessions migrate only to the same origin, never to a newly
  // configured external backend. Remove the old unscoped slot in either case.
  const legacy = get(storage, LEGACY_KEY);
  if (!invalid && !key && saved === null && !deploymentOrigin && apiOrigin === pageOrigin && legacy) {
    key = legacy; set(storage, apiSessionKey(apiOrigin, pageOrigin), key);
  }
  remove(storage, LEGACY_KEY);
  if (!invalid) {
    set(storage, API_ORIGIN_STORAGE, apiOrigin === pageOrigin ? '' : apiOrigin);
    set(storage, API_DEPLOYMENT_ORIGIN_STORAGE, currentDefault);
    set(storage, API_SELECTION_MODE_STORAGE, followsDefault ? 'default' : 'override');
  }
  return {apiOrigin, apiInput: apiOrigin === pageOrigin ? '' : apiOrigin, key,
    error: invalid ? '저장된 백엔드 URL이 올바르지 않습니다. 서버 주소를 다시 입력하세요.' : ''};
}

export function saveApiSession(storage, {apiOrigin, key}, pageOrigin, deploymentOrigin = '') {
  const normalized = normalizeApiOrigin(apiOrigin, pageOrigin);
  const currentDefault = normalizeApiOrigin(deploymentOrigin, pageOrigin);
  set(storage, API_ORIGIN_STORAGE, normalized === pageOrigin ? '' : normalized);
  set(storage, API_DEPLOYMENT_ORIGIN_STORAGE, currentDefault);
  set(storage, API_SELECTION_MODE_STORAGE, normalized === currentDefault ? 'default' : 'override');
  set(storage, apiSessionKey(normalized, pageOrigin), key);
  remove(storage, LEGACY_KEY);
}

export function forgetApiSession(storage, apiOrigin, pageOrigin) {
  remove(storage, apiSessionKey(apiOrigin, pageOrigin)); remove(storage, LEGACY_KEY);
}

export function apiRequestUrl(path, apiOrigin, pageOrigin) {
  const origin = normalizeApiOrigin(apiOrigin, pageOrigin);
  if (typeof path !== 'string' || !/^\/api(?:\/|\?|$)/.test(path) || /[\\#\u0000-\u0020]/.test(path))
    throw new Error('잘못된 API 요청 경로입니다.');
  const url = new URL(path, `${origin}/`);
  if (url.origin !== origin || !(url.pathname === '/api' || url.pathname.startsWith('/api/')))
    throw new Error('잘못된 API 요청 경로입니다.');
  return url.href;
}

export function backendAssetUrl(value, apiOrigin, pageOrigin) {
  if (typeof value !== 'string' || !value.startsWith('/assets/tokens/') || /[\\#\u0000-\u0020]/.test(value)) return null;
  const origin = normalizeApiOrigin(apiOrigin, pageOrigin), url = new URL(value, `${origin}/`);
  return url.origin === origin && url.pathname.startsWith('/assets/tokens/') ? url.href : null;
}
