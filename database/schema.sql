-- diseaseZone Database Schema
-- Supporting user management, family disease tracking, and medical professional access

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user', -- 'user', 'medical_professional', 'researcher', 'compliance', 'admin'
    verified BOOLEAN DEFAULT FALSE,
    verification_token TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,

    -- Profile information
    date_of_birth DATE,
    gender TEXT,
    location_state TEXT,
    location_zip TEXT,

    -- Medical professional specific fields
    medical_license_number TEXT,
    medical_specialty TEXT,
    institution_name TEXT,
    institution_verified BOOLEAN DEFAULT FALSE,

    -- Privacy settings
    share_family_data BOOLEAN DEFAULT TRUE,
    allow_research_contact BOOLEAN DEFAULT FALSE
);

-- API Keys for medical professionals and external systems
CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_id TEXT UNIQUE NOT NULL,
    api_key_hash TEXT NOT NULL,
    user_id INTEGER,
    name TEXT NOT NULL,
    permissions TEXT NOT NULL, -- JSON array of permissions
    rate_limit INTEGER DEFAULT 1000, -- requests per hour
    expires_at DATETIME,
    last_used DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT TRUE,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Disease registry - our internal disease ID system
CREATE TABLE IF NOT EXISTS diseases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    disease_code TEXT UNIQUE NOT NULL, -- e.g., 'DZ_ALZ_001'
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'neurological', 'genetic', 'musculoskeletal', 'std'
    subcategory TEXT,
    icd10_codes TEXT, -- JSON array of ICD-10 codes
    inheritance_pattern TEXT, -- 'autosomal_dominant', 'autosomal_recessive', 'complex', 'none'
    prevalence_description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Family disease declarations
CREATE TABLE IF NOT EXISTS family_diseases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    disease_id INTEGER NOT NULL,
    family_member TEXT NOT NULL, -- 'mother', 'father', 'sibling', 'child', 'grandparent', 'other'
    family_member_name TEXT,
    family_member_relationship TEXT, -- detailed relationship if 'other'

    -- Disease status
    has_disease BOOLEAN NOT NULL,
    diagnosis_confirmed BOOLEAN DEFAULT FALSE,
    diagnosed_by_professional BOOLEAN DEFAULT FALSE,
    diagnosis_date DATE,
    acquired_disease_on DATETIME,

    -- Symptoms tracking
    family_member_has_symptoms TEXT, -- JSON array of current symptoms
    family_member_had_symptoms TEXT, -- JSON array of past symptoms
    symptom_severity TEXT, -- 'mild', 'moderate', 'severe'
    symptom_onset_age INTEGER,

    -- Children and inheritance
    family_member_has_children BOOLEAN DEFAULT FALSE,
    family_member_children_count INTEGER DEFAULT 0,
    family_member_children_have_disease BOOLEAN DEFAULT FALSE,
    family_member_children_affected_count INTEGER DEFAULT 0,

    -- Additional information
    family_member_disease_notes TEXT,
    treatment_history TEXT, -- JSON array of treatments
    family_member_deceased BOOLEAN DEFAULT FALSE,
    cause_of_death TEXT,

    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    verified_by_professional BOOLEAN DEFAULT FALSE,
    verified_by_user_id INTEGER,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (disease_id) REFERENCES diseases(id),
    FOREIGN KEY (verified_by_user_id) REFERENCES users(id),

    UNIQUE(user_id, disease_id, family_member, family_member_name)
);

-- User comments on diseases
CREATE TABLE IF NOT EXISTS disease_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    disease_id INTEGER NOT NULL,
    comment_text TEXT NOT NULL,
    is_personal_experience BOOLEAN DEFAULT FALSE,
    family_member_affected TEXT, -- if commenting about family member

    -- Moderation
    flagged BOOLEAN DEFAULT FALSE,
    flag_count INTEGER DEFAULT 0,
    approved BOOLEAN DEFAULT FALSE,
    approved_by_user_id INTEGER,

    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (disease_id) REFERENCES diseases(id),
    FOREIGN KEY (approved_by_user_id) REFERENCES users(id)
);

-- Comment flags/reports
CREATE TABLE IF NOT EXISTS comment_flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id INTEGER NOT NULL,
    flagged_by_user_id INTEGER NOT NULL,
    flag_reason TEXT NOT NULL, -- 'inappropriate', 'misinformation', 'spam', 'other'
    flag_description TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_by_user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (comment_id) REFERENCES disease_comments(id) ON DELETE CASCADE,
    FOREIGN KEY (flagged_by_user_id) REFERENCES users(id),
    FOREIGN KEY (resolved_by_user_id) REFERENCES users(id),

    UNIQUE(comment_id, flagged_by_user_id)
);

-- Data contributions from medical professionals
CREATE TABLE IF NOT EXISTS data_contributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contributor_user_id INTEGER NOT NULL,
    disease_id INTEGER NOT NULL,
    contribution_type TEXT NOT NULL, -- 'prevalence_update', 'new_research', 'treatment_update'
    data_payload TEXT NOT NULL, -- JSON data
    source_reference TEXT, -- research paper, clinical study, etc.

    -- Review process
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    reviewed_by_user_id INTEGER,
    review_notes TEXT,
    reviewed_at DATETIME,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (contributor_user_id) REFERENCES users(id),
    FOREIGN KEY (disease_id) REFERENCES diseases(id),
    FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id)
);

-- User sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Ticket types configuration (admin can modify)
CREATE TABLE IF NOT EXISTS ticket_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    priority_level INTEGER DEFAULT 2, -- 1=Low, 2=Medium, 3=High, 4=Critical, 5=Emergency
    auto_assign_role TEXT, -- Role to auto-assign tickets to
    sla_response_hours INTEGER DEFAULT 24,
    sla_resolution_hours INTEGER DEFAULT 72,
    active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id INTEGER,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

-- HIPAA compliant ticketing system
CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_number TEXT UNIQUE NOT NULL, -- Format: TICK-YYYY-NNNNNN
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    ticket_type_id INTEGER NOT NULL,
    
    -- User information
    created_by_user_id INTEGER NOT NULL,
    assigned_to_user_id INTEGER,
    
    -- Status and priority
    status TEXT DEFAULT 'open', -- 'open', 'in_progress', 'pending', 'resolved', 'closed'
    priority INTEGER DEFAULT 2, -- 1=Low, 2=Medium, 3=High, 4=Critical, 5=Emergency
    
    -- HIPAA compliance flags
    contains_phi BOOLEAN DEFAULT FALSE,
    phi_fields TEXT, -- JSON array of PHI field names if applicable
    encryption_required BOOLEAN DEFAULT TRUE,
    
    -- SLA tracking
    sla_response_due DATETIME,
    sla_resolution_due DATETIME,
    first_response_at DATETIME,
    resolved_at DATETIME,
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by_user_id) REFERENCES users(id),
    FOREIGN KEY (assigned_to_user_id) REFERENCES users(id),
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id)
);

-- Ticket comments/updates
CREATE TABLE IF NOT EXISTS ticket_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    comment_text TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE, -- Internal comments not visible to ticket creator
    is_status_change BOOLEAN DEFAULT FALSE,
    previous_status TEXT,
    new_status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Change management system
CREATE TABLE IF NOT EXISTS change_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    change_number TEXT UNIQUE NOT NULL, -- Format: CHG-YYYY-NNNNNN
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    change_type TEXT NOT NULL, -- 'security', 'infrastructure', 'application', 'policy', 'emergency'
    
    -- Requestor information
    requested_by_user_id INTEGER NOT NULL,
    business_justification TEXT NOT NULL,
    
    -- Risk assessment
    risk_level TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    risk_assessment TEXT,
    impact_assessment TEXT,
    rollback_plan TEXT,
    
    -- Approval workflow
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'implemented', 'closed'
    approved_by_user_id INTEGER,
    approved_at DATETIME,
    approval_notes TEXT,
    
    -- Implementation
    scheduled_start DATETIME,
    scheduled_end DATETIME,
    implemented_by_user_id INTEGER,
    implemented_at DATETIME,
    implementation_notes TEXT,
    
    -- HIPAA compliance
    affects_phi BOOLEAN DEFAULT FALSE,
    hipaa_impact_assessment TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (requested_by_user_id) REFERENCES users(id),
    FOREIGN KEY (approved_by_user_id) REFERENCES users(id),
    FOREIGN KEY (implemented_by_user_id) REFERENCES users(id)
);

-- Compliance tracking
CREATE TABLE IF NOT EXISTS compliance_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    framework TEXT NOT NULL, -- 'HIPAA', 'HITRUST', 'GDPR', etc.
    control_id TEXT NOT NULL, -- e.g., '164.308(a)(1)' for HIPAA
    control_name TEXT NOT NULL,
    description TEXT NOT NULL,
    
    -- Implementation status
    status TEXT DEFAULT 'not_started', -- 'not_started', 'in_progress', 'implemented', 'verified'
    implementation_notes TEXT,
    evidence_location TEXT, -- File path or URL to evidence
    
    -- Responsible parties
    assigned_to_user_id INTEGER,
    verified_by_user_id INTEGER,
    
    -- Dates
    target_completion_date DATE,
    completed_at DATETIME,
    last_reviewed_at DATETIME,
    next_review_date DATE,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (assigned_to_user_id) REFERENCES users(id),
    FOREIGN KEY (verified_by_user_id) REFERENCES users(id),
    
    UNIQUE(framework, control_id)
);

-- Audit log for sensitive operations
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details TEXT, -- JSON details
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- AI Symptom Analysis Sessions
CREATE TABLE IF NOT EXISTS symptom_analysis_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    status TEXT DEFAULT 'active', -- 'active', 'completed', 'abandoned'
    current_phase TEXT DEFAULT 'initial_screening', -- 'initial_screening', 'narrowing_to_10', 'narrowing_to_5', 'narrowing_to_3', 'final_assessment'

    -- Patient context and data
    patient_context TEXT, -- JSON: age, gender, family_diseases, medical_history, risk_factors
    symptoms TEXT, -- JSON array of extracted symptoms with severity, duration, category
    responses TEXT, -- JSON array of patient responses to questions
    disorder_candidates TEXT, -- JSON array of disorder predictions with confidence scores
    confidence_scores TEXT, -- JSON object with confidence analysis

    -- Final analysis results
    final_report TEXT, -- JSON: complete analysis report with all 4 lists

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,

    -- Quality assurance
    analysis_quality_score REAL, -- 0.0 to 1.0 quality assessment
    medical_review_required BOOLEAN DEFAULT FALSE,
    reviewed_by_professional BOOLEAN DEFAULT FALSE,
    reviewed_by_user_id INTEGER,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id)
);

-- Symptom Analysis Questions and Responses (for detailed tracking)
CREATE TABLE IF NOT EXISTS symptom_analysis_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    question_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL, -- 'text', 'multiple_choice', 'scale', 'boolean'
    response_text TEXT,
    response_value REAL, -- for numeric responses
    confidence REAL DEFAULT 1.0, -- AI confidence in response interpretation
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (session_id) REFERENCES symptom_analysis_sessions(session_id) ON DELETE CASCADE
);

-- Symptom-Disorder Mapping for AI Training
CREATE TABLE IF NOT EXISTS symptom_disorder_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symptom_name TEXT NOT NULL,
    symptom_category TEXT NOT NULL,
    disorder_id TEXT NOT NULL, -- Links to diseases.disease_code
    correlation_strength REAL NOT NULL, -- 0.0 to 1.0
    frequency_percentage REAL, -- How often this symptom appears in this disorder
    specificity_score REAL, -- How specific this symptom is to this disorder

    -- Medical validation
    validated_by_professional BOOLEAN DEFAULT FALSE,
    validation_source TEXT, -- Research paper, clinical study, etc.
    last_validated DATETIME,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(symptom_name, disorder_id)
);

-- Risk Factor Mappings for Enhanced Prediction
CREATE TABLE IF NOT EXISTS risk_factor_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    risk_factor_name TEXT NOT NULL,
    risk_factor_category TEXT NOT NULL, -- 'demographic', 'lifestyle', 'genetic', 'environmental', 'medical'
    disorder_id TEXT NOT NULL,
    risk_multiplier REAL NOT NULL, -- How much this factor increases risk
    population_frequency REAL, -- How common this risk factor is in general population

    -- Age and gender specificity
    applies_to_gender TEXT, -- 'male', 'female', 'both'
    min_age INTEGER,
    max_age INTEGER,

    -- Validation
    evidence_level TEXT NOT NULL, -- 'strong', 'moderate', 'weak', 'anecdotal'
    source_reference TEXT,
    validated_by_professional BOOLEAN DEFAULT FALSE,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(risk_factor_name, disorder_id)
);

-- Medical History Tracking for Users
CREATE TABLE IF NOT EXISTS user_medical_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    condition_name TEXT NOT NULL,
    icd10_code TEXT,
    diagnosis_date DATE,
    current_status TEXT DEFAULT 'active', -- 'active', 'resolved', 'chronic', 'managed'

    -- Medications and treatments
    medications TEXT, -- JSON array of current medications
    treatments TEXT, -- JSON array of treatments received

    -- Professional verification
    diagnosed_by_professional BOOLEAN DEFAULT FALSE,
    healthcare_provider TEXT,
    verified_by_user_id INTEGER, -- Medical professional who verified

    -- Privacy
    shared_for_analysis BOOLEAN DEFAULT TRUE,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by_user_id) REFERENCES users(id)
);

-- Contact messages for storing contact form submissions
CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'unread', -- 'unread', 'read', 'replied', 'spam', 'archived'
    ip_address TEXT,
    user_agent TEXT,
    user_id INTEGER, -- Optional: if the message is from a logged-in user
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    replied_at DATETIME,
    replied_by_user_id INTEGER,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (replied_by_user_id) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_uuid ON users(uuid);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_id ON api_keys(key_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_family_diseases_user_id ON family_diseases(user_id);
CREATE INDEX IF NOT EXISTS idx_family_diseases_disease_id ON family_diseases(disease_id);
CREATE INDEX IF NOT EXISTS idx_disease_comments_user_id ON disease_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_disease_comments_disease_id ON disease_comments(disease_id);
CREATE INDEX IF NOT EXISTS idx_comment_flags_comment_id ON comment_flags(comment_id);
CREATE INDEX IF NOT EXISTS idx_data_contributions_contributor ON data_contributions(contributor_user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- AI Symptom Analysis Indexes
CREATE INDEX IF NOT EXISTS idx_symptom_sessions_session_id ON symptom_analysis_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_symptom_sessions_user_id ON symptom_analysis_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_symptom_sessions_status ON symptom_analysis_sessions(status);
CREATE INDEX IF NOT EXISTS idx_symptom_responses_session_id ON symptom_analysis_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_symptom_disorder_mapping ON symptom_disorder_mappings(symptom_name, disorder_id);
CREATE INDEX IF NOT EXISTS idx_risk_factor_mapping ON risk_factor_mappings(risk_factor_name, disorder_id);
CREATE INDEX IF NOT EXISTS idx_user_medical_history_user_id ON user_medical_history(user_id);

-- Contact Messages Indexes
CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON contact_messages(email);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_contact_messages_user_id ON contact_messages(user_id);