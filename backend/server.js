const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const Groq = require("groq-sdk");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());
app.use(express.json());

// ==========================================
// GROQ
// ==========================================

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// ==========================================
// TEST ROUTE
// ==========================================

app.get("/", (req, res) => {
    res.json({
        message: "CHATBEE AI SERVER",
        ai: "Groq",
        status: "running"
    });
});

// ==========================================
// CHAT API
// ==========================================

app.post("/api/chat", async (req, res) => {

    try {

        const messages = req.body.messages || [];

        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                error: "No messages received."
            });
        }

        // Keep only recent messages.
        // This reduces input processing time.
        const recentMessages = messages.slice(-8);

        // ==========================================
        // SYSTEM MESSAGE
        // ==========================================

        const systemMessage = {
            role: "system",
            content: `
You are ChatBee AI, a helpful, intelligent and friendly AI assistant.

Give clear and useful answers.

For technical questions:
- Explain step by step.
- Give working code when requested.
- Prefer complete code over incomplete snippets.
- Use simple language when the user asks for easy explanations.

For educational questions:
- Explain concepts clearly.
- Use examples where useful.
- Focus on exam-oriented information when appropriate.

Do not unnecessarily repeat the user's question.

Keep answers reasonably concise unless the user asks for detailed information.
            `.trim()
        };

        // ==========================================
        // STREAMING HEADERS
        // ==========================================

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");

        // ==========================================
        // GROQ STREAM
        // ==========================================

        const stream = await groq.chat.completions.create({

            model: "openai/gpt-oss-20b",

            messages: [
                systemMessage,
                ...recentMessages
            ],

            temperature: 0.5,

            max_completion_tokens: 1024,

            stream: true
        });

        // ==========================================
        // SEND TOKENS TO FRONTEND
        // ==========================================

        for await (const chunk of stream) {

            const text =
                chunk.choices?.[0]?.delta?.content || "";

            if (text) {

                res.write(
                    `data: ${JSON.stringify({
                        type: "chunk",
                        text: text
                    })}\n\n`
                );

            }
        }

        // ==========================================
        // FINISHED
        // ==========================================

        res.write(
            `data: ${JSON.stringify({
                type: "done"
            })}\n\n`
        );

        res.end();

    } catch (error) {

        console.error("Groq Error:", error);

        if (!res.headersSent) {

            return res.status(500).json({
                error:
                    error.message ||
                    "Groq AI request failed."
            });

        }

        res.write(
            `data: ${JSON.stringify({
                type: "error",
                error:
                    error.message ||
                    "Groq AI request failed."
            })}\n\n`
        );

        res.end();
    }
});

// ==========================================
// START SERVER
// ==========================================

const port = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {

    console.log("");
    console.log("====================================");
    console.log("       CHATBEE AI SERVER");
    console.log("====================================");
    console.log(`Server running on port ${PORT}`);
    console.log("AI Model: Groq GPT-OSS 20B");
    console.log("Streaming: ENABLED");
    console.log("====================================");
    console.log("");

});