export function formatMessageTime(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const hourMinute = date.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit"
    });

    if (date.toDateString() === now.toDateString()) {
        return hourMinute;
    }

    if (date.toDateString() === yesterday.toDateString()) {
        return `昨日 ${hourMinute}`;
    }

    if (date.getFullYear() === now.getFullYear()) {
        return `${date.getMonth() + 1}/${date.getDate()} ${hourMinute}`;
    }

    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${hourMinute}`;
}
