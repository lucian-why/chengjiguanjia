const cloud = require('@cloudbase/node-sdk');

const app = cloud.init({ env: cloud.SYMBOL_CURRENT_ENV });
const db = app.database();
const auth = app.auth();
const _ = db.command;

function parseEventPayload(event = {}) {
  if (!event || typeof event !== 'object') return {};
  if (event.queryStringParameters && typeof event.queryStringParameters === 'object' && Object.keys(event.queryStringParameters).length > 0) {
    return event.queryStringParameters;
  }
  if (event.queryString && typeof event.queryString === 'object' && Object.keys(event.queryString).length > 0) {
    return event.queryString;
  }
  if (typeof event.body === 'string' && event.body) {
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;
    try {
      return JSON.parse(rawBody);
    } catch {
      return Object.fromEntries(new URLSearchParams(rawBody));
    }
  }
  if (event.body && typeof event.body === 'object') {
    return event.body;
  }
  return event;
}

async function getCurrentUser(event = {}) {
  const payload = parseEventPayload(event);
  const explicitUid = String(payload.userId || payload.uid || '').trim();
  if (explicitUid) {
    return { code: 0, uid: explicitUid, userInfo: { uid: explicitUid } };
  }

  const userInfo = await auth.getUserInfo();
  const uid = userInfo?.uid || userInfo?.openId || userInfo?.customUserId || '';
  if (!uid) {
    return { code: 401, message: '未获取到当前登录用户，请重新登录' };
  }
  return { code: 0, uid, userInfo };
}

exports.main = async (event = {}) => {
  const payload = parseEventPayload(event);
  let { profileIds } = payload;
  if (typeof profileIds === 'string') {
    try {
      profileIds = JSON.parse(profileIds);
    } catch {
      profileIds = profileIds.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }

  if (!Array.isArray(profileIds) || profileIds.length === 0) {
    return { code: 400, message: '请提供要删除的 profileIds' };
  }

  try {
    const current = await getCurrentUser(payload);
    if (current.code !== 0) {
      return current;
    }

    const result = await db.collection('cloud_profiles')
      .where({
        userId: current.uid,
        profileId: _.in(profileIds)
      })
      .remove();

    return {
      code: 0,
      message: '云端档案删除成功',
      data: {
        count: result.deleted || result.stats?.removed || profileIds.length
      }
    };
  } catch (error) {
    console.error('[deleteCloudProfiles] error:', error);
    return { code: 500, message: '删除云端档案失败：' + (error.message || '未知错误') };
  }
};
