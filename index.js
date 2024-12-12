const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const sql = require('mssql');
const app = express();
const port = 4000;

// Body parser middleware
app.use(express.json());

// Set up Multer for video upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads');  // The directory to store uploaded files
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);  // Save file with the original filename
  }
});

const upload = multer({ storage: storage });

// Database connection configuration
const config = {
  user: 'stega',        // Replace with your Azure SQL DB username
  password: '$tega123',    // Replace with your Azure SQL DB password
  server: 'stega.database.windows.net', // Azure SQL Server URL
  database: 'stagaDB',          // Your database name
  options: {
    encrypt: true,              // Use encryption
    trustServerCertificate: true
  }
};

// Set up login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('username', sql.NVarChar, username)
      .query('SELECT * FROM Users WHERE Username = @username');

    if (result.recordset.length === 0) {
      return res.status(400).send('User not found');
    }

    const user = result.recordset[0];
    const isMatch = await bcrypt.compare(password, user.PasswordHash);

    if (!isMatch) {
      return res.status(400).send('Invalid password');
    }

    res.send('Login successful');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Set up signup route
app.post('/signup', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check if user already exists
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('username', sql.NVarChar, username)
      .query('SELECT * FROM Users WHERE Username = @username');

    if (result.recordset.length > 0) {
      return res.status(400).send('Username already exists');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    

    // Insert the new user into the database
    await pool.request()
      .input('username', sql.NVarChar, username)
      .input('passwordHash', sql.NVarChar, hashedPassword)
      .query('INSERT INTO Users (Username, PasswordHash) VALUES (@username, @passwordHash)');

    res.send('User registered successfully');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Set up video upload route
app.post('/upload', upload.single('video'), (req, res) => {
  const { userId, videoName, videoURL } = req.body;

  if (!req.file) {
    return res.status(400).send('No file uploaded');
  }

  // Here, store the video URL in the database (assuming you save the path in Azure Blob Storage)
  const videoUrl = `https://your-blob-storage-url/${req.file.filename}`;

  sql.connect(config)
    .then(pool => {
      return pool.request()
        .input('userId', sql.Int, userId)
        .input('videoName', sql.NVarChar, videoName)
        .input('videoURL', sql.NVarChar, videoUrl)
        .query('INSERT INTO Videos (UserID, VideoName, VideoURL) VALUES (@userId, @videoName, @videoURL)');
    })
    .then(() => {
      res.send('Video uploaded successfully');
    })
    .catch(err => {
      console.error(err);
      res.status(500).send('Server error');
    });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
