-- Disease Zone Database Initialization Script
-- This script sets up the basic tables needed for the comprehensive web frontend

-- Create database if it doesn't exist (PostgreSQL)
-- CREATE DATABASE IF NOT EXISTS disease_zone;

-- Users table with role-based access
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'patient',
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    phone VARCHAR(20),
    date_of_birth DATE,
    gender VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    blockchain_address VARCHAR(255),
    health_credit_balance DECIMAL(20, 8) DEFAULT 0,
    subscription_tier VARCHAR(50) DEFAULT 'free',
    medical_license_number VARCHAR(100),
    hospital_affiliation VARCHAR(255),
    specialization VARCHAR(255),
    insurance_company VARCHAR(255),
    insurance_policy_number VARCHAR(100),
    privacy_settings JSON,
    consent_data_sharing BOOLEAN DEFAULT false,
    consent_research BOOLEAN DEFAULT false,
    consent_blockchain BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    email_verified BOOLEAN DEFAULT false,
    account_status VARCHAR(20) DEFAULT 'active'
);

-- Medical conditions/diseases table
CREATE TABLE IF NOT EXISTS medical_conditions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    condition_name VARCHAR(255) NOT NULL,
    icd_10_code VARCHAR(10),
    diagnosis_date DATE,
    current_status VARCHAR(50) DEFAULT 'active',
    severity VARCHAR(20),
    notes TEXT,
    diagnosed_by VARCHAR(255),
    treatment_status VARCHAR(50),
    medications TEXT,
    family_history BOOLEAN DEFAULT false,
    reported_by VARCHAR(50) DEFAULT 'patient',
    verified_by_doctor BOOLEAN DEFAULT false,
    blockchain_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Family medical history
CREATE TABLE IF NOT EXISTS family_medical_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    family_member_relation VARCHAR(50) NOT NULL,
    condition_name VARCHAR(255) NOT NULL,
    icd_10_code VARCHAR(10),
    age_of_onset INTEGER,
    current_status VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User sessions for authentication
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255),
    expires_at TIMESTAMP NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Disease tracking and reporting
CREATE TABLE IF NOT EXISTS disease_reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    disease_type VARCHAR(100) NOT NULL,
    location_reported VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    symptoms TEXT,
    severity_level INTEGER CHECK (severity_level >= 1 AND severity_level <= 10),
    confirmed_diagnosis BOOLEAN DEFAULT false,
    healthcare_provider VARCHAR(255),
    report_date DATE NOT NULL,
    verified_by_medical_professional BOOLEAN DEFAULT false,
    public_health_notification BOOLEAN DEFAULT false,
    blockchain_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Research data marketplace transactions
CREATE TABLE IF NOT EXISTS research_transactions (
    id SERIAL PRIMARY KEY,
    researcher_id INTEGER REFERENCES users(id),
    data_provider_id INTEGER REFERENCES users(id),
    transaction_type VARCHAR(50) NOT NULL,
    data_category VARCHAR(100),
    health_credits_amount DECIMAL(20, 8),
    blockchain_transaction_hash VARCHAR(255),
    transaction_status VARCHAR(20) DEFAULT 'pending',
    research_purpose TEXT,
    data_anonymization_level VARCHAR(50),
    access_duration_days INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Insurance risk assessments
CREATE TABLE IF NOT EXISTS insurance_assessments (
    id SERIAL PRIMARY KEY,
    insurance_company_id INTEGER REFERENCES users(id),
    assessment_type VARCHAR(100) NOT NULL,
    demographic_filters JSON,
    risk_factors JSON,
    assessment_results JSON,
    population_size INTEGER,
    risk_score DECIMAL(5, 2),
    confidence_level DECIMAL(5, 2),
    blockchain_verification_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit trail for compliance
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id INTEGER,
    details JSON,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API usage tracking
CREATE TABLE IF NOT EXISTS api_usage (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    request_size_bytes INTEGER,
    response_size_bytes INTEGER,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_medical_conditions_user_id ON medical_conditions(user_id);
CREATE INDEX IF NOT EXISTS idx_medical_conditions_condition_name ON medical_conditions(condition_name);
CREATE INDEX IF NOT EXISTS idx_disease_reports_user_id ON disease_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_disease_reports_disease_type ON disease_reports(disease_type);
CREATE INDEX IF NOT EXISTS idx_disease_reports_location ON disease_reports(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_research_transactions_researcher_id ON research_transactions(researcher_id);
CREATE INDEX IF NOT EXISTS idx_insurance_assessments_company_id ON insurance_assessments(insurance_company_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_timestamp ON api_usage(timestamp);

-- Update trigger for timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medical_conditions_updated_at BEFORE UPDATE ON medical_conditions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_disease_reports_updated_at BEFORE UPDATE ON disease_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: admin123 - change immediately in production)
INSERT INTO users (
    username,
    email,
    password_hash,
    role,
    first_name,
    last_name,
    account_status,
    email_verified
) VALUES (
    'admin',
    'admin@disease.zone',
    '$2b$10$rQj7DqzKxYbJJ8YHNtmO6eK5Q5yGgZJJ4xXxXx4xXxXxXxXxXxXx',
    'admin',
    'System',
    'Administrator',
    'active',
    true
) ON CONFLICT (email) DO NOTHING;

-- Insert sample medical professional
INSERT INTO users (
    username,
    email,
    password_hash,
    role,
    first_name,
    last_name,
    medical_license_number,
    hospital_affiliation,
    specialization,
    account_status,
    email_verified
) VALUES (
    'dr_smith',
    'dr.smith@hospital.disease.zone',
    '$2b$10$rQj7DqzKxYbJJ8YHNtmO6eK5Q5yGgZJJ4xXxXx4xXxXxXxXxXxXx',
    'medical_professional',
    'Dr. Jane',
    'Smith',
    'MD123456',
    'General Hospital',
    'Infectious Diseases',
    'active',
    true
) ON CONFLICT (email) DO NOTHING;