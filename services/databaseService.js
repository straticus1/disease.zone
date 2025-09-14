const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class DatabaseService {
  constructor() {
    this.db = null;
    this.dbPath = path.join(__dirname, '../database/diseaseZone.db');
  }

  async init() {
    return new Promise((resolve, reject) => {
      // Ensure database directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
          return;
        }

        console.log('Connected to SQLite database');
        this.setupDatabase()
          .then(() => resolve())
          .catch(reject);
      });
    });
  }

  async setupDatabase() {
    try {
      // Read and execute schema
      const schemaPath = path.join(__dirname, '../database/schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');

      await this.executeScript(schema);
      console.log('Database schema created successfully');

      // Check if diseases table is empty and seed if needed
      const diseaseCount = await this.get('SELECT COUNT(*) as count FROM diseases');
      if (diseaseCount.count === 0) {
        const seedPath = path.join(__dirname, '../database/seed_diseases.sql');
        const seedData = fs.readFileSync(seedPath, 'utf8');
        await this.executeScript(seedData);
        console.log('Database seeded with initial disease data');
      }

    } catch (error) {
      console.error('Error setting up database:', error);
      throw error;
    }
  }

  async executeScript(script) {
    return new Promise((resolve, reject) => {
      this.db.exec(script, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // User management methods
  async createUser(userData) {
    const {
      uuid, email, password_hash, first_name, last_name, role = 'user',
      date_of_birth, gender, location_state, location_zip,
      medical_license_number, medical_specialty, institution_name
    } = userData;

    const sql = `
      INSERT INTO users (
        uuid, email, password_hash, first_name, last_name, role,
        date_of_birth, gender, location_state, location_zip,
        medical_license_number, medical_specialty, institution_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return await this.run(sql, [
      uuid, email, password_hash, first_name, last_name, role,
      date_of_birth, gender, location_state, location_zip,
      medical_license_number, medical_specialty, institution_name
    ]);
  }

  async getUserByEmail(email) {
    return await this.get('SELECT * FROM users WHERE email = ?', [email]);
  }

  async getUserByUuid(uuid) {
    return await this.get('SELECT * FROM users WHERE uuid = ?', [uuid]);
  }

  async getUserById(id) {
    return await this.get('SELECT * FROM users WHERE id = ?', [id]);
  }

  // API Key management
  async createApiKey(keyData) {
    const { key_id, api_key_hash, user_id, name, permissions, rate_limit, expires_at } = keyData;

    const sql = `
      INSERT INTO api_keys (key_id, api_key_hash, user_id, name, permissions, rate_limit, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    return await this.run(sql, [key_id, api_key_hash, user_id, name, JSON.stringify(permissions), rate_limit, expires_at]);
  }

  async getApiKey(key_id) {
    const apiKey = await this.get('SELECT * FROM api_keys WHERE key_id = ? AND active = TRUE', [key_id]);
    if (apiKey && apiKey.permissions) {
      apiKey.permissions = JSON.parse(apiKey.permissions);
    }
    return apiKey;
  }

  async updateApiKeyLastUsed(key_id) {
    return await this.run('UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE key_id = ?', [key_id]);
  }

  // Disease management
  async getAllDiseases() {
    return await this.all('SELECT * FROM diseases ORDER BY category, name');
  }

  async getDiseaseById(id) {
    return await this.get('SELECT * FROM diseases WHERE id = ?', [id]);
  }

  async getDiseaseByCode(disease_code) {
    return await this.get('SELECT * FROM diseases WHERE disease_code = ?', [disease_code]);
  }

  async getDiseasesByCategory(category) {
    return await this.all('SELECT * FROM diseases WHERE category = ? ORDER BY name', [category]);
  }

  // Family disease declarations
  async createFamilyDisease(familyDiseaseData) {
    const {
      user_id, disease_id, family_member, family_member_name, family_member_relationship,
      has_disease, diagnosis_confirmed, diagnosed_by_professional, diagnosis_date, acquired_disease_on,
      family_member_has_symptoms, family_member_had_symptoms, symptom_severity, symptom_onset_age,
      family_member_has_children, family_member_children_count, family_member_children_have_disease, family_member_children_affected_count,
      family_member_disease_notes, treatment_history, family_member_deceased, cause_of_death
    } = familyDiseaseData;

    const sql = `
      INSERT INTO family_diseases (
        user_id, disease_id, family_member, family_member_name, family_member_relationship,
        has_disease, diagnosis_confirmed, diagnosed_by_professional, diagnosis_date, acquired_disease_on,
        family_member_has_symptoms, family_member_had_symptoms, symptom_severity, symptom_onset_age,
        family_member_has_children, family_member_children_count, family_member_children_have_disease, family_member_children_affected_count,
        family_member_disease_notes, treatment_history, family_member_deceased, cause_of_death
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return await this.run(sql, [
      user_id, disease_id, family_member, family_member_name, family_member_relationship,
      has_disease, diagnosis_confirmed, diagnosed_by_professional, diagnosis_date, acquired_disease_on,
      JSON.stringify(family_member_has_symptoms || []), JSON.stringify(family_member_had_symptoms || []),
      symptom_severity, symptom_onset_age,
      family_member_has_children, family_member_children_count, family_member_children_have_disease, family_member_children_affected_count,
      family_member_disease_notes, JSON.stringify(treatment_history || []), family_member_deceased, cause_of_death
    ]);
  }

  async getFamilyDiseasesByUser(user_id) {
    const sql = `
      SELECT fd.*, d.name as disease_name, d.disease_code, d.category, d.inheritance_pattern
      FROM family_diseases fd
      JOIN diseases d ON fd.disease_id = d.id
      WHERE fd.user_id = ?
      ORDER BY fd.created_at DESC
    `;

    const results = await this.all(sql, [user_id]);

    // Parse JSON fields
    return results.map(row => ({
      ...row,
      family_member_has_symptoms: JSON.parse(row.family_member_has_symptoms || '[]'),
      family_member_had_symptoms: JSON.parse(row.family_member_had_symptoms || '[]'),
      treatment_history: JSON.parse(row.treatment_history || '[]')
    }));
  }

  async updateFamilyDisease(id, updates) {
    const updateFields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
      if (key !== 'id' && updates[key] !== undefined) {
        updateFields.push(`${key} = ?`);
        if (Array.isArray(updates[key])) {
          values.push(JSON.stringify(updates[key]));
        } else {
          values.push(updates[key]);
        }
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const sql = `UPDATE family_diseases SET ${updateFields.join(', ')} WHERE id = ?`;
    return await this.run(sql, values);
  }

  async deleteFamilyDisease(id, user_id) {
    return await this.run('DELETE FROM family_diseases WHERE id = ? AND user_id = ?', [id, user_id]);
  }

  // Comments
  async createComment(commentData) {
    const { user_id, disease_id, comment_text, is_personal_experience, family_member_affected } = commentData;

    const sql = `
      INSERT INTO disease_comments (user_id, disease_id, comment_text, is_personal_experience, family_member_affected)
      VALUES (?, ?, ?, ?, ?)
    `;

    return await this.run(sql, [user_id, disease_id, comment_text, is_personal_experience, family_member_affected]);
  }

  async getCommentsByDisease(disease_id, limit = 50, offset = 0) {
    const sql = `
      SELECT dc.*, u.first_name, u.last_name
      FROM disease_comments dc
      JOIN users u ON dc.user_id = u.id
      WHERE dc.disease_id = ? AND dc.approved = TRUE
      ORDER BY dc.created_at DESC
      LIMIT ? OFFSET ?
    `;

    return await this.all(sql, [disease_id, limit, offset]);
  }

  // Session management
  async createSession(sessionData) {
    const { session_id, user_id, expires_at, ip_address, user_agent } = sessionData;

    const sql = `
      INSERT INTO user_sessions (session_id, user_id, expires_at, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?)
    `;

    return await this.run(sql, [session_id, user_id, expires_at, ip_address, user_agent]);
  }

  async getSession(session_id) {
    return await this.get('SELECT * FROM user_sessions WHERE session_id = ? AND expires_at > CURRENT_TIMESTAMP', [session_id]);
  }

  async deleteSession(session_id) {
    return await this.run('DELETE FROM user_sessions WHERE session_id = ?', [session_id]);
  }

  // Audit logging
  async logAudit(auditData) {
    const { user_id, action, resource_type, resource_id, details, ip_address, user_agent } = auditData;

    const sql = `
      INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    return await this.run(sql, [user_id, action, resource_type, resource_id, JSON.stringify(details), ip_address, user_agent]);
  }

  async close() {
    if (this.db) {
      return new Promise((resolve) => {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
          } else {
            console.log('Database connection closed');
          }
          resolve();
        });
      });
    }
  }
}

module.exports = DatabaseService;