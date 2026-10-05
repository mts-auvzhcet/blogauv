const { app, initializeDatabase } = require('../server/app');

let databaseReady;

module.exports = async function handler(req, res) {
  try {
    databaseReady ||= initializeDatabase();
    await databaseReady;
  } catch (error) {
    console.error('Could not initialize the Neon database.', error);
    return res.status(500).json({ error: 'The database is unavailable. Check the deployment environment variables.' });
  }
  return app(req, res);
};
