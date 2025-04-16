const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');
const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const PROJECTS_FILE = path.join(__dirname, 'projects.json');

// Initialize projects file if it doesn't exist
async function initializeProjectsFile() {
    try {
        await fs.access(PROJECTS_FILE);
    } catch (error) {
        // File doesn't exist, create it with default empty array
        await fs.writeFile(PROJECTS_FILE, '[]');
    }
}

// Function to read data with backup
async function readProjectsData() {
    try {
        await initializeProjectsFile();
        const data = await fs.readFile(PROJECTS_FILE, 'utf8');
        return JSON.parse(data || '[]');
    } catch (error) {
        console.error('Error reading data:', error);
        // Try to recover from backup if main file is corrupted
        try {
            const backup = await fs.readFile(`${PROJECTS_FILE}.backup`, 'utf8');
            await fs.writeFile(PROJECTS_FILE, backup);
            return JSON.parse(backup || '[]');
        } catch (backupError) {
            return [];
        }
    }
}

// Function to write data with backup
async function writeProjectsData(data) {
    try {
        const jsonData = JSON.stringify(data, null, 2);
        // Create backup before writing
        try {
            await fs.copyFile(PROJECTS_FILE, `${PROJECTS_FILE}.backup`);
        } catch (backupError) {
            console.error('Backup creation failed:', backupError);
        }
        await fs.writeFile(PROJECTS_FILE, jsonData);
    } catch (error) {
        console.error('Error writing data:', error);
    }
}

// Initialize file when server starts
app.listen(PORT, '0.0.0.0', async () => {
    await initializeProjectsFile();
    console.log(`Server running on port ${PORT}`);
});

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
});