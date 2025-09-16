-- Migration: Add wallet fields to users table
-- This allows the main application to display wallet info while keeping operations on ledger subdomain

-- Add wallet fields to users table
ALTER TABLE users ADD COLUMN wallet_address TEXT;
ALTER TABLE users ADD COLUMN wallet_public_key TEXT;
ALTER TABLE users ADD COLUMN health_credit_balance REAL DEFAULT 0.0;
ALTER TABLE users ADD COLUMN last_balance_update DATETIME;

-- Add wallet-related preferences
ALTER TABLE users ADD COLUMN wallet_connected BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN wallet_network TEXT DEFAULT 'polygon'; -- 'polygon', 'ethereum', etc.
ALTER TABLE users ADD COLUMN wallet_type TEXT; -- 'metamask', 'walletconnect', 'generated', etc.

-- Privacy settings for wallet
ALTER TABLE users ADD COLUMN show_wallet_publicly BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN allow_wallet_research_data BOOLEAN DEFAULT TRUE;

-- Create table for tracking HEALTH credit transactions (read-only sync from ledger)
CREATE TABLE IF NOT EXISTS health_credit_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    transaction_hash TEXT UNIQUE NOT NULL,
    transaction_type TEXT NOT NULL, -- 'earn', 'spend', 'transfer', 'stake', 'unstake'
    amount REAL NOT NULL,
    description TEXT,
    
    -- Blockchain details
    block_number INTEGER,
    gas_used INTEGER,
    gas_price REAL,
    network TEXT DEFAULT 'polygon',
    
    -- Application context
    source_action TEXT, -- 'daily_checkin', 'symptom_report', 'data_contribution', etc.
    related_session_id TEXT, -- Link to symptom analysis sessions, etc.
    
    -- Status
    status TEXT DEFAULT 'confirmed', -- 'pending', 'confirmed', 'failed'
    
    -- Sync tracking
    synced_from_ledger BOOLEAN DEFAULT TRUE,
    ledger_sync_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create table for wallet connection audit log
CREATE TABLE IF NOT EXISTS wallet_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL, -- 'connect', 'disconnect', 'balance_update', 'address_change'
    old_value TEXT,
    new_value TEXT,
    ip_address TEXT,
    user_agent TEXT,
    source TEXT DEFAULT 'main_app', -- 'main_app', 'ledger_subdomain'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_wallet_connected ON users(wallet_connected);
CREATE INDEX IF NOT EXISTS idx_health_credit_transactions_user_id ON health_credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_health_credit_transactions_hash ON health_credit_transactions(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_health_credit_transactions_created_at ON health_credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_wallet_audit_log_user_id ON wallet_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_audit_log_created_at ON wallet_audit_log(created_at);