import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import mongoSanitize from 'express-mongo-sanitize';
import morgan from 'morgan';
import './config/env';

import { connectDB } from './config/db';
import logger from './config/logger';
import { errorMiddleware } from './middlewares/errorMiddleware';
import { authRateLimiter, apiRateLimiter } from './middlewares/rateLimit';
import { seedDefaultAdmin } from './services/seedService';

// Import Route Handlers
import authRoutes from './routes/authRoutes';
import noteRoutes from './routes/noteRoutes';
import adminRoutes from './routes/adminRoutes';

function getAllowedOrigins() {
  return [
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGINS,
  ]
    .filter(Boolean)
    .flatMap((value) => value!.split(','))
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isApiOnlyMode() {
  return process.argv.includes('--api-only') || process.env.API_ONLY === 'true';
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const frontendRoot = path.resolve('frontend');
  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins = getAllowedOrigins();
  const apiOnly = isApiOnlyMode();

  // Initialize Database (lazy fallback support)
  const isMongoConnected = await connectDB();
  logger.info(`Database mode initialized. Mongo Atlas connected: ${isMongoConnected}`);

  // Seed default admin workspace account
  await seedDefaultAdmin();

  // Defensive Security Middlewares
  app.use(helmet({
    contentSecurityPolicy: isProduction ? undefined : false,
  }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (!isProduction) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '10kb' })); // Prevents oversized payloads
  app.use(cookieParser());
  app.use(mongoSanitize()); // Prevent NoSQL Injection attacks

  // HTTP Access Logging via Morgan connected to Winston stream
  const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
  app.use(morgan(morganFormat, {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  }));

  // Route Rate Limiters
  app.use('/api/auth/register', authRateLimiter);
  app.use('/api/auth/login', authRateLimiter);
  app.use('/api/notes', apiRateLimiter);
  app.use('/api/admin', apiRateLimiter);

  // Mount API Endpoints
  app.use('/api/auth', authRoutes);
  app.use('/api/notes', noteRoutes);
  app.use('/api/admin', adminRoutes);

  // Serve static assets in production or use Vite middleware in dev
  if (apiOnly) {
    logger.info('API-only mode enabled. Frontend dev middleware is disabled.');
  } else if (process.env.NODE_ENV === 'production' || process.env.VITE_PROD === 'true') {
    const distPath = path.resolve('dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    } else {
      logger.warn('Production asset build directory "/dist" was not found. Assets serving skipped.');
    }
  } else {
    logger.info('Initializing Vite middleware mode for active frontend compilation.');
    const vite = await createViteServer({
      root: frontendRoot,
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // Centralized Error Handler Middleware (captures validator/server errors)
  app.use(errorMiddleware);

  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server listening securely at http://0.0.0.0:${PORT} [ENV: ${process.env.NODE_ENV || 'development'}]`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use. Stop the existing server or start this one with PORT=<another port>.`);
      process.exit(1);
    }

    throw err;
  });

  // Graceful Shutdown Mechanics
  const handleGracefulShutdown = (signal: string) => {
    logger.info(`Received signal ${signal}. Initiating server shutdown sequences.`);
    server.close(async () => {
      logger.info('HTTP active socket connections closed cleanly.');
      
      // Close MongoDB Mongoose connection if open
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
        logger.info('Mongoose database connections closed cleanly.');
      }
      
      logger.info('Process termination completes.');
      process.exit(0);
    });

    // Force exit after 10s if sockets remain open
    setTimeout(() => {
      logger.error('Graceful shutdown timeout exceeded. Forcing terminate.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
}

startServer().catch((err) => {
  logger.error(`Critical server initialization crash: ${err.message}`);
  process.exit(1);
});
