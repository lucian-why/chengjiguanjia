import {
    initTCB,
    sendEmailCode as sendTCBEmailCode,
    emailLogin as emailCodeLogin,
    verifyToken as verifyTCBToken,
    getCurrentUser as getTCBCurrentUser,
    signOut as signOutTCB,
    getTCBEnvId
} from './cloud-tcb.js';

let initialized = false;
let authEnabled = false;
const listeners = new Set();

function hasAuthConfig() {
    return Boolean(getTCBEnvId()) && import.meta.env.VITE_ENABLE_AUTH !== 'false';
}

function emitAuthChange(event, payload = {}) {
    listeners.forEach((listener) => {
        try {
            listener(event, payload);
        } catch (error) {
            console.warn('[auth] 监听登录状态变更失败：', error);
        }
    });
}

export function normalizeEmail(email) {
    const raw = String(email || '').trim().toLowerCase();
    if (!raw) {
        throw new Error('请输入邮箱');
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(raw)) {
        throw new Error('请输入正确的邮箱地址');
    }

    return raw;
}

export function initSupabase() {
    if (initialized) {
        return authEnabled;
    }

    initialized = true;
    authEnabled = hasAuthConfig();

    if (!authEnabled) {
        return null;
    }

    return initTCB();
}

export function isAuthEnabled() {
    if (!initialized) {
        initSupabase();
    }
    return authEnabled;
}

export function getSupabaseClient() {
    return null;
}

export async function getCurrentUser() {
    if (!isAuthEnabled()) {
        return null;
    }

    return await getTCBCurrentUser();
}

export async function sendEmailCode(email) {
    if (!isAuthEnabled()) {
        throw new Error('当前环境未启用腾讯云登录');
    }

    return await sendTCBEmailCode(normalizeEmail(email));
}

export async function sendMagicLink(email) {
    return await sendEmailCode(email);
}

export async function emailLogin(email, code) {
    if (!isAuthEnabled()) {
        throw new Error('当前环境未启用腾讯云登录');
    }

    const result = await emailCodeLogin(normalizeEmail(email), code);
    emitAuthChange('SIGNED_IN', {
        user: result?.user || null,
        token: result?.token || null
    });
    return result;
}

export async function verifyToken() {
    if (!isAuthEnabled()) {
        return null;
    }

    return await verifyTCBToken();
}

export async function signOut() {
    await signOutTCB();
    emitAuthChange('SIGNED_OUT', { user: null, token: null });
}

export function onAuthStateChange(callback) {
    if (typeof callback !== 'function') {
        return () => {};
    }

    listeners.add(callback);
    return () => listeners.delete(callback);
}
