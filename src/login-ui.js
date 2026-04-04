import { sendMagicLink } from './auth.js';

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
                <p class="login-subtitle">登录后可启用云端保存与多端同步</p>
                <div class="login-method-note">当前阶段使用邮箱魔法链接登录，适合先完成本地联调与云端验证</div>
                <div class="login-form">
                    <label class="login-label" for="loginEmailInput">邮箱</label>
                    <input id="loginEmailInput" class="login-input" type="email" placeholder="请输入常用邮箱地址" maxlength="100" />
                    <button id="sendMagicLinkBtn" class="login-secondary-btn login-block-btn" type="button">发送魔法链接</button>
                    <button id="loginSubmitBtn" class="login-primary-btn" type="button">登录</button>
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

async function handleSendMagicLink() {
    const email = document.getElementById('loginEmailInput')?.value || '';
    try {
        setStatus('正在发送魔法链接…', 'pending');
        await sendMagicLink(email);
        setStatus('魔法链接已发送，请去邮箱中点击登录链接，然后回到当前页面。', 'success');
    } catch (error) {
        setStatus(error.message || '发送失败，请稍后重试。', 'error');
    }
}

async function handleLogin() {
    await handleSendMagicLink();
}

function bindUiEvents() {
    if (uiBound) return;

    const overlay = document.getElementById('loginPage');
    const sendBtn = document.getElementById('sendMagicLinkBtn');
    const submitBtn = document.getElementById('loginSubmitBtn');
    const emailInput = document.getElementById('loginEmailInput');
    const logoutBtn = document.getElementById('authLogoutBtn');
    const closeBtn = document.getElementById('loginCloseBtn');
    const cancelBtn = document.getElementById('loginCancelBtn');
    const dismiss = () => hideLoginPage();

    sendBtn?.addEventListener('click', handleSendMagicLink);
    submitBtn?.addEventListener('click', handleLogin);
    emailInput?.addEventListener('keydown', (event) => {
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
        value.textContent = user?.email || user?.phone || '已登录';
    }
    authBar?.classList.remove('hidden');
}

export function clearAuthStatus() {
    const authBar = document.getElementById('authStatusBar');
    authBar?.classList.add('hidden');
}
