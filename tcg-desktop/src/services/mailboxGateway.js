import { withDeadline } from '../core/promiseDeadline.js';
import { normalizePlaySessionPayload } from './playSessionGateway.js';

const DEFAULT_TIMEOUT_MS = 12000;

export class MailboxGatewayError extends Error {
  constructor(message, { status = 0, code = '', payload = {} } = {}) {
    super(message);
    this.name = 'MailboxGatewayError';
    this.status = Number(status) || 0;
    this.code = String(code || payload?.code || '');
    this.payload = payload;
  }
}

function normalizeRewards(value = {}) {
  return {
    coins: Math.max(0, Math.floor(Number(value.coins) || 0)),
    standardPacks: Math.max(0, Math.floor(Number(value.standardPacks ?? value.packs) || 0)),
  };
}

export function normalizeMail(entry = {}) {
  const claimedAt = entry.claimedAt || null;
  const expiresAt = entry.expiresAt || null;
  const expired = !claimedAt && expiresAt && new Date(expiresAt).getTime() <= Date.now();
  return {
    id: String(entry.id || entry._id || ''),
    title: String(entry.title || '운영팀 우편'),
    message: String(entry.message || entry.body || ''),
    rewards: normalizeRewards(entry.rewards),
    createdAt: entry.createdAt || null,
    expiresAt,
    readAt: entry.readAt || null,
    claimedAt,
    status: claimedAt ? 'claimed' : (entry.status === 'expired' || expired ? 'expired' : 'pending'),
  };
}

export function createMailboxGateway({
  apiBase = '',
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const base = String(apiBase || '').trim().replace(/\/+$/, '');

  async function request(path, { method = 'GET', token = '', body, requireToken = true } = {}) {
    if (!base) throw new MailboxGatewayError('우편 서버 주소가 설정되지 않았습니다.', { code: 'UNCONFIGURED' });
    if (requireToken && !token) throw new MailboxGatewayError('로그인이 필요합니다.', { status: 401, code: 'AUTH_REQUIRED' });
    const controller = new AbortController();
    try {
      return await withDeadline(async () => {
        const response = await fetchImpl(`${base}${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new MailboxGatewayError(
            String(payload?.message || payload?.msg || payload?.error || '우편 요청을 처리하지 못했습니다.'),
            { status: response.status, code: payload?.code, payload },
          );
        }
        return payload;
      }, {
        timeoutMs,
        onTimeout: () => controller.abort(),
        timeoutError: () => new MailboxGatewayError('우편 서버 응답이 늦어 연결을 중단했습니다.', { code: 'TIMEOUT' }),
      });
    } catch (error) {
      if (error instanceof MailboxGatewayError) throw error;
      throw new MailboxGatewayError('우편 서버에 연결할 수 없습니다.', { code: 'NETWORK_ERROR' });
    }
  }

  const normalizeMailboxPayload = (payload) => ({
    ...payload,
    mailbox: (payload?.mailbox || payload?.mails || payload?.mail || []).map(normalizeMail).filter((mail) => mail.id),
  });

  return {
    list(token) {
      return request('/api/tcg/mail', { token }).then(normalizeMailboxPayload);
    },
    read(token, mailId) {
      return request('/api/tcg/mail/read', { method: 'POST', token, body: { mailId } }).then(normalizeMailboxPayload);
    },
    claim(token, body) {
      return request('/api/tcg/mail/claim', { method: 'POST', token, body })
        .then((payload) => ({ ...normalizeMailboxPayload(payload), snapshot: normalizePlaySessionPayload(payload) }));
    },
    claimAll(token, body) {
      return request('/api/tcg/mail/claim-all', { method: 'POST', token, body })
        .then((payload) => ({ ...normalizeMailboxPayload(payload), snapshot: normalizePlaySessionPayload(payload) }));
    },
    adminLogin(username, password) {
      return request('/api/tcg/admin/auth/login', {
        method: 'POST', requireToken: false, body: { username, password },
      });
    },
    adminUsers(adminToken) {
      return request('/api/tcg/admin/users', { token: adminToken });
    },
    adminSendMail(adminToken, body) {
      return request('/api/tcg/admin/mail/send', { method: 'POST', token: adminToken, body });
    },
  };
}

const configuredBase = String(import.meta.env?.VITE_TCG_API_BASE || '').trim();
const mailboxGateway = createMailboxGateway({ apiBase: configuredBase });

export const loadMailbox = mailboxGateway.list;
export const markMailRead = mailboxGateway.read;
export const claimMailboxItem = mailboxGateway.claim;
export const claimAllMailboxItems = mailboxGateway.claimAll;
export const loginTcgAdmin = mailboxGateway.adminLogin;
export const loadTcgAdminUsers = mailboxGateway.adminUsers;
export const sendTcgAdminMail = mailboxGateway.adminSendMail;
