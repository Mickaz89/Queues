# Queue API - Simple Message Queue REST API

A simple REST API for managing message queues, built with **Express** and **TypeScript**.

## 📦 Features

- **POST** messages to a queue
- **GET** messages from a queue with timeout (long polling)
- Multiple queues supported (dynamically created)
- In-memory storage (no database needed)
- FIFO (First In, First Out) ordering

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Server

**Development mode (with hot reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

The server runs on **http://localhost:3000**

---

## 📖 API Documentation

### POST `/api/{queue_name}`

Adds a message to the queue.

**Request Body:**
```json
{
  "content": "Your message content here"
}
```

**Example:**
```bash
POST http://localhost:3000/api/orders
Content-Type: application/json

{
  "content": "Order #123 for Pizza"
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "a1b2c3d4-5678-90ab-cdef-1234567890ab"
}
```

---

### GET `/api/{queue_name}?timeout={ms}`

Gets the next message from the queue. If the queue is empty, waits up to `timeout` milliseconds for a message to arrive.

**Parameters:**
- `timeout` (optional): Milliseconds to wait. Default: **10000** (10 seconds)

**Request:**
```bash
GET http://localhost:3000/api/orders?timeout=5000
```

**Response (if message available):**
```json
{
  "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  "content": "Order #123 for Pizza",
  "timestamp": 1699564800000
}
```

**Response (if timeout expires):**
```
HTTP 204 No Content
```

---

## 📨 Message Structure

Every message in the queue follows this structure (similar to AWS SQS):

```typescript
{
  id: string;           // Unique identifier (UUID)
  content: string;      // Your message content
  timestamp: number;    // When the message was created (Unix timestamp in ms)
}
```

**When you POST:**
- You only provide `content`
- The server automatically generates `id` and `timestamp`
- You receive the `messageId` in the response

**When you GET:**
- You receive the full message object with all fields

---

## 🎯 How It Works

### The Queue Manager

The system uses a simple **in-memory** data structure:

```
For each queue:
{
  messages: [...]           // Messages waiting to be consumed
  waitingConsumers: [...]   // GET requests waiting for messages
}
```

### POST Logic (Adding a Message)

1. **Check** if any consumers are waiting
2. **If YES** → Give the message directly to the first waiting consumer (skip the queue!)
3. **If NO** → Add message to the end of the queue

### GET Logic (Getting a Message)

1. **Check** if messages exist in the queue
2. **If YES** → Return the first message immediately (FIFO)
3. **If NO** → Wait up to `timeout` ms for a message to arrive
4. **If timeout expires** → Return 204 (No Content)

### What is the Timeout For?

The timeout implements **"long polling"** or **"wait-for-message"** pattern:

**Example:**
1. Client A does `GET /api/orders?timeout=5000`
2. Queue is empty, so the request **waits**
3. 2 seconds later, Client B does `POST /api/orders` with a message
4. Client A **immediately** receives that message (after waiting only 2s)

This is more efficient than constantly polling the API!

---

## 🔧 Edge Cases Handled

### Case 1: Multiple GET requests waiting

If 2 GET requests are waiting and 1 POST arrives:
- **First GET** gets the message (FIFO)
- **Second GET** keeps waiting

### Case 2: Multiple POST requests

If 2 consumers are waiting and 2 POST requests arrive:
- **First POST** → First consumer
- **Second POST** → Second consumer

If no consumers are waiting:
- Both messages are added to the queue

### Case 3: Timeout expires

When a GET request times out:
- It's removed from the `waitingConsumers` list
- Returns 204 (No Content)

---

## 📂 Project Structure

```
Queues/
├── src/
│   ├── QueueManager.ts    # Queue management logic
│   └── server.ts          # Express server and routes
├── dist/                  # Compiled JavaScript (after build)
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🧪 Testing Examples

### Using curl

**Terminal 1 - Wait for a message:**
```bash
curl -X GET "http://localhost:3000/api/orders?timeout=30000"
```

**Terminal 2 - Send a message:**
```bash
curl -X POST "http://localhost:3000/api/orders" \
  -H "Content-Type: application/json" \
  -d '{"content": "Order #123 for Pizza"}'
```

You'll see Terminal 1 immediately receive the message!

### Multiple Messages

```bash
# Add 3 messages
curl -X POST "http://localhost:3000/api/orders" \
  -H "Content-Type: application/json" \
  -d '{"content": "Order #1: Pizza"}'

curl -X POST "http://localhost:3000/api/orders" \
  -H "Content-Type: application/json" \
  -d '{"content": "Order #2: Burger"}'

curl -X POST "http://localhost:3000/api/orders" \
  -H "Content-Type: application/json" \
  -d '{"content": "Order #3: Salad"}'

# Get them (FIFO order)
curl -X GET "http://localhost:3000/api/orders"  # Returns message with content "Order #1: Pizza"
curl -X GET "http://localhost:3000/api/orders"  # Returns message with content "Order #2: Burger"
curl -X GET "http://localhost:3000/api/orders"  # Returns message with content "Order #3: Salad"
curl -X GET "http://localhost:3000/api/orders"  # Returns 204 (empty)
```

---

