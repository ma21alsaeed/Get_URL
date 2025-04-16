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

const PROJECTS_FILE = path.join(__dirname, 'projects.json');

// Helpers to read/write project data
async function readProjectsData() {
    try {
        const data = await fs.readFile(PROJECTS_FILE, 'utf8');
        return JSON.parse(data || '[]');
    } catch (error) {
        console.error('❌ Error reading data:', error);
        return [];
    }
}

async function writeProjectsData(data) {
    try {
        await fs.writeFile(PROJECTS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('❌ Error writing data:', error);
    }
}

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

// 🧠 Telegram webhook handler with debug logs
app.post('/bot', async (req, res) => {
    console.log('🐞 Telegram webhook received:', JSON.stringify(req.body, null, 2));

    try {
        const message = req.body.message;
        if (!message || !message.text) {
            console.log('⚠️ No text message received');
            return res.sendStatus(200);
        }

        const chatId = message.chat.id;
        const text = message.text.trim();

        if (text.startsWith('/add')) {
            const parts = text.split(' ');
            if (parts.length < 4) {
                await sendMessage(chatId, '❗ Usage: /add <name> <ip> <port>');
            } else {
                const [, name, ip, port] = parts;
                const projects = await readProjectsData();
                const newProject = {
                    id: Date.now(),
                    name,
                    ip,
                    port,
                    codeSample: ''
                };
                projects.push(newProject);
                await writeProjectsData(projects);
                await sendMessage(chatId, `✅ Project "${name}" added successfully!`);
            }
        } else if (text.startsWith('/get')) {
            const parts = text.split(' ');
            if (parts.length < 2) {
                await sendMessage(chatId, '❗ Usage: /get <project_name>');
            } else {
                const name = parts[1];
                const projects = await readProjectsData();
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
        console.error('🔥 Error handling Telegram webhook:', err.message);
        res.sendStatus(200); // always respond 200 so Telegram stops retrying
    }
});

// Web frontend routes
app.get('/', (req, res) => res.render('home', { error: null }));

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

// Debug POST to check payloads
app.post('/debug', (req, res) => {
    console.log('🛠️ DEBUG BODY:', req.body);
    res.sendStatus(200);
});

// Start server and set webhook
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`✅ Server running on port ${PORT}`);

    // Set Telegram webhook
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
