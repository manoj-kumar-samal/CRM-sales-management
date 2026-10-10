const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const AppError = require('./utils/AppError');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimiter');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1); 

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.clientOrigins.includes(origin)) return callback(null, true);
      callback(new AppError('Not allowed by CORS', 403));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.get('/health', (req, res) => res.json({ success: true, message: 'CRM API is running', data: { uptime: process.uptime() } }));

app.use('/api', apiLimiter);
app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
