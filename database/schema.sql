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
    role TEXT NOT NULL DEFAULT 'user', -- 'user', 'medical_professional', 'admin'
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