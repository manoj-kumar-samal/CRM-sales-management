const env = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');

const start = async () => {
  await connectDB();
  const server = app.listen(env.port, () => console.log(`Server running on port ${env.port} (${env.nodeEnv})`));

  const shutdown = (reason, err) => {
    console.error(`${reason}`, err || '');
    server.close(() => process.exit(1));
  };
  process.on('unhandledRejection', (err) => shutdown('Unhandled rejection - shutting down', err));
  process.on('uncaughtException', (err) => shutdown('Uncaught exception - shutting down', err));
};

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
