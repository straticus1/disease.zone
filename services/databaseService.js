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

      // Check if ticket types table is empty and seed if needed
      const ticketTypeCount = await this.get('SELECT COUNT(*) as count FROM ticket_types');
      if (ticketTypeCount.count === 0) {
        const ticketSeedPath = path.join(__dirname, '../database/seed_ticket_types.sql');
        const ticketSeedData = fs.readFileSync(ticketSeedPath, 'utf8');
        await this.executeScript(ticketSeedData);
        console.log('Database seeded with ticket types and compliance items');
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

  // Ticket Types Management
  async getAllTicketTypes() {
    return await this.all('SELECT * FROM ticket_types WHERE active = TRUE ORDER BY name');
  }

  async getTicketTypeById(id) {
    return await this.get('SELECT * FROM ticket_types WHERE id = ? AND active = TRUE', [id]);
  }

  async createTicketType(ticketTypeData) {
    const { name, description, priority_level, auto_assign_role, sla_response_hours, sla_resolution_hours, created_by_user_id } = ticketTypeData;
    const sql = `
      INSERT INTO ticket_types (name, description, priority_level, auto_assign_role, sla_response_hours, sla_resolution_hours, created_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    return await this.run(sql, [name, description, priority_level, auto_assign_role, sla_response_hours, sla_resolution_hours, created_by_user_id]);
  }

  async updateTicketType(id, updates) {
    const updateFields = [];
    const values = [];
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && updates[key] !== undefined) {
        updateFields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });
    if (updateFields.length === 0) throw new Error('No fields to update');
    values.push(id);
    const sql = `UPDATE ticket_types SET ${updateFields.join(', ')} WHERE id = ?`;
    return await this.run(sql, values);
  }

  // Ticketing System
  async generateTicketNumber() {
    const year = new Date().getFullYear();
    const count = await this.get(`SELECT COUNT(*) as count FROM tickets WHERE ticket_number LIKE 'TICK-${year}-%'`);
    const nextNumber = (count.count + 1).toString().padStart(6, '0');
    return `TICK-${year}-${nextNumber}`;
  }

  async createTicket(ticketData) {
    const { title, description, ticket_type_id, created_by_user_id, priority, contains_phi, phi_fields } = ticketData;
    const ticket_number = await this.generateTicketNumber();
    
    // Get SLA times from ticket type
    const ticketType = await this.getTicketTypeById(ticket_type_id);
    const sla_response_due = new Date(Date.now() + (ticketType.sla_response_hours * 60 * 60 * 1000)).toISOString();
    const sla_resolution_due = new Date(Date.now() + (ticketType.sla_resolution_hours * 60 * 60 * 1000)).toISOString();
    
    const sql = `
      INSERT INTO tickets (ticket_number, title, description, ticket_type_id, created_by_user_id, priority, contains_phi, phi_fields, sla_response_due, sla_resolution_due)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    return await this.run(sql, [ticket_number, title, description, ticket_type_id, created_by_user_id, priority, contains_phi, JSON.stringify(phi_fields || []), sla_response_due, sla_resolution_due]);
  }

  async getTicketById(id) {
    const sql = `
      SELECT t.*, tt.name as ticket_type_name, 
             creator.first_name as creator_first_name, creator.last_name as creator_last_name,
             assignee.first_name as assignee_first_name, assignee.last_name as assignee_last_name
      FROM tickets t
      JOIN ticket_types tt ON t.ticket_type_id = tt.id
      JOIN users creator ON t.created_by_user_id = creator.id
      LEFT JOIN users assignee ON t.assigned_to_user_id = assignee.id
      WHERE t.id = ?
    `;
    const ticket = await this.get(sql, [id]);
    if (ticket && ticket.phi_fields) {
      ticket.phi_fields = JSON.parse(ticket.phi_fields);
    }
    return ticket;
  }

  async getTicketsByUser(user_id, role, limit = 50, offset = 0) {
    let sql;
    let params;
    
    if (role === 'admin' || role === 'compliance') {
      // Admin and compliance can see all tickets
      sql = `
        SELECT t.*, tt.name as ticket_type_name, creator.first_name as creator_first_name, creator.last_name as creator_last_name
        FROM tickets t
        JOIN ticket_types tt ON t.ticket_type_id = tt.id
        JOIN users creator ON t.created_by_user_id = creator.id
        ORDER BY t.created_at DESC
        LIMIT ? OFFSET ?
      `;
      params = [limit, offset];
    } else {
      // Others can see tickets they created or are assigned to
      sql = `
        SELECT t.*, tt.name as ticket_type_name, creator.first_name as creator_first_name, creator.last_name as creator_last_name
        FROM tickets t
        JOIN ticket_types tt ON t.ticket_type_id = tt.id
        JOIN users creator ON t.created_by_user_id = creator.id
        WHERE t.created_by_user_id = ? OR t.assigned_to_user_id = ?
        ORDER BY t.created_at DESC
        LIMIT ? OFFSET ?
      `;
      params = [user_id, user_id, limit, offset];
    }
    
    const tickets = await this.all(sql, params);
    return tickets.map(ticket => {
      if (ticket.phi_fields) {
        ticket.phi_fields = JSON.parse(ticket.phi_fields);
      }
      return ticket;
    });
  }

  async updateTicket(id, updates) {
    const updateFields = [];
    const values = [];
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && updates[key] !== undefined) {
        updateFields.push(`${key} = ?`);
        if (key === 'phi_fields' && Array.isArray(updates[key])) {
          values.push(JSON.stringify(updates[key]));
        } else {
          values.push(updates[key]);
        }
      }
    });
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    if (updateFields.length === 1) throw new Error('No fields to update');
    values.push(id);
    const sql = `UPDATE tickets SET ${updateFields.join(', ')} WHERE id = ?`;
    return await this.run(sql, values);
  }

  // Ticket Comments
  async createTicketComment(commentData) {
    const { ticket_id, user_id, comment_text, is_internal, is_status_change, previous_status, new_status } = commentData;
    const sql = `
      INSERT INTO ticket_comments (ticket_id, user_id, comment_text, is_internal, is_status_change, previous_status, new_status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    return await this.run(sql, [ticket_id, user_id, comment_text, is_internal, is_status_change, previous_status, new_status]);
  }

  async getTicketComments(ticket_id, user_role, user_id) {
    let sql = `
      SELECT tc.*, u.first_name, u.last_name
      FROM ticket_comments tc
      JOIN users u ON tc.user_id = u.id
      WHERE tc.ticket_id = ?
    `;
    
    // Regular users can't see internal comments unless they created the ticket
    if (user_role !== 'admin' && user_role !== 'compliance') {
      const ticket = await this.get('SELECT created_by_user_id FROM tickets WHERE id = ?', [ticket_id]);
      if (ticket.created_by_user_id !== user_id) {
        sql += ' AND tc.is_internal = FALSE';
      }
    }
    
    sql += ' ORDER BY tc.created_at ASC';
    return await this.all(sql, [ticket_id]);
  }

  // Change Management
  async generateChangeNumber() {
    const year = new Date().getFullYear();
    const count = await this.get(`SELECT COUNT(*) as count FROM change_requests WHERE change_number LIKE 'CHG-${year}-%'`);
    const nextNumber = (count.count + 1).toString().padStart(6, '0');
    return `CHG-${year}-${nextNumber}`;
  }

  async createChangeRequest(changeData) {
    const { title, description, change_type, requested_by_user_id, business_justification, risk_level, risk_assessment, impact_assessment, rollback_plan, affects_phi, hipaa_impact_assessment, scheduled_start, scheduled_end } = changeData;
    const change_number = await this.generateChangeNumber();
    
    const sql = `
      INSERT INTO change_requests (change_number, title, description, change_type, requested_by_user_id, business_justification, risk_level, risk_assessment, impact_assessment, rollback_plan, affects_phi, hipaa_impact_assessment, scheduled_start, scheduled_end)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    return await this.run(sql, [change_number, title, description, change_type, requested_by_user_id, business_justification, risk_level, risk_assessment, impact_assessment, rollback_plan, affects_phi, hipaa_impact_assessment, scheduled_start, scheduled_end]);
  }

  async getChangeRequestById(id) {
    const sql = `
      SELECT cr.*, 
             requestor.first_name as requestor_first_name, requestor.last_name as requestor_last_name,
             approver.first_name as approver_first_name, approver.last_name as approver_last_name
      FROM change_requests cr
      JOIN users requestor ON cr.requested_by_user_id = requestor.id
      LEFT JOIN users approver ON cr.approved_by_user_id = approver.id
      WHERE cr.id = ?
    `;
    return await this.get(sql, [id]);
  }

  async getAllChangeRequests(limit = 50, offset = 0) {
    const sql = `
      SELECT cr.*, requestor.first_name as requestor_first_name, requestor.last_name as requestor_last_name
      FROM change_requests cr
      JOIN users requestor ON cr.requested_by_user_id = requestor.id
      ORDER BY cr.created_at DESC
      LIMIT ? OFFSET ?
    `;
    return await this.all(sql, [limit, offset]);
  }

  async updateChangeRequest(id, updates) {
    const updateFields = [];
    const values = [];
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && updates[key] !== undefined) {
        updateFields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    if (updateFields.length === 1) throw new Error('No fields to update');
    values.push(id);
    const sql = `UPDATE change_requests SET ${updateFields.join(', ')} WHERE id = ?`;
    return await this.run(sql, values);
  }

  // Compliance Items
  async getAllComplianceItems(framework = null) {
    let sql = 'SELECT * FROM compliance_items';
    const params = [];
    if (framework) {
      sql += ' WHERE framework = ?';
      params.push(framework);
    }
    sql += ' ORDER BY framework, control_id';
    return await this.all(sql, params);
  }

  async getComplianceItemById(id) {
    return await this.get('SELECT * FROM compliance_items WHERE id = ?', [id]);
  }

  async updateComplianceItem(id, updates) {
    const updateFields = [];
    const values = [];
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && updates[key] !== undefined) {
        updateFields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    if (updateFields.length === 1) throw new Error('No fields to update');
    values.push(id);
    const sql = `UPDATE compliance_items SET ${updateFields.join(', ')} WHERE id = ?`;
    return await this.run(sql, values);
  }

  async getComplianceStats() {
    const sql = `
      SELECT 
        framework,
        COUNT(*) as total_controls,
        SUM(CASE WHEN status = 'implemented' THEN 1 ELSE 0 END) as implemented,
        SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'not_started' THEN 1 ELSE 0 END) as not_started
      FROM compliance_items 
      GROUP BY framework
    `;
    return await this.all(sql);
  }

  // HIPAA Audit Log (PHI Access Logging)
  async createPHIAccessLog(logData) {
    const { user_id, action, resource_type, resource_id, phi_fields_accessed, user_ip, user_agent, access_granted, denial_reason, access_timestamp } = logData;
    const sql = `
      INSERT INTO phi_access_log (user_id, action, resource_type, resource_id, phi_fields_accessed, user_ip, user_agent, access_granted, denial_reason, access_timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    return await this.run(sql, [user_id, action, resource_type, resource_id, phi_fields_accessed, user_ip, user_agent, access_granted, denial_reason, access_timestamp]);
  }

  async getFamilyDiseaseById(id) {
    const sql = 'SELECT * FROM family_diseases WHERE id = ?';
    return await this.get(sql, [id]);
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