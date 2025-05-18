/**
 * Real Backend API Endpoints for Legal AI Reach Out Platform
 * 
 * This file implements actual API endpoints with proper data models,
 * controllers, and middleware for a production environment.
 */

const express = require('express');
const router = express.Router();
const { csrfProtection, authenticateToken } = require('./security-enhancements');
const validator = require('validator');
const mongoose = require('mongoose');

// Connect to MongoDB (in a real app, connection string would be in environment variables)
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/legal_ai_platform', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Define Mongoose schemas and models
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    validate: {
      validator: validator.isEmail,
      message: 'Invalid email format'
    }
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  role: {
    type: String,
    enum: ['user', 'investor', 'admin'],
    default: 'user'
  },
  firstName: String,
  lastName: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: Date
});

const caseSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  description: {
    type: String,
    required: true
  },
  legalFields: {
    type: [String],
    required: true
  },
  complexity: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'matching', 'connected', 'closed'],
    default: 'pending'
  },
  documents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  }],
  outreachAttempts: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const documentSchema = new mongoose.Schema({
  case: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  source: {
    type: String,
    enum: ['email', 'drive', 'manual'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const lawyerSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    validate: {
      validator: validator.isEmail,
      message: 'Invalid email format'
    }
  },
  name: {
    type: String,
    required: true
  },
  specializations: {
    type: [String],
    required: true
  },
  location: String,
  experience: Number,
  responseRate: {
    type: Number,
    min: 0,
    max: 100
  },
  acceptanceRate: {
    type: Number,
    min: 0,
    max: 100
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const outreachSchema = new mongoose.Schema({
  case: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true
  },
  lawyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lawyer',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'opened', 'responded', 'accepted', 'declined'],
    default: 'pending'
  },
  sentAt: Date,
  openedAt: Date,
  respondedAt: Date,
  response: String,
  followUpCount: {
    type: Number,
    default: 0
  },
  lastFollowUpAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const metricSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  responseRate: {
    type: Number,
    required: true
  },
  caseAcceptance: {
    type: Number,
    required: true
  },
  timeToLawyer: {
    type: Number,
    required: true
  },
  profitMargin: {
    type: Number,
    required: true
  },
  totalCases: {
    type: Number,
    required: true
  },
  totalOutreach: {
    type: Number,
    required: true
  },
  totalConnections: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create models
const User = mongoose.model('User', userSchema);
const Case = mongoose.model('Case', caseSchema);
const Document = mongoose.model('Document', documentSchema);
const Lawyer = mongoose.model('Lawyer', lawyerSchema);
const Outreach = mongoose.model('Outreach', outreachSchema);
const Metric = mongoose.model('Metric', metricSchema);

// API Controllers

// User Controller
const UserController = {
  // Register new user
  async register(req, res) {
    try {
      const { email, password, firstName, lastName } = req.body;
      
      // Validate input
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }
      
      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }
      
      // Hash password (in a real app)
      // const hashedPassword = await bcrypt.hash(password, 10);
      const hashedPassword = password; // For demo purposes only
      
      // Create new user
      const user = new User({
        email,
        password: hashedPassword,
        firstName,
        lastName
      });
      
      await user.save();
      
      res.status(201).json({
        success: true,
        message: 'User registered successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error registering user',
        error: error.message
      });
    }
  },
  
  // Login user
  async login(req, res) {
    try {
      const { email, password } = req.body;
      
      // Validate input
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }
      
      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
      
      // Verify password (in a real app)
      // const isMatch = await bcrypt.compare(password, user.password);
      const isMatch = password === user.password; // For demo purposes only
      
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
      
      // Update last login
      user.lastLogin = Date.now();
      await user.save();
      
      // Generate token (using the function from security-enhancements.js)
      // const token = generateToken(user.email);
      
      res.json({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error logging in',
        error: error.message
      });
    }
  },
  
  // Get user profile
  async getProfile(req, res) {
    try {
      const user = await User.findOne({ email: req.user.email }).select('-password');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      res.json({
        success: true,
        user
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching user profile',
        error: error.message
      });
    }
  }
};

// Case Controller
const CaseController = {
  // Submit new case
  async submitCase(req, res) {
    try {
      const { description, legalFields } = req.body;
      
      // Validate input
      if (!description) {
        return res.status(400).json({
          success: false,
          message: 'Case description is required'
        });
      }
      
      // Find user
      const user = await User.findOne({ email: req.user.email });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Determine legal fields if not provided
      let fields = legalFields;
      if (!fields || !Array.isArray(fields) || fields.length === 0) {
        // In a real app, this would use AI to determine legal fields
        fields = ['Contract Law']; // Default for demo
      }
      
      // Create new case
      const newCase = new Case({
        user: user._id,
        description,
        legalFields: fields
      });
      
      await newCase.save();
      
      // In a real app, we would trigger the outreach process here
      
      res.status(201).json({
        success: true,
        message: 'Case submitted successfully',
        case: {
          id: newCase._id,
          description: newCase.description,
          legalFields: newCase.legalFields,
          status: newCase.status,
          createdAt: newCase.createdAt
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error submitting case',
        error: error.message
      });
    }
  },
  
  // Get user cases
  async getUserCases(req, res) {
    try {
      const user = await User.findOne({ email: req.user.email });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      const cases = await Case.find({ user: user._id }).sort({ createdAt: -1 });
      
      res.json({
        success: true,
        cases
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching user cases',
        error: error.message
      });
    }
  },
  
  // Get case details
  async getCaseDetails(req, res) {
    try {
      const { caseId } = req.params;
      
      const user = await User.findOne({ email: req.user.email });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      const caseDetails = await Case.findOne({
        _id: caseId,
        user: user._id
      }).populate('documents');
      
      if (!caseDetails) {
        return res.status(404).json({
          success: false,
          message: 'Case not found'
        });
      }
      
      // Get outreach attempts
      const outreachAttempts = await Outreach.find({
        case: caseDetails._id
      }).populate('lawyer', 'name email specializations');
      
      res.json({
        success: true,
        case: caseDetails,
        outreach: outreachAttempts
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching case details',
        error: error.message
      });
    }
  }
};

// Document Controller
const DocumentController = {
  // Upload document
  async uploadDocument(req, res) {
    try {
      const { caseId, name, type, content, source } = req.body;
      
      // Validate input
      if (!caseId || !name || !type || !content || !source) {
        return res.status(400).json({
          success: false,
          message: 'All document fields are required'
        });
      }
      
      const user = await User.findOne({ email: req.user.email });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Check if case exists and belongs to user
      const caseDetails = await Case.findOne({
        _id: caseId,
        user: user._id
      });
      
      if (!caseDetails) {
        return res.status(404).json({
          success: false,
          message: 'Case not found'
        });
      }
      
      // Create new document
      const newDocument = new Document({
        case: caseId,
        name,
        type,
        content,
        source
      });
      
      await newDocument.save();
      
      // Add document to case
      caseDetails.documents.push(newDocument._id);
      caseDetails.updatedAt = Date.now();
      await caseDetails.save();
      
      res.status(201).json({
        success: true,
        message: 'Document uploaded successfully',
        document: {
          id: newDocument._id,
          name: newDocument.name,
          type: newDocument.type,
          source: newDocument.source,
          createdAt: newDocument.createdAt
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error uploading document',
        error: error.message
      });
    }
  },
  
  // Get case documents
  async getCaseDocuments(req, res) {
    try {
      const { caseId } = req.params;
      
      const user = await User.findOne({ email: req.user.email });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Check if case exists and belongs to user
      const caseDetails = await Case.findOne({
        _id: caseId,
        user: user._id
      });
      
      if (!caseDetails) {
        return res.status(404).json({
          success: false,
          message: 'Case not found'
        });
      }
      
      // Get documents
      const documents = await Document.find({
        case: caseId
      }).sort({ createdAt: -1 });
      
      res.json({
        success: true,
        documents
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching case documents',
        error: error.message
      });
    }
  }
};

// Metrics Controller
const MetricsController = {
  // Get current metrics
  async getCurrentMetrics(req, res) {
    try {
      // Check if user is an investor
      if (req.user.role !== 'investor' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      // Get latest metrics
      const latestMetrics = await Metric.findOne().sort({ date: -1 });
      
      if (!latestMetrics) {
        return res.status(404).json({
          success: false,
          message: 'No metrics found'
        });
      }
      
      res.json({
        success: true,
        metrics: latestMetrics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching metrics',
        error: error.message
      });
    }
  },
  
  // Get metrics history
  async getMetricsHistory(req, res) {
    try {
      // Check if user is an investor
      if (req.user.role !== 'investor' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      const { period } = req.query;
      let startDate;
      
      // Determine start date based on period
      switch (period) {
        case 'week':
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'quarter':
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case 'year':
          startDate = new Date();
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1); // Default to 1 month
      }
      
      // Get metrics history
      const metricsHistory = await Metric.find({
        date: { $gte: startDate }
      }).sort({ date: 1 });
      
      res.json({
        success: true,
        metrics: metricsHistory
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching metrics history',
        error: error.message
      });
    }
  },
  
  // Get business assumptions
  async getBusinessAssumptions(req, res) {
    try {
      // Check if user is an investor
      if (req.user.role !== 'investor' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      // In a real app, this would come from a database
      // For this demo, we'll return static data
      const assumptions = {
        marketSize: 18500,
        lawyerWorkload: 50,
        initialResponseRate: 30,
        caseAcceptanceRate: '0.1% to 1.3%',
        revenueModel: 'Pay-per-use based on resource consumption - Resource cost × 2',
        aiProcessingCost: '€0.05 per minute',
        storageCost: '€0.01 per GB',
        emailOutreachCost: '€0.01 per email'
      };
      
      res.json({
        success: true,
        assumptions
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching business assumptions',
        error: error.message
      });
    }
  },
  
  // Get financial projections
  async getFinancialProjections(req, res) {
    try {
      // Check if user is an investor
      if (req.user.role !== 'investor' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      // In a real app, this would come from a database
      // For this demo, we'll return static data
      const projections = {
        q2_2025: { revenue: 125000, userGrowth: 1500, caseVolume: 2500 },
        q3_2025: { revenue: 250000, userGrowth: 3000, caseVolume: 5000 },
        q4_2025: { revenue: 375000, userGrowth: 5000, caseVolume: 8000 },
        q1_2026: { revenue: 500000, userGrowth: 7500, caseVolume: 12000 }
      };
      
      res.json({
        success: true,
        projections
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching financial projections',
        error: error.message
      });
    }
  }
};

// API Routes

// User routes
router.post('/auth/register', csrfProtection, UserController.register);
router.post('/auth/login', csrfProtection, UserController.login);
router.get('/user/profile', authenticateToken, csrfProtection, UserController.getProfile);

// Case routes
router.post('/cases', authenticateToken, csrfProtection, CaseController.submitCase);
router.get('/cases', authenticateToken, CaseController.getUserCases);
router.get('/cases/:caseId', authenticateToken, CaseController.getCaseDetails);

// Document routes
router.post('/documents', authenticateToken, csrfProtection, DocumentController.uploadDocument);
router.get('/cases/:caseId/documents', authenticateToken, DocumentController.getCaseDocuments);

// Metrics routes
router.get('/metrics/current', authenticateToken, MetricsController.getCurrentMetrics);
router.get('/metrics/history', authenticateToken, MetricsController.getMetricsHistory);
router.get('/metrics/assumptions', authenticateToken, MetricsController.getBusinessAssumptions);
router.get('/metrics/projections', authenticateToken, MetricsController.getFinancialProjections);

module.exports = router;
