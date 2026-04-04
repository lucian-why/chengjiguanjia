import { createClient } from '@supabase/supabase-js';

let supabase = null;
let initialized = false;
let authEnabled = false;

function hasAuthConfig() {
    return Boolean(
        import.meta.env.VITE_SUPABASE_URL &&
        import.meta.env.VITE_SUPABASE_ANON_KEY &&
        import.meta.env.VITE_ENABLE_AUTH !== 'false'
    );
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

async function ensureUserRow(user) {
    if (!supabase || !user) return;

    const payload = {
        id: user.id,
        openid: user.app_metadata?.provider === 'wechat' ? (user.user_metadata?.openid || null) : null,
        phone: user.phone || null,
        nickname: user.user_metadata?.nickname || user.email || '成绩雷达用户',
        avatar_url: user.user_metadata?.avatar_url || null
    };

    const { error } = await supabase
        .from('users')
        .upsert(payload, { onConflict: 'id' });

    if (error) {
        console.warn('[auth] 同步 users 表失败：', error.message);
    }
}

export function initSupabase() {
    if (initialized) {
        return supabase;
    }

    initialized = true;
    authEnabled = hasAuthConfig();

    if (!authEnabled) {
        return null;
    }

    supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        }
    );

    return supabase;
}

export function isAuthEnabled() {
    return authEnabled;
}

export function getSupabaseClient() {
    return supabase || initSupabase();
}

export async function getCurrentUser() {
    const client = getSupabaseClient();
    if (!client) return null;

    const { data, error } = await client.auth.getUser();
    if (error) {
        console.warn('[auth] 获取当前用户失败：', error.message);
        return null;
    }

    if (data.user) {
        await ensureUserRow(data.user);
    }

    return data.user || null;
}

export async function sendMagicLink(email) {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('当前环境未启用登录');
    }

    const normalizedEmail = normalizeEmail(email);
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await client.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
            emailRedirectTo: redirectTo,
            shouldCreateUser: true
        }
    });

    if (error) {
        throw error;
    }

    return { email: normalizedEmail };
}

export async function signOut() {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) throw error;
}

export function onAuthStateChange(callback) {
    const client = getSupabaseClient();
    if (!client) {
        return () => {};
    }

    const { data } = client.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
            await ensureUserRow(session.user);
        }
        if (callback) {
            callback(event, session);
        }
    });

    return () => data.subscription.unsubscribe();
}
