const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const TELEGRAM_TOKEN = '7742484652:AAEUJBUh0BM93n_IfPY1VcCXq27TL9HUMBc';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const WEBHOOK_URL = 'https://get-url-o0dy.onrender.com/bot';
const GROUP_CHAT_ID = -1002392864802;

// Telegram message sender
async function sendMessage(chatId, text, markdown = false) {
    try {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text,
            parse_mode: markdown ? 'Markdown' : undefined
        });
    } catch (err) {
        console.error('❌ Telegram sendMessage error:', err.message);
    }
}

// Fetch pinned message JSON data
async function getPinnedProjects() {
    try {
        const res = await axios.get(`${TELEGRAM_API}/getChat`, {
            params: { chat_id: GROUP_CHAT_ID }
        });
        const pinnedId = res.data.result.pinned_message?.message_id;
        if (!pinnedId) return [];

        const pinnedRes = await axios.get(`${TELEGRAM_API}/getChatMessage`, {
            params: { chat_id: GROUP_CHAT_ID, message_id: pinnedId }
        });
        return JSON.parse(pinnedRes.data.result.text || '[]');
    } catch (error) {
        console.error('❌ Error fetching pinned projects:', error.message);
        return [];
    }
}

// Overwrite pinned message with updated project list
async function updatePinnedProjects(projects) {
    try {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: GROUP_CHAT_ID,
            text: JSON.stringify(projects, null, 2),
            disable_notification: true
        });
    } catch (error) {
        console.error('❌ Failed to update pinned message:', error.message);
    }
}

// Telegram webhook handler
app.post('/bot', async (req, res) => {
    console.log('🐞 Telegram webhook received:', JSON.stringify(req.body, null, 2));

    try {
        const message = req.body.message;
        if (!message || !message.text) return res.sendStatus(200);

        const chatId = message.chat.id;
        const text = message.text.trim();

        if (text.startsWith('/add')) {
            const parts = text.split(' ');
            if (parts.length < 4) {
                await sendMessage(chatId, '❗ Usage: /add <name> <ip> <port>');
            } else {
                const [, name, ip, port] = parts;
                const projects = await getPinnedProjects();
                const newProject = { id: Date.now(), name, ip, port };
                projects.push(newProject);
                await updatePinnedProjects(projects);
                await sendMessage(chatId, `✅ Project "${name}" added.`);
            }
        } else if (text.startsWith('/get')) {
            const parts = text.split(' ');
            if (parts.length < 2) {
                await sendMessage(chatId, '❗ Usage: /get <project_name>');
            } else {
                const name = parts[1];
                const projects = await getPinnedProjects();
                const project = projects.find(p => p.name.toLowerCase() === name.toLowerCase());
                if (project) {
                    await sendMessage(chatId, `📡 *${project.name}*\nIP: ${project.ip}\nPort: ${project.port}`, true);
                } else {
                    await sendMessage(chatId, `❌ Project "${name}" not found.`);
                }
            }
        } else {
            await sendMessage(chatId, '🤖 Hi! Use:\n/add <name> <ip> <port>\n/get <name>');
        }

        res.sendStatus(200);
    } catch (err) {
        console.error('🔥 Error in bot handler:', err.message);
        res.sendStatus(200);
    }
});

// Debug route
app.post('/debug', (req, res) => {
    console.log('🛠️ DEBUG BODY:', req.body);
    res.sendStatus(200);
});

// Start server and set webhook
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`✅ Server running on port ${PORT}`);

    try {
        const webhookRes = await axios.get(`${TELEGRAM_API}/setWebhook?url=${WEBHOOK_URL}`);
        if (webhookRes.data.ok) {
            console.log('✅ Telegram webhook set successfully!');
        } else {
            console.error('❌ Failed to set webhook:', webhookRes.data);
        }
    } catch (err) {
        console.error('❌ Error setting webhook:', err.message);
    }
});
