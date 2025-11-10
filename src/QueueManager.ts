/**
 * QueueManager - Manages multiple queues in memory
 * 
 * Each queue has:
 * - messages: Array of messages waiting to be consumed (FIFO)
 * - waitingConsumers: Array of GET requests waiting for messages
 */

// Type for a message (following SQS-like conventions)
export interface Message {
  id: string;           // Unique message identifier
  content: string;      // Message content
  timestamp?: number;   // Optional: when message was created
}

// Type for a consumer waiting for a message
interface WaitingConsumer {
  resolve: (message: Message) => void;  // Function to call when message arrives
  reject: () => void;                    // Function to call when timeout expires
  timeoutId: NodeJS.Timeout;             // Timer ID to cancel if message arrives early
}

// Structure for each queue
interface Queue {
  messages: Message[];                   // Messages waiting to be consumed
  waitingConsumers: WaitingConsumer[];   // Consumers waiting for messages
}

export class QueueManager {
  // Map of queue_name -> Queue
  private queues: Map<string, Queue> = new Map();

  /**
   * Get or create a queue by name
   */
  private getQueue(queueName: string): Queue {
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, {
        messages: [],
        waitingConsumers: []
      });
    }
    return this.queues.get(queueName)!;
  }

  /**
   * POST - Add a message to the queue
   * 
   * Logic:
   * 1. If there are consumers waiting, give message to the first one
   * 2. Otherwise, add message to the queue
   */
  addMessage(queueName: string, message: Message): void {
    const queue = this.getQueue(queueName);

    // If someone is waiting for a message, give it to them immediately
    if (queue.waitingConsumers.length > 0) {
      const consumer = queue.waitingConsumers.shift()!; // Remove first waiting consumer (FIFO)
      clearTimeout(consumer.timeoutId);                  // Cancel their timeout
      consumer.resolve(message);                         // Give them the message
    } else {
      // No one waiting, add message to queue
      queue.messages.push(message);
    }
  }

  /**
   * GET - Get a message from the queue (with timeout)
   * 
   * Logic:
   * 1. If messages exist, return first one immediately
   * 2. Otherwise, wait up to 'timeout' ms for a message to arrive
   * 3. If timeout expires, return null (will become 204 response)
   */
  getMessage(queueName: string, timeout: number): Promise<Message | null> {
    const queue = this.getQueue(queueName);

    // If messages exist, return immediately
    if (queue.messages.length > 0) {
      const message = queue.messages.shift()!; // Remove first message (FIFO)
      return Promise.resolve(message);
    }

    // No messages, so wait for one to arrive (or timeout)
    return new Promise((resolve) => {
      // Set up timeout - if this expires, return null
      const timeoutId = setTimeout(() => {
        // Remove this consumer from waiting list
        const index = queue.waitingConsumers.findIndex(c => c.timeoutId === timeoutId);
        if (index !== -1) {
          queue.waitingConsumers.splice(index, 1);
        }
        resolve(null); // No message after timeout
      }, timeout);

      // Add this consumer to the waiting list
      queue.waitingConsumers.push({
        resolve: (message: Message) => resolve(message),
        reject: () => resolve(null),
        timeoutId
      });
    });
  }
}

