export const THEMES = [
    {
        value: "dark",
        name: "Dark",
        colors: ["#1e1e1e", "#222222", "#007aff"]
    },
    {
        value: "light",
        name: "Light",
        colors: ["#f4f6fb", "#ffffff", "#2563eb"]
    },
    {
        value: "line",
        name: "LINE風",
        colors: ["#eaf6e8", "#ffffff", "#06c755"]
    },
    {
        value: "midnight",
        name: "Midnight",
        colors: ["#101624", "#1d2738", "#38bdf8"]
    },
    {
        value: "sakura",
        name: "Sakura",
        colors: ["#fff4f7", "#ffffff", "#ff6b9a"]
    },
    {
        value: "cyber",
        name: "Cyber",
        colors: ["#09090f", "#171927", "#7c3aed"]
    }
];

export const DEFAULT_SETTINGS = {
    unreadBadges: true,
    pushNotifications: false,
    theme: "dark",
    compactMode: false
};

const THEME_VALUES = new Set(THEMES.map((theme) => theme.value));

export function normalizeSettings(settings) {
    const nextSettings = {
        ...DEFAULT_SETTINGS,
        ...(settings || {})
    };

    nextSettings.unreadBadges = nextSettings.unreadBadges !== false;
    nextSettings.pushNotifications = nextSettings.pushNotifications === true;
    nextSettings.compactMode = nextSettings.compactMode === true;

    if (!THEME_VALUES.has(nextSettings.theme)) {
        nextSettings.theme = DEFAULT_SETTINGS.theme;
    }

    return nextSettings;
}

export function applySettings(settings) {
    document.documentElement.dataset.theme = settings.theme;
    document.body.classList.toggle("compact-mode", settings.compactMode);
}

export function setupSettingsPanel(options) {
    const {
        elements,
        settings,
        onChange
    } = options;

    function emitChange(patch) {
        onChange(normalizeSettings({
            ...settings.current,
            ...patch
        }));
    }

    function renderThemeOptions() {
        elements.themeOptions.replaceChildren();

        THEMES.forEach((theme) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "theme-option";
            button.dataset.themeValue = theme.value;
            button.setAttribute("aria-pressed", String(theme.value === settings.current.theme));

            if (theme.value === settings.current.theme) {
                button.classList.add("active");
            }

            const swatches = document.createElement("span");
            swatches.className = "theme-swatches";

            theme.colors.forEach((color) => {
                const swatch = document.createElement("span");
                swatch.className = "theme-swatch";
                swatch.style.background = color;
                swatches.appendChild(swatch);
            });

            const name = document.createElement("span");
            name.className = "theme-name";
            name.textContent = theme.name;

            button.append(swatches, name);
            button.addEventListener("click", () => emitChange({ theme: theme.value }));
            elements.themeOptions.appendChild(button);
        });
    }

    function syncControls() {
        elements.unreadBadgesToggle.checked = settings.current.unreadBadges;
        elements.compactModeToggle.checked = settings.current.compactMode;
        renderThemeOptions();
    }

    elements.unreadBadgesToggle.addEventListener("change", () => {
        emitChange({ unreadBadges: elements.unreadBadgesToggle.checked });
    });

    elements.compactModeToggle.addEventListener("change", () => {
        emitChange({ compactMode: elements.compactModeToggle.checked });
    });

    syncControls();

    return {
        syncControls
    };
}
