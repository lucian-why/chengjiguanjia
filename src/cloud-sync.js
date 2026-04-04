import { getCurrentUser, getSupabaseClient, isAuthEnabled } from './auth.js';
import { getAllLocalProfileBundles, getLocalProfileBundle, applyCloudProfileBundle } from './storage.js';

const CLOUD_TABLE = 'cloud_profiles';

function ensureCloudReady() {
    if (!isAuthEnabled()) {
        throw new Error('当前环境未启用云端登录');
    }

    const client = getSupabaseClient();
    if (!client) {
        throw new Error('云端服务尚未初始化');
    }

    return client;
}

function formatSupabaseError(error, fallback) {
    const message = error?.message || fallback;
    if (/cloud_profiles/i.test(message)) {
        return '云端同步表尚未创建，请先在 Supabase 中创建 cloud_profiles 表';
    }
    return message;
}

function estimateBundleSize(bundle) {
    return new TextEncoder().encode(JSON.stringify(bundle)).length;
}

function toCloudSummary(row) {
    return {
        id: row.id,
        profileId: row.profile_id,
        profileName: row.profile_name,
        examCount: row.exam_count || 0,
        dataSize: row.data_size || 0,
        lastSyncAt: row.last_sync_at || row.updated_at || row.created_at,
        bundle: row.profile_data
    };
}

export async function getCloudProfiles() {
    const client = ensureCloudReady();
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('请先登录后再使用云端同步');
    }

    const { data, error } = await client
        .from(CLOUD_TABLE)
        .select('id, profile_id, profile_name, exam_count, data_size, last_sync_at, updated_at, created_at, profile_data')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

    if (error) {
        throw new Error(formatSupabaseError(error, '获取云端档案失败'));
    }

    return (data || []).map(toCloudSummary);
}

export async function getCloudProfileData(profileId) {
    const client = ensureCloudReady();
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('请先登录后再使用云端同步');
    }

    const { data, error } = await client
        .from(CLOUD_TABLE)
        .select('*')
        .eq('user_id', user.id)
        .eq('profile_id', profileId)
        .limit(1)
        .maybeSingle();

    if (error) {
        throw new Error(formatSupabaseError(error, '获取云端档案详情失败'));
    }

    return data ? toCloudSummary(data) : null;
}

async function upsertCloudProfileRow(userId, payload) {
    const client = ensureCloudReady();
    const existing = await getCloudProfileData(payload.profile_id);

    if (existing?.id) {
        const { error } = await client
            .from(CLOUD_TABLE)
            .update({
                profile_name: payload.profile_name,
                profile_data: payload.profile_data,
                exam_count: payload.exam_count,
                data_size: payload.data_size,
                last_sync_at: payload.last_sync_at
            })
            .eq('id', existing.id)
            .eq('user_id', userId);

        if (error) {
            throw new Error(formatSupabaseError(error, '更新云端档案失败'));
        }

        return existing.id;
    }

    const { data, error } = await client
        .from(CLOUD_TABLE)
        .insert({ ...payload, user_id: userId })
        .select('id')
        .single();

    if (error) {
        throw new Error(formatSupabaseError(error, '创建云端档案失败'));
    }

    return data.id;
}

export async function uploadProfile(profileId) {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('请先登录后再使用云端同步');
    }

    const localBundle = getLocalProfileBundle(profileId);
    if (!localBundle) {
        throw new Error('未找到要备份的本地档案');
    }

    const syncTime = new Date().toISOString();
    await upsertCloudProfileRow(user.id, {
        profile_id: localBundle.profileId,
        profile_name: localBundle.profileName,
        profile_data: localBundle.bundle,
        exam_count: localBundle.examCount,
        data_size: estimateBundleSize(localBundle.bundle),
        last_sync_at: syncTime
    });

    return {
        profileId: localBundle.profileId,
        profileName: localBundle.profileName,
        examCount: localBundle.examCount,
        lastSyncAt: syncTime
    };
}

export async function downloadProfiles(profileIds = []) {
    const cloudProfiles = await Promise.all(profileIds.map(profileId => getCloudProfileData(profileId)));
    const validProfiles = cloudProfiles.filter(Boolean);

    validProfiles.forEach(profile => {
        applyCloudProfileBundle(profile.bundle || profile.profile_data || profile);
    });

    return validProfiles;
}

export async function deleteCloudProfiles(profileIds = []) {
    const client = ensureCloudReady();
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('请先登录后再使用云端同步');
    }
    if (!profileIds.length) return 0;

    const { error, count } = await client
        .from(CLOUD_TABLE)
        .delete({ count: 'exact' })
        .eq('user_id', user.id)
        .in('profile_id', profileIds);

    if (error) {
        throw new Error(formatSupabaseError(error, '删除云端档案失败'));
    }

    return count || profileIds.length;
}

export function compareProfiles(localProfiles = getAllLocalProfileBundles(), cloudProfiles = []) {
    const cloudMap = new Map(cloudProfiles.map(item => [item.profileId, item]));

    return localProfiles.map(local => {
        const cloud = cloudMap.get(local.profileId);
        let status = 'local-only';
        if (cloud) {
            status = cloud.examCount === local.examCount && cloud.dataSize === local.dataSize ? 'synced' : 'different';
        }

        return {
            profileId: local.profileId,
            profileName: local.profileName,
            localExamCount: local.examCount,
            localDataSize: local.dataSize,
            cloudExamCount: cloud?.examCount || 0,
            cloudDataSize: cloud?.dataSize || 0,
            cloudLastSyncAt: cloud?.lastSyncAt || null,
            status
        };
    });
}

export function getLocalProfileSummaries() {
    return getAllLocalProfileBundles().map(bundle => ({
        profileId: bundle.profileId,
        profileName: bundle.profileName,
        examCount: bundle.examCount,
        dataSize: bundle.dataSize
    }));
}
