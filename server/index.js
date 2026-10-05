require('dotenv').config();

const { app, initializeDatabase } = require('./app');
const port = Number(process.env.PORT || 3001);
const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';

initializeDatabase()
  .then(() => app.listen(port, host, () => {
    console.log(`AUV-ZHCET Blog API ready on ${host}:${port}`);
  }))
  .catch((error) => {
    console.error('Could not connect to PostgreSQL. Check DATABASE_URL and your Neon database.');
    console.error(error.message);
    process.exit(1);
  });
