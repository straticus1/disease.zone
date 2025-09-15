require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

// Services
const STDService = require('./services/stdService');
const CDCDataService = require('./services/cdcDataService');
const StateDataService = require('./services/stateDataService');
const MappingService = require('./services/mappingService');
const NeurologicalDiseaseService = require('./services/neurologicalDiseaseService');
const GeneticDiseaseService = require('./services/geneticDiseaseService');
const MusculoskeletalDiseaseService = require('./services/musculoskeletalDiseaseService');
const DatabaseService = require('./services/databaseService');
const UserService = require('./services/userService');
const AISymptomAnalysisService = require('./services/aiSymptomAnalysisService');

// Compliance and Security Services
const MedicalValidationService = require('./services/medicalValidationService');
const AuditLoggingService = require('./services/auditLoggingService');
const HIPAAService = require('./services/hipaaService');

// Middleware
const AuthMiddleware = require('./middleware/auth');

// Utilities
const ResponseHandler = require('./utils/responseHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize services
async function initializeServices() {
  try {
    // Initialize database first
    const databaseService = new DatabaseService();
    await databaseService.init();

    // Initialize other services
    const stdService = new STDService();
    const cdcDataService = new CDCDataService();
    const stateDataService = new StateDataService();
    const mappingService = new MappingService();
    const neurologicalService = new NeurologicalDiseaseService();
    const geneticService = new GeneticDiseaseService();
    const musculoskeletalService = new MusculoskeletalDiseaseService();

    // Initialize compliance and security services
    const auditLoggingService = new AuditLoggingService(databaseService);
    const hipaaService = new HIPAAService(databaseService, auditLoggingService);
    const medicalValidationService = new MedicalValidationService(databaseService, auditLoggingService);

    // Initialize authentication and user services
    const authMiddleware = new AuthMiddleware(databaseService);
    const userService = new UserService(databaseService, authMiddleware);

    // Initialize AI symptom analysis service
    const aiSymptomAnalysisService = new AISymptomAnalysisService(
      databaseService,
      medicalValidationService,
      auditLoggingService,
      hipaaService
    );

    // Make services available to routes
    app.locals.db = databaseService;
    app.locals.auth = authMiddleware;
    app.locals.userService = userService;
    app.locals.stdService = stdService;
    app.locals.cdcDataService = cdcDataService;
    app.locals.stateDataService = stateDataService;
    app.locals.mappingService = mappingService;
    app.locals.neurologicalService = neurologicalService;
    app.locals.geneticService = geneticService;
    app.locals.musculoskeletalService = musculoskeletalService;
    app.locals.auditLoggingService = auditLoggingService;
    app.locals.hipaaService = hipaaService;
    app.locals.medicalValidationService = medicalValidationService;
    app.locals.aiSymptomAnalysisService = aiSymptomAnalysisService;

    console.log('All services initialized successfully');
  } catch (error) {
    console.error('Error initializing services:', error);
    process.exit(1);
  }
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));

// Basic middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Security and logging middleware (applied after services are initialized)
app.use((req, res, next) => {
  if (app.locals.auth) {
    app.locals.auth.securityHeaders()(req, res, next);
  } else {
    next();
  }
});

app.use((req, res, next) => {
  if (app.locals.auth) {
    app.locals.auth.logApiUsage()(req, res, next);
  } else {
    next();
  }
});

// Homepage route
app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>diseaseZone - Medical Staff Portal</title>
    <style>
        :root {
            --primary-color: #059669;
            --secondary-color: #047857;
            --success-color: #10b981;
            --warning-color: #f59e0b;
            --danger-color: #ef4444;
            --dark-color: #1f2937;
            --light-color: #f0fdf4;
            --border-color: #d1fae5;
            --text-primary: #1e293b;
            --text-secondary: #64748b;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: var(--text-primary);
            background: linear-gradient(135deg, #059669 0%, #0d9488 50%, #047857 100%);
            min-height: 100vh;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 40px;
            margin-bottom: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            text-align: center;
        }

        .logo {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
            margin-bottom: 20px;
        }

        .logo-icon {
            width: 64px;
            height: 64px;
            background: linear-gradient(45deg, var(--primary-color), var(--secondary-color));
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 32px;
        }

        .logo h1 {
            color: var(--primary-color);
            font-size: 3rem;
            font-weight: 700;
        }

        .subtitle {
            color: var(--text-secondary);
            font-size: 1.2rem;
            margin-bottom: 30px;
        }

        .search-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 30px;
            margin-bottom: 30px;
        }

        .search-card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .card-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 20px;
        }

        .card-icon {
            width: 40px;
            height: 40px;
            background: var(--primary-color);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 20px;
        }

        .card-title {
            color: var(--text-primary);
            font-size: 1.3rem;
            font-weight: 600;
        }

        .card-description {
            color: var(--text-secondary);
            margin-bottom: 20px;
            line-height: 1.5;
        }

        .form-group {
            margin-bottom: 15px;
        }

        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
            color: var(--text-primary);
        }

        input, select {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid var(--border-color);
            border-radius: 8px;
            font-size: 1rem;
            transition: border-color 0.2s;
        }

        input:focus, select:focus {
            outline: none;
            border-color: var(--primary-color);
        }

        .btn {
            width: 100%;
            padding: 12px 24px;
            background: var(--primary-color);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
        }

        .btn:hover {
            background: var(--secondary-color);
        }

        .quick-links {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }

        .quick-links h3 {
            color: var(--text-primary);
            margin-bottom: 20px;
            font-size: 1.3rem;
        }

        .links-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }

        .quick-link {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 16px;
            background: var(--light-color);
            border-radius: 8px;
            text-decoration: none;
            color: var(--text-primary);
            transition: background 0.2s;
        }

        .quick-link:hover {
            background: var(--border-color);
        }

        .status-bar {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            padding: 12px 20px;
            border-radius: 25px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.9rem;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            background: var(--success-color);
            border-radius: 50%;
        }

        @media (max-width: 768px) {
            .container { padding: 10px; }
            .header { padding: 30px 20px; }
            .logo h1 { font-size: 2.5rem; }
            .search-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">
                <div class="logo-icon">🧬</div>
                <h1>diseaseZone</h1>
            </div>
            <p class="subtitle">Medical Staff Portal - Disease Surveillance & Research</p>
        </div>

        <div class="search-grid">
            <div class="search-card">
                <div class="card-header">
                    <div class="card-icon">🔍</div>
                    <h3 class="card-title">Disease Database Search</h3>
                </div>
                <p class="card-description">Search through our comprehensive database of diseases, including STDs, genetic disorders, neurological conditions, and more.</p>
                <form action="/api/diseases" method="GET">
                    <div class="form-group">
                        <label for="category">Disease Category</label>
                        <select name="category" id="category">
                            <option value="">All Categories</option>
                            <option value="std">STDs</option>
                            <option value="genetic">Genetic Disorders</option>
                            <option value="neurological">Neurological</option>
                            <option value="musculoskeletal">Musculoskeletal</option>
                            <option value="mental_health">Mental Health</option>
                            <option value="cancer">Cancer</option>
                            <option value="cardiovascular">Cardiovascular</option>
                        </select>
                    </div>
                    <button type="submit" class="btn">Search Diseases</button>
                </form>
            </div>

            <div class="search-card">
                <div class="card-header">
                    <div class="card-icon">📊</div>
                    <h3 class="card-title">STD Surveillance Data</h3>
                </div>
                <p class="card-description">Access real-time STD surveillance data from CDC sources. Filter by disease, state, and year.</p>
                <form action="/api/std/real-data" method="GET">
                    <div class="form-group">
                        <label for="std-disease">Disease</label>
                        <select name="disease" id="std-disease">
                            <option value="all">All STDs</option>
                            <option value="chlamydia">Chlamydia</option>
                            <option value="gonorrhea">Gonorrhea</option>
                            <option value="syphilis">Syphilis</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="std-year">Year</label>
                        <select name="year" id="std-year">
                            <option value="2023">2023</option>
                            <option value="2022">2022</option>
                            <option value="2021">2021</option>
                            <option value="2020">2020</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="std-state">State</label>
                        <select name="state" id="std-state">
                            <option value="all">All States</option>
                            <option value="ny">New York</option>
                            <option value="ca">California</option>
                            <option value="tx">Texas</option>
                            <option value="fl">Florida</option>
                        </select>
                    </div>
                    <button type="submit" class="btn">Get STD Data</button>
                </form>
            </div>

            <div class="search-card">
                <div class="card-header">
                    <div class="card-icon">🧠</div>
                    <h3 class="card-title">Neurological Diseases</h3>
                </div>
                <p class="card-description">Search neurological conditions including Alzheimer's, dementia, and rare neurological disorders.</p>
                <form action="/api/neurological/diseases" method="GET">
                    <button type="submit" class="btn">Browse Neurological Diseases</button>
                </form>
            </div>

            <div class="search-card">
                <div class="card-header">
                    <div class="card-icon">🧬</div>
                    <h3 class="card-title">Genetic Disorders</h3>
                </div>
                <p class="card-description">Access information on genetic disorders, inheritance patterns, and prevalence data.</p>
                <form action="/api/genetic/diseases" method="GET">
                    <button type="submit" class="btn">Browse Genetic Disorders</button>
                </form>
            </div>
        </div>

        <div class="quick-links">
            <h3>Quick Access Links</h3>
            <div class="links-grid">
                <a href="/api/diseases" class="quick-link">
                    <span>🗂️</span>
                    <span>All Diseases</span>
                </a>
                <a href="/api/std/status" class="quick-link">
                    <span>📈</span>
                    <span>STD Status</span>
                </a>
                <a href="/api/std/real-summary" class="quick-link">
                    <span>📋</span>
                    <span>STD Summary</span>
                </a>
                <a href="/api/neurological/summary" class="quick-link">
                    <span>🧠</span>
                    <span>Neuro Summary</span>
                </a>
                <a href="/api/genetic/summary" class="quick-link">
                    <span>🧬</span>
                    <span>Genetic Summary</span>
                </a>
                <a href="/api/musculoskeletal/summary" class="quick-link">
                    <span>🦴</span>
                    <span>Musculoskeletal Summary</span>
                </a>
            </div>
        </div>
    </div>

    <div class="status-bar">
        <div class="status-dot"></div>
        <span>System Online • Live Data</span>
    </div>

    <script>
        // Add some interactivity
        document.querySelectorAll('form').forEach(form => {
            form.addEventListener('submit', function(e) {
                const btn = this.querySelector('.btn');
                btn.textContent = 'Loading...';
                btn.disabled = true;
            });
        });

        // Auto-refresh status every 30 seconds
        setInterval(() => {
            fetch('/api/health')
                .then(response => response.json())
                .then(data => {
                    const statusBar = document.querySelector('.status-bar span');
                    if (data.status === 'ok') {
                        statusBar.textContent = 'System Online • Live Data';
                    }
                })
                .catch(() => {
                    const statusBar = document.querySelector('.status-bar span');
                    statusBar.textContent = 'System Offline';
                });
        }, 30000);
    </script>
</body>
</html>
  `;
  res.send(html);
});

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Import and use new route modules
const stiRoutes = require('./routes/stiRoutes');
const globalHealthRoutes = require('./routes/globalHealthRoutes');

// Mount the new route modules
app.use('/sti', stiRoutes);
app.use('/global', globalHealthRoutes);

// Authentication endpoints
app.post('/api/auth/register',
  (req, res, next) => {
    if (app.locals.auth) {
      return app.locals.auth.getAuthRateLimit()(req, res, next);
    }
    next();
  },
  async (req, res) => {
    try {
      const userService = app.locals.userService;

      // Apply validation
      await Promise.all(userService.getRegistrationValidation().map(validation => validation.run(req)));
      userService.handleValidationErrors(req);

      const userData = {
        ...req.body,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      };

      const result = await userService.registerUser(userData);
      res.status(201).json(result);
    } catch (error) {
      console.error('Registration error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

app.post('/api/auth/login',
  (req, res, next) => {
    if (app.locals.auth) {
      return app.locals.auth.getAuthRateLimit()(req, res, next);
    }
    next();
  },
  async (req, res) => {
    try {
      const userService = app.locals.userService;

      // Apply validation
      await Promise.all(userService.getLoginValidation().map(validation => validation.run(req)));
      userService.handleValidationErrors(req);

      const { email, password } = req.body;
      const result = await userService.loginUser(email, password, req.ip, req.get('User-Agent'));

      // Set HTTP-only cookie for browser clients
      res.cookie('session_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.json(result);
    } catch (error) {
      console.error('Login error:', error);
      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  });

app.post('/api/auth/logout',
  (req, res, next) => {
    if (app.locals.auth) {
      return app.locals.auth.authenticateToken(req, res, next);
    }
    next();
  },
  async (req, res) => {
    try {
      // Clear cookie
      res.clearCookie('session_token');

      // Log logout
      await app.locals.db.logAudit({
        user_id: req.user.id,
        action: 'user_logout',
        resource_type: 'user',
        resource_id: req.user.uuid,
        details: {},
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }
  });

// User profile endpoints
app.get('/api/user/profile',
  (req, res, next) => {
    if (app.locals.auth?.authenticateToken) {
      return app.locals.auth.authenticateToken(req, res, next);
    }
    return res.status(500).json({ error: 'Authentication service not initialized' });
  },
  async (req, res) => {
    try {
      const result = await app.locals.userService.getUserProfile(req.user.id);
      res.json(result);
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

// Family disease management endpoints
app.get('/api/user/family-diseases',
  (req, res, next) => {
    if (app.locals.auth?.authenticateToken) {
      return app.locals.auth.authenticateToken(req, res, next);
    }
    return res.status(500).json({ error: 'Authentication service not initialized' });
  },
  async (req, res) => {
    try {
      const result = await app.locals.userService.getFamilyDiseases(req.user.id);
      res.json(result);
    } catch (error) {
      console.error('Get family diseases error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

app.post('/api/user/family-diseases',
  (req, res, next) => {
    if (app.locals.auth?.authenticateToken) {
      return app.locals.auth.authenticateToken(req, res, next);
    }
    return res.status(500).json({ error: 'Authentication service not initialized' });
  },
  async (req, res) => {
    try {
      const userService = app.locals.userService;

      // Apply validation
      await Promise.all(userService.getFamilyDiseaseValidation().map(validation => validation.run(req)));
      userService.handleValidationErrors(req);

      const diseaseData = {
        ...req.body,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      };

      const result = await userService.addFamilyDisease(req.user.id, diseaseData);
      res.status(201).json(result);
    } catch (error) {
      console.error('Add family disease error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

app.put('/api/user/family-diseases/:id',
  (req, res, next) => {
    if (app.locals.auth?.authenticateToken) {
      return app.locals.auth.authenticateToken(req, res, next);
    }
    return res.status(500).json({ error: 'Authentication service not initialized' });
  },
  async (req, res) => {
    try {
      const familyDiseaseId = parseInt(req.params.id);
      const updates = {
        ...req.body,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      };

      const result = await app.locals.userService.updateFamilyDisease(req.user.id, familyDiseaseId, updates);
      res.json(result);
    } catch (error) {
      console.error('Update family disease error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

app.delete('/api/user/family-diseases/:id',
  (req, res, next) => {
    if (app.locals.auth?.authenticateToken) {
      return app.locals.auth.authenticateToken(req, res, next);
    }
    return res.status(500).json({ error: 'Authentication service not initialized' });
  },
  async (req, res) => {
    try {
      const familyDiseaseId = parseInt(req.params.id);
      const result = await app.locals.userService.deleteFamilyDisease(
        req.user.id,
        familyDiseaseId,
        req.ip,
        req.get('User-Agent')
      );
      res.json(result);
    } catch (error) {
      console.error('Delete family disease error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

// AI Symptom Analysis endpoints
app.post('/api/user/symptom-analysis/start',
  (req, res, next) => {
    if (app.locals.auth) {
      return app.locals.auth.authenticateToken(req, res, next);
    }
    next();
  },
  async (req, res) => {
    try {
      const aiService = app.locals.aiSymptomAnalysisService;
      if (!aiService) {
        return res.status(503).json({
          success: false,
          error: 'AI Symptom Analysis service not available'
        });
      }

      const result = await aiService.startSymptomAnalysis(req.user.id, req.body);

      // Log HIPAA compliant access
      await app.locals.auditLoggingService.logEvent('SYMPTOM_ANALYSIS_ACCESS', {
        user_id: req.user.id,
        session_id: result.session_id,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Start symptom analysis error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

app.post('/api/user/symptom-analysis/:sessionId/responses',
  (req, res, next) => {
    if (app.locals.auth) {
      return app.locals.auth.authenticateToken(req, res, next);
    }
    next();
  },
  async (req, res) => {
    try {
      const aiService = app.locals.aiSymptomAnalysisService;
      const sessionId = req.params.sessionId;

      // Verify session ownership
      const session = await aiService.getAnalysisSession(sessionId);
      if (!session || session.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this analysis session'
        });
      }

      const result = await aiService.processResponses(sessionId, req.body.responses);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Process responses error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

app.post('/api/user/symptom-analysis/:sessionId/complete',
  (req, res, next) => {
    if (app.locals.auth) {
      return app.locals.auth.authenticateToken(req, res, next);
    }
    next();
  },
  async (req, res) => {
    try {
      const aiService = app.locals.aiSymptomAnalysisService;
      const sessionId = req.params.sessionId;

      // Verify session ownership
      const session = await aiService.getAnalysisSession(sessionId);
      if (!session || session.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this analysis session'
        });
      }

      const finalReport = await aiService.completeAnalysis(sessionId);

      // Log completion for medical compliance
      await app.locals.auditLoggingService.logEvent('SYMPTOM_ANALYSIS_REPORT_GENERATED', {
        user_id: req.user.id,
        session_id: sessionId,
        final_prediction: finalReport.final_prediction?.disorder_name,
        confidence: finalReport.final_prediction?.confidence,
        recommendations_count: finalReport.recommendations.length
      });

      res.json({
        success: true,
        data: finalReport
      });
    } catch (error) {
      console.error('Complete analysis error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

app.get('/api/user/symptom-analysis/history',
  (req, res, next) => {
    if (app.locals.auth) {
      return app.locals.auth.authenticateToken(req, res, next);
    }
    next();
  },
  async (req, res) => {
    try {
      const aiService = app.locals.aiSymptomAnalysisService;
      const limit = parseInt(req.query.limit) || 10;

      const history = await aiService.getUserAnalysisHistory(req.user.id, limit);

      res.json({
        success: true,
        data: {
          history: history,
          total_sessions: history.length
        }
      });
    } catch (error) {
      console.error('Get analysis history error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

app.get('/api/user/symptom-analysis/:sessionId',
  (req, res, next) => {
    if (app.locals.auth) {
      return app.locals.auth.authenticateToken(req, res, next);
    }
    next();
  },
  async (req, res) => {
    try {
      const aiService = app.locals.aiSymptomAnalysisService;
      const sessionId = req.params.sessionId;

      const session = await aiService.getAnalysisSession(sessionId);
      if (!session || session.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Analysis session not found or access denied'
        });
      }

      // Log access to analysis data
      await app.locals.auditLoggingService.logEvent('SYMPTOM_ANALYSIS_DATA_ACCESS', {
        user_id: req.user.id,
        session_id: sessionId,
        ip_address: req.ip
      });

      res.json({
        success: true,
        data: session
      });
    } catch (error) {
      console.error('Get analysis session error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

app.delete('/api/user/symptom-analysis/:sessionId',
  (req, res, next) => {
    if (app.locals.auth) {
      return app.locals.auth.authenticateToken(req, res, next);
    }
    next();
  },
  async (req, res) => {
    try {
      const aiService = app.locals.aiSymptomAnalysisService;
      const sessionId = req.params.sessionId;

      await aiService.deleteAnalysisSession(sessionId, req.user.id);

      res.json({
        success: true,
        message: 'Analysis session deleted successfully'
      });
    } catch (error) {
      console.error('Delete analysis session error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

// Medical Professional Symptom Analysis endpoints
app.get('/api/medical/symptom-analysis/pending-review',
  (req, res, next) => {
    if (app.locals.auth) {
      return app.locals.auth.authenticateToken(req, res, next);
    }
    next();
  },
  (req, res, next) => {
    if (app.locals.auth) {
      return app.locals.auth.requireRole('medical_professional')(req, res, next);
    }
    next();
  },
  async (req, res) => {
    try {
      const db = app.locals.db;

      // Get sessions requiring medical review
      const query = `
        SELECT session_id, user_id, created_at, current_phase,
               JSON_EXTRACT(final_report, '$.final_prediction.disorder_name') as predicted_disorder,
               JSON_EXTRACT(final_report, '$.final_prediction.confidence') as confidence
        FROM symptom_analysis_sessions
        WHERE medical_review_required = TRUE AND reviewed_by_professional = FALSE
        ORDER BY created_at DESC
      `;

      const pendingSessions = await db.all(query);

      res.json({
        success: true,
        data: {
          pending_sessions: pendingSessions,
          total_pending: pendingSessions.length
        }
      });
    } catch (error) {
      console.error('Get pending reviews error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

// Disease registry endpoints
app.get('/api/diseases', async (req, res) => {
  try {
    const diseases = await app.locals.db.getAllDiseases();
    const data = {
      success: true,
      diseases,
      total_count: diseases.length
    };

    ResponseHandler.sendResponse(req, res, data, {
      title: 'Disease Database',
      description: 'Comprehensive database of tracked diseases including STDs, genetic disorders, neurological conditions, and more',
      tableName: `All Diseases (${diseases.length})`
    });
  } catch (error) {
    console.error('Get diseases error:', error);
    const errorData = {
      success: false,
      error: 'Failed to fetch diseases'
    };

    if (ResponseHandler.isApiRequest(req)) {
      res.status(500).json(errorData);
    } else {
      res.status(500).send(`
        <div style="padding: 40px; text-align: center; color: #ef4444;">
          <h2>❌ Error Loading Diseases</h2>
          <p>Failed to fetch diseases from database</p>
        </div>
      `);
    }
  }
});

app.get('/api/diseases/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const diseases = await app.locals.db.getDiseasesByCategory(category);
    res.json({
      success: true,
      diseases,
      category,
      total_count: diseases.length
    });
  } catch (error) {
    console.error('Get diseases by category error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch diseases by category'
    });
  }
});

// API key management (for medical professionals)
app.post('/api/user/api-keys',
  (req, res, next) => {
    if (app.locals.auth?.authenticateToken) {
      return app.locals.auth.authenticateToken(req, res, next);
    }
    return res.status(500).json({ error: 'Authentication service not initialized' });
  },
  (req, res, next) => {
    if (app.locals.auth?.requireRole) {
      return app.locals.auth.requireRole(['medical_professional', 'admin'])(req, res, next);
    }
    return res.status(500).json({ error: 'Authentication service not initialized' });
  },
  async (req, res) => {
    try {
      const { name, permissions, rate_limit, expires_in_days } = req.body;

      if (!name || !permissions || !Array.isArray(permissions)) {
        return res.status(400).json({
          success: false,
          error: 'Name and permissions array are required'
        });
      }

      const result = await app.locals.userService.generateApiKey(
        req.user.id,
        name,
        permissions,
        rate_limit || 1000,
        expires_in_days
      );

      res.status(201).json(result);
    } catch (error) {
      console.error('Generate API key error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

// STD surveillance data endpoints
app.get('/api/std/data', async (req, res) => {
  try {
    const { disease, year, state, ageGroup } = req.query;

    // Return mock data for now while we debug the CDC API
    const mockData = {
      success: true,
      data: [
        {
          disease: disease || 'chlamydia',
          year: year || '2022',
          state: state || 'NY',
          cases: 125000,
          rate: 400.5
        },
        {
          disease: disease || 'chlamydia',
          year: year || '2022',
          state: 'CA',
          cases: 180000,
          rate: 455.8
        }
      ],
      totalRecords: 2,
      timestamp: new Date().toISOString(),
      note: "Mock data - CDC WONDER API integration in progress"
    };

    res.json(mockData);
  } catch (error) {
    console.error('Error fetching STD data:', error);
    res.status(500).json({ error: 'Failed to fetch STD surveillance data' });
  }
});

app.get('/api/std/summary', async (req, res) => {
  try {
    const { year } = req.query;

    // Return mock summary data
    const mockSummary = {
      success: true,
      year: year || '2022',
      summary: {
        chlamydia: {
          totalCases: 1640000,
          states: 50,
          avgRate: 495.1
        },
        gonorrhea: {
          totalCases: 710000,
          states: 50,
          avgRate: 214.8
        },
        syphilis: {
          totalCases: 176000,
          states: 50,
          avgRate: 53.2
        }
      },
      timestamp: new Date().toISOString(),
      note: "Mock data - CDC WONDER API integration in progress"
    };

    res.json(mockSummary);
  } catch (error) {
    console.error('Error fetching STD summary:', error);
    res.status(500).json({ error: 'Failed to fetch STD summary data' });
  }
});

app.get('/api/std/diseases', (req, res) => {
  res.json({
    diseases: [
      { code: 'chlamydia', name: 'Chlamydia' },
      { code: 'gonorrhea', name: 'Gonorrhea' },
      { code: 'syphilis', name: 'Syphilis' },
      { code: 'chancroid', name: 'Chancroid' }
    ],
    states: [
      { code: 'ny', name: 'New York' },
      { code: 'ca', name: 'California' },
      { code: 'tx', name: 'Texas' },
      { code: 'fl', name: 'Florida' }
    ],
    ageGroups: [
      { code: '15-19', name: '15-19 years' },
      { code: '20-24', name: '20-24 years' },
      { code: '25-29', name: '25-29 years' },
      { code: '30-34', name: '30-34 years' }
    ],
    availableYears: ['2008', '2009', '2010', '2011', '2012', '2013', '2014'],
    note: "CDC WONDER STD data available through 2014 only"
  });
});

// API Status and Documentation Endpoint
app.get('/api/std/status', async (req, res) => {
  try {
    // Get dataset info from CDC data service
    const datasetInfo = await app.locals.cdcDataService.getDatasetInfo();
    const availableYears = await app.locals.cdcDataService.getAvailableYears();

    res.json({
      status: "fully_operational",
      mockDataActive: true,
      realDataAvailable: true,
      realDataSource: "CDC data.gov NNDSS",
      cdcWonderIntegration: "in_development",
      dataLimitations: {
        cdcWonder: "STD data available 1996-2014 only",
        realData: "Weekly surveillance reports, may include provisional data"
      },
      endpoints: {
        "/api/std/data": "STD surveillance data (mock)",
        "/api/std/summary": "STD summary statistics (mock)",
        "/api/std/real-data": "Real CDC surveillance data (2015-present)",
        "/api/std/real-summary": "Real CDC summary statistics",
        "/api/std/diseases": "Available diseases, states, years",
        "/api/std/status": "API status and documentation",
        "/api/std/test-wonder": "CDC WONDER integration status",
        "/api/std/charts/trend": "Multi-year trend analysis for visualization",
        "/api/std/charts/geographic": "State-by-state geographic data for maps",
        "/api/std/charts/comparison": "Disease comparison statistics",
        "/api/std/states": "Available state-level data sources",
        "/api/std/states/:state": "State-level STD surveillance data",
        "/api/std/states/:state/summary": "State-level summary statistics",
        "/api/maps/status": "Mapping service status and configuration",
        "/api/maps/config": "Get map configuration for frontend integration",
        "/api/maps/tile/:provider/:z/:x/:y": "Get tile URLs for map rendering",
        "/api/maps/geocode": "Geocoding service with multiple providers",
        "/api/maps/tiers": "Available service tiers and provider information"
      },
      realDataCapabilities: {
        diseases: datasetInfo.diseases,
        dataRange: datasetInfo.dataRange,
        updateFrequency: datasetInfo.updateFrequency,
        availableYears: availableYears.slice(0, 5), // Show recent 5 years
        aggregationOptions: ["state", "year", "disease", "raw"]
      },
      dataSources: {
        primary: datasetInfo.name,
        description: datasetInfo.description,
        limitations: datasetInfo.limitations
      },
      nextSteps: [
        "Add chlamydia dataset integration",
        "Implement data visualization endpoints",
        "Complete CDC WONDER XML troubleshooting",
        "Add state-level data filtering"
      ]
    });
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({
      error: "Unable to fetch complete status information",
      basicStatus: "operational_with_errors"
    });
  }
});

// Real CDC data.gov API endpoints
app.get('/api/std/real-data', async (req, res) => {
  try {
    const { disease = 'all', year = '2023', state = 'all', aggregate = 'state' } = req.query;

    const data = await app.locals.cdcDataService.querySTDData({
      disease,
      year,
      state,
      aggregateBy: aggregate
    });

    res.json(data);
  } catch (error) {
    console.error('Error fetching real CDC data:', error);
    res.status(500).json({
      error: error.message,
      endpoint: "/api/std/real-data",
      fallback: "/api/std/data"
    });
  }
});

app.get('/api/std/real-summary', async (req, res) => {
  try {
    const { year = '2023' } = req.query;

    // Get data for all diseases aggregated by disease
    const data = await app.locals.cdcDataService.querySTDData({
      disease: 'all',
      year,
      state: 'all',
      aggregateBy: 'disease'
    });

    // Transform to summary format
    const summary = {};
    data.data.forEach(item => {
      summary[item.disease] = {
        totalCases: item.totalCases,
        reportsCount: item.weeklyReports,
        lastUpdated: item.lastUpdated
      };
    });

    res.json({
      success: true,
      year: year,
      summary: summary,
      source: data.source,
      timestamp: data.timestamp,
      note: "Real CDC surveillance data aggregated by disease"
    });
  } catch (error) {
    console.error('Error fetching real CDC summary:', error);
    res.status(500).json({
      error: error.message,
      endpoint: "/api/std/real-summary",
      fallback: "/api/std/summary"
    });
  }
});

// CDC WONDER parameter discovery endpoint
app.get('/api/std/wonder-discovery', async (req, res) => {
  try {
    const discoveryInfo = app.locals.stdService.getParameterDiscoveryInstructions();
    res.json(discoveryInfo);
  } catch (error) {
    res.status(500).json({
      error: "Unable to get parameter discovery information",
      fallback: "/api/std/real-data"
    });
  }
});

// Test CDC WONDER database codes endpoint
app.get('/api/std/wonder-test-codes', async (req, res) => {
  try {
    await app.locals.stdService.initFetch();
    const testResults = await app.locals.stdService.testDatabaseCodes();
    res.json({
      ...testResults,
      warning: "This endpoint tests multiple CDC WONDER database codes and may take several minutes",
      note: "Use sparingly - includes rate limiting delays"
    });
  } catch (error) {
    console.error('Error testing database codes:', error);
    res.status(500).json({
      error: error.message,
      note: "Database code testing failed - check CDC WONDER availability"
    });
  }
});

// Test endpoint for real CDC WONDER API (currently non-functional)
app.get('/api/std/test-wonder', async (req, res) => {
  res.status(503).json({
    error: "CDC WONDER STD API integration temporarily unavailable",
    reason: "XML parameter structure requires manual discovery",
    status: "under_development",
    discoveryEndpoint: "/api/std/wonder-discovery",
    realDataEndpoint: "/api/std/real-data",
    mockDataEndpoint: "/api/std/data",
    documentation: "/api/std/status"
  });
});

// Data visualization endpoints
app.get('/api/std/charts/trend', async (req, res) => {
  try {
    const { disease = 'all', state = 'all', years = '5' } = req.query;

    // Get multi-year data for trend analysis
    const yearCount = parseInt(years);
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - yearCount;

    const trendData = [];

    if (disease === 'all') {
      // Get trend for all diseases
      const diseases = ['chlamydia', 'gonorrhea', 'syphilis'];
      for (const d of diseases) {
        try {
          const data = await app.locals.cdcDataService.querySTDData({
            disease: d,
            year: 'all',
            state,
            aggregateBy: 'year'
          });

          if (data.success && data.data.length > 0) {
            const diseaseData = data.data
              .filter(item => {
                const year = parseInt(item.year || item.lastUpdated);
                return year >= startYear && year <= currentYear;
              })
              .map(item => ({
                disease: d,
                year: item.year || item.lastUpdated,
                cases: item.totalCases || 0,
                reports: item.weeklyReports || 0
              }));

            trendData.push(...diseaseData);
          }
        } catch (error) {
          console.error(`Error getting trend data for ${d}:`, error);
        }
      }
    } else {
      // Get trend for specific disease
      try {
        const data = await app.locals.cdcDataService.querySTDData({
          disease,
          year: 'all',
          state,
          aggregateBy: 'year'
        });

        if (data.success && data.data.length > 0) {
          const diseaseData = data.data
            .filter(item => {
              const year = parseInt(item.year || item.lastUpdated);
              return year >= startYear && year <= currentYear;
            })
            .map(item => ({
              disease: disease,
              year: item.year || item.lastUpdated,
              cases: item.totalCases || 0,
              reports: item.weeklyReports || 0
            }));

          trendData.push(...diseaseData);
        }
      } catch (error) {
        console.error(`Error getting trend data for ${disease}:`, error);
      }
    }

    // Group by year for chart formatting
    const chartData = {};
    trendData.forEach(item => {
      if (!chartData[item.year]) {
        chartData[item.year] = { year: item.year };
      }
      chartData[item.year][item.disease] = item.cases;
    });

    const formattedData = Object.values(chartData).sort((a, b) => a.year - b.year);

    res.json({
      success: true,
      type: 'trend',
      data: formattedData,
      metadata: {
        disease,
        state,
        yearRange: `${startYear}-${currentYear}`,
        chartType: 'line',
        xAxis: 'year',
        yAxis: 'cases'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating trend chart data:', error);
    res.status(500).json({
      error: 'Failed to generate trend chart data',
      message: error.message
    });
  }
});

app.get('/api/std/charts/geographic', async (req, res) => {
  try {
    const { disease = 'chlamydia', year = '2023' } = req.query;

    const data = await app.locals.cdcDataService.querySTDData({
      disease,
      year,
      state: 'all',
      aggregateBy: 'state'
    });

    if (!data.success) {
      throw new Error('Failed to fetch geographic data');
    }

    // Transform data for geographic visualization
    const geoData = data.data.map(item => ({
      state: item.area,
      stateName: item.area,
      cases: item.totalCases || 0,
      reports: item.weeklyReports || 0,
      rate: item.totalCases ? (item.totalCases / (item.weeklyReports || 1)) : 0
    })).filter(item => item.state && item.state !== 'TOTAL');

    res.json({
      success: true,
      type: 'geographic',
      data: geoData,
      metadata: {
        disease,
        year,
        chartType: 'choropleth',
        valueField: 'cases',
        rateField: 'rate',
        totalStates: geoData.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating geographic chart data:', error);
    res.status(500).json({
      error: 'Failed to generate geographic chart data',
      message: error.message
    });
  }
});

app.get('/api/std/charts/comparison', async (req, res) => {
  try {
    const { year = '2023', state = 'all' } = req.query;

    const diseases = ['chlamydia', 'gonorrhea', 'syphilis'];
    const comparisonData = [];

    for (const disease of diseases) {
      try {
        const data = await app.locals.cdcDataService.querySTDData({
          disease,
          year,
          state,
          aggregateBy: state === 'all' ? 'disease' : 'state'
        });

        if (data.success && data.data.length > 0) {
          const totalCases = data.data.reduce((sum, item) => sum + (item.totalCases || 0), 0);
          const totalReports = data.data.reduce((sum, item) => sum + (item.weeklyReports || 0), 0);

          comparisonData.push({
            disease,
            totalCases,
            totalReports,
            averageCasesPerReport: totalReports > 0 ? Math.round(totalCases / totalReports) : 0,
            dataPoints: data.data.length
          });
        }
      } catch (error) {
        console.error(`Error getting comparison data for ${disease}:`, error);
        comparisonData.push({
          disease,
          totalCases: 0,
          totalReports: 0,
          averageCasesPerReport: 0,
          dataPoints: 0,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      type: 'comparison',
      data: comparisonData,
      metadata: {
        year,
        state,
        chartType: 'bar',
        xAxis: 'disease',
        yAxis: 'totalCases'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating comparison chart data:', error);
    res.status(500).json({
      error: 'Failed to generate comparison chart data',
      message: error.message
    });
  }
});

// State-level data endpoints
app.get('/api/std/states', async (req, res) => {
  try {
    const availableStates = await app.locals.stateDataService.getAvailableStates();
    res.json(availableStates);
  } catch (error) {
    console.error('Error getting available states:', error);
    res.status(500).json({
      error: 'Failed to fetch available state data sources',
      message: error.message
    });
  }
});

app.get('/api/std/states/:state', async (req, res) => {
  try {
    const { state } = req.params;
    const { disease = 'all', county = 'all', year = 'all', sex = 'Total' } = req.query;

    const data = await app.locals.stateDataService.queryStateData(state, {
      disease,
      county,
      year,
      sex
    });

    res.json(data);
  } catch (error) {
    console.error(`Error fetching state data for ${req.params.state}:`, error);
    res.status(500).json({
      error: `Failed to fetch state data for ${req.params.state}`,
      message: error.message,
      fallback: '/api/std/real-data'
    });
  }
});

app.get('/api/std/states/:state/summary', async (req, res) => {
  try {
    const { state } = req.params;
    const { year = '2021' } = req.query;

    const summary = await app.locals.stateDataService.getStateDataSummary(state, parseInt(year));
    res.json(summary);
  } catch (error) {
    console.error(`Error generating state summary for ${req.params.state}:`, error);
    res.status(500).json({
      error: `Failed to generate state summary for ${req.params.state}`,
      message: error.message
    });
  }
});

// Neurological Disease Endpoints
app.get('/api/neurological/alzheimers', async (req, res) => {
  try {
    const { state, year, metric } = req.query;
    const data = await app.locals.neurologicalService.getAlzheimersData({ state, year, metric });
    res.json(data);
  } catch (error) {
    console.error('Error fetching Alzheimer\'s data:', error);
    res.status(500).json({
      error: 'Failed to fetch Alzheimer\'s surveillance data',
      message: error.message
    });
  }
});

app.get('/api/neurological/trigeminal-neuralgia', async (req, res) => {
  try {
    const { state, year } = req.query;
    const data = await app.locals.neurologicalService.getTrigeminalNeuralgiaData({ state, year });
    res.json(data);
  } catch (error) {
    console.error('Error fetching trigeminal neuralgia data:', error);
    res.status(500).json({
      error: 'Failed to fetch trigeminal neuralgia data',
      message: error.message
    });
  }
});

app.get('/api/neurological/diseases', (req, res) => {
  try {
    const data = app.locals.neurologicalService.getAvailableDiseases();

    ResponseHandler.sendResponse(req, res, data, {
      title: 'Neurological Diseases',
      description: 'Comprehensive database of neurological conditions including Alzheimer\'s, dementia, and rare neurological disorders',
      tableName: `Neurological Diseases (${data.diseases?.length || 0})`
    });
  } catch (error) {
    console.error('Error getting neurological diseases:', error);
    const errorData = {
      error: 'Failed to get neurological diseases list',
      message: error.message
    };

    if (ResponseHandler.isApiRequest(req)) {
      res.status(500).json(errorData);
    } else {
      res.status(500).send(`
        <div style="padding: 40px; text-align: center; color: #ef4444;">
          <h2>❌ Error Loading Neurological Diseases</h2>
          <p>${error.message}</p>
        </div>
      `);
    }
  }
});

app.get('/api/neurological/summary', async (req, res) => {
  try {
    const { year } = req.query;
    const summary = await app.locals.neurologicalService.getNeurologicalSummary(year);
    res.json(summary);
  } catch (error) {
    console.error('Error generating neurological summary:', error);
    res.status(500).json({
      error: 'Failed to generate neurological disease summary',
      message: error.message
    });
  }
});

// Genetic Disease Endpoints
app.get('/api/genetic/pkd', async (req, res) => {
  try {
    const { state, year, type } = req.query;
    const data = await app.locals.geneticService.getPKDData({ state, year, type });
    res.json(data);
  } catch (error) {
    console.error('Error fetching PKD data:', error);
    res.status(500).json({
      error: 'Failed to fetch polycystic kidney disease data',
      message: error.message
    });
  }
});

app.get('/api/genetic/lupus', async (req, res) => {
  try {
    const { state, year, demographic } = req.query;
    const data = await app.locals.geneticService.getLupusData({ state, year, demographic });
    res.json(data);
  } catch (error) {
    console.error('Error fetching lupus data:', error);
    res.status(500).json({
      error: 'Failed to fetch lupus surveillance data',
      message: error.message
    });
  }
});

app.get('/api/genetic/diseases', (req, res) => {
  try {
    const diseases = app.locals.geneticService.getAvailableGeneticDiseases();
    res.json(diseases);
  } catch (error) {
    console.error('Error getting genetic diseases:', error);
    res.status(500).json({
      error: 'Failed to get genetic diseases list',
      message: error.message
    });
  }
});

app.get('/api/genetic/summary', async (req, res) => {
  try {
    const { year } = req.query;
    const summary = await app.locals.geneticService.getGeneticDiseasesSummary(year);
    res.json(summary);
  } catch (error) {
    console.error('Error generating genetic diseases summary:', error);
    res.status(500).json({
      error: 'Failed to generate genetic diseases summary',
      message: error.message
    });
  }
});

// Musculoskeletal Disease Endpoints
app.get('/api/musculoskeletal/degenerative-disc', async (req, res) => {
  try {
    const { state, year, spineLevel } = req.query;
    const data = await app.locals.musculoskeletalService.getDegenerativeDiscData({ state, year, spineLevel });
    res.json(data);
  } catch (error) {
    console.error('Error fetching degenerative disc data:', error);
    res.status(500).json({
      error: 'Failed to fetch degenerative disc disease data',
      message: error.message
    });
  }
});

app.get('/api/musculoskeletal/spine-level/:level', async (req, res) => {
  try {
    const { level } = req.params;
    const { state, year } = req.query;
    const data = await app.locals.musculoskeletalService.getSpineLevelData({ level, state, year });
    res.json(data);
  } catch (error) {
    console.error(`Error fetching spine level data for ${req.params.level}:`, error);
    res.status(500).json({
      error: `Failed to fetch ${req.params.level} spine data`,
      message: error.message
    });
  }
});

app.get('/api/musculoskeletal/risk-factors', async (req, res) => {
  try {
    const { factor, state } = req.query;
    const data = await app.locals.musculoskeletalService.getRiskFactorsData({ factor, state });
    res.json(data);
  } catch (error) {
    console.error('Error fetching risk factors data:', error);
    res.status(500).json({
      error: 'Failed to fetch risk factors data',
      message: error.message
    });
  }
});

app.get('/api/musculoskeletal/diseases', (req, res) => {
  try {
    const diseases = app.locals.musculoskeletalService.getAvailableMusculoskeletalDiseases();
    res.json(diseases);
  } catch (error) {
    console.error('Error getting musculoskeletal diseases:', error);
    res.status(500).json({
      error: 'Failed to get musculoskeletal diseases list',
      message: error.message
    });
  }
});

app.get('/api/musculoskeletal/summary', async (req, res) => {
  try {
    const { year } = req.query;
    const summary = await app.locals.musculoskeletalService.getMusculoskeletalSummary(year);
    res.json(summary);
  } catch (error) {
    console.error('Error generating musculoskeletal summary:', error);
    res.status(500).json({
      error: 'Failed to generate musculoskeletal diseases summary',
      message: error.message
    });
  }
});

// Mapping service endpoints
app.get('/api/maps/status', async (req, res) => {
  try {
    const status = app.locals.mappingService.getServiceStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting mapping service status:', error);
    res.status(500).json({
      error: 'Failed to get mapping service status',
      message: error.message
    });
  }
});

app.get('/api/maps/config', async (req, res) => {
  try {
    const {
      tier = 'free',
      provider = null,
      strategy = null,
      style = 'streets-v11',
      zoom = '10',
      centerLat = '40.7128',
      centerLng = '-74.0060'
    } = req.query;

    const config = app.locals.mappingService.getMapConfig(tier, {
      provider,
      strategy,
      style,
      zoom: parseInt(zoom),
      center: [parseFloat(centerLng), parseFloat(centerLat)]
    });

    res.json({
      success: true,
      config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting map configuration:', error);
    res.status(500).json({
      error: 'Failed to get map configuration',
      message: error.message
    });
  }
});

app.get('/api/maps/tile/:provider/:z/:x/:y', async (req, res) => {
  try {
    const { provider, z, x, y } = req.params;
    const { style, tier = 'free' } = req.query;

    // Check if provider is available for the tier
    const availableProviders = app.locals.mappingService.getAvailableProviders(tier);
    if (!availableProviders.includes(provider)) {
      return res.status(403).json({
        error: `Provider ${provider} not available for tier ${tier}`,
        availableProviders
      });
    }

    const tileUrl = app.locals.mappingService.getTileUrl(provider, z, x, y, { style });

    // Return tile URL or redirect to it
    res.json({
      success: true,
      tileUrl,
      provider,
      coordinates: { z: parseInt(z), x: parseInt(x), y: parseInt(y) }
    });
  } catch (error) {
    console.error('Error getting tile URL:', error);
    res.status(500).json({
      error: 'Failed to get tile URL',
      message: error.message
    });
  }
});

app.get('/api/maps/geocode', async (req, res) => {
  try {
    const { address, tier = 'free', provider = null } = req.query;

    if (!address) {
      return res.status(400).json({
        error: 'Address parameter is required'
      });
    }

    const results = await app.locals.mappingService.geocode(address, tier, provider);

    res.json({
      success: true,
      query: address,
      tier,
      ...results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error geocoding address:', error);
    res.status(500).json({
      error: 'Geocoding failed',
      message: error.message,
      query: req.query.address
    });
  }
});

app.post('/api/maps/config/api-key', async (req, res) => {
  try {
    const { provider, apiKey } = req.body;

    if (!provider || !apiKey) {
      return res.status(400).json({
        error: 'Provider and apiKey are required'
      });
    }

    const updated = app.locals.mappingService.updateApiKey(provider, apiKey);

    if (updated) {
      res.json({
        success: true,
        message: `API key updated for ${provider}`,
        provider,
        configured: true
      });
    } else {
      res.status(400).json({
        error: `Invalid provider or provider does not require API key: ${provider}`
      });
    }
  } catch (error) {
    console.error('Error updating API key:', error);
    res.status(500).json({
      error: 'Failed to update API key',
      message: error.message
    });
  }
});

app.post('/api/maps/config/strategy', async (req, res) => {
  try {
    const { strategy } = req.body;

    if (!strategy) {
      return res.status(400).json({
        error: 'Strategy is required',
        availableStrategies: ['failover', 'round_robin', 'weighted']
      });
    }

    const updated = app.locals.mappingService.setLoadBalancingStrategy(strategy);

    if (updated) {
      res.json({
        success: true,
        message: `Load balancing strategy updated to ${strategy}`,
        strategy
      });
    } else {
      res.status(400).json({
        error: `Invalid strategy: ${strategy}`,
        availableStrategies: ['failover', 'round_robin', 'weighted']
      });
    }
  } catch (error) {
    console.error('Error updating load balancing strategy:', error);
    res.status(500).json({
      error: 'Failed to update load balancing strategy',
      message: error.message
    });
  }
});

app.get('/api/maps/tiers', (req, res) => {
  try {
    const tiers = app.locals.mappingService.tiers;
    const providers = app.locals.mappingService.providers;

    const tierInfo = {};
    Object.keys(tiers).forEach(tier => {
      const tierConfig = tiers[tier];
      tierInfo[tier] = {
        ...tierConfig,
        availableProviders: app.locals.mappingService.getAvailableProviders(tier).map(p => ({
          id: p,
          name: providers[p].name,
          requiresApiKey: providers[p].requiresApiKey,
          configured: !providers[p].requiresApiKey || app.locals.mappingService.apiKeys[p] !== null
        }))
      };
    });

    res.json({
      success: true,
      tiers: tierInfo,
      loadBalancingStrategies: ['failover', 'round_robin', 'weighted'],
      currentStrategy: app.locals.mappingService.currentStrategy
    });
  } catch (error) {
    console.error('Error getting tier information:', error);
    res.status(500).json({
      error: 'Failed to get tier information',
      message: error.message
    });
  }
});

// Serve the main application
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Initialize services and start the server
async function startServer() {
  try {
    await initializeServices();

    app.listen(PORT, () => {
      console.log(`🌍 diseaseZone server is running on http://localhost:${PORT}`);
      console.log('Services initialized:');
      console.log('  ✅ Database with user management');
      console.log('  ✅ Authentication with API key support');
      console.log('  ✅ Family disease tracking');
      console.log('  ✅ Disease surveillance APIs');
      console.log('  ✅ Medical professional access');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down diseaseZone server...');

  if (app.locals.db) {
    await app.locals.db.close();
  }

  process.exit(0);
});

// Start the server
startServer();
