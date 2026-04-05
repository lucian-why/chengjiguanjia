const ENV_ID = import.meta.env.VITE_TCB_ENV_ID || 'chengjileida-8gpex74ea92afd85';
const TOKEN_KEY = 'tcb_token';
const USER_KEY = 'tcb_user';
const USER_ID_KEY = 'tcb_user_id';
const USER_EMAIL_KEY = 'tcb_user_email';
const VERIFICATION_INFO_KEY = 'tcb_email_verification_info';

let appInstance = null;
let authInstance = null;
let tcbModulePromise = null;

function isBrowser() {
    return typeof window !== 'undefined';
}

function normalizeEmail(email) {
    const value = String(email || '').trim().toLowerCase();
    if (!value) {
        throw new Error('请输入邮箱');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw new Error('请输入正确的邮箱地址');
    }
    return value;
}

function normalizeCode(code) {
    const value = String(code || '').trim();
    if (!/^\d{6}$/.test(value)) {
        throw new Error('请输入 6 位验证码');
    }
    return value;
}

async function loadCloudbaseModule() {
    if (tcbModulePromise) return tcbModulePromise;
    tcbModulePromise = import(/* @vite-ignore */ '@cloudbase/js-sdk');
    return tcbModulePromise;
}

function buildError(error, fallback) {
    const rawMessage = error?.message || error?.msg || error?.error_description || fallback || '腾讯云服务暂时不可用';
    const message = typeof rawMessage === 'string' ? rawMessage : JSON.stringify(rawMessage);
    return error instanceof Error ? new Error(message) : new Error(message);
}

function readVerificationInfo() {
    if (!isBrowser()) return null;
    const raw = localStorage.getItem(VERIFICATION_INFO_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        localStorage.removeItem(VERIFICATION_INFO_KEY);
        return null;
    }
}

function writeVerificationInfo(info) {
    if (!isBrowser()) return;
    if (!info) {
        localStorage.removeItem(VERIFICATION_INFO_KEY);
        return;
    }
    localStorage.setItem(VERIFICATION_INFO_KEY, JSON.stringify(info));
}

function mapAuthUser(user) {
    if (!user) return null;
    const email = user.email || user.username || user.user_metadata?.email || '';
    const nickname = user.user_metadata?.nickName || user.user_metadata?.name || user.nickname || (email ? email.split('@')[0] : '云端用户');
    return {
        id: user.id || user.uid || user.sub || '',
        email,
        nickname,
        avatarUrl: user.user_metadata?.avatarUrl || user.user_metadata?.picture || user.picture || null
    };
}

export async function initTCB() {
    if (appInstance) return appInstance;

    const cloudbase = await loadCloudbaseModule();
    const sdk = cloudbase.default || cloudbase;
    appInstance = sdk.init({
        env: ENV_ID,
        persistence: 'local'
    });
    return appInstance;
}

async function getAuth() {
    if (authInstance) return authInstance;
    const app = await initTCB();
    authInstance = app.auth({ persistence: 'local' });
    return authInstance;
}

export function getStoredToken() {
    return isBrowser() ? localStorage.getItem(TOKEN_KEY) || '' : '';
}

export function getStoredUser() {
    if (!isBrowser()) return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        clearAuthStorage();
        return null;
    }
}

export function clearAuthStorage() {
    if (!isBrowser()) return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(USER_EMAIL_KEY);
    localStorage.removeItem(VERIFICATION_INFO_KEY);
}

export function saveAuthSession({ token, user }) {
    if (!isBrowser()) return;
    if (token) {
        localStorage.setItem(TOKEN_KEY, token);
    } else {
        localStorage.removeItem(TOKEN_KEY);
    }
    if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        if (user.id) localStorage.setItem(USER_ID_KEY, user.id);
        if (user.email) localStorage.setItem(USER_EMAIL_KEY, user.email);
    }
}

export function isLoggedIn() {
    return Boolean(getStoredUser());
}

export async function callFunction(name, data = {}) {
    const app = await initTCB();
    try {
        const result = await app.callFunction({ name, data });
        return result?.result ?? result;
    } catch (error) {
        throw buildError(error, '云函数调用失败');
    }
}

export async function sendEmailCode(email) {
    const normalizedEmail = normalizeEmail(email);
    const auth = await getAuth();

    try {
        const result = await auth.getVerification({ email: normalizedEmail });
        if (result?.error) {
            throw buildError(result.error, '验证码发送失败');
        }

        const info = result?.data || result;
        if (!info?.verification_id) {
            throw new Error('验证码发送失败：未返回 verification_id');
        }

        writeVerificationInfo({
            email: normalizedEmail,
            verification_id: info.verification_id,
            is_user: Boolean(info.is_user)
        });
        return info;
    } catch (error) {
        throw buildError(error, '验证码发送失败');
    }
}

export async function emailLogin(email, code) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedCode = normalizeCode(code);
    const auth = await getAuth();
    const verificationInfo = readVerificationInfo();

    if (!verificationInfo?.verification_id || verificationInfo.email !== normalizedEmail) {
        throw new Error('请先发送验证码，再完成登录');
    }

    try {
        const result = await auth.signInWithEmail({
            email: normalizedEmail,
            verificationCode: normalizedCode,
            verificationInfo: {
                verification_id: verificationInfo.verification_id,
                is_user: Boolean(verificationInfo.is_user)
            }
        });

        if (result?.error) {
            throw buildError(result.error, '登录失败');
        }

        const user = mapAuthUser(result?.data?.user || result?.user);
        if (!user?.id) {
            throw new Error('登录返回结果不完整');
        }

        saveAuthSession({ token: 'cloudbase-auth-session', user });
        writeVerificationInfo(null);
        return user;
    } catch (error) {
        throw buildError(error, '登录失败');
    }
}

export async function verifyToken() {
    try {
        const auth = await getAuth();
        const result = await auth.getCurrentUser();
        const user = mapAuthUser(result?.user || result?.data?.user || result);
        if (!user?.id) {
            clearAuthStorage();
            return null;
        }
        saveAuthSession({ token: 'cloudbase-auth-session', user });
        return user;
    } catch {
        clearAuthStorage();
        return null;
    }
}

export async function getCurrentUser() {
    const localUser = getStoredUser();
    if (localUser) {
        return localUser;
    }
    return verifyToken();
}

export async function signOut() {
    try {
        const auth = await getAuth();
        await auth.signOut();
    } catch {
        // ignore sign-out SDK errors and still clear local state
    }
    clearAuthStorage();
}

export function getCurrentUserId() {
    return isBrowser() ? localStorage.getItem(USER_ID_KEY) || '' : '';
}

export function getCurrentUserEmail() {
    return isBrowser() ? localStorage.getItem(USER_EMAIL_KEY) || '' : '';
}

export function getTCBEnvId() {
    return ENV_ID;
}
