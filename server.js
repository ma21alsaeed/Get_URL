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
// Fetch pinned message JSON data
async function getPinnedProjects() {
    try {
        const res = await axios.get(`${TELEGRAM_API}/getChat`, {
            params: { chat_id: GROUP_CHAT_ID }
        });

        const pinnedText = res.data.result.pinned_message?.text;
        if (!pinnedText) return [];

        return JSON.parse(pinnedText || '[]');
    } catch (error) {
        console.error('❌ Error fetching pinned projects:', error.message);
        return [];
    }
}

// Overwrite pinned message with updated project list
// Overwrite pinned message with updated project list
async function updatePinnedProjects(projects) {
    try {
        // First: Get the current pinned message ID
        const chatRes = await axios.get(`${TELEGRAM_API}/getChat`, {
            params: { chat_id: GROUP_CHAT_ID }
        });

        const pinnedMessageId = chatRes.data.result.pinned_message?.message_id;

        if (pinnedMessageId) {
            // Edit the pinned message
            await axios.post(`${TELEGRAM_API}/editMessageText`, {
                chat_id: GROUP_CHAT_ID,
                message_id: pinnedMessageId,
                text: JSON.stringify(projects, null, 2)
            });
        } else {
            // No pinned message exists — send and pin a new one
            const newMsg = await axios.post(`${TELEGRAM_API}/sendMessage`, {
                chat_id: GROUP_CHAT_ID,
                text: JSON.stringify(projects, null, 2),
                disable_notification: true
            });

            // Pin the new message
            await axios.post(`${TELEGRAM_API}/pinChatMessage`, {
                chat_id: GROUP_CHAT_ID,
                message_id: newMsg.data.result.message_id
            });
        }
    } catch (error) {
        console.error('❌ Failed to update pinned message:', error.message);
    }
}


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
