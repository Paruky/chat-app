const MAX_ACCOUNT_NAME_LENGTH = 20;

function countCharacters(value) {
    return Array.from(String(value || "")).length;
}

function normalizeAccountName(value) {
    return String(value || "")
        .trim()
        .replace(/^@+/, "");
}

function getAccountKey(value) {
    return normalizeAccountName(value).toLowerCase();
}

function createAccountNameError(message, code = "invalid-account-name") {
    const error = new Error(message);
    error.code = code;
    return error;
}

function validateAccountName(value) {
    const accountName = normalizeAccountName(value);

    if (!accountName) {
        throw createAccountNameError("アカウント名を入力してください");
    }

    if (countCharacters(accountName) > MAX_ACCOUNT_NAME_LENGTH) {
        throw createAccountNameError(`アカウント名は${MAX_ACCOUNT_NAME_LENGTH}文字以内にしてください`);
    }

    if (/[\s#/:?&%\u0000-\u001F\u007F]/u.test(accountName)) {
        throw createAccountNameError("空白や # / : ? & % は使えません");
    }

    return accountName;
}

module.exports = {
    MAX_ACCOUNT_NAME_LENGTH,
    getAccountKey,
    normalizeAccountName,
    validateAccountName
};
