const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const EMAILS_CSV_PATH = path.join(__dirname, '../public/emails.csv');

app.post('/api/append-email', (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Invalid email' });
  }
  // Normalize email
  const normalized = email.trim().toLowerCase();
  // Check if already present
  fs.readFile(EMAILS_CSV_PATH, 'utf8', (err, data) => {
    if (err && err.code !== 'ENOENT') {
      return res.status(500).json({ error: 'Could not read emails file' });
    }
    const emails = (data || '').split(/\r?\n/).map(line => line.trim().toLowerCase()).filter(Boolean);
    if (emails.includes(normalized)) {
      return res.status(200).json({ message: 'Email already present' });
    }
    // Append email
    fs.appendFile(EMAILS_CSV_PATH, (emails.length ? '\n' : '') + normalized, err => {
      if (err) {
        return res.status(500).json({ error: 'Could not append email' });
      }
      res.status(200).json({ message: 'Email added' });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Email backend running on port ${PORT}`);
});
