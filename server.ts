import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initDatabase } from './src/server/db.ts';
import { authMiddleware } from './src/server/auth.ts';
import { authRouter } from './src/server/routes/auth.routes.ts';
import { inventoryRouter } from './src/server/routes/inventory.routes.ts';
import { salesRouter } from './src/server/routes/sales.routes.ts';
import { purchasesRouter } from './src/server/routes/purchases.routes.ts';
import { importRouter } from './src/server/routes/import.routes.ts';
import { cashRouter } from './src/server/routes/cash.routes.ts';
import { dashboardRouter } from './src/server/routes/dashboard.routes.ts';
import { snapshotRouter } from './src/server/routes/snapshot.routes.ts';
import { usersRouter } from './src/server/routes/users.routes.ts';
import { auditRouter } from './src/server/routes/audit.routes.ts';
import { settingsRouter } from './src/server/routes/settings.routes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Initialize SQLite database and tables
  initDatabase();

  // Basic Middlewares
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());
  app.use(authMiddleware);

  // Mount API Endpoints
  app.use('/api/auth', authRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/sales', salesRouter);
  app.use('/api/purchases', purchasesRouter);
  app.use('/api/import', importRouter);
  app.use('/api/cash', cashRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/system/snapshot', snapshotRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/settings', settingsRouter);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      version: '3.0.0',
      system: 'G.STOCK-Franchise / AFLOU ERP',
      time: new Date().toISOString(),
    });
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[G.STOCK-Franchise ERP v3.0.0] Server running smoothly at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start G.STOCK server:', err);
  process.exit(1);
});
