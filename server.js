require('dotenv').config();
const express = require('express');
const { Dropbox } = require('dropbox');
const path = require('path');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();

// Dropbox configuration
const dbx = new Dropbox({
  refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
  clientId: process.env.DROPBOX_APP_KEY,
  clientSecret: process.env.DROPBOX_APP_SECRET
});

const PROJECTS_FILE = '/projects.json';

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Initialize projects file if it doesn't exist
async function initializeProjectsFile() {
  try {
    await dbx.filesDownload({ path: PROJECTS_FILE });
  } catch (error) {
    if (error.status === 409) { // Not found error
      await dbx.filesUpload({
        path: PROJECTS_FILE,
        contents: JSON.stringify([]),
        mode: { '.tag': 'overwrite' }
      });
      console.log('Created new projects file on Dropbox');
    }
  }
}

// Helper functions for projects
async function getProjects() {
  try {
    const response = await dbx.filesDownload({ path: PROJECTS_FILE });
    return JSON.parse(response.result.fileBinary.toString());
  } catch (error) {
    console.error('Error reading projects:', error);
    return [];
  }
}

async function saveProjects(projects) {
  try {
    await dbx.filesUpload({
      path: PROJECTS_FILE,
      contents: JSON.stringify(projects, null, 2),
      mode: { '.tag': 'overwrite' }
    });
  } catch (error) {
    console.error('Error saving projects:', error);
    throw error;
  }
}

// Routes
app.get('/', async (req, res) => {
  res.render('home', { error: null });
});

app.get('/find-project', async (req, res) => {
  const projectName = req.query.projectName;
  const projects = await getProjects();
  const project = projects.find(p => p.name === projectName);

  if (project) {
    res.render('project', { projects: [project] });
  } else {
    res.render('not-found');
  }
});

app.post('/create-project', async (req, res) => {
  const { projectName, password } = req.body;
  const projects = await getProjects();

  if (projects.some(p => p.name === projectName)) {
    return res.render('home', { error: 'Project name already exists' });
  }

  const newProject = {
    id: crypto.randomBytes(16).toString('hex'),
    name: projectName,
    password: crypto.createHash('sha256').update(password).digest('hex'),
    ip: '',
    port: '',
    codeSample: '',
    createdAt: new Date().toISOString()
  };

  projects.push(newProject);
  await saveProjects(projects);

  res.render('project', { projects: [newProject] });
});

app.post('/update-project/:id', async (req, res) => {
  const { id } = req.params;
  const { ip, port, codeSample } = req.body;
  const projects = await getProjects();
  const projectIndex = projects.findIndex(p => p.id === id);

  if (projectIndex === -1) {
    return res.render('error', { message: 'Project not found' });
  }

  projects[projectIndex] = {
    ...projects[projectIndex],
    ip,
    port,
    codeSample
  };

  await saveProjects(projects);
  res.render('project', { projects: [projects[projectIndex]] });
});

app.post('/delete-project/:id', async (req, res) => {
  const { id } = req.params;
  const projects = await getProjects();
  const filteredProjects = projects.filter(p => p.id !== id);

  if (projects.length === filteredProjects.length) {
    return res.render('error', { message: 'Project not found' });
  }

  await saveProjects(filteredProjects);
  res.redirect('/');
});

// API Routes
app.get('/api/project/:name', async (req, res) => {
  const projects = await getProjects();
  const project = projects.find(p => p.name === req.params.name);

  if (project) {
    res.json({
      name: project.name,
      ip: project.ip,
      port: project.port,
      codeSample: project.codeSample
    });
  } else {
    res.status(404).json({ error: 'Project not found' });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { message: 'Something went wrong!' });
});

app.get('/redirect', async (req, res) => {
  const code = req.query.code;

  if (!code) return res.status(400).send('Missing code');

  try {
    const response = await axios.post('https://api.dropbox.com/oauth2/token', null, {
      params: {
        code: code, // ✅ Use the correct code from the URL
        grant_type: 'authorization_code', // ✅ Correct grant type
        client_id: '7eyr8lhfhnv8pqx',
        client_secret: 'lwfwcgjxxphoh84',
        redirect_uri: 'https://get-url-o0dy.onrender.com/redirect'
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log('✅ REFRESH TOKEN:', response.data.refresh_token);
    res.send('✅ Success! Check server logs for refresh token and save it in .env');
  } catch (err) {
    console.error('❌ Token exchange failed:', err.response?.data || err.message);
    res.status(500).send('Failed to exchange code for token');
  }
});


// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await initializeProjectsFile();

});