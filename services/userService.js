const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');

class UserService {
  constructor(databaseService, authMiddleware) {
    this.db = databaseService;
    this.auth = authMiddleware;
  }

  // Validation rules
  getRegistrationValidation() {
    return [
      body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
      body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
      body('first_name')
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('First name is required (max 50 characters)'),
      body('last_name')
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('Last name is required (max 50 characters)'),
      body('role')
        .optional()
        .isIn(['user', 'medical_professional', 'researcher', 'insurance'])
        .withMessage('Role must be one of: user, medical_professional, researcher, insurance'),
      body('date_of_birth')
        .optional()
        .isISO8601()
        .withMessage('Date of birth must be a valid date'),
      body('gender')
        .optional()
        .isIn(['male', 'female', 'other', 'prefer_not_to_say'])
        .withMessage('Invalid gender option'),
      body('location_state')
        .optional()
        .isLength({ max: 2 })
        .withMessage('State must be 2-letter code'),
      body('medical_license_number')
        .if(body('role').equals('medical_professional'))
        .notEmpty()
        .withMessage('Medical license number is required for medical professionals'),
      body('medical_specialty')
        .if(body('role').equals('medical_professional'))
        .notEmpty()
        .withMessage('Medical specialty is required for medical professionals'),
      body('institution_name')
        .if(body('role').equals('medical_professional'))
        .notEmpty()
        .withMessage('Institution name is required for medical professionals')
    ];
  }

  getLoginValidation() {
    return [
      body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
      body('password')
        .notEmpty()
        .withMessage('Password is required')
    ];
  }

  getFamilyDiseaseValidation() {
    return [
      body('disease_id')
        .isInt({ min: 1 })
        .withMessage('Valid disease ID is required'),
      body('family_member')
        .isIn(['mother', 'father', 'sibling', 'child', 'grandparent', 'other'])
        .withMessage('Invalid family member type'),
      body('family_member_name')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Family member name must be under 100 characters'),
      body('has_disease')
        .isBoolean()
        .withMessage('has_disease must be true or false'),
      body('diagnosis_confirmed')
        .optional()
        .isBoolean()
        .withMessage('diagnosis_confirmed must be true or false'),
      body('family_member_has_symptoms')
        .optional()
        .isArray()
        .withMessage('Symptoms must be an array'),
      body('family_member_children_count')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Children count must be a non-negative integer')
    ];
  }

  // User registration
  async registerUser(userData) {
    try {
      // Check if user already exists
      const existingUser = await this.db.getUserByEmail(userData.email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const password_hash = await this.auth.hashPassword(userData.password);

      // Generate UUID
      const uuid = uuidv4();

      // Prepare user data
      const userRecord = {
        uuid,
        email: userData.email,
        password_hash,
        first_name: userData.first_name,
        last_name: userData.last_name,
        role: userData.role || 'user',
        date_of_birth: userData.date_of_birth,
        gender: userData.gender,
        location_state: userData.location_state?.toUpperCase(),
        location_zip: userData.location_zip,
        medical_license_number: userData.medical_license_number,
        medical_specialty: userData.medical_specialty,
        institution_name: userData.institution_name
      };

      // Create user
      const result = await this.db.createUser(userRecord);

      // Generate JWT token
      const token = this.auth.generateToken(result.id);

      // Log registration
      await this.db.logAudit({
        user_id: result.id,
        action: 'user_registered',
        resource_type: 'user',
        resource_id: uuid,
        details: {
          role: userRecord.role,
          registration_ip: userData.ip_address
        },
        ip_address: userData.ip_address,
        user_agent: userData.user_agent
      });

      return {
        success: true,
        user: {
          id: result.id,
          uuid,
          email: userData.email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          role: userRecord.role
        },
        token
      };

    } catch (error) {
      console.error('User registration error:', error);
      throw error;
    }
  }

  // User login
  async loginUser(email, password, ip_address, user_agent) {
    try {
      // Get user by email
      const user = await this.db.getUserByEmail(email);
      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Verify password
      const isValidPassword = await this.auth.comparePassword(password, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Invalid email or password');
      }

      // Generate JWT token
      const token = this.auth.generateToken(user.id);

      // Update last login
      await this.db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

      // Log login
      await this.db.logAudit({
        user_id: user.id,
        action: 'user_login',
        resource_type: 'user',
        resource_id: user.uuid,
        details: {
          login_method: 'email_password'
        },
        ip_address,
        user_agent
      });

      return {
        success: true,
        user: {
          id: user.id,
          uuid: user.uuid,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role
        },
        token
      };

    } catch (error) {
      console.error('User login error:', error);
      throw error;
    }
  }

  // Get user profile
  async getUserProfile(userId) {
    try {
      const user = await this.db.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get recent HEALTH credit transactions if wallet is connected
      let recentTransactions = [];
      if (user.wallet_connected) {
        recentTransactions = await this.db.all(`
          SELECT transaction_type, amount, description, source_action, created_at, status
          FROM health_credit_transactions
          WHERE user_id = ? 
          ORDER BY created_at DESC 
          LIMIT 5
        `, [userId]);
      }

      // Remove sensitive information
      delete user.password_hash;
      delete user.verification_token;
      delete user.wallet_public_key; // Keep private keys private

      // Add wallet summary to user profile
      user.wallet_summary = {
        connected: user.wallet_connected || false,
        address: user.wallet_connected ? user.wallet_address : null,
        health_credit_balance: user.health_credit_balance || 0,
        recent_transactions: recentTransactions
      };

      return {
        success: true,
        user
      };

    } catch (error) {
      console.error('Get user profile error:', error);
      throw error;
    }
  }

  // Family disease management
  async addFamilyDisease(userId, diseaseData) {
    try {
      // Verify disease exists
      const disease = await this.db.getDiseaseById(diseaseData.disease_id);
      if (!disease) {
        throw new Error('Disease not found');
      }

      // Prepare family disease data
      const familyDiseaseRecord = {
        user_id: userId,
        ...diseaseData,
        acquired_disease_on: diseaseData.acquired_disease_on || new Date().toISOString()
      };

      // Create family disease record
      const result = await this.db.createFamilyDisease(familyDiseaseRecord);

      // Log the addition
      await this.db.logAudit({
        user_id: userId,
        action: 'family_disease_added',
        resource_type: 'family_disease',
        resource_id: result.id.toString(),
        details: {
          disease_code: disease.disease_code,
          family_member: diseaseData.family_member,
          has_disease: diseaseData.has_disease
        },
        ip_address: diseaseData.ip_address,
        user_agent: diseaseData.user_agent
      });

      return {
        success: true,
        family_disease: {
          id: result.id,
          disease_name: disease.name,
          disease_code: disease.disease_code,
          ...diseaseData
        }
      };

    } catch (error) {
      console.error('Add family disease error:', error);
      throw error;
    }
  }

  // Get user's family diseases
  async getFamilyDiseases(userId) {
    try {
      const familyDiseases = await this.db.getFamilyDiseasesByUser(userId);

      return {
        success: true,
        family_diseases: familyDiseases,
        total_count: familyDiseases.length
      };

    } catch (error) {
      console.error('Get family diseases error:', error);
      throw error;
    }
  }

  // Update family disease
  async updateFamilyDisease(userId, familyDiseaseId, updates) {
    try {
      // Verify ownership
      const existingRecord = await this.db.get(
        'SELECT * FROM family_diseases WHERE id = ? AND user_id = ?',
        [familyDiseaseId, userId]
      );

      if (!existingRecord) {
        throw new Error('Family disease record not found or access denied');
      }

      // Update record
      const result = await this.db.updateFamilyDisease(familyDiseaseId, updates);

      // Log the update
      await this.db.logAudit({
        user_id: userId,
        action: 'family_disease_updated',
        resource_type: 'family_disease',
        resource_id: familyDiseaseId.toString(),
        details: {
          updated_fields: Object.keys(updates)
        },
        ip_address: updates.ip_address,
        user_agent: updates.user_agent
      });

      return {
        success: true,
        message: 'Family disease record updated successfully'
      };

    } catch (error) {
      console.error('Update family disease error:', error);
      throw error;
    }
  }

  // Delete family disease
  async deleteFamilyDisease(userId, familyDiseaseId, ip_address, user_agent) {
    try {
      const result = await this.db.deleteFamilyDisease(familyDiseaseId, userId);

      if (result.changes === 0) {
        throw new Error('Family disease record not found or access denied');
      }

      // Log the deletion
      await this.db.logAudit({
        user_id: userId,
        action: 'family_disease_deleted',
        resource_type: 'family_disease',
        resource_id: familyDiseaseId.toString(),
        details: {},
        ip_address,
        user_agent
      });

      return {
        success: true,
        message: 'Family disease record deleted successfully'
      };

    } catch (error) {
      console.error('Delete family disease error:', error);
      throw error;
    }
  }

  // Generate API key for medical professionals
  async generateApiKey(userId, name, permissions, rateLimit = 1000, expiresInDays = null) {
    try {
      const user = await this.db.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.role !== 'medical_professional' && user.role !== 'admin') {
        throw new Error('Only medical professionals and admins can generate API keys');
      }

      const apiKey = await this.auth.generateApiKey(userId, name, permissions, rateLimit, expiresInDays);

      // Log API key generation
      await this.db.logAudit({
        user_id: userId,
        action: 'api_key_generated',
        resource_type: 'api_key',
        resource_id: apiKey.key_id,
        details: {
          name,
          permissions,
          rate_limit: rateLimit,
          expires_in_days: expiresInDays
        },
        ip_address: null,
        user_agent: null
      });

      return {
        success: true,
        api_key: apiKey,
        warning: 'Store this API key securely. It will not be shown again.'
      };

    } catch (error) {
      console.error('Generate API key error:', error);
      throw error;
    }
  }

  // Handle validation errors
  handleValidationErrors(req) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      throw new Error(`Validation failed: ${errorMessages.join(', ')}`);
    }
  }
}

module.exports = UserService;