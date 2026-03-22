// MongoDB Initialization Script
// Win11 Development Environment

// Switch to devdb database
db = db.getSiblingDB('devdb');

// Create collections with validation
db.createCollection('documents', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['title', 'created_at'],
            properties: {
                title: {
                    bsonType: 'string',
                    description: 'Document title - required'
                },
                content: {
                    bsonType: 'string',
                    description: 'Document content'
                },
                tags: {
                    bsonType: 'array',
                    items: {
                        bsonType: 'string'
                    },
                    description: 'Array of tags'
                },
                created_at: {
                    bsonType: 'string',
                    description: 'Creation timestamp - required'
                },
                updated_at: {
                    bsonType: 'string',
                    description: 'Update timestamp'
                }
            }
        }
    }
});

db.createCollection('users', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['email', 'username'],
            properties: {
                email: {
                    bsonType: 'string',
                    pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
                    description: 'Valid email address - required'
                },
                username: {
                    bsonType: 'string',
                    minLength: 3,
                    maxLength: 50,
                    description: 'Username - required'
                },
                profile: {
                    bsonType: 'object',
                    properties: {
                        firstName: { bsonType: 'string' },
                        lastName: { bsonType: 'string' },
                        avatar: { bsonType: 'string' }
                    }
                },
                settings: {
                    bsonType: 'object'
                },
                created_at: {
                    bsonType: 'string'
                }
            }
        }
    }
});

db.createCollection('logs');

// Create indexes
db.documents.createIndex({ 'title': 1 });
db.documents.createIndex({ 'tags': 1 });
db.documents.createIndex({ 'created_at': -1 });

db.users.createIndex({ 'email': 1 }, { unique: true });
db.users.createIndex({ 'username': 1 }, { unique: true });

db.logs.createIndex({ 'timestamp': -1 });
db.logs.createIndex({ 'level': 1 });

// Insert sample documents
db.documents.insertMany([
    {
        title: 'Welcome Document',
        content: 'Welcome to the Win11 Development Environment! This is a sample document stored in MongoDB.',
        tags: ['welcome', 'sample', 'mongodb'],
        created_at: new Date().toISOString()
    },
    {
        title: 'Getting Started',
        content: 'This document explains how to get started with the development environment.',
        tags: ['guide', 'tutorial'],
        created_at: new Date().toISOString()
    },
    {
        title: 'API Documentation',
        content: 'Documentation for the backend APIs including FastAPI, Express, and Go services.',
        tags: ['api', 'documentation', 'backend'],
        created_at: new Date().toISOString()
    }
]);

// Insert sample log entry
db.logs.insertOne({
    level: 'info',
    message: 'MongoDB initialized successfully',
    service: 'mongo-init',
    timestamp: new Date().toISOString()
});

print('✅ MongoDB initialization completed successfully!');
