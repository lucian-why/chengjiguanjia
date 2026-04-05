import { sendEmailCode, emailLogin } from './auth.js';

let onLoginSuccess = null;
let onLogout = null;
let uiBound = false;

function ensureLoginUi() {
    let overlay = document.getElementById('loginPage');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loginPage';
        overlay.className = 'login-page hidden';
        overlay.innerHTML = `
            <div class="login-card">
                <button type="button" class="login-close-btn" id="loginCloseBtn" aria-label="关闭登录">×</button>
                <div class="login-logo">成绩雷达</div>
                <p class="login-subtitle">登录后可启用云端备份与多端同步</p>
                <div class="login-method-note">当前阶段使用腾讯云邮箱验证码登录，后续再补密码登录和微信登录</div>
                <div class="login-form">
                    <label class="login-label" for="loginEmailInput">邮箱</label>
                    <input id="loginEmailInput" class="login-input" type="email" placeholder="请输入常用邮箱地址" maxlength="100" />
                    <label class="login-label" for="loginCodeInput">验证码</label>
                    <div class="login-inline-row">
                        <input id="loginCodeInput" class="login-input" type="text" inputmode="numeric" placeholder="请输入 6 位验证码" maxlength="6" />
                        <button id="sendEmailCodeBtn" class="login-secondary-btn" type="button">发送验证码</button>
                    </div>
                    <button id="loginSubmitBtn" class="login-primary-btn" type="button">验证码登录</button>
                    <button id="loginCancelBtn" class="login-ghost-btn" type="button">暂不登录，返回页面</button>
                    <div id="loginStatus" class="login-status"></div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    let authBar = document.getElementById('authStatusBar');
    if (!authBar) {
        authBar = document.createElement('div');
        authBar.id = 'authStatusBar';
        authBar.className = 'auth-status-bar hidden';
        authBar.innerHTML = `
            <div class="auth-status-main">
                <span class="auth-status-label">云端账户</span>
                <span class="auth-status-value" id="authStatusValue">未登录</span>
            </div>
            <button type="button" id="authLogoutBtn" class="auth-logout-btn">退出</button>
        `;
        const sidebarHeader = document.querySelector('.sidebar-header');
        sidebarHeader?.appendChild(authBar);
    }

    bindUiEvents();
    return overlay;
}

function setStatus(message = '', type = '') {
    const status = document.getElementById('loginStatus');
    if (!status) return;
    status.textContent = message;
    status.dataset.type = type;
}

async function handleSendEmailCode() {
    const email = document.getElementById('loginEmailInput')?.value || '';
    try {
        setStatus('正在发送验证码…', 'pending');
        await sendEmailCode(email);
        setStatus('验证码已发送，请查收邮箱后输入 6 位验证码。', 'success');
    } catch (error) {
        setStatus(error.message || '发送失败，请稍后重试。', 'error');
    }
}

async function handleLogin() {
    const email = document.getElementById('loginEmailInput')?.value || '';
    const code = (document.getElementById('loginCodeInput')?.value || '').trim();

    try {
        setStatus('正在登录…', 'pending');
        const result = await emailLogin(email, code);
        setStatus('登录成功，正在进入云端同步…', 'success');
        if (onLoginSuccess) {
            await onLoginSuccess(result?.user || null);
        }
    } catch (error) {
        setStatus(error.message || '登录失败，请稍后重试。', 'error');
    }
}

function bindUiEvents() {
    if (uiBound) return;

    const overlay = document.getElementById('loginPage');
    const sendBtn = document.getElementById('sendEmailCodeBtn');
    const submitBtn = document.getElementById('loginSubmitBtn');
    const emailInput = document.getElementById('loginEmailInput');
    const codeInput = document.getElementById('loginCodeInput');
    const logoutBtn = document.getElementById('authLogoutBtn');
    const closeBtn = document.getElementById('loginCloseBtn');
    const cancelBtn = document.getElementById('loginCancelBtn');
    const dismiss = () => hideLoginPage();

    sendBtn?.addEventListener('click', handleSendEmailCode);
    submitBtn?.addEventListener('click', handleLogin);
    emailInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleSendEmailCode();
        }
    });
    codeInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleLogin();
        }
    });
    closeBtn?.addEventListener('click', dismiss);
    cancelBtn?.addEventListener('click', dismiss);
    overlay?.addEventListener('click', (event) => {
        if (event.target === overlay) {
            dismiss();
        }
    });
    overlay?.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            dismiss();
        }
    });
    logoutBtn?.addEventListener('click', async () => {
        if (onLogout) {
            await onLogout();
        }
    });

    uiBound = true;
}

export function setLoginSuccessHandler(handler) {
    onLoginSuccess = handler;
}

export function setLogoutHandler(handler) {
    onLogout = handler;
}

export function showLoginPage(message = '') {
    const overlay = ensureLoginUi();
    overlay.classList.remove('hidden');
    document.body.classList.add('auth-locked');
    if (message) {
        setStatus(message, 'info');
    } else {
        setStatus('');
    }
}

export function hideLoginPage() {
    const overlay = ensureLoginUi();
    overlay.classList.add('hidden');
    document.body.classList.remove('auth-locked');
    setStatus('');
}

export function renderAuthStatus(user) {
    ensureLoginUi();
    const authBar = document.getElementById('authStatusBar');
    const value = document.getElementById('authStatusValue');
    if (value) {
        value.textContent = user?.email || '已登录';
    }
    authBar?.classList.remove('hidden');
}

export function clearAuthStatus() {
    const authBar = document.getElementById('authStatusBar');
    authBar?.classList.add('hidden');
}
