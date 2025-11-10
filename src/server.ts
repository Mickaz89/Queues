import express, { Request, Response } from 'express';
import { QueueManager, Message } from './QueueManager';
import { randomUUID } from 'crypto';

// Create Express app
const app = express();
const PORT = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Create a single QueueManager instance (manages all queues)
const queueManager = new QueueManager();

/**
 * POST /api/{queue_name}
 * 
 * Adds a message to the specified queue
 * Body: { content: string } or just a string
 */
app.post('/api/:queueName', (req: Request, res: Response) => {
  const queueName = req.params.queueName;
  
  // Extract content from request body
  const content = typeof req.body === 'string' 
    ? req.body 
    : req.body.content || JSON.stringify(req.body);
  
  // Create message with SQS-like structure
  const message: Message = {
    id: randomUUID(),
    content: content,
    timestamp: Date.now()
  };

  // Add message to queue
  queueManager.addMessage(queueName, message);

  // Return 200 OK with message ID
  res.status(200).json({ 
    success: true,
    messageId: message.id 
  });
});

/**
 * GET /api/{queue_name}?timeout={ms}
 * 
 * Gets the next message from the queue
 * 
 * Query params:
 * - timeout: milliseconds to wait (default: 10000 = 10 seconds)
 * 
 * Returns:
 * - 200 with message if available
 * - 204 No Content if timeout expires with no message
 */
app.get('/api/:queueName', async (req: Request, res: Response) => {
  const queueName = req.params.queueName;
  
  // Get timeout from query params, default to 10 seconds (10000ms)
  const timeout = req.query.timeout 
    ? parseInt(req.query.timeout as string, 10) 
    : 10000;

  // Wait for a message (or timeout)
  const message = await queueManager.getMessage(queueName, timeout);

  // If we got a message, return it
  if (message !== null) {
    res.status(200).json(message);
  } else {
    // Timeout expired, no message available
    res.status(204).send();
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Queue API server running on http://localhost:${PORT}`);
  console.log(`\nExamples:`);
  console.log(`  POST http://localhost:${PORT}/api/orders`);
  console.log(`  GET  http://localhost:${PORT}/api/orders?timeout=5000`);
});

