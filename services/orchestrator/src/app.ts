import express from 'express';
import helmet from 'helmet';
import { runRouter } from './routes/run.routes';
import { errorHandler } from './middleware/error.middleware';
import { gatewayAuth } from './middleware/gateway-auth.middleware';

const app = express();
app.use(helmet());
app.use(express.json({ limit: '100kb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'orchestrator' }));

app.use(gatewayAuth);
app.use('/runs', runRouter);
app.use(errorHandler);

export default app;
