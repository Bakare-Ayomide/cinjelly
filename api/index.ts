import app from '../server';
import { initDb } from '../server/db';

let isInitialized = false;

// Middleware to lazily initialize the database tables on Vercel
app.use(async (req, res, next) => {
  if (!isInitialized) {
    try {
      await initDb();
      isInitialized = true;
    } catch (e) {
      console.error('Error during Vercel dynamic initDb:', e);
    }
  }
  next();
});

export default app;
