const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Store projects in JSON file
const projectsFile = path.join(__dirname, 'projects.json');

// Initialize projects file if it doesn't exist
if (!fs.existsSync(projectsFile)) {
    fs.writeFileSync(projectsFile, '[]');
}

app.get('/', (req, res) => {
    res.render('home', { error: null });
});

app.get('/find-project', (req, res) => {
    const projectName = req.query.projectName;
    if (!projectName) {
        return res.render('error', { message: 'Project name is required' });
    }

    const projects = JSON.parse(fs.readFileSync(projectsFile));
    const project = projects.find(p => p.name.toLowerCase() === projectName.toLowerCase());

    if (project) {
        res.render('project', { projects: [project] });
    } else {
        res.render('not-found');
    }
});

app.post('/create-project', (req, res) => {
    if (req.body.password !== 'anchorlearner') {
        return res.render('home', { error: 'Incorrect password' });
    }

    const projects = JSON.parse(fs.readFileSync(projectsFile));
    const newProject = {
        id: Date.now(),
        name: req.body.projectName,
        ip: req.body.ip || '',
        port: req.body.port || '',
        codeSample: req.body.codeSample || ''
    };
    projects.push(newProject);
    fs.writeFileSync(projectsFile, JSON.stringify(projects, null, 2));
    res.redirect('/project');
});

app.get('/project', (req, res) => {
    const projects = JSON.parse(fs.readFileSync(projectsFile));
    res.render('project', { projects });
});

app.post('/delete-project/:id', (req, res) => {
    let projects = JSON.parse(fs.readFileSync(projectsFile));
    projects = projects.filter(p => p.id !== parseInt(req.params.id));
    fs.writeFileSync(projectsFile, JSON.stringify(projects, null, 2));
    res.redirect('/project');
});

app.post('/update-project/:id', (req, res) => {
    let projects = JSON.parse(fs.readFileSync(projectsFile));
    const index = projects.findIndex(p => p.id === parseInt(req.params.id));
    if (index !== -1) {
        projects[index] = {
            ...projects[index],
            ip: req.body.ip,
            port: req.body.port,
            codeSample: req.body.codeSample
        };
        fs.writeFileSync(projectsFile, JSON.stringify(projects, null, 2));
    }
    res.redirect('/project');
});

// Add new API endpoint
app.get('/api/project/:name', (req, res) => {
    const projectName = req.params.name;
    const projects = JSON.parse(fs.readFileSync(projectsFile));
    const project = projects.find(p => p.name.toLowerCase() === projectName.toLowerCase());
    
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

// Add PUT endpoint to update project IP and port by name
app.put('/api/project/:name', (req, res) => {
    const projectName = req.params.name;
    const { ip, port } = req.body;
    
    let projects = JSON.parse(fs.readFileSync(projectsFile));
    const index = projects.findIndex(p => p.name.toLowerCase() === projectName.toLowerCase());
    
    if (index !== -1) {
        projects[index] = {
            ...projects[index],
            ip: ip || projects[index].ip,
            port: port || projects[index].port
        };
        fs.writeFileSync(projectsFile, JSON.stringify(projects, null, 2));
        res.json({
            name: projects[index].name,
            ip: projects[index].ip,
            port: projects[index].port
        });
    } else {
        res.status(404).json({ error: 'Project not found' });
    }
});

// Update the port configuration for Render deployment
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});