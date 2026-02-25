import express from 'express';
import helmet from 'helmet';
import { workflowRouter } from './routes/workflow.routes';
import { errorHandler } from './middleware/error.middleware';
import { gatewayAuth } from './middleware/gateway-auth.middleware';

const app = express();
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'workflow' }));

app.use(gatewayAuth);
app.use('/workflows', workflowRouter);
app.use(errorHandler);

export default app;
