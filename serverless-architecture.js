// Serverless Architecture Implementation
// This file implements serverless architecture components including AWS Lambda-style functions,
// event-driven architecture, and serverless database integration

// Serverless Function Manager
class ServerlessFunctionManager {
  constructor() {
    this.functions = new Map();
    this.eventBus = new EventBus();
    this.metrics = {
      invocations: {},
      errors: {},
      durations: {}
    };
  }

  // Register a new serverless function
  registerFunction(name, handler, options = {}) {
    if (this.functions.has(name)) {
      console.warn(`Function ${name} already registered, overwriting`);
    }

    const defaultOptions = {
      timeout: 30000, // 30 seconds
      memorySize: 128, // 128 MB
      environment: {},
      concurrency: 100,
      retries: 3,
      events: []
    };

    const functionConfig = {
      name,
      handler,
      options: { ...defaultOptions, ...options }
    };

    this.functions.set(name, functionConfig);
    
    // Initialize metrics for this function
    this.metrics.invocations[name] = 0;
    this.metrics.errors[name] = 0;
    this.metrics.durations[name] = [];

    // Register event triggers if specified
    if (options.events && options.events.length > 0) {
      for (const event of options.events) {
        this.eventBus.subscribe(event.type, async (eventData) => {
          await this.invokeFunction(name, eventData);
        });
      }
    }

    console.log(`Registered serverless function: ${name}`);
    return true;
  }

  // Invoke a serverless function
  async invokeFunction(name, payload = {}, options = {}) {
    if (!this.functions.has(name)) {
      console.error(`Function ${name} not found`);
      return {
        statusCode: 404,
        body: { error: `Function ${name} not found` }
      };
    }

    const functionConfig = this.functions.get(name);
    const startTime = Date.now();
    
    // Increment invocation counter
    this.metrics.invocations[name]++;

    try {
      console.log(`Invoking serverless function: ${name}`);
      console.log('Payload:', payload);

      // Create context object similar to AWS Lambda
      const context = {
        functionName: name,
        functionVersion: '1.0.0',
        invokedFunctionArn: `arn:aws:lambda:us-east-1:123456789012:function:${name}`,
        memoryLimitInMB: functionConfig.options.memorySize,
        awsRequestId: this.generateRequestId(),
        logGroupName: `/aws/lambda/${name}`,
        logStreamName: `2023/04/03/[$LATEST]${this.generateRandomString(32)}`,
        identity: {
          cognitoIdentityId: null,
          cognitoIdentityPoolId: null
        },
        clientContext: options.clientContext || null,
        getRemainingTimeInMillis: () => {
          return functionConfig.options.timeout - (Date.now() - startTime);
        },
        callbackWaitsForEmptyEventLoop: true,
        done: (error, result) => {
          if (error) {
            return {
              statusCode: 500,
              body: { error: error.message }
            };
          }
          return {
            statusCode: 200,
            body: result
          };
        },
        fail: (error) => {
          return {
            statusCode: 500,
            body: { error: error.message }
          };
        },
        succeed: (result) => {
          return {
            statusCode: 200,
            body: result
          };
        }
      };

      // Set up timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Function ${name} timed out after ${functionConfig.options.timeout}ms`));
        }, functionConfig.options.timeout);
      });

      // Execute the function with timeout
      const executionPromise = Promise.resolve().then(() => {
        return functionConfig.handler(payload, context);
      });

      // Race between execution and timeout
      const result = await Promise.race([executionPromise, timeoutPromise]);
      
      // Record execution duration
      const duration = Date.now() - startTime;
      this.metrics.durations[name].push(duration);
      
      // Keep only the last 100 durations
      if (this.metrics.durations[name].length > 100) {
        this.metrics.durations[name].shift();
      }

      console.log(`Function ${name} executed successfully in ${duration}ms`);
      
      return {
        statusCode: 200,
        body: result,
        executionTime: duration
      };
    } catch (error) {
      // Record error
      this.metrics.errors[name]++;
      
      // Record execution duration even for errors
      const duration = Date.now() - startTime;
      this.metrics.durations[name].push(duration);
      
      console.error(`Error executing function ${name}:`, error);
      
      return {
        statusCode: 500,
        body: { error: error.message },
        executionTime: duration
      };
    }
  }

  // Generate a random request ID
  generateRequestId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Generate a random string
  generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  // List all registered functions
  listFunctions() {
    const functions = [];
    for (const [name, config] of this.functions.entries()) {
      functions.push({
        name,
        memorySize: config.options.memorySize,
        timeout: config.options.timeout,
        concurrency: config.options.concurrency,
        events: config.options.events
      });
    }
    return functions;
  }

  // Get function metrics
  getFunctionMetrics(name) {
    if (!this.functions.has(name)) {
      console.error(`Function ${name} not found`);
      return null;
    }

    const invocations = this.metrics.invocations[name] || 0;
    const errors = this.metrics.errors[name] || 0;
    const durations = this.metrics.durations[name] || [];

    // Calculate average duration
    const avgDuration = durations.length > 0
      ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
      : 0;

    // Calculate p95 duration
    let p95Duration = 0;
    if (durations.length > 0) {
      const sortedDurations = [...durations].sort((a, b) => a - b);
      const p95Index = Math.floor(sortedDurations.length * 0.95);
      p95Duration = sortedDurations[p95Index] || sortedDurations[sortedDurations.length - 1];
    }

    return {
      name,
      invocations,
      errors,
      successRate: invocations > 0 ? ((invocations - errors) / invocations) * 100 : 100,
      avgDuration,
      p95Duration,
      timestamp: new Date()
    };
  }

  // Get all function metrics
  getAllFunctionMetrics() {
    const metrics = {};
    for (const name of this.functions.keys()) {
      metrics[name] = this.getFunctionMetrics(name);
    }
    return metrics;
  }

  // Delete a function
  deleteFunction(name) {
    if (!this.functions.has(name)) {
      console.error(`Function ${name} not found`);
      return false;
    }

    this.functions.delete(name);
    
    // Clean up metrics
    delete this.metrics.invocations[name];
    delete this.metrics.errors[name];
    delete this.metrics.durations[name];
    
    console.log(`Deleted serverless function: ${name}`);
    return true;
  }
}

// Event Bus for event-driven architecture
class EventBus {
  constructor() {
    this.subscribers = new Map();
    this.eventHistory = [];
    this.maxHistorySize = 1000;
  }

  // Subscribe to an event
  subscribe(eventType, callback) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    
    this.subscribers.get(eventType).push(callback);
    console.log(`Subscribed to event: ${eventType}`);
    return true;
  }

  // Publish an event
  async publish(eventType, eventData = {}) {
    console.log(`Publishing event: ${eventType}`);
    console.log('Event data:', eventData);
    
    // Add event to history
    const event = {
      id: this.generateEventId(),
      type: eventType,
      data: eventData,
      timestamp: new Date()
    };
    
    this.eventHistory.unshift(event);
    
    // Trim history if needed
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(0, this.maxHistorySize);
    }
    
    // If no subscribers, just log and return
    if (!this.subscribers.has(eventType)) {
      console.log(`No subscribers for event: ${eventType}`);
      return true;
    }
    
    // Notify all subscribers
    const subscribers = this.subscribers.get(eventType);
    const promises = subscribers.map(callback => {
      try {
        return Promise.resolve(callback(eventData, event));
      } catch (error) {
        console.error(`Error in event subscriber for ${eventType}:`, error);
        return Promise.resolve();
      }
    });
    
    await Promise.all(promises);
    console.log(`Event ${eventType} processed by ${subscribers.length} subscribers`);
    return true;
  }

  // Generate a unique event ID
  generateEventId() {
    return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Get event history
  getEventHistory(eventType = null, limit = 100) {
    if (eventType) {
      return this.eventHistory
        .filter(event => event.type === eventType)
        .slice(0, limit);
    }
    
    return this.eventHistory.slice(0, limit);
  }

  // Clear event history
  clearEventHistory() {
    const count = this.eventHistory.length;
    this.eventHistory = [];
    console.log(`Cleared event history (${count} events)`);
    return count;
  }

  // Unsubscribe from an event
  unsubscribe(eventType, callback) {
    if (!this.subscribers.has(eventType)) {
      console.log(`No subscribers for event: ${eventType}`);
      return false;
    }
    
    const subscribers = this.subscribers.get(eventType);
    const index = subscribers.indexOf(callback);
    
    if (index === -1) {
      console.log(`Callback not found for event: ${eventType}`);
      return false;
    }
    
    subscribers.splice(index, 1);
    console.log(`Unsubscribed from event: ${eventType}`);
    
    // Remove the event type if no subscribers left
    if (subscribers.length === 0) {
      this.subscribers.delete(eventType);
    }
    
    return true;
  }
}

// Serverless API Gateway
class ServerlessApiGateway {
  constructor(functionManager) {
    this.functionManager = functionManager;
    this.routes = new Map();
    this.middlewares = [];
    this.corsConfig = {
      enabled: false,
      allowOrigin: '*',
      allowMethods: 'GET,POST,PUT,DELETE,OPTIONS',
      allowHeaders: 'Content-Type,Authorization',
      maxAge: 86400 // 24 hours
    };
  }

  // Register a route
  registerRoute(method, path, functionName, options = {}) {
    const routeKey = `${method.toUpperCase()}:${path}`;
    
    if (this.routes.has(routeKey)) {
      console.warn(`Route ${routeKey} already registered, overwriting`);
    }
    
    this.routes.set(routeKey, {
      method: method.toUpperCase(),
      path,
      functionName,
      options
    });
    
    console.log(`Registered API route: ${method.toUpperCase()} ${path} -> ${functionName}`);
    return true;
  }

  // Configure CORS
  configureCors(config = {}) {
    this.corsConfig = {
      ...this.corsConfig,
      ...config,
      enabled: true
    };
    
    console.log('CORS configured:', this.corsConfig);
    return true;
  }

  // Add middleware
  addMiddleware(middleware) {
    this.middlewares.push(middleware);
    console.log('Added API middleware');
    return true;
  }

  // Handle an API request
  async handleRequest(method, path, headers = {}, body = {}, queryParams = {}) {
    console.log(`API request: ${method} ${path}`);
    console.log('Headers:', headers);
    console.log('Query params:', queryParams);
    console.log('Body:', body);
    
    // Check if it's a CORS preflight request
    if (this.corsConfig.enabled && method === 'OPTIONS') {
      return this.handleCorsPreflightRequest(headers);
    }
    
    // Find matching route
    const routeKey = `${method.toUpperCase()}:${path}`;
    
    if (!this.routes.has(routeKey)) {
      console.log(`Route not found: ${routeKey}`);
      return {
        statusCode: 404,
        headers: this.getCorsHeaders(),
        body: { error: 'Not Found' }
      };
    }
    
    const route = this.routes.get(routeKey);
    
    // Prepare request context
    const requestContext = {
      method,
      path,
      headers,
      queryParams,
      route
    };
    
    // Run request through middlewares
    let currentBody = body;
    
    for (const middleware of this.middlewares) {
      try {
        const result = await middleware(requestContext, currentBody);
        
        // If middleware returns false, stop processing
        if (result === false) {
          return {
            statusCode: 403,
            headers: this.getCorsHeaders(),
            body: { error: 'Forbidden by middleware' }
          };
        }
        
        // If middleware returns an object, use it as the new body
        if (result && typeof result === 'object') {
          currentBody = result;
        }
      } catch (error) {
        console.error('Middleware error:', error);
        return {
          statusCode: 500,
          headers: this.getCorsHeaders(),
          body: { error: 'Middleware Error' }
        };
      }
    }
    
    // Invoke the function
    const result = await this.functionManager.invokeFunction(route.functionName, {
      body: currentBody,
      headers,
      queryParams,
      path,
      method,
      requestContext
    });
    
    // Add CORS headers to response
    return {
      ...result,
      headers: {
        ...result.headers,
        ...this.getCorsHeaders()
      }
    };
  }

  // Handle CORS preflight request
  handleCorsPreflightRequest(headers) {
    return {
      statusCode: 204, // No Content
      headers: this.getCorsHeaders(),
      body: {}
    };
  }

  // Get CORS headers
  getCorsHeaders() {
    if (!this.corsConfig.enabled) {
      return {};
    }
    
    return {
      'Access-Control-Allow-Origin': this.corsConfig.allowOrigin,
      'Access-Control-Allow-Methods': this.corsConfig.allowMethods,
      'Access-Control-Allow-Headers': this.corsConfig.allowHeaders,
      'Access-Control-Max-Age': this.corsConfig.maxAge
    };
  }

  // List all registered routes
  listRoutes() {
    const routes = [];
    for (const [routeKey, route] of this.routes.entries()) {
      routes.push({
        routeKey,
        method: route.method,
        path: route.path,
        functionName: route.functionName
      });
    }
    return routes;
  }

  // Delete a route
  deleteRoute(method, path) {
    const routeKey = `${method.toUpperCase()}:${path}`;
    
    if (!this.routes.has(routeKey)) {
      console.log(`Route not found: ${routeKey}`);
      return false;
    }
    
    this.routes.delete(routeKey);
    console.log(`Deleted API route: ${routeKey}`);
    return true;
  }
}

// Serverless Database Manager
class ServerlessDatabaseManager {
  constructor() {
    this.collections = new Map();
    this.indexes = new Map();
    this.transactions = new Map();
    this.metrics = {
      operations: {
        read: 0,
        write: 0,
        delete: 0
      },
      errors: 0,
      latency: {
        read: [],
        write: [],
        delete: []
      }
    };
  }

  // Initialize the database
  initialize() {
    console.log('Initializing serverless database');
    return true;
  }

  // Create a collection
  createCollection(name, schema = null) {
    if (this.collections.has(name)) {
      console.warn(`Collection ${name} already exists`);
      return false;
    }
    
    this.collections.set(name, new Map());
    
    // Initialize indexes for this collection
    this.indexes.set(name, new Map());
    
    // Add default index on id
    this.createIndex(name, 'id', { unique: true });
    
    console.log(`Created collection: ${name}`);
    return true;
  }

  // Create an index
  createIndex(collectionName, field, options = {}) {
    if (!this.collections.has(collectionName)) {
      console.error(`Collection ${collectionName} not found`);
      return false;
    }
    
    if (!this.indexes.has(collectionName)) {
      this.indexes.set(collectionName, new Map());
    }
    
    const collectionIndexes = this.indexes.get(collectionName);
    collectionIndexes.set(field, options);
    
    console.log(`Created index on ${field} for collection ${collectionName}`);
    return true;
  }

  // Insert a document
  async insertDocument(collectionName, document) {
    const startTime = Date.now();
    
    try {
      if (!this.collections.has(collectionName)) {
        console.error(`Collection ${collectionName} not found`);
        this.metrics.errors++;
        return null;
      }
      
      const collection = this.collections.get(collectionName);
      
      // Generate ID if not provided
      if (!document.id) {
        document.id = this.generateId();
      }
      
      // Check unique indexes
      const collectionIndexes = this.indexes.get(collectionName);
      
      for (const [field, options] of collectionIndexes.entries()) {
        if (options.unique && document[field] !== undefined) {
          // Check if any existing document has the same value for this field
          for (const [_, existingDoc] of collection.entries()) {
            if (existingDoc[field] === document[field]) {
              console.error(`Duplicate value for unique field ${field}`);
              this.metrics.errors++;
              return null;
            }
          }
        }
      }
      
      // Add timestamps
      document.createdAt = new Date();
      document.updatedAt = new Date();
      
      // Store the document
      collection.set(document.id, document);
      
      // Update metrics
      this.metrics.operations.write++;
      this.recordLatency('write', startTime);
      
      console.log(`Inserted document with ID ${document.id} into collection ${collectionName}`);
      return document;
    } catch (error) {
      console.error(`Error inserting document into collection ${collectionName}:`, error);
      this.metrics.errors++;
      return null;
    }
  }

  // Find documents
  async findDocuments(collectionName, query = {}, options = {}) {
    const startTime = Date.now();
    
    try {
      if (!this.collections.has(collectionName)) {
        console.error(`Collection ${collectionName} not found`);
        this.metrics.errors++;
        return [];
      }
      
      const collection = this.collections.get(collectionName);
      let results = [];
      
      // If query is empty, return all documents
      if (Object.keys(query).length === 0) {
        results = Array.from(collection.values());
      } else {
        // Filter documents based on query
        for (const document of collection.values()) {
          if (this.matchesQuery(document, query)) {
            results.push(document);
          }
        }
      }
      
      // Apply sorting if specified
      if (options.sort) {
        const [field, direction] = Object.entries(options.sort)[0];
        results.sort((a, b) => {
          if (a[field] < b[field]) return direction === 1 ? -1 : 1;
          if (a[field] > b[field]) return direction === 1 ? 1 : -1;
          return 0;
        });
      }
      
      // Apply pagination if specified
      if (options.skip || options.limit) {
        const skip = options.skip || 0;
        const limit = options.limit || results.length;
        results = results.slice(skip, skip + limit);
      }
      
      // Update metrics
      this.metrics.operations.read++;
      this.recordLatency('read', startTime);
      
      console.log(`Found ${results.length} documents in collection ${collectionName}`);
      return results;
    } catch (error) {
      console.error(`Error finding documents in collection ${collectionName}:`, error);
      this.metrics.errors++;
      return [];
    }
  }

  // Find one document
  async findOneDocument(collectionName, query = {}) {
    const startTime = Date.now();
    
    try {
      if (!this.collections.has(collectionName)) {
        console.error(`Collection ${collectionName} not found`);
        this.metrics.errors++;
        return null;
      }
      
      const collection = this.collections.get(collectionName);
      
      // If query has an ID, try to get the document directly
      if (query.id) {
        const document = collection.get(query.id);
        
        if (document && this.matchesQuery(document, query)) {
          // Update metrics
          this.metrics.operations.read++;
          this.recordLatency('read', startTime);
          
          return document;
        }
      }
      
      // Otherwise, search for the first matching document
      for (const document of collection.values()) {
        if (this.matchesQuery(document, query)) {
          // Update metrics
          this.metrics.operations.read++;
          this.recordLatency('read', startTime);
          
          return document;
        }
      }
      
      // Update metrics
      this.metrics.operations.read++;
      this.recordLatency('read', startTime);
      
      console.log(`No document found in collection ${collectionName} matching query`);
      return null;
    } catch (error) {
      console.error(`Error finding document in collection ${collectionName}:`, error);
      this.metrics.errors++;
      return null;
    }
  }

  // Update a document
  async updateDocument(collectionName, query, update) {
    const startTime = Date.now();
    
    try {
      if (!this.collections.has(collectionName)) {
        console.error(`Collection ${collectionName} not found`);
        this.metrics.errors++;
        return false;
      }
      
      // Find the document to update
      const document = await this.findOneDocument(collectionName, query);
      
      if (!document) {
        console.log(`No document found in collection ${collectionName} matching query`);
        return false;
      }
      
      const collection = this.collections.get(collectionName);
      
      // Apply updates
      let updatedDocument = { ...document };
      
      if (update.$set) {
        updatedDocument = { ...updatedDocument, ...update.$set };
      }
      
      if (update.$unset) {
        for (const field of Object.keys(update.$unset)) {
          delete updatedDocument[field];
        }
      }
      
      if (update.$inc) {
        for (const [field, value] of Object.entries(update.$inc)) {
          updatedDocument[field] = (updatedDocument[field] || 0) + value;
        }
      }
      
      // Update timestamp
      updatedDocument.updatedAt = new Date();
      
      // Check unique indexes
      const collectionIndexes = this.indexes.get(collectionName);
      
      for (const [field, options] of collectionIndexes.entries()) {
        if (options.unique && updatedDocument[field] !== undefined && updatedDocument[field] !== document[field]) {
          // Check if any other document has the same value for this field
          for (const [docId, existingDoc] of collection.entries()) {
            if (docId !== document.id && existingDoc[field] === updatedDocument[field]) {
              console.error(`Duplicate value for unique field ${field}`);
              this.metrics.errors++;
              return false;
            }
          }
        }
      }
      
      // Store the updated document
      collection.set(document.id, updatedDocument);
      
      // Update metrics
      this.metrics.operations.write++;
      this.recordLatency('write', startTime);
      
      console.log(`Updated document with ID ${document.id} in collection ${collectionName}`);
      return true;
    } catch (error) {
      console.error(`Error updating document in collection ${collectionName}:`, error);
      this.metrics.errors++;
      return false;
    }
  }

  // Delete a document
  async deleteDocument(collectionName, query) {
    const startTime = Date.now();
    
    try {
      if (!this.collections.has(collectionName)) {
        console.error(`Collection ${collectionName} not found`);
        this.metrics.errors++;
        return false;
      }
      
      // Find the document to delete
      const document = await this.findOneDocument(collectionName, query);
      
      if (!document) {
        console.log(`No document found in collection ${collectionName} matching query`);
        return false;
      }
      
      const collection = this.collections.get(collectionName);
      
      // Delete the document
      collection.delete(document.id);
      
      // Update metrics
      this.metrics.operations.delete++;
      this.recordLatency('delete', startTime);
      
      console.log(`Deleted document with ID ${document.id} from collection ${collectionName}`);
      return true;
    } catch (error) {
      console.error(`Error deleting document from collection ${collectionName}:`, error);
      this.metrics.errors++;
      return false;
    }
  }

  // Start a transaction
  startTransaction() {
    const transactionId = this.generateId();
    
    this.transactions.set(transactionId, {
      id: transactionId,
      operations: [],
      status: 'active',
      startTime: Date.now()
    });
    
    console.log(`Started transaction: ${transactionId}`);
    return transactionId;
  }

  // Add operation to transaction
  addOperationToTransaction(transactionId, operation) {
    if (!this.transactions.has(transactionId)) {
      console.error(`Transaction ${transactionId} not found`);
      return false;
    }
    
    const transaction = this.transactions.get(transactionId);
    
    if (transaction.status !== 'active') {
      console.error(`Transaction ${transactionId} is not active`);
      return false;
    }
    
    transaction.operations.push(operation);
    console.log(`Added operation to transaction ${transactionId}`);
    return true;
  }

  // Commit a transaction
  async commitTransaction(transactionId) {
    if (!this.transactions.has(transactionId)) {
      console.error(`Transaction ${transactionId} not found`);
      return false;
    }
    
    const transaction = this.transactions.get(transactionId);
    
    if (transaction.status !== 'active') {
      console.error(`Transaction ${transactionId} is not active`);
      return false;
    }
    
    try {
      console.log(`Committing transaction: ${transactionId}`);
      
      // Execute all operations in the transaction
      for (const operation of transaction.operations) {
        switch (operation.type) {
          case 'insert':
            await this.insertDocument(operation.collection, operation.document);
            break;
            
          case 'update':
            await this.updateDocument(operation.collection, operation.query, operation.update);
            break;
            
          case 'delete':
            await this.deleteDocument(operation.collection, operation.query);
            break;
            
          default:
            console.error(`Unknown operation type: ${operation.type}`);
        }
      }
      
      // Mark transaction as committed
      transaction.status = 'committed';
      transaction.commitTime = Date.now();
      
      console.log(`Transaction ${transactionId} committed successfully`);
      return true;
    } catch (error) {
      console.error(`Error committing transaction ${transactionId}:`, error);
      
      // Mark transaction as failed
      transaction.status = 'failed';
      transaction.error = error.message;
      
      return false;
    }
  }

  // Abort a transaction
  abortTransaction(transactionId) {
    if (!this.transactions.has(transactionId)) {
      console.error(`Transaction ${transactionId} not found`);
      return false;
    }
    
    const transaction = this.transactions.get(transactionId);
    
    if (transaction.status !== 'active') {
      console.error(`Transaction ${transactionId} is not active`);
      return false;
    }
    
    // Mark transaction as aborted
    transaction.status = 'aborted';
    transaction.abortTime = Date.now();
    
    console.log(`Transaction ${transactionId} aborted`);
    return true;
  }

  // Check if a document matches a query
  matchesQuery(document, query) {
    for (const [field, value] of Object.entries(query)) {
      // Handle special operators
      if (field === '$or' && Array.isArray(value)) {
        let orMatch = false;
        
        for (const subQuery of value) {
          if (this.matchesQuery(document, subQuery)) {
            orMatch = true;
            break;
          }
        }
        
        if (!orMatch) {
          return false;
        }
        
        continue;
      }
      
      if (field === '$and' && Array.isArray(value)) {
        for (const subQuery of value) {
          if (!this.matchesQuery(document, subQuery)) {
            return false;
          }
        }
        
        continue;
      }
      
      // Handle regular field queries
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Handle operators
        for (const [operator, operand] of Object.entries(value)) {
          switch (operator) {
            case '$eq':
              if (document[field] !== operand) {
                return false;
              }
              break;
              
            case '$ne':
              if (document[field] === operand) {
                return false;
              }
              break;
              
            case '$gt':
              if (document[field] <= operand) {
                return false;
              }
              break;
              
            case '$gte':
              if (document[field] < operand) {
                return false;
              }
              break;
              
            case '$lt':
              if (document[field] >= operand) {
                return false;
              }
              break;
              
            case '$lte':
              if (document[field] > operand) {
                return false;
              }
              break;
              
            case '$in':
              if (!Array.isArray(operand) || !operand.includes(document[field])) {
                return false;
              }
              break;
              
            case '$nin':
              if (!Array.isArray(operand) || operand.includes(document[field])) {
                return false;
              }
              break;
              
            case '$exists':
              const fieldExists = document[field] !== undefined;
              if (operand !== fieldExists) {
                return false;
              }
              break;
              
            default:
              console.warn(`Unknown operator: ${operator}`);
          }
        }
      } else {
        // Simple equality check
        if (document[field] !== value) {
          return false;
        }
      }
    }
    
    return true;
  }

  // Generate a unique ID
  generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Record operation latency
  recordLatency(operationType, startTime) {
    const latency = Date.now() - startTime;
    this.metrics.latency[operationType].push(latency);
    
    // Keep only the last 100 latency measurements
    if (this.metrics.latency[operationType].length > 100) {
      this.metrics.latency[operationType].shift();
    }
  }

  // Get database metrics
  getMetrics() {
    const calculateAvgLatency = (latencies) => {
      if (latencies.length === 0) return 0;
      return latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length;
    };
    
    return {
      collections: this.collections.size,
      documents: Array.from(this.collections.entries()).reduce((total, [_, collection]) => total + collection.size, 0),
      operations: this.metrics.operations,
      errors: this.metrics.errors,
      avgLatency: {
        read: calculateAvgLatency(this.metrics.latency.read),
        write: calculateAvgLatency(this.metrics.latency.write),
        delete: calculateAvgLatency(this.metrics.latency.delete)
      },
      timestamp: new Date()
    };
  }

  // Drop a collection
  dropCollection(collectionName) {
    if (!this.collections.has(collectionName)) {
      console.error(`Collection ${collectionName} not found`);
      return false;
    }
    
    this.collections.delete(collectionName);
    this.indexes.delete(collectionName);
    
    console.log(`Dropped collection: ${collectionName}`);
    return true;
  }

  // Clear all data
  clearAllData() {
    const collectionCount = this.collections.size;
    
    this.collections.clear();
    this.indexes.clear();
    this.transactions.clear();
    
    // Reset metrics
    this.metrics = {
      operations: {
        read: 0,
        write: 0,
        delete: 0
      },
      errors: 0,
      latency: {
        read: [],
        write: [],
        delete: []
      }
    };
    
    console.log(`Cleared all data (${collectionCount} collections)`);
    return true;
  }
}

// Example serverless functions for the Legal AI platform

// Case matching function
const caseMatchingFunction = async (event, context) => {
  console.log('Executing case matching function');
  console.log('Event:', event);
  
  try {
    const { caseDescription, clientInfo } = event.body;
    
    if (!caseDescription) {
      return {
        error: 'Case description is required'
      };
    }
    
    // In a real implementation, this would use AI to match the case
    // For this prototype, we'll simulate the matching
    
    // Extract keywords from description
    const keywords = caseDescription.toLowerCase().split(/\s+/);
    
    // Define legal categories and their keywords
    const categories = {
      'FAMILY_LAW': ['divorce', 'custody', 'child', 'support', 'marriage', 'separation'],
      'CRIMINAL_LAW': ['arrest', 'crime', 'criminal', 'defense', 'charge', 'police'],
      'CORPORATE_LAW': ['business', 'company', 'contract', 'corporate', 'merger', 'acquisition'],
      'REAL_ESTATE_LAW': ['property', 'real estate', 'lease', 'tenant', 'landlord', 'mortgage'],
      'INTELLECTUAL_PROPERTY': ['patent', 'copyright', 'trademark', 'ip', 'invention', 'creative'],
      'IMMIGRATION_LAW': ['visa', 'citizenship', 'immigration', 'passport', 'foreign', 'asylum']
    };
    
    // Count keyword matches for each category
    const categoryScores = {};
    
    for (const [category, categoryKeywords] of Object.entries(categories)) {
      categoryScores[category] = 0;
      
      for (const keyword of categoryKeywords) {
        if (caseDescription.toLowerCase().includes(keyword)) {
          categoryScores[category] += 1;
        }
      }
    }
    
    // Find the best matching category
    let bestCategory = null;
    let bestScore = -1;
    
    for (const [category, score] of Object.entries(categoryScores)) {
      if (score > bestScore) {
        bestCategory = category;
        bestScore = score;
      }
    }
    
    // If no good match, default to general
    if (bestScore === 0) {
      bestCategory = 'GENERAL_LAW';
    }
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Return the result
    return {
      category: bestCategory,
      confidence: bestScore > 0 ? Math.min(bestScore / 3, 1) : 0.3,
      suggestedLawyerTypes: [bestCategory],
      estimatedComplexity: Math.random() > 0.5 ? 'HIGH' : 'MEDIUM',
      estimatedDuration: Math.floor(Math.random() * 12) + 1 + ' months',
      keywords: keywords.slice(0, 5)
    };
  } catch (error) {
    console.error('Error in case matching function:', error);
    return {
      error: 'Internal server error'
    };
  }
};

// Document processing function
const documentProcessingFunction = async (event, context) => {
  console.log('Executing document processing function');
  console.log('Event:', event);
  
  try {
    const { documentUrl, documentType, caseId } = event.body;
    
    if (!documentUrl) {
      return {
        error: 'Document URL is required'
      };
    }
    
    // In a real implementation, this would process the document
    // For this prototype, we'll simulate the processing
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return the result
    return {
      documentId: 'doc_' + Date.now(),
      status: 'PROCESSED',
      extractedText: 'This is a sample document with extracted text...',
      metadata: {
        pageCount: Math.floor(Math.random() * 20) + 1,
        fileSize: Math.floor(Math.random() * 1000000) + 100000,
        fileType: documentType || 'PDF',
        createdAt: new Date().toISOString(),
        caseId: caseId || null
      },
      entities: [
        { type: 'PERSON', text: 'John Doe', confidence: 0.95 },
        { type: 'DATE', text: '2023-01-15', confidence: 0.92 },
        { type: 'ORGANIZATION', text: 'Acme Corp', confidence: 0.88 }
      ]
    };
  } catch (error) {
    console.error('Error in document processing function:', error);
    return {
      error: 'Internal server error'
    };
  }
};

// Lawyer matching function
const lawyerMatchingFunction = async (event, context) => {
  console.log('Executing lawyer matching function');
  console.log('Event:', event);
  
  try {
    const { caseCategory, location, specialRequirements } = event.body;
    
    if (!caseCategory) {
      return {
        error: 'Case category is required'
      };
    }
    
    // In a real implementation, this would query a database of lawyers
    // For this prototype, we'll simulate the matching
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Generate simulated lawyers
    const lawyers = [];
    const count = Math.floor(Math.random() * 5) + 3; // 3-7 lawyers
    
    for (let i = 0; i < count; i++) {
      lawyers.push({
        id: 'lawyer_' + (i + 1),
        name: `Lawyer ${i + 1}`,
        specialization: caseCategory,
        location: location || 'Amsterdam, Netherlands',
        experience: Math.floor(Math.random() * 20) + 5 + ' years',
        languages: ['Dutch', 'English'],
        rating: (Math.random() * 2 + 3).toFixed(1), // 3.0-5.0 rating
        availability: Math.random() > 0.3 ? 'AVAILABLE' : 'LIMITED',
        matchScore: (Math.random() * 30 + 70).toFixed(1) // 70-100 match score
      });
    }
    
    // Sort by match score
    lawyers.sort((a, b) => parseFloat(b.matchScore) - parseFloat(a.matchScore));
    
    // Return the result
    return {
      lawyers,
      totalMatches: lawyers.length,
      bestMatch: lawyers[0],
      searchCriteria: {
        category: caseCategory,
        location: location || 'Any',
        specialRequirements: specialRequirements || []
      }
    };
  } catch (error) {
    console.error('Error in lawyer matching function:', error);
    return {
      error: 'Internal server error'
    };
  }
};

// Email generation function
const emailGenerationFunction = async (event, context) => {
  console.log('Executing email generation function');
  console.log('Event:', event);
  
  try {
    const { lawyerId, caseId, clientInfo, caseDetails } = event.body;
    
    if (!lawyerId || !caseId) {
      return {
        error: 'Lawyer ID and case ID are required'
      };
    }
    
    // In a real implementation, this would generate an email
    // For this prototype, we'll simulate the generation
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Generate a simulated email
    const emailSubject = `Legal Assistance Request: ${caseDetails?.category || 'New Case'}`;
    
    const emailBody = `
Dear [Lawyer Name],

I am writing to you on behalf of ${clientInfo?.name || 'our client'} regarding a ${caseDetails?.category || 'legal matter'}.

Case Summary:
${caseDetails?.description || 'The client requires legal assistance with their case.'}

Client Information:
- Name: ${clientInfo?.name || '[Client Name]'}
- Contact: ${clientInfo?.email || '[Client Email]'}
- Location: ${clientInfo?.location || '[Client Location]'}

The client has provided the following details about their case:
${caseDetails?.additionalInfo || '[Additional case information would be included here]'}

Please review this case and let us know if you would be interested in representing the client. If you have any questions or need additional information, please don't hesitate to contact us.

Thank you for your consideration.

Best regards,
Legal AI Reach Out Platform
    `;
    
    // Return the result
    return {
      emailId: 'email_' + Date.now(),
      recipient: `lawyer_${lawyerId}@example.com`,
      subject: emailSubject,
      body: emailBody,
      status: 'GENERATED',
      scheduledSendTime: new Date(Date.now() + 60000).toISOString() // 1 minute from now
    };
  } catch (error) {
    console.error('Error in email generation function:', error);
    return {
      error: 'Internal server error'
    };
  }
};

// Analytics function
const analyticsFunction = async (event, context) => {
  console.log('Executing analytics function');
  console.log('Event:', event);
  
  try {
    const { startDate, endDate, metrics } = event.body;
    
    // In a real implementation, this would query analytics data
    // For this prototype, we'll simulate the analytics
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Generate simulated analytics data
    const analyticsData = {
      period: {
        start: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: endDate || new Date().toISOString()
      },
      metrics: {
        caseCount: Math.floor(Math.random() * 500) + 100,
        successfulMatches: Math.floor(Math.random() * 400) + 50,
        averageResponseTime: Math.floor(Math.random() * 24) + 12 + ' hours',
        clientSatisfaction: (Math.random() * 1 + 4).toFixed(1), // 4.0-5.0 rating
        costPerCase: '€' + (Math.random() * 50 + 150).toFixed(2),
        revenueGenerated: '€' + (Math.random() * 50000 + 10000).toFixed(2)
      },
      categoryBreakdown: {
        'FAMILY_LAW': Math.floor(Math.random() * 30) + 10,
        'CRIMINAL_LAW': Math.floor(Math.random() * 20) + 5,
        'CORPORATE_LAW': Math.floor(Math.random() * 25) + 15,
        'REAL_ESTATE_LAW': Math.floor(Math.random() * 15) + 10,
        'INTELLECTUAL_PROPERTY': Math.floor(Math.random() * 10) + 5,
        'IMMIGRATION_LAW': Math.floor(Math.random() * 15) + 5,
        'GENERAL_LAW': Math.floor(Math.random() * 10) + 5
      },
      trends: {
        caseGrowth: (Math.random() * 30 + 5).toFixed(1) + '%',
        revenueGrowth: (Math.random() * 25 + 10).toFixed(1) + '%',
        costReduction: (Math.random() * 15 + 5).toFixed(1) + '%',
        clientRetention: (Math.random() * 10 + 85).toFixed(1) + '%'
      }
    };
    
    // Return the result
    return analyticsData;
  } catch (error) {
    console.error('Error in analytics function:', error);
    return {
      error: 'Internal server error'
    };
  }
};

// Create and export instances
export const serverlessFunctionManager = new ServerlessFunctionManager();
export const serverlessApiGateway = new ServerlessApiGateway(serverlessFunctionManager);
export const serverlessDatabaseManager = new ServerlessDatabaseManager();

// Register functions
serverlessFunctionManager.registerFunction('caseMatching', caseMatchingFunction, {
  timeout: 10000,
  memorySize: 256,
  events: [
    { type: 'api.request', path: '/api/case-matching' },
    { type: 'case.created' }
  ]
});

serverlessFunctionManager.registerFunction('documentProcessing', documentProcessingFunction, {
  timeout: 30000,
  memorySize: 512,
  events: [
    { type: 'api.request', path: '/api/document-processing' },
    { type: 'document.uploaded' }
  ]
});

serverlessFunctionManager.registerFunction('lawyerMatching', lawyerMatchingFunction, {
  timeout: 15000,
  memorySize: 256,
  events: [
    { type: 'api.request', path: '/api/lawyer-matching' },
    { type: 'case.categorized' }
  ]
});

serverlessFunctionManager.registerFunction('emailGeneration', emailGenerationFunction, {
  timeout: 10000,
  memorySize: 256,
  events: [
    { type: 'api.request', path: '/api/email-generation' },
    { type: 'lawyer.matched' }
  ]
});

serverlessFunctionManager.registerFunction('analytics', analyticsFunction, {
  timeout: 20000,
  memorySize: 512,
  events: [
    { type: 'api.request', path: '/api/analytics' },
    { type: 'analytics.requested' }
  ]
});

// Register API routes
serverlessApiGateway.registerRoute('POST', '/api/case-matching', 'caseMatching');
serverlessApiGateway.registerRoute('POST', '/api/document-processing', 'documentProcessing');
serverlessApiGateway.registerRoute('POST', '/api/lawyer-matching', 'lawyerMatching');
serverlessApiGateway.registerRoute('POST', '/api/email-generation', 'emailGeneration');
serverlessApiGateway.registerRoute('GET', '/api/analytics', 'analytics');

// Configure CORS
serverlessApiGateway.configureCors({
  allowOrigin: '*',
  allowMethods: 'GET,POST,PUT,DELETE,OPTIONS',
  allowHeaders: 'Content-Type,Authorization,X-API-Key'
});

// Initialize database
serverlessDatabaseManager.initialize();

// Create collections
serverlessDatabaseManager.createCollection('users');
serverlessDatabaseManager.createCollection('cases');
serverlessDatabaseManager.createCollection('documents');
serverlessDatabaseManager.createCollection('lawyers');
serverlessDatabaseManager.createCollection('messages');

// Create indexes
serverlessDatabaseManager.createIndex('users', 'email', { unique: true });
serverlessDatabaseManager.createIndex('cases', 'clientId');
serverlessDatabaseManager.createIndex('cases', 'category');
serverlessDatabaseManager.createIndex('documents', 'caseId');
serverlessDatabaseManager.createIndex('lawyers', 'specialization');
serverlessDatabaseManager.createIndex('messages', 'caseId');

// Example usage:
/*
// Invoke a function
const result = await serverlessFunctionManager.invokeFunction('caseMatching', {
  caseDescription: 'I need help with my divorce proceedings and child custody.',
  clientInfo: {
    name: 'John Doe',
    email: 'john.doe@example.com',
    location: 'Amsterdam'
  }
});
console.log('Function result:', result);

// Handle an API request
const apiResponse = await serverlessApiGateway.handleRequest(
  'POST',
  '/api/lawyer-matching',
  { 'Content-Type': 'application/json' },
  {
    caseCategory: 'FAMILY_LAW',
    location: 'Amsterdam',
    specialRequirements: ['Dutch speaking', 'Evening availability']
  }
);
console.log('API response:', apiResponse);

// Insert a document into the database
const user = await serverlessDatabaseManager.insertDocument('users', {
  name: 'Jane Smith',
  email: 'jane.smith@example.com',
  role: 'CLIENT',
  location: 'Rotterdam'
});
console.log('Inserted user:', user);

// Find documents in the database
const familyLawCases = await serverlessDatabaseManager.findDocuments('cases', {
  category: 'FAMILY_LAW'
}, {
  sort: { createdAt: -1 },
  limit: 10
});
console.log('Family law cases:', familyLawCases);

// Get function metrics
const metrics = serverlessFunctionManager.getFunctionMetrics('caseMatching');
console.log('Function metrics:', metrics);

// Get database metrics
const dbMetrics = serverlessDatabaseManager.getMetrics();
console.log('Database metrics:', dbMetrics);
*/
