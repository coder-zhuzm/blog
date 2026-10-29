(function () {
  const storageKey = "theme";
  const root = document.documentElement;

  const getThemePreference = () => {
    const saved = localStorage.getItem(storageKey);
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  };

  const applyTheme = theme => {
    root.setAttribute("data-theme", theme);
    localStorage.setItem(storageKey, theme);
    const metaThemeColor = document.querySelector("meta[name='theme-color']");
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", theme === "dark" ? "#212737" : "#fdfdfd");
    }
  };

  applyTheme(getThemePreference());

  window.__toggleTheme = function () {
    const current = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
    applyTheme(current === "dark" ? "light" : "dark");
  };
})();
