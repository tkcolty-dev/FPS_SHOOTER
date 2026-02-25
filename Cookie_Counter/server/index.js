const express = require('express');
const path = require('path');
const { initDb } = require('./db');
const authRoutes = require('./routes/auth');
const boothRoutes = require('./routes/booths');

const app = express();
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/booths', boothRoutes);

app.use(express.static(path.join(__dirname, '..', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Cookie Counter server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
