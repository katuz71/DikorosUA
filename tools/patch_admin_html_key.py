from pathlib import Path

p = Path("admin.html")
s = p.read_text(encoding="utf-8")

marker = "</head>"

snippet = r'''
<script>
(function () {
    const STORAGE_KEY = "dikoros_admin_api_key";
    const originalFetch = window.fetch.bind(window);

    function getAdminKey() {
        let key = localStorage.getItem(STORAGE_KEY) || "";
        if (!key) {
            key = window.prompt("Введите ADMIN_API_KEY для админки") || "";
            if (key) {
                localStorage.setItem(STORAGE_KEY, key);
            }
        }
        return key;
    }

    window.resetAdminApiKey = function () {
        localStorage.removeItem(STORAGE_KEY);
        alert("ADMIN_API_KEY удалён. Обновите страницу и введите ключ заново.");
    };

    window.fetch = function (input, init) {
        init = init || {};

        const url = typeof input === "string" ? input : input && input.url;
        const isSameOrigin =
            !url ||
            url.startsWith("/") ||
            url.startsWith(window.location.origin);

        if (isSameOrigin) {
            const key = getAdminKey();
            if (key) {
                const headers = new Headers(init.headers || {});
                headers.set("X-Admin-Key", key);
                init.headers = headers;
            }
        }

        return originalFetch(input, init).then(function (response) {
            if (response.status === 403) {
                localStorage.removeItem(STORAGE_KEY);
                alert("Доступ запрещён. Введите правильный ADMIN_API_KEY.");
            }
            return response;
        });
    };
})();
</script>
'''

if "dikoros_admin_api_key" in s:
    raise SystemExit("admin key helper already exists")

if marker not in s:
    raise SystemExit("</head> not found")

s = s.replace(marker, snippet + "\n" + marker)
p.write_text(s, encoding="utf-8")

print("OK: added admin API key helper")
