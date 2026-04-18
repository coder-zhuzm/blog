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
  };

  applyTheme(getThemePreference());

  window.__toggleTheme = function () {
    const current = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
    applyTheme(current === "dark" ? "light" : "dark");
  };
})();
