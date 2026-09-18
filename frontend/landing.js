document.addEventListener("DOMContentLoaded", () => {
    const root = document.documentElement;

    // Load saved theme
    const savedTheme = localStorage.getItem("chatbee-theme");

    if (savedTheme) {
        root.dataset.theme = savedTheme;
    } else {
        root.dataset.theme =
            window.matchMedia("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light";
    }

    // Theme button
    const themeToggle = document.getElementById("themeToggle");

    if (themeToggle) {
        themeToggle.addEventListener("click", () => {
            const newTheme =
                root.dataset.theme === "dark"
                    ? "light"
                    : "dark";

            root.dataset.theme = newTheme;

            localStorage.setItem(
                "chatbee-theme",
                newTheme
            );
        });
    }

    // Mobile menu
    const links = document.getElementById("links");
    const burger = document.getElementById("burger");

    if (burger && links) {
        burger.addEventListener("click", () => {
            links.classList.toggle("open");
        });

        links.querySelectorAll("a").forEach((a) => {
            a.addEventListener("click", () => {
                links.classList.remove("open");
            });
        });
    }

    // Smooth scrolling
    document.documentElement.style.scrollBehavior = "smooth";
});