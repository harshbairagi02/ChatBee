const $ = (id) => document.getElementById(id);

const els = {
    messages: $("messages"),
    welcome: $("welcome"),
    input: $("input"),
    send: $("send"),
    history: $("history"),
    title: $("chatTitle"),
    sidebar: $("sidebar"),
    scrim: $("scrim")
};

// ==========================================
// CHAT STORAGE
// ==========================================

let chats = JSON.parse(
    localStorage.getItem("chatbee-chats") || "[]"
);

let current = null;
let isLoading = false;

// ==========================================
// BACKEND
// ==========================================

const API_URL = "http://localhost:3000/api/chat";

// ==========================================
// SAVE CHATS
// ==========================================

const save = () => {
    localStorage.setItem(
        "chatbee-chats",
        JSON.stringify(chats)
    );
};

// ==========================================
// ADD MESSAGE
// ==========================================

function addMessage(role, text) {

    const row = document.createElement("div");

    row.className = `msg ${role}`;

    if (role === "bot") {

        const bee = document.createElement("span");

        bee.className = "hex";
        bee.textContent = "🐝";

        row.appendChild(bee);
    }

    const bubble = document.createElement("div");

    bubble.className = "bubble";
    bubble.textContent = text;

    row.appendChild(bubble);

    els.messages.appendChild(row);

    els.messages.scrollTop =
        els.messages.scrollHeight;

    return row;
}

// ==========================================
// TYPING INDICATOR
// ==========================================

function showTyping() {

    const row = addMessage("bot", "");

    const bubble =
        row.querySelector(".bubble");

    bubble.innerHTML = `
        <div class="typing">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;

    return row;
}

// ==========================================
// RENDER CHAT HISTORY
// ==========================================

function renderHistory() {

    els.history.innerHTML =
        chats.length
            ? ""
            : '<p class="empty">No chats yet</p>';

    chats.forEach((chat) => {

        const button =
            document.createElement("button");

        button.textContent =
            chat.title;

        button.className =
            chat === current
                ? "active"
                : "";

        button.onclick = () => {
            if (isLoading) return;

            openChat(chat);
        };

        els.history.appendChild(button);
    });
}

// ==========================================
// OPEN CHAT
// ==========================================

function openChat(chat) {

    current = chat;

    els.messages.innerHTML = "";

    if (
        !chat ||
        !chat.messages ||
        chat.messages.length === 0
    ) {

        els.messages.appendChild(
            els.welcome
        );

    } else {

        chat.messages.forEach((message) => {

            addMessage(
                message.role,
                message.text
            );

        });
    }

    els.title.textContent =
        chat
            ? chat.title
            : "New chat";

    renderHistory();

    closeMenu();
}

// ==========================================
// STREAM AI RESPONSE
// ==========================================

async function getBotReply(history, bubble) {

    const response =
        await fetch(API_URL, {

            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify({

                messages: history.map(
                    (message) => ({

                        role:
                            message.role === "bot"
                                ? "assistant"
                                : "user",

                        content:
                            message.text

                    })
                )

            })

        });

    // ======================================
    // SERVER ERROR
    // ======================================

    if (!response.ok) {

        let errorMessage =
            `Server error: ${response.status}`;

        try {

            const data =
                await response.json();

            if (data.error) {
                errorMessage =
                    data.error;
            }

        } catch {}

        throw new Error(errorMessage);
    }

    // ======================================
    // STREAM CHECK
    // ======================================

    if (!response.body) {

        throw new Error(
            "Streaming is not supported by this browser."
        );
    }

    const reader =
        response.body.getReader();

    const decoder =
        new TextDecoder("utf-8");

    let buffer = "";
    let fullReply = "";

    // ======================================
    // READ STREAM
    // ======================================

    while (true) {

        const {
            value,
            done
        } = await reader.read();

        if (done) break;

        buffer += decoder.decode(
            value,
            {
                stream: true
            }
        );

        const events =
            buffer.split("\n\n");

        buffer =
            events.pop();

        for (const event of events) {

            const lines =
                event.split("\n");

            const dataLine =
                lines.find(
                    (line) =>
                        line.startsWith("data:")
                );

            if (!dataLine) continue;

            const jsonText =
                dataLine
                    .substring(5)
                    .trim();

            if (!jsonText) continue;

            let data;

            try {

                data =
                    JSON.parse(jsonText);

            } catch {

                continue;
            }

            // ==================================
            // AI TEXT
            // ==================================

            if (
                data.type === "chunk"
            ) {

                fullReply +=
                    data.text;

                bubble.textContent =
                    fullReply;

                els.messages.scrollTop =
                    els.messages.scrollHeight;
            }

            // ==================================
            // ERROR
            // ==================================

            if (
                data.type === "error"
            ) {

                throw new Error(
                    data.error ||
                    "AI request failed."
                );
            }
        }
    }

    return fullReply;
}

// ==========================================
// SEND MESSAGE
// ==========================================

async function send(text) {

    text = text.trim();

    if (!text || isLoading) return;

    isLoading = true;

    els.send.disabled = true;

    // ======================================
    // CREATE CHAT
    // ======================================

    if (!current) {

        current = {

            id: Date.now(),

            title:
                text.length > 40
                    ? text.slice(0, 40) + "..."
                    : text,

            messages: []

        };

        chats.unshift(current);

        els.title.textContent =
            current.title;
    }

    // ======================================
    // REMOVE WELCOME
    // ======================================

    if (els.welcome.parentNode) {
        els.welcome.remove();
    }

    // ======================================
    // USER MESSAGE
    // ======================================

    current.messages.push({

        role: "user",

        text: text

    });

    addMessage(
        "user",
        text
    );

    // ======================================
    // CLEAR INPUT
    // ======================================

    els.input.value = "";

    resize();

    renderHistory();

    save();

    // ======================================
    // TYPING
    // ======================================

    const typing =
        showTyping();

    try {

        const bubble =
            typing.querySelector(
                ".bubble"
            );

        // ==================================
        // STREAM RESPONSE
        // ==================================

        const reply =
            await getBotReply(
                current.messages,
                bubble
            );

        // ==================================
        // REMOVE TYPING MESSAGE
        // ==================================

        typing.remove();

        const finalReply =
            reply.trim() ||
            "I didn't receive a response.";

        // ==================================
        // SAVE AI RESPONSE
        // ==================================

        current.messages.push({

            role: "bot",

            text: finalReply

        });

        addMessage(
            "bot",
            finalReply
        );

        save();

    } catch (error) {

        console.error(
            "ChatBee error:",
            error
        );

        typing.remove();

        const errorText =
            error.message ||
            "Something went wrong while contacting the server.";

        current.messages.push({

            role: "bot",

            text: errorText

        });

        addMessage(
            "bot",
            errorText
        );

        save();
    }

    // ======================================
    // FINISH
    // ======================================

    isLoading = false;

    els.send.disabled =
        !els.input.value.trim();

    els.input.focus();
}

// ==========================================
// INPUT RESIZE
// ==========================================

function resize() {

    els.input.style.height =
        "auto";

    els.input.style.height =
        Math.min(
            els.input.scrollHeight,
            160
        ) + "px";

    els.send.disabled =
        !els.input.value.trim() ||
        isLoading;
}

// ==========================================
// INPUT
// ==========================================

els.input.addEventListener(
    "input",
    resize
);

// ==========================================
// ENTER TO SEND
// ==========================================

els.input.addEventListener(
    "keydown",
    (e) => {

        if (
            e.key === "Enter" &&
            !e.shiftKey
        ) {

            e.preventDefault();

            send(
                els.input.value
            );
        }
    }
);

// ==========================================
// SEND BUTTON
// ==========================================

els.send.onclick = () => {

    send(
        els.input.value
    );
};

// ==========================================
// SUGGESTION CHIPS
// ==========================================

document
    .querySelectorAll(".chips button")
    .forEach((button) => {

        button.onclick = () => {

            send(
                button.dataset.prompt
            );
        };

    });

// ==========================================
// NEW CHAT
// ==========================================

$("newChat").onclick = () => {

    if (isLoading) return;

    openChat(null);
};

// ==========================================
// MOBILE MENU
// ==========================================

const closeMenu = () => {

    els.sidebar.classList.remove(
        "open"
    );

    els.scrim.classList.remove(
        "show"
    );
};

$("menuBtn").onclick = () => {

    els.sidebar.classList.add(
        "open"
    );

    els.scrim.classList.add(
        "show"
    );
};

els.scrim.onclick =
    closeMenu;

// ==========================================
// THEME
// ==========================================

const root =
    document.documentElement;

root.dataset.theme =
    localStorage.getItem(
        "chatbee-theme"
    ) ||
    (
        matchMedia(
            "(prefers-color-scheme: dark)"
        ).matches
            ? "dark"
            : "light"
    );

$("themeToggle").onclick = () => {

    root.dataset.theme =
        root.dataset.theme === "dark"
            ? "light"
            : "dark";

    localStorage.setItem(
        "chatbee-theme",
        root.dataset.theme
    );
};

// ==========================================
// START
// ==========================================

renderHistory();