export const MAX_ACCOUNT_NAME_LENGTH = 20;

export function countAccountNameCharacters(value) {
    return Array.from(String(value || "")).length;
}

export function normalizeAccountName(value) {
    return String(value || "")
        .trim()
        .replace(/^@+/, "");
}

export function getAccountKey(value) {
    return normalizeAccountName(value).toLowerCase();
}

export function validateAccountName(value) {
    const accountName = normalizeAccountName(value);

    if (!accountName) {
        return {
            ok: false,
            message: "アカウント名を入力してください"
        };
    }

    if (countAccountNameCharacters(accountName) > MAX_ACCOUNT_NAME_LENGTH) {
        return {
            ok: false,
            message: `アカウント名は${MAX_ACCOUNT_NAME_LENGTH}文字以内にしてください`
        };
    }

    if (/[\s#/:?&%\u0000-\u001F\u007F]/u.test(accountName)) {
        return {
            ok: false,
            message: "空白や # / : ? & % は使えません"
        };
    }

    return {
        ok: true,
        accountName
    };
}
