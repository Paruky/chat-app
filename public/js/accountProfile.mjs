import { normalizeAccountName, validateAccountName } from "./accountNames.mjs";

async function readJsonResponse(response) {
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.ok === false) {
        throw new Error(data.message || "プロフィールを更新できませんでした");
    }

    return data;
}

function createAuthHeaders(accessToken) {
    return {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
    };
}

export function normalizeProfileResponse(data) {
    const profile = data?.profile || {};
    const fallback = data?.fallback || {};
    const accountName = normalizeAccountName(profile.accountName || fallback.accountName);

    return {
        accountName,
        accountKey: profile.accountKey || fallback.accountKey || accountName.toLowerCase(),
        displayName: profile.displayName || fallback.displayName || accountName || "ユーザー",
        avatarUrl: profile.avatarUrl || fallback.avatarUrl || "",
        fallbackAccountName: normalizeAccountName(fallback.accountName || ""),
        needsAccountName: data?.needsAccountName !== false || !accountName
    };
}

export async function fetchAccountProfile(accessToken) {
    const response = await fetch("/api/profile", {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    return normalizeProfileResponse(await readJsonResponse(response));
}

export async function saveAccountProfile(accountName, accessToken) {
    const validation = validateAccountName(accountName);

    if (!validation.ok) {
        throw new Error(validation.message);
    }

    const response = await fetch("/api/profile", {
        method: "PUT",
        headers: createAuthHeaders(accessToken),
        body: JSON.stringify({
            accountName: validation.accountName
        })
    });

    return normalizeProfileResponse(await readJsonResponse(response));
}
