const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Telegram Bot configuration
const BOT_TOKEN = '7742484652:AAEUJBUh0BM93n_IfPY1VcCXq27TL9HUMBc';
const url = 'https://get-url.onrender.com'; // Replace with your Render URL
const bot = new TelegramBot(BOT_TOKEN, { webHook: { port: process.env.PORT || 3000 } });

// Set webhook
bot.setWebHook(`${url}/webhook/${BOT_TOKEN}`);

// Store the last known state
let chatId = process.env.CHAT_ID || null;
let messageId = process.env.MESSAGE_ID || null;

// Webhook endpoint
app.post(`/webhook/${BOT_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Initialize bot and create storage
bot.onText(/\/start/, async (msg) => {
    try {
        if (!chatId || !messageId) {
            chatId = msg.chat.id;
            const initialMessage = await bot.sendMessage(chatId, '[]');
            messageId = initialMessage.message_id;
            await bot.pinChatMessage(chatId, messageId);
            console.log(`Storage initialized. Chat ID: ${chatId}, Message ID: ${messageId}`);
        }
    } catch (error) {
        console.error('Error initializing storage:', error);
    }
});

// Function to read data
async function readProjectsData() {
    try {
        if (!chatId || !messageId) return [];
        const chat = await bot.getChat(chatId);
        const pinnedMessage = chat.pinned_message;
        if (pinnedMessage && pinnedMessage.message_id === messageId) {
            return JSON.parse(pinnedMessage.text || '[]');
        }
        return [];
    } catch (error) {
        console.error('Error reading data:', error);
        return [];
    }
}

// Function to write data
async function writeProjectsData(data) {
    try {
        if (!chatId || !messageId) return;
        const jsonData = JSON.stringify(data);
        await bot.editMessageText(jsonData, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML'
        });
    } catch (error) {
        console.error('Error writing data:', error);
        // If message is too long, split it into multiple messages
        if (error.response && error.response.statusCode === 400) {
            const chunks = jsonData.match(/.{1,4000}/g);
            if (chunks) {
                await bot.deleteMessage(chatId, messageId);
                const newMessage = await bot.sendMessage(chatId, chunks[0]);
                messageId = newMessage.message_id;
                await bot.pinChatMessage(chatId, messageId);
            }
        }
    }
}

app.get('/', (req, res) => {
    res.render('home', { error: null });
});

app.post('/create-project', async (req, res) => {
    if (req.body.password !== 'anchorlearner') {
        return res.render('home', { error: 'Incorrect password' });
    }

    const projects = await readProjectsData();
    const newProject = {
        id: Date.now(),
        name: req.body.projectName,
        ip: req.body.ip || '',
        port: req.body.port || '',
        codeSample: req.body.codeSample || ''
    };
    projects.push(newProject);
    await writeProjectsData(projects);
    res.redirect('/project');
});

app.get('/project', async (req, res) => {
    const projects = await readProjectsData();
    res.render('project', { projects });
});

app.post('/delete-project/:id', async (req, res) => {
    let projects = await readProjectsData();
    projects = projects.filter(p => p.id !== parseInt(req.params.id));
    await writeProjectsData(projects);
    res.redirect('/project');
});

app.post('/update-project/:id', async (req, res) => {
    let projects = await readProjectsData();
    const index = projects.findIndex(p => p.id === parseInt(req.params.id));
    if (index !== -1) {
        projects[index] = {
            ...projects[index],
            ip: req.body.ip,
            port: req.body.port,
            codeSample: req.body.codeSample
        };
        await writeProjectsData(projects);
    }
    res.redirect('/project');
});

app.get('/api/project/:name', async (req, res) => {
    const projects = await readProjectsData();
    const project = projects.find(p => p.name.toLowerCase() === req.params.name.toLowerCase());
    
    if (project) {
        res.json({
            name: project.name,
            ip: project.ip,
            port: project.port
        });
    } else {
        res.status(404).json({ error: 'Project not found' });
    }
});

app.put('/api/project/:name', async (req, res) => {
    const { ip, port } = req.body;
    let projects = await readProjectsData();
    const index = projects.findIndex(p => p.name.toLowerCase() === req.params.name.toLowerCase());
    
    if (index !== -1) {
        projects[index] = {
            ...projects[index],
            ip: ip || projects[index].ip,
            port: port || projects[index].port
        };
        await writeProjectsData(projects);
        res.json({
            name: projects[index].name,
            ip: projects[index].ip,
            port: projects[index].port
        });
    } else {
        res.status(404).json({ error: 'Project not found' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Start the bot by sending /start in Telegram');
});