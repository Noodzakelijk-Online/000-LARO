-- Database Schema for Legal AI Reach Out Platform

-- Users Table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Investors Table
CREATE TABLE investors (
    investor_id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    access_level INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Legal Fields Table
CREATE TABLE legal_fields (
    field_id SERIAL PRIMARY KEY,
    field_name VARCHAR(100) NOT NULL,
    description TEXT
);

-- Lawyers Table
CREATE TABLE lawyers (
    lawyer_id SERIAL PRIMARY KEY,
    nova_id VARCHAR(50) UNIQUE, -- Nederlandse orde van advocaten ID
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    firm_name VARCHAR(255),
    city VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lawyer Specializations (Many-to-Many)
CREATE TABLE lawyer_specializations (
    lawyer_id INTEGER REFERENCES lawyers(lawyer_id),
    field_id INTEGER REFERENCES legal_fields(field_id),
    PRIMARY KEY (lawyer_id, field_id)
);

-- Cases Table
CREATE TABLE cases (
    case_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    case_title VARCHAR(255) NOT NULL,
    case_summary TEXT,
    ai_generated_summary TEXT,
    legal_field_id INTEGER REFERENCES legal_fields(field_id),
    status VARCHAR(50) DEFAULT 'pending', -- pending, matched, accepted, closed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    complexity_score FLOAT, -- AI-determined complexity
    urgency_level INTEGER -- 1-5 scale
);

-- Secondary Legal Fields for Cases (Many-to-Many)
CREATE TABLE case_secondary_fields (
    case_id INTEGER REFERENCES cases(case_id),
    field_id INTEGER REFERENCES legal_fields(field_id),
    confidence_score FLOAT, -- AI confidence in this classification
    PRIMARY KEY (case_id, field_id)
);

-- Documents Table
CREATE TABLE documents (
    document_id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(case_id),
    document_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(50), -- email, contract, court_filing, etc.
    file_path VARCHAR(255),
    content_summary TEXT, -- AI-generated summary
    source VARCHAR(50), -- manual, gmail, outlook, gdrive, onedrive
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_key_document BOOLEAN DEFAULT FALSE
);

-- Outreach Table
CREATE TABLE outreach (
    outreach_id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(case_id),
    lawyer_id INTEGER REFERENCES lawyers(lawyer_id),
    initial_contact_date TIMESTAMP,
    response_received BOOLEAN DEFAULT FALSE,
    response_date TIMESTAMP,
    response_type VARCHAR(50), -- accepted, declined, more_info
    follow_up_count INTEGER DEFAULT 0,
    last_follow_up_date TIMESTAMP,
    next_follow_up_date TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Case Assignments
CREATE TABLE case_assignments (
    assignment_id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(case_id),
    lawyer_id INTEGER REFERENCES lawyers(lawyer_id),
    assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active', -- active, completed, terminated
    completion_date TIMESTAMP
);

-- Resource Usage Metrics
CREATE TABLE resource_usage (
    usage_id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(case_id),
    ai_processing_time_ms INTEGER,
    storage_bytes_used BIGINT,
    email_count INTEGER,
    follow_up_count INTEGER,
    total_resource_cost DECIMAL(10,2),
    user_charge DECIMAL(10,2), -- resource_cost * 2
    usage_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System Metrics for Investor Dashboard
CREATE TABLE system_metrics (
    metric_id SERIAL PRIMARY KEY,
    metric_date DATE UNIQUE,
    total_users INTEGER,
    new_users INTEGER,
    total_cases INTEGER,
    new_cases INTEGER,
    active_cases INTEGER,
    completed_cases INTEGER,
    avg_response_rate FLOAT,
    avg_acceptance_rate FLOAT,
    avg_time_to_lawyer_hours FLOAT,
    total_revenue DECIMAL(10,2),
    total_resource_cost DECIMAL(10,2),
    profit_margin FLOAT
);

-- Business Plan Assumptions
CREATE TABLE business_assumptions (
    assumption_id SERIAL PRIMARY KEY,
    category VARCHAR(100), -- market_size, response_rate, acceptance_rate, etc.
    assumption_name VARCHAR(255),
    assumption_value VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    is_current BOOLEAN DEFAULT TRUE
);

-- Indexes for performance
CREATE INDEX idx_cases_user_id ON cases(user_id);
CREATE INDEX idx_cases_legal_field_id ON cases(legal_field_id);
CREATE INDEX idx_documents_case_id ON documents(case_id);
CREATE INDEX idx_outreach_case_id ON outreach(case_id);
CREATE INDEX idx_outreach_lawyer_id ON outreach(lawyer_id);
CREATE INDEX idx_resource_usage_case_id ON resource_usage(case_id);
CREATE INDEX idx_system_metrics_date ON system_metrics(metric_date);
