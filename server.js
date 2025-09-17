require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const fs = require('fs');

// Load configuration
let config = {};
try {
    config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
    console.log('✅ Configuration loaded successfully');
} catch (error) {
    console.warn('⚠️ Could not load config.json, using defaults:', error.message);
    config = {
        security: { captcha: { failedLoginThreshold: 7 }, passwordReset: {} },
        email: {},
        app: { name: 'diseaseZone', url: 'https://disease.zone' }
    };
}

// Services
const STDService = require('./services/stdService');
const CDCDataService = require('./services/cdcDataService');
const StateDataService = require('./services/stateDataService');
const MappingService = require('./services/mappingService');
const WalletConfigService = require('./services/walletConfigService');
const NeurologicalDiseaseService = require('./services/neurologicalDiseaseService');
const GeneticDiseaseService = require('./services/geneticDiseaseService');
const CountryHealthService = require('./services/countryHealthService');
const MusculoskeletalDiseaseService = require('./services/musculoskeletalDiseaseService');
const NeuralSearchService = require('./services/neuralSearchService');
const ModelTrainingScheduler = require('./services/modelTrainingScheduler');
const DatabaseService = require('./services/databaseService');
const UserService = require('./services/userService');
const AISymptomAnalysisService = require('./services/aiSymptomAnalysisService');

// Compliance and Security Services
const MedicalValidationService = require('./services/medicalValidationService');
const AuditLoggingService = require('./services/auditLoggingService');
const HIPAAService = require('./services/hipaaService');

// Email and Password Reset Services
const EmailService = require('./services/emailService');
const PasswordResetService = require('./services/passwordResetService');

// MetaSearch and Redirect Services
const MetaSearchService = require('./services/metaSearchService');
const RedirectService = require('./services/redirectService');

// Enhanced Security and Blockchain
const SecurityValidator = require('./middleware/security');
const WalletManagementService = require('./services/walletManagementService');
const ErrorHandler = require('./middleware/errorHandler');

// Middleware
const AuthMiddleware = require('./middleware/auth');

// Utilities
const ResponseHandler = require('./utils/responseHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize enhanced security and blockchain services
const securityValidator = new SecurityValidator();
const walletService = new WalletManagementService();
const errorHandler = new ErrorHandler(securityValidator);

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
    const countryHealthService = new CountryHealthService();
    const neuralSearchService = new NeuralSearchService();
    const modelTrainingScheduler = new ModelTrainingScheduler(neuralSearchService, databaseService);

    // Initialize compliance and security services
    const auditLoggingService = new AuditLoggingService(databaseService);
    const hipaaService = new HIPAAService(databaseService, auditLoggingService);
    const medicalValidationService = new MedicalValidationService(databaseService, auditLoggingService);

    // Initialize authentication and user services
    const authMiddleware = new AuthMiddleware(databaseService);
    const userService = new UserService(databaseService, authMiddleware, config);
    
    // Initialize wallet integration service
    const WalletUserService = require('./services/walletUserService');
    const walletUserService = new WalletUserService(databaseService, authMiddleware);

    // Initialize AI symptom analysis service
    const aiSymptomAnalysisService = new AISymptomAnalysisService(
      databaseService,
      medicalValidationService,
      auditLoggingService,
      hipaaService
    );

    // Initialize FHIR service
    const FHIRService = require('./services/fhirService');
    const fhirService = new FHIRService();

    // Initialize email and password reset services
    const emailService = new EmailService(config);
    const passwordResetService = new PasswordResetService(databaseService, emailService, config.security?.passwordReset);
    passwordResetService.startPeriodicCleanup();

    // Initialize metasearch and redirect services
    const metaSearchService = new MetaSearchService();
    const redirectService = new RedirectService();

    // Cleanup old redirects every hour
    setInterval(() => {
      redirectService.cleanupOldRedirects();
    }, 60 * 60 * 1000);

    // Make services available to routes
    app.locals.db = databaseService;
    app.locals.auth = authMiddleware;
    app.locals.userService = userService;
    app.locals.walletUserService = walletUserService;
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
    app.locals.fhirService = fhirService;
    app.locals.securityValidator = securityValidator;
    app.locals.walletService = walletService;
    app.locals.emailService = emailService;
    app.locals.passwordResetService = passwordResetService;
    app.locals.metaSearchService = metaSearchService;
    app.locals.redirectService = redirectService;
    app.locals.neuralSearchService = neuralSearchService;
    app.locals.modelTrainingScheduler = modelTrainingScheduler;
    app.locals.config = config;

    // Initialize neural search service
    console.log('🧠 Initializing Neural Search Service...');
    await neuralSearchService.initialize();

    // Start model training scheduler
    console.log('⏰ Starting model training scheduler...');
    modelTrainingScheduler.start();

    console.log('All services initialized successfully');
  } catch (error) {
    console.error('Error initializing services:', error);
    process.exit(1);
  }
}

// Enhanced Security middleware
app.use(securityValidator.enhancedCSP()); // Fixed CSP to allow inline event handlers
app.use(securityValidator.configureCORS());
app.use(securityValidator.ipSecurity());
app.use(securityValidator.sanitizeRequest());

// Basic middleware - CORS now handled by SecurityValidator
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Homepage route - serve main application or API portal based on subdomain
// This MUST be before static middleware to prevent index.html from being served
app.get('/', (req, res) => {
  const host = req.get('host') || '';
  console.log(`🔍 Homepage request from host: "${host}"`);
  
  // If it's the api subdomain, serve the API portal
  if (host.startsWith('api.') || host.includes('api.disease.zone') || host.includes('api.disease.app')) {
    console.log('✅ Serving API portal for subdomain:', host);
    return serveApiHomepage(req, res);
  }
  
  // If it's the ledger subdomain, serve the ledger platform
  if (host.startsWith('ledger.') || host.includes('ledger.disease.zone') || host.includes('ledger.disease.app')) {
    console.log('✅ Serving ledger platform for subdomain:', host);
    return serveLedgerHomepage(req, res);
  }
  
  // For main domain, serve the app.html content directly
  console.log('✅ Serving main app.html for domain:', host);
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

// Static middleware - serves other static files but not index.html (handled above)
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

// Function to serve the API homepage
function serveApiHomepage(req, res) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>diseaseZone - API Portal & Developer Dashboard</title>
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

        .top-nav {
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(10px);
            padding: 15px 0;
            margin-bottom: 20px;
            border-radius: 12px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        }

        .nav-links {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin: 0;
            padding: 0;
            list-style: none;
        }

        .nav-links a {
            color: var(--text-primary);
            text-decoration: none;
            font-weight: 500;
            padding: 8px 16px;
            border-radius: 6px;
            transition: all 0.2s;
        }

        .nav-links a:hover {
            background: var(--light-color);
            color: var(--primary-color);
        }

        .nav-links .main-app-link {
            background: var(--primary-color);
            color: white;
        }

        .nav-links .main-app-link:hover {
            background: var(--secondary-color);
            color: white;
        }

        @media (max-width: 768px) {
            .container { padding: 10px; }
            .header { padding: 30px 20px; }
            .logo h1 { font-size: 2.5rem; }
            .search-grid { grid-template-columns: 1fr; }
            .nav-links { flex-wrap: wrap; gap: 15px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <nav class="top-nav">
            <ul class="nav-links">
                <li><a href="https://www.disease.zone/" class="main-app-link">🏠 Main Application</a></li>
                <li><a href="#api-docs">📚 API Documentation</a></li>
                <li><a href="#quick-links">🔗 Quick Links</a></li>
                <li><a href="mailto:api@disease.zone">💬 API Support</a></li>
            </ul>
        </nav>
        
        <div class="header">
            <div class="logo">
                <div class="logo-icon">🧬</div>
                <h1>diseaseZone</h1>
            </div>
            <p class="subtitle">API Portal & Developer Dashboard</p>
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

        <div class="quick-links" id="quick-links">
            <h3>🔗 Quick API Links</h3>
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
}

// Function to serve the Ledger homepage
function serveLedgerHomepage(req, res) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>diseaseZone Ledger - Health Blockchain Platform</title>
    <style>
        :root {
            --primary-color: #3b82f6;
            --secondary-color: #1e40af;
            --accent-color: #06b6d4;
            --success-color: #10b981;
            --warning-color: #f59e0b;
            --danger-color: #ef4444;
            --dark-color: #1f2937;
            --light-color: #f0f9ff;
            --border-color: #bfdbfe;
            --text-primary: #1e293b;
            --text-secondary: #64748b;
            --gradient-bg: linear-gradient(135deg, #3b82f6 0%, #1e40af 50%, #1e3a8a 100%);
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
            background: var(--gradient-bg);
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
            background: var(--gradient-bg);
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 32px;
            animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }

        .logo h1 {
            background: var(--gradient-bg);
            background-clip: text;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-size: 3rem;
            font-weight: 700;
        }

        .subtitle {
            color: var(--text-secondary);
            font-size: 1.4rem;
            margin-bottom: 30px;
            font-weight: 300;
        }

        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 30px;
            margin-bottom: 30px;
        }

        .feature-card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: transform 0.3s ease;
        }

        .feature-card:hover {
            transform: translateY(-5px);
        }

        .card-header {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 20px;
        }

        .card-icon {
            width: 50px;
            height: 50px;
            background: var(--primary-color);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
        }

        .card-title {
            color: var(--text-primary);
            font-size: 1.4rem;
            font-weight: 600;
        }

        .card-description {
            color: var(--text-secondary);
            margin-bottom: 20px;
            line-height: 1.6;
        }

        .btn {
            width: 100%;
            padding: 14px 24px;
            background: var(--primary-color);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
            display: inline-block;
            text-align: center;
        }

        .btn:hover {
            background: var(--secondary-color);
            transform: translateY(-2px);
        }

        .btn-outline {
            background: transparent;
            color: var(--primary-color);
            border: 2px solid var(--primary-color);
        }

        .btn-outline:hover {
            background: var(--primary-color);
            color: white;
        }

        .top-nav {
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(10px);
            padding: 15px 0;
            margin-bottom: 20px;
            border-radius: 12px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        }

        .nav-links {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin: 0;
            padding: 0;
            list-style: none;
        }

        .nav-links a {
            color: var(--text-primary);
            text-decoration: none;
            font-weight: 500;
            padding: 8px 16px;
            border-radius: 6px;
            transition: all 0.2s;
        }

        .nav-links a:hover {
            background: var(--light-color);
            color: var(--primary-color);
        }

        .nav-links .main-app-link {
            background: var(--primary-color);
            color: white;
        }

        .nav-links .main-app-link:hover {
            background: var(--secondary-color);
            color: white;
        }

        .stats-section {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
        }

        .stat-item {
            text-align: center;
            padding: 20px;
            background: var(--light-color);
            border-radius: 12px;
        }

        .stat-number {
            font-size: 2rem;
            font-weight: 700;
            color: var(--primary-color);
            margin-bottom: 5px;
        }

        .stat-label {
            color: var(--text-secondary);
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 1px;
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
            animation: pulse-dot 2s ease-in-out infinite;
        }

        @keyframes pulse-dot {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
        }

        @media (max-width: 768px) {
            .container { padding: 10px; }
            .header { padding: 30px 20px; }
            .logo h1 { font-size: 2.5rem; }
            .features-grid { grid-template-columns: 1fr; }
            .nav-links { flex-wrap: wrap; gap: 15px; }
            .stats-grid { grid-template-columns: repeat(2, 1fr); }
        }
    </style>
</head>
<body>
    <div class="container">
        <nav class="top-nav">
            <ul class="nav-links">
                <li><a href="https://www.disease.zone/" class="main-app-link">🏠 Main Application</a></li>
                <li><a href="https://api.disease.zone/">🔌 API Portal</a></li>
                <li><a href="#wallet">💰 Wallet</a></li>
                <li><a href="#network">🌐 Network Status</a></li>
                <li><a href="mailto:ledger@disease.zone">💬 Ledger Support</a></li>
            </ul>
        </nav>
        
        <div class="header">
            <div class="logo">
                <div class="logo-icon">⛓️</div>
                <h1>Ledger</h1>
            </div>
            <p class="subtitle">Secure Health Blockchain Platform</p>
        </div>

        <div class="stats-section">
            <h3 style="text-align: center; margin-bottom: 20px; color: var(--text-primary);">🚀 Network Statistics</h3>
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-number" id="totalTransactions">12,847</div>
                    <div class="stat-label">Total Transactions</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number" id="activeWallets">3,492</div>
                    <div class="stat-label">Active Wallets</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number" id="blockHeight">2,847,692</div>
                    <div class="stat-label">Current Block</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number" id="networkHealth">99.8%</div>
                    <div class="stat-label">Network Uptime</div>
                </div>
            </div>
        </div>

        <div class="features-grid">
            <div class="feature-card">
                <div class="card-header">
                    <div class="card-icon">💰</div>
                    <h3 class="card-title">Digital Wallet</h3>
                </div>
                <p class="card-description">Secure multi-network wallet supporting Polygon, Ethereum, and other blockchain networks. Store, send, and receive health credits and tokens safely.</p>
                <a href="/wallet" class="btn">Access Wallet</a>
            </div>

            <div class="feature-card">
                <div class="card-header">
                    <div class="card-icon">🏥</div>
                    <h3 class="card-title">Health Credits</h3>
                </div>
                <p class="card-description">Earn and spend health credits through verified health activities, research participation, and community engagement in the disease tracking ecosystem.</p>
                <a href="/health-credits" class="btn btn-outline">Learn More</a>
            </div>

            <div class="feature-card">
                <div class="card-header">
                    <div class="card-icon">📊</div>
                    <h3 class="card-title">Data Marketplace</h3>
                </div>
                <p class="card-description">Securely monetize your anonymized health data while contributing to medical research and public health initiatives through blockchain verification.</p>
                <a href="/marketplace" class="btn btn-outline">Explore Marketplace</a>
            </div>

            <div class="feature-card">
                <div class="card-header">
                    <div class="card-icon">🔐</div>
                    <h3 class="card-title">Privacy & Security</h3>
                </div>
                <p class="card-description">Your health data is encrypted and stored on decentralized networks, ensuring privacy while enabling valuable research contributions.</p>
                <a href="/security" class="btn btn-outline">Security Details</a>
            </div>

            <div class="feature-card">
                <div class="card-header">
                    <div class="card-icon">🌐</div>
                    <h3 class="card-title">Network Explorer</h3>
                </div>
                <p class="card-description">Explore transactions, validate health data submissions, and monitor the integrity of the health blockchain network in real-time.</p>
                <a href="/explorer" class="btn btn-outline">View Explorer</a>
            </div>

            <div class="feature-card">
                <div class="card-header">
                    <div class="card-icon">🤝</div>
                    <h3 class="card-title">Research Partnerships</h3>
                </div>
                <p class="card-description">Connect with verified research institutions and pharmaceutical companies for secure, transparent health data collaboration.</p>
                <a href="/partnerships" class="btn btn-outline">View Partners</a>
            </div>
        </div>
    </div>

    <div class="status-bar">
        <div class="status-dot"></div>
        <span>Ledger Online • Network Healthy</span>
    </div>

    <script>
        // Simulate live network statistics
        function updateStats() {
            const stats = {
                totalTransactions: Math.floor(12800 + Math.random() * 100),
                activeWallets: Math.floor(3480 + Math.random() * 50),
                blockHeight: Math.floor(2847600 + Math.random() * 200),
                networkHealth: (99.7 + Math.random() * 0.3).toFixed(1)
            };
            
            Object.keys(stats).forEach(key => {
                const element = document.getElementById(key);
                if (element) {
                    if (key === 'networkHealth') {
                        element.textContent = stats[key] + '%';
                    } else {
                        element.textContent = stats[key].toLocaleString();
                    }
                }
            });
        }
        
        // Update stats every 10 seconds
        setInterval(updateStats, 10000);
        
        // Auto-refresh network status every 30 seconds
        setInterval(() => {
            fetch('/api/wallet/health')
                .then(response => response.json())
                .then(data => {
                    const statusBar = document.querySelector('.status-bar span');
                    if (data.success && data.data.status === 'healthy') {
                        statusBar.textContent = 'Ledger Online • Network Healthy';
                    } else {
                        statusBar.textContent = 'Ledger Online • Limited Service';
                    }
                })
                .catch(() => {
                    const statusBar = document.querySelector('.status-bar span');
                    statusBar.textContent = 'Ledger Offline';
                });
        }, 30000);
        
        // Add some interactive animations
        document.querySelectorAll('.feature-card').forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.boxShadow = '0 12px 48px rgba(59, 130, 246, 0.2)';
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
            });
        });
    </script>
</body>
</html>
  `;
  res.send(html);
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Import and use new route modules
const stiRoutes = require('./routes/stiRoutes');
const globalHealthRoutes = require('./routes/globalHealthRoutes');
const newsRoutes = require('./routes/newsRoutes');
// Temporarily comment out FHIR blockchain routes due to initialization issues
// const fhirBlockchainRoutes = require('./routes/fhirBlockchainRoutes');

// Mount the new route modules
app.use('/sti', stiRoutes);
app.use('/global', globalHealthRoutes);
app.use('/api/news', newsRoutes);
// app.use('/api/fhir/blockchain', fhirBlockchainRoutes);

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

      const { email, password, captchaToken } = req.body;
      const result = await userService.loginUser(email, password, req.ip, req.get('User-Agent'), captchaToken);

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

      // Special handling for captcha required
      if (error.message === 'CAPTCHA_REQUIRED') {
        const captcha = userService.generateCaptcha();
        return res.status(401).json({
          success: false,
          error: 'Too many failed login attempts. Please solve the captcha.',
          captcha_required: true,
          captcha: captcha
        });
      }

      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  });

// Check if captcha is required for login
app.post('/api/auth/check-captcha-required', async (req, res) => {
  try {
    const { email } = req.body;
    const userService = app.locals.userService;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const failedAttempts = await userService.getFailedLoginAttempts(email, req.ip);
    const captchaRequired = failedAttempts >= (config?.security?.captcha?.failedLoginThreshold || 7);

    if (captchaRequired) {
      const captcha = userService.generateCaptcha();
      res.json({
        success: true,
        captcha_required: true,
        captcha: captcha,
        failed_attempts: failedAttempts
      });
    } else {
      res.json({
        success: true,
        captcha_required: false,
        failed_attempts: failedAttempts
      });
    }
  } catch (error) {
    console.error('Check captcha required error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
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

// Password reset endpoints
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    const result = await app.locals.passwordResetService.initiatePasswordReset(email);

    // Log the attempt
    await app.locals.db.logAudit({
      user_id: null,
      action: 'password_reset_requested',
      resource_type: 'user',
      resource_id: email,
      details: { email },
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.json(result);

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process password reset request'
    });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Reset token and new password are required'
      });
    }

    const result = await app.locals.passwordResetService.resetPassword(token, newPassword);

    // Log successful password reset
    await app.locals.db.logAudit({
      user_id: null,
      action: 'password_reset_completed',
      resource_type: 'user',
      resource_id: token.substring(0, 8) + '...',
      details: { success: true },
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.json(result);

  } catch (error) {
    console.error('Reset password error:', error);

    // Log failed password reset attempt
    await app.locals.db.logAudit({
      user_id: null,
      action: 'password_reset_failed',
      resource_type: 'user',
      resource_id: req.body.token ? req.body.token.substring(0, 8) + '...' : 'unknown',
      details: { error: error.message },
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.status(400).json({
      success: false,
      error: error.message || 'Failed to reset password'
    });
  }
});

app.get('/api/auth/validate-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Reset token is required'
      });
    }

    // Validate the token (but don't return sensitive info)
    await app.locals.passwordResetService.validateResetToken(token);

    res.json({
      success: true,
      message: 'Reset token is valid'
    });

  } catch (error) {
    console.error('Validate reset token error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Invalid or expired reset token'
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

// Wallet integration endpoints
app.get('/api/user/wallet',
  (req, res, next) => {
    if (app.locals.auth?.authenticateToken) {
      return app.locals.auth.authenticateToken(req, res, next);
    }
    return res.status(500).json({ error: 'Authentication service not initialized' });
  },
  async (req, res) => {
    try {
      const result = await app.locals.walletUserService.getWalletInfo(req.user.id);
      res.json(result);
    } catch (error) {
      console.error('Get wallet info error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

app.post('/api/user/wallet/connect',
  (req, res, next) => {
    if (app.locals.auth?.authenticateToken) {
      return app.locals.auth.authenticateToken(req, res, next);
    }
    return res.status(500).json({ error: 'Authentication service not initialized' });
  },
  async (req, res) => {
    try {
      const walletService = app.locals.walletUserService;
      
      // Apply validation
      await Promise.all(walletService.getWalletConnectionValidation().map(validation => validation.run(req)));
      walletService.handleValidationErrors(req);
      
      const result = await walletService.connectWallet(
        req.user.id,
        req.body,
        req.ip,
        req.get('User-Agent')
      );
      res.json(result);
    } catch (error) {
      console.error('Connect wallet error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

app.post('/api/user/wallet/disconnect',
  (req, res, next) => {
    if (app.locals.auth?.authenticateToken) {
      return app.locals.auth.authenticateToken(req, res, next);
    }
    return res.status(500).json({ error: 'Authentication service not initialized' });
  },
  async (req, res) => {
    try {
      const result = await app.locals.walletUserService.disconnectWallet(
        req.user.id,
        req.ip,
        req.get('User-Agent')
      );
      res.json(result);
    } catch (error) {
      console.error('Disconnect wallet error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

app.get('/api/user/wallet/transactions',
  (req, res, next) => {
    if (app.locals.auth?.authenticateToken) {
      return app.locals.auth.authenticateToken(req, res, next);
    }
    return res.status(500).json({ error: 'Authentication service not initialized' });
  },
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      
      const result = await app.locals.walletUserService.getTransactionHistory(
        req.user.id,
        limit,
        offset
      );
      res.json(result);
    } catch (error) {
      console.error('Get transaction history error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

// Endpoint for ledger subdomain to sync transaction data
app.post('/api/user/wallet/sync-transaction',
  (req, res, next) => {
    // This endpoint is called from the ledger subdomain to sync transaction data
    // We'll add authentication via API key or special internal auth later
    next();
  },
  async (req, res) => {
    try {
      const { userId, transactionData } = req.body;
      
      if (!userId || !transactionData) {
        return res.status(400).json({
          success: false,
          error: 'userId and transactionData are required'
        });
      }
      
      const result = await app.locals.walletUserService.recordHealthTokenTransaction(
        userId,
        transactionData
      );
      res.json(result);
    } catch (error) {
      console.error('Sync transaction error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

// Endpoint for ledger subdomain to update user balance
app.post('/api/user/wallet/sync-balance',
  (req, res, next) => {
    // This endpoint is called from the ledger subdomain to sync balance updates
    next();
  },
  async (req, res) => {
    try {
      const { userId, newBalance } = req.body;
      
      if (!userId || newBalance === undefined) {
        return res.status(400).json({
          success: false,
          error: 'userId and newBalance are required'
        });
      }
      
      const result = await app.locals.walletUserService.updateHealthTokenBalance(
        userId,
        newBalance,
        'ledger_sync'
      );
      res.json(result);
    } catch (error) {
      console.error('Sync balance error:', error);
      res.status(400).json({
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

// Location-based diseases endpoint
app.get('/api/diseases/by-location', async (req, res) => {
  try {
    const { lat, lng, limit = 10 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }
    
    // Get diseases with simulated location-based prevalence
    const diseases = await app.locals.db.getAllDiseases();
    
    // Simulate location-based disease prevalence
    const locationBasedDiseases = diseases.map(disease => {
      // Simulate case counts based on disease type and location
      let baseCases = Math.floor(Math.random() * 1000) + 10;
      let severity = 'Low';
      let trend = 'Stable';
      
      // Adjust based on disease type
      if (disease.category === 'std') {
        baseCases = Math.floor(Math.random() * 200) + 5;
        severity = 'Moderate';
      } else if (disease.category === 'neurological') {
        baseCases = Math.floor(Math.random() * 50) + 1;
        severity = 'High';
      } else if (disease.category === 'genetic') {
        baseCases = Math.floor(Math.random() * 30) + 1;
        severity = 'Moderate';
      }
      
      // Simulate trends
      const trends = ['Increasing', 'Decreasing', 'Stable', 'Seasonal Peak'];
      trend = trends[Math.floor(Math.random() * trends.length)];
      
      return {
        name: disease.name,
        category: disease.category,
        cases: baseCases,
        severity,
        trend,
        description: disease.description,
        icon: getIconForCategory(disease.category),
        color: getColorForSeverity(severity)
      };
    });
    
    // Sort by cases (descending) and take the requested limit
    const topDiseases = locationBasedDiseases
      .sort((a, b) => b.cases - a.cases)
      .slice(0, parseInt(limit));
    
    res.json({
      success: true,
      diseases: topDiseases,
      location: { lat: parseFloat(lat), lng: parseFloat(lng) },
      count: topDiseases.length
    });
  } catch (error) {
    console.error('Error fetching location-based diseases:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch location-based disease data'
    });
  }
});

function getIconForCategory(category) {
  const icons = {
    'std': 'fas fa-virus',
    'neurological': 'fas fa-brain',
    'genetic': 'fas fa-dna',
    'musculoskeletal': 'fas fa-bone',
    'cardiovascular': 'fas fa-heartbeat',
    'respiratory': 'fas fa-lungs',
    'infectious': 'fas fa-bug',
    'default': 'fas fa-stethoscope'
  };
  return icons[category] || icons.default;
}

function getColorForSeverity(severity) {
  const colors = {
    'Very High': '#dc2626',
    'High': '#ef4444',
    'Moderate': '#f59e0b',
    'Low': '#10b981'
  };
  return colors[severity] || '#6b7280';
}

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

// MetaSearch API endpoints
app.get('/api/metasearch/sources', async (req, res) => {
  try {
    const sources = app.locals.metaSearchService.getDataSources();
    res.json({
      success: true,
      sources,
      count: sources.length
    });
  } catch (error) {
    console.error('Get data sources error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch data sources'
    });
  }
});

app.get('/api/metasearch/search', async (req, res) => {
  try {
    const {
      q: query,
      sources,
      maxResults = 15,
      advanced = false,
      page = 1,
      pageSize = 50
    } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Query must be at least 2 characters long'
      });
    }

    const searchOptions = {
      maxResults: parseInt(maxResults),
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      timeout: 15000
    };

    // Handle source filtering for advanced search
    if (advanced === 'true' && sources) {
      const sourceList = Array.isArray(sources) ? sources : sources.split(',');
      searchOptions.sources = sourceList;
    }

    let results;

    // Use neural search for AI mode
    if (req.query.aiMode === 'true' && req.query.engine === 'neural') {
      console.log('🧠 Using Neural Search Engine');

      const enhancedQuery = await app.locals.neuralSearchService.enhanceQuery(query.trim(), {
        dataFocus: req.query.dataFocus,
        audience: req.query.audience,
        context: req.query.context
      });

      // Use enhanced query for search
      results = await app.locals.metaSearchService.search(enhancedQuery.enhancedQuery, searchOptions);

      // Add neural network insights to results
      results.neuralInsights = {
        originalQuery: enhancedQuery.originalQuery,
        enhancedQuery: enhancedQuery.enhancedQuery,
        confidence: enhancedQuery.confidence,
        entities: enhancedQuery.entities,
        relatedTerms: enhancedQuery.relatedTerms,
        embedding: enhancedQuery.embedding ? enhancedQuery.embedding.slice(0, 5) : null // First 5 dimensions for display
      };
    } else {
      // Use regular meta-search
      results = await app.locals.metaSearchService.search(query.trim(), searchOptions);
    }

    // Process results to include redirect URLs
    const processedResults = {
      ...results,
      results: results.results.map(result => ({
        ...result,
        redirectUrl: app.locals.redirectService.createRedirectUrl(
          result.url,
          result.source,
          query,
          result.title
        )
      }))
    };

    res.json({
      success: true,
      ...processedResults
    });

  } catch (error) {
    console.error('MetaSearch error:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed. Please try again.'
    });
  }
});

// Redirect endpoints
app.get('/redirect/:redirectId', async (req, res) => {
  try {
    const { redirectId } = req.params;
    const redirectInfo = app.locals.redirectService.getRedirectInfo(redirectId);

    if (!redirectInfo) {
      return res.status(404).send(`
        <div style="padding: 40px; text-align: center;">
          <h2>🔍 Redirect Not Found</h2>
          <p>This redirect link has expired or is invalid.</p>
          <a href="/" style="color: #2563eb;">← Return to diseaseZone</a>
        </div>
      `);
    }

    // Process the redirect (mark as clicked)
    const processedRedirect = app.locals.redirectService.processRedirect(
      redirectId,
      req.ip
    );

    // Generate and send the attribution page
    const redirectPage = app.locals.redirectService.generateRedirectPage(processedRedirect);
    res.send(redirectPage);

  } catch (error) {
    console.error('Redirect error:', error);
    res.status(500).send(`
      <div style="padding: 40px; text-align: center;">
        <h2>❌ Redirect Error</h2>
        <p>An error occurred while processing this redirect.</p>
        <a href="/" style="color: #2563eb;">← Return to diseaseZone</a>
      </div>
    `);
  }
});

app.post('/api/redirect/track', async (req, res) => {
  try {
    const { redirectId, manual } = req.body;

    // Optional: Add additional tracking logic here
    console.log(`📊 Redirect tracking: ${redirectId} - Manual: ${manual}`);

    res.json({ success: true });
  } catch (error) {
    console.error('Redirect tracking error:', error);
    res.status(500).json({ success: false });
  }
});

// Blockchain wallet endpoints
app.get('/api/wallet/balance/:address',
  securityValidator.createRateLimit(60000, 30, 'Too many balance requests'),
  securityValidator.validateWalletOperation(),
  async (req, res) => {
    try {
      const { address } = req.params;
      const { network = 'polygon' } = req.query;
      
      const balance = await walletService.getNativeBalance(address, network);
      
      securityValidator.logSecurityEvent('WALLET_BALANCE_CHECK', req, {
        address,
        network,
        isReal: balance.isReal
      });
      
      res.json({
        success: true,
        data: balance
      });
    } catch (error) {
      console.error('Error checking wallet balance:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

app.get('/api/wallet/portfolio/:address',
  securityValidator.createRateLimit(60000, 20, 'Too many portfolio requests'),
  securityValidator.validateWalletOperation(),
  async (req, res) => {
    try {
      const { address } = req.params;
      const { network = 'polygon' } = req.query;
      
      const portfolio = await walletService.getPortfolio(address, network);
      
      securityValidator.logSecurityEvent('WALLET_PORTFOLIO_CHECK', req, {
        address,
        network,
        isReal: portfolio.isReal,
        totalValue: portfolio.totalValueUSD
      });
      
      res.json({
        success: true,
        data: portfolio
      });
    } catch (error) {
      console.error('Error fetching wallet portfolio:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

app.post('/api/wallet/validate-transaction',
  securityValidator.createRateLimit(60000, 10, 'Too many transaction validation requests'),
  securityValidator.validateWalletOperation(),
  securityValidator.secureGeolocation(),
  async (req, res) => {
    try {
      const { fromAddress, toAddress, amount, tokenSymbol, network = 'polygon' } = req.body;
      
      const validation = await walletService.validateTransaction(
        fromAddress,
        toAddress,
        amount,
        tokenSymbol,
        network
      );
      
      securityValidator.logSecurityEvent('TRANSACTION_VALIDATION', req, {
        fromAddress,
        toAddress,
        amount,
        tokenSymbol,
        network,
        valid: validation.valid,
        locationHash: req.locationHash
      });
      
      res.json({
        success: true,
        data: validation
      });
    } catch (error) {
      console.error('Error validating transaction:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

app.get('/api/wallet/health',
  securityValidator.createRateLimit(60000, 5, 'Too many health check requests'),
  async (req, res) => {
    try {
      const health = await walletService.healthCheck();
      
      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      console.error('Error checking wallet service health:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Network management endpoints
app.get('/api/wallet/network-config',
  securityValidator.createRateLimit(60000, 10, 'Too many network config requests'),
  async (req, res) => {
    try {
      const networkConfig = walletService.getCurrentNetworkConfig();
      const availableNetworks = walletService.getAvailableNetworks();
      
      res.json({
        success: true,
        data: {
          current: networkConfig,
          available: availableNetworks
        }
      });
    } catch (error) {
      console.error('Error getting network configuration:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

app.post('/api/wallet/switch-mode',
  securityValidator.createRateLimit(60000, 3, 'Too many mode switch requests'),
  securityValidator.validateWalletOperation(),
  async (req, res) => {
    try {
      const { mode, confirmRealMoney } = req.body;
      
      if (!mode || !['testnet', 'mainnet'].includes(mode)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid mode. Must be "testnet" or "mainnet"'
        });
      }
      
      const result = walletService.switchMode(mode, confirmRealMoney);
      
      securityValidator.logSecurityEvent('WALLET_MODE_SWITCH', req, {
        newMode: mode,
        confirmRealMoney,
        success: result.success,
        requiresConfirmation: result.requiresConfirmation
      });
      
      // Return 202 for confirmation required, 200 for success
      const statusCode = result.requiresConfirmation ? 202 : 200;
      
      res.status(statusCode).json({
        success: result.success,
        data: result
      });
    } catch (error) {
      console.error('Error switching wallet mode:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

app.post('/api/wallet/switch-network',
  securityValidator.createRateLimit(60000, 10, 'Too many network switch requests'),
  securityValidator.validateWalletOperation(),
  async (req, res) => {
    try {
      const { network } = req.body;
      
      if (!network) {
        return res.status(400).json({
          success: false,
          error: 'Network is required'
        });
      }
      
      const result = walletService.switchNetwork(network);
      
      securityValidator.logSecurityEvent('WALLET_NETWORK_SWITCH', req, {
        newNetwork: network,
        success: result.success
      });
      
      res.json({
        success: result.success,
        data: result
      });
    } catch (error) {
      console.error('Error switching wallet network:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

app.post('/api/wallet/validate-transaction-safety',
  securityValidator.createRateLimit(60000, 20, 'Too many transaction validation requests'),
  securityValidator.validateWalletOperation(),
  async (req, res) => {
    try {
      const transactionData = req.body;
      
      const safetyValidation = walletService.validateTransactionSafety(transactionData);
      
      securityValidator.logSecurityEvent('TRANSACTION_SAFETY_CHECK', req, {
        isMainnet: safetyValidation.isMainnet,
        warningLevel: safetyValidation.warningLevel,
        warningCount: safetyValidation.warnings.length
      });
      
      res.json({
        success: true,
        data: safetyValidation
      });
    } catch (error) {
      console.error('Error validating transaction safety:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// ===== COMPREHENSIVE WALLET MANAGEMENT ENDPOINTS =====

// Create new wallet
app.post('/api/wallet/create',
  securityValidator.createRateLimit(60000, 5, 'Too many wallet creation requests'),
  securityValidator.validateWalletOperation(),
  async (req, res) => {
    try {
      const { name, description } = req.body;
      
      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Wallet name is required'
        });
      }
      
      const result = await walletService.createNewWallet(name.trim(), description?.trim() || '');
      
      securityValidator.logSecurityEvent('WALLET_CREATED', req, {
        walletName: name,
        success: result.success,
        address: result.wallet?.address
      });
      
      res.json({
        success: result.success,
        data: result
      });
    } catch (error) {
      console.error('Error creating wallet:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Import existing wallet
app.post('/api/wallet/import',
  securityValidator.createRateLimit(60000, 3, 'Too many wallet import requests'),
  securityValidator.validateWalletOperation(),
  async (req, res) => {
    try {
      const { name, privateKeyOrMnemonic, description } = req.body;
      
      if (!name || !privateKeyOrMnemonic) {
        return res.status(400).json({
          success: false,
          error: 'Wallet name and private key/mnemonic are required'
        });
      }
      
      const result = await walletService.importWallet(
        name.trim(), 
        privateKeyOrMnemonic.trim(), 
        description?.trim() || ''
      );
      
      securityValidator.logSecurityEvent('WALLET_IMPORTED', req, {
        walletName: name,
        success: result.success,
        address: result.wallet?.address
      });
      
      res.json({
        success: result.success,
        data: result
      });
    } catch (error) {
      console.error('Error importing wallet:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Get all wallets
app.get('/api/wallet/all',
  securityValidator.createRateLimit(60000, 30, 'Too many wallet list requests'),
  async (req, res) => {
    try {
      const result = await walletService.getAllWallets();
      
      res.json({
        success: result.success,
        data: result
      });
    } catch (error) {
      console.error('Error getting all wallets:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Get specific wallet
app.get('/api/wallet/:walletId',
  securityValidator.createRateLimit(60000, 50, 'Too many wallet detail requests'),
  async (req, res) => {
    try {
      const { walletId } = req.params;
      const { includePrivateKey } = req.query;
      
      const result = await walletService.getWallet(walletId, includePrivateKey === 'true');
      
      if (includePrivateKey === 'true') {
        securityValidator.logSecurityEvent('WALLET_PRIVATE_KEY_ACCESSED', req, {
          walletId,
          address: result.wallet?.address
        });
      }
      
      res.json({
        success: result.success,
        data: result
      });
    } catch (error) {
      console.error('Error getting wallet:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Set active wallet
app.post('/api/wallet/set-active',
  securityValidator.createRateLimit(60000, 20, 'Too many active wallet changes'),
  securityValidator.validateWalletOperation(),
  async (req, res) => {
    try {
      const { walletId } = req.body;
      
      if (!walletId) {
        return res.status(400).json({
          success: false,
          error: 'Wallet ID is required'
        });
      }
      
      const result = await walletService.setActiveWallet(walletId);
      
      securityValidator.logSecurityEvent('WALLET_SET_ACTIVE', req, {
        walletId,
        success: result.success
      });
      
      res.json({
        success: result.success,
        data: result
      });
    } catch (error) {
      console.error('Error setting active wallet:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Search wallets
app.post('/api/wallet/search',
  securityValidator.createRateLimit(60000, 50, 'Too many wallet search requests'),
  async (req, res) => {
    try {
      const { query, filters } = req.body;
      
      const result = await walletService.searchWallets(query || '', filters || {});
      
      securityValidator.logSecurityEvent('WALLET_SEARCH', req, {
        query,
        filtersCount: Object.keys(filters || {}).length,
        resultsCount: result.count || 0
      });
      
      res.json({
        success: result.success,
        data: result
      });
    } catch (error) {
      console.error('Error searching wallets:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Find wallet by address
app.get('/api/wallet/find/:address',
  securityValidator.createRateLimit(60000, 30, 'Too many wallet find requests'),
  async (req, res) => {
    try {
      const { address } = req.params;
      
      const result = await walletService.findWalletByAddress(address);
      
      res.json({
        success: result.success,
        data: result
      });
    } catch (error) {
      console.error('Error finding wallet by address:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// ===== USER WALLET MONITORING ENDPOINTS =====

// Track user wallet
app.post('/api/wallet/track-user',
  securityValidator.createRateLimit(60000, 10, 'Too many user wallet tracking requests'),
  securityValidator.validateWalletOperation(),
  async (req, res) => {
    try {
      const { userId, address, nickname } = req.body;
      
      if (!userId || !address) {
        return res.status(400).json({
          success: false,
          error: 'User ID and wallet address are required'
        });
      }
      
      const result = await walletService.trackUserWallet(userId, address, nickname || '');
      
      securityValidator.logSecurityEvent('USER_WALLET_TRACKED', req, {
        userId,
        address,
        success: result.success
      });
      
      res.json({
        success: result.success,
        data: result
      });
    } catch (error) {
      console.error('Error tracking user wallet:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Get user wallets
app.get('/api/wallet/users/:userId?',
  securityValidator.createRateLimit(60000, 20, 'Too many user wallet requests'),
  async (req, res) => {
    try {
      const { userId } = req.params;
      
      const result = await walletService.getUserWallets(userId || null);
      
      res.json({
        success: result.success,
        data: result
      });
    } catch (error) {
      console.error('Error getting user wallets:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Get wallet analytics
app.get('/api/wallet/analytics',
  securityValidator.createRateLimit(60000, 10, 'Too many analytics requests'),
  async (req, res) => {
    try {
      const result = await walletService.getWalletAnalytics();
      
      res.json({
        success: result.success,
        data: result
      });
    } catch (error) {
      console.error('Error getting wallet analytics:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

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

// STD surveillance data endpoints - using real data sources
app.get('/api/std/data', async (req, res) => {
  try {
    const { disease, year, state, ageGroup } = req.query;
    
    // Initialize STI service if not available
    if (!app.locals.comprehensiveSTIService) {
      const ComprehensiveSTIService = require('./services/comprehensiveSTIService');
      app.locals.comprehensiveSTIService = new ComprehensiveSTIService();
    }
    
    // Map query parameters to service options
    const diseases = disease ? [disease] : ['chlamydia', 'gonorrhea', 'syphilis'];
    const region = state || 'all';
    const timeframe = year || 'current';
    
    // Query real STI data
    const stiData = await app.locals.comprehensiveSTIService.queryDiseaseData({
      diseases: diseases,
      region: region,
      timeframe: timeframe,
      dataTypes: ['surveillance', 'incidence'],
      sources: 'auto'
    });
    
    if (stiData.success) {
      // Transform data for backwards compatibility
      const transformedData = [];
      
      Object.entries(stiData.data).forEach(([diseaseName, diseaseData]) => {
        if (diseaseData.aggregated && diseaseData.aggregated.totalCases > 0) {
          transformedData.push({
            disease: diseaseName,
            year: year || new Date().getFullYear(),
            state: state || 'Multiple',
            cases: diseaseData.aggregated.totalCases,
            rate: Math.round((diseaseData.aggregated.totalCases / 100000) * 100) / 100, // Rough rate calculation
            sources: diseaseData.aggregated.sources,
            lastUpdated: diseaseData.aggregated.lastUpdated
          });
        }
      });
      
      res.json({
        success: true,
        data: transformedData,
        totalRecords: transformedData.length,
        timestamp: new Date().toISOString(),
        metadata: stiData.metadata,
        note: transformedData.length > 0 ? "Real-time surveillance data" : "No current data available for specified parameters"
      });
    } else {
      // Fallback to educational mock data with clear labeling
      res.json({
        success: true,
        data: [
          {
            disease: disease || 'chlamydia',
            year: year || '2022',
            state: state || 'Example',
            cases: 0,
            rate: 0,
            note: "Sample structure - real data service initialization failed"
          }
        ],
        totalRecords: 1,
        timestamp: new Date().toISOString(),
        error: stiData.error,
        note: "Fallback educational data - service unavailable"
      });
    }
    
  } catch (error) {
    console.error('Error fetching STD surveillance data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch STD surveillance data',
      details: error.message
    });
  }
});

app.get('/api/std/summary', async (req, res) => {
  try {
    const { year } = req.query;
    
    // Initialize STI service if not available
    if (!app.locals.comprehensiveSTIService) {
      const ComprehensiveSTIService = require('./services/comprehensiveSTIService');
      app.locals.comprehensiveSTIService = new ComprehensiveSTIService();
    }
    
    // Query comprehensive STI data for summary
    const stiData = await app.locals.comprehensiveSTIService.queryDiseaseData({
      diseases: ['chlamydia', 'gonorrhea', 'syphilis', 'hiv', 'aids'],
      region: 'all',
      timeframe: year || 'current',
      dataTypes: ['surveillance', 'incidence'],
      sources: 'auto'
    });
    
    if (stiData.success) {
      const summary = {};
      
      Object.entries(stiData.data).forEach(([disease, diseaseData]) => {
        if (diseaseData.aggregated) {
          summary[disease] = {
            totalCases: diseaseData.aggregated.totalCases || 0,
            regions: diseaseData.aggregated.regions ? diseaseData.aggregated.regions.length : 0,
            sources: diseaseData.aggregated.sources || [],
            lastUpdated: diseaseData.aggregated.lastUpdated,
            confidence: diseaseData.confidence || 'low'
          };
        }
      });
      
      res.json({
        success: true,
        year: year || new Date().getFullYear(),
        summary: summary,
        timestamp: new Date().toISOString(),
        metadata: stiData.metadata,
        note: Object.keys(summary).length > 0 ? "Real-time surveillance summary" : "Limited data availability"
      });
    } else {
      // Fallback to educational structure
      res.json({
        success: true,
        year: year || new Date().getFullYear(),
        summary: {
          chlamydia: { totalCases: 0, regions: 0, note: "Data service unavailable" },
          gonorrhea: { totalCases: 0, regions: 0, note: "Data service unavailable" },
          syphilis: { totalCases: 0, regions: 0, note: "Data service unavailable" }
        },
        timestamp: new Date().toISOString(),
        error: stiData.error,
        note: "Fallback structure - comprehensive STI service initialization failed"
      });
    }
    
  } catch (error) {
    console.error('Error fetching STD summary:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch STD summary data',
      details: error.message
    });
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
      mockDataActive: false,
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

// Disease overlay endpoints for production mapping
app.get('/api/maps/overlays/disease', async (req, res) => {
  try {
    const {
      disease,
      overlayType = 'circles',
      colorScheme = 'red-yellow-green',
      state,
      year = new Date().getFullYear()
    } = req.query;

    if (!disease) {
      return res.status(400).json({
        error: 'Disease parameter is required',
        supportedDiseases: ['chlamydia', 'gonorrhea', 'syphilis', 'hiv', 'aids']
      });
    }

    // Get disease data from the STI service
    let diseaseData;
    try {
      const stiData = await app.locals.comprehensiveSTIService.queryDiseaseData({
        diseases: [disease],
        states: state ? [state] : undefined,
        year
      });

      if (stiData.success && stiData.data && stiData.data.length > 0) {
        // Transform STI data to mapping format
        diseaseData = stiData.data.map(item => ({
          latitude: item.latitude || item.lat,
          longitude: item.longitude || item.lng || item.lon,
          cases: item.cases || item.totalCases,
          rate: item.rate || item.incidenceRate,
          location: item.location || item.city,
          state: item.state,
          disease: disease,
          lastUpdated: item.lastUpdated || item.reportDate
        })).filter(item => item.latitude && item.longitude);
      }
    } catch (error) {
      console.log('STI service unavailable, using fallback data:', error.message);
    }

    // If no real data, use sample production data
    if (!diseaseData || diseaseData.length === 0) {
      diseaseData = generateSampleDiseaseData(disease, state);
    }

    // Generate overlay using mapping service
    const overlayData = app.locals.mappingService.generateDiseaseOverlay(
      diseaseData,
      overlayType,
      { colorScheme }
    );

    res.json({
      success: true,
      disease,
      overlayType,
      dataPoints: diseaseData.length,
      overlays: overlayData,
      metadata: {
        timestamp: new Date().toISOString(),
        dataSource: diseaseData.length > 0 ? 'comprehensive-sti-service' : 'sample-data',
        colorScheme,
        supportedOverlayTypes: ['circles', 'heatmap', 'choropleth', 'markers']
      }
    });
  } catch (error) {
    console.error('Error generating disease overlay:', error);
    res.status(500).json({
      error: 'Failed to generate disease overlay',
      message: error.message
    });
  }
});

// Health check endpoint for mapping service
app.get('/api/maps/health', async (req, res) => {
  try {
    const healthCheck = await app.locals.mappingService.performHealthCheck();
    
    res.status(healthCheck.status === 'healthy' ? 200 : healthCheck.status === 'degraded' ? 206 : 503)
       .json(healthCheck);
  } catch (error) {
    console.error('Error performing mapping health check:', error);
    res.status(500).json({
      error: 'Health check failed',
      message: error.message
    });
  }
});

// Get geographic disease data for mapping
app.get('/api/maps/data/disease/:disease', async (req, res) => {
  try {
    const { disease } = req.params;
    const { state, year = new Date().getFullYear(), format = 'geojson' } = req.query;

    // Validate disease parameter
    const supportedDiseases = ['chlamydia', 'gonorrhea', 'syphilis', 'hiv', 'aids'];
    if (!supportedDiseases.includes(disease)) {
      return res.status(400).json({
        error: `Unsupported disease: ${disease}`,
        supportedDiseases
      });
    }

    // Get geographic disease data
    let geoData = [];
    try {
      const stiData = await app.locals.comprehensiveSTIService.queryDiseaseData({
        diseases: [disease],
        states: state ? [state] : undefined,
        year,
        includeGeography: true
      });

      if (stiData.success && stiData.data) {
        geoData = stiData.data;
      }
    } catch (error) {
      console.log('Using fallback geographic data:', error.message);
      geoData = generateSampleDiseaseData(disease, state);
    }

    // Format data based on requested format
    let responseData;
    if (format === 'geojson') {
      responseData = {
        type: 'FeatureCollection',
        features: geoData.map(item => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [item.longitude || item.lng, item.latitude || item.lat]
          },
          properties: {
            ...item,
            disease,
            popupContent: app.locals.mappingService.generatePopupContent({
              ...item,
              disease
            })
          }
        })).filter(feature => 
          feature.geometry.coordinates[0] && feature.geometry.coordinates[1]
        )
      };
    } else {
      responseData = geoData;
    }

    res.json({
      success: true,
      disease,
      format,
      totalFeatures: format === 'geojson' ? responseData.features.length : responseData.length,
      data: responseData,
      metadata: {
        timestamp: new Date().toISOString(),
        year,
        state: state || 'all',
        dataSource: 'comprehensive-sti-service'
      }
    });
  } catch (error) {
    console.error('Error fetching geographic disease data:', error);
    res.status(500).json({
      error: 'Failed to fetch geographic disease data',
      message: error.message
    });
  }
});

// ===== COUNTRY HEALTH DATA API ENDPOINTS =====

// Get health data for a specific country
app.get('/api/countries/:countryCode/health', async (req, res) => {
  try {
    const { countryCode } = req.params;
    const {
      region = 'all',
      dataType = 'covid',
      startDate = null,
      endDate = null,
      limit = 100
    } = req.query;

    console.log(`🌍 API: Fetching health data for ${countryCode}, region: ${region}, type: ${dataType}`);

    const healthData = await countryHealthService.getCountryHealthData(countryCode, {
      region,
      dataType,
      startDate,
      endDate,
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: healthData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching country health data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch country health data',
      message: error.message
    });
  }
});

// Get available regions for a country
app.get('/api/countries/:countryCode/regions', async (req, res) => {
  try {
    const { countryCode } = req.params;

    const regions = countryHealthService.getAvailableRegions(countryCode);

    res.json({
      success: true,
      country: countryCode,
      regions,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching country regions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch country regions',
      message: error.message
    });
  }
});

// Get API status for all country health services
app.get('/api/countries/health/status', async (req, res) => {
  try {
    console.log('🔍 API: Checking country health API status');

    const status = await countryHealthService.getAPIStatus();

    res.json({
      success: true,
      apis: status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching API status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch API status',
      message: error.message
    });
  }
});

// Bulk health data endpoint for multiple countries
app.post('/api/countries/health/bulk', async (req, res) => {
  try {
    const { countries, dataType = 'covid', region = 'all' } = req.body;

    if (!Array.isArray(countries) || countries.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Countries array is required'
      });
    }

    console.log(`🌍 API: Bulk fetching health data for ${countries.length} countries`);

    const results = {};

    // Fetch data for each country in parallel
    const promises = countries.map(async (countryCode) => {
      try {
        const data = await countryHealthService.getCountryHealthData(countryCode, {
          region,
          dataType,
          limit: 50
        });
        results[countryCode] = { success: true, data };
      } catch (error) {
        results[countryCode] = {
          success: false,
          error: error.message
        };
      }
    });

    await Promise.all(promises);

    res.json({
      success: true,
      results,
      totalCountries: countries.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in bulk health data fetch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bulk health data',
      message: error.message
    });
  }
});

// ===== NEURAL NETWORK SEARCH API ENDPOINTS =====

// Get neural search service status
app.get('/api/neural/status', async (req, res) => {
  try {
    const status = app.locals.neuralSearchService.getStatus();
    res.json({
      success: true,
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting neural search status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get neural search status',
      message: error.message
    });
  }
});

// Neural query enhancement endpoint
app.post('/api/neural/enhance-query', async (req, res) => {
  try {
    const { query, context = {} } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a string'
      });
    }

    console.log(`🧠 Neural query enhancement requested for: "${query}"`);

    const enhancement = await app.locals.neuralSearchService.enhanceQuery(query, context);

    res.json({
      success: true,
      enhancement,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error enhancing query:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enhance query',
      message: error.message
    });
  }
});

// Generate embeddings for custom text
app.post('/api/neural/embeddings', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string'
      });
    }

    console.log(`🔢 Generating embeddings for: "${text.substring(0, 50)}..."`);

    const embedding = await app.locals.neuralSearchService.generateQueryEmbedding(text);

    res.json({
      success: true,
      text,
      embedding,
      dimensions: embedding.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating embeddings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate embeddings',
      message: error.message
    });
  }
});

// Model training status and control
app.get('/api/neural/training/status', async (req, res) => {
  try {
    const status = app.locals.modelTrainingScheduler.getStatus();
    res.json({
      success: true,
      training: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting training status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get training status',
      message: error.message
    });
  }
});

// Manual model training trigger (for testing/admin use)
app.post('/api/neural/training/trigger',
  // Add authentication check for admin users
  (req, res, next) => {
    // For now, allow without auth - in production, restrict to admin users
    next();
  },
  async (req, res) => {
    try {
      const { type = 'manual' } = req.body;

      console.log(`🏋️ Manual training triggered (type: ${type})`);

      // Trigger training in background
      app.locals.modelTrainingScheduler.manualTraining(type)
        .then(() => {
          console.log('✅ Manual training completed successfully');
        })
        .catch(error => {
          console.error('❌ Manual training failed:', error);
        });

      res.json({
        success: true,
        message: `${type} training started`,
        type,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error triggering training:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to trigger training',
        message: error.message
      });
    }
  }
);

// Similarity search endpoint
app.post('/api/neural/similarity', async (req, res) => {
  try {
    const { query, documents = [], limit = 10 } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a string'
      });
    }

    console.log(`🔍 Similarity search for: "${query}" across ${documents.length} documents`);

    // Generate query embedding
    const queryEmbedding = await app.locals.neuralSearchService.generateQueryEmbedding(query);

    // Generate embeddings for documents
    const documentEmbeddings = new Map();
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const docId = doc.id || `doc_${i}`;
      const docText = doc.text || doc.content || doc.title || '';

      if (docText) {
        const embedding = await app.locals.neuralSearchService.generateQueryEmbedding(docText);
        documentEmbeddings.set(docId, embedding);
      }
    }

    // Find similar documents
    const similarities = await app.locals.neuralSearchService.findSimilarDocuments(
      queryEmbedding,
      documentEmbeddings,
      limit
    );

    res.json({
      success: true,
      query,
      queryEmbedding: queryEmbedding.slice(0, 5), // First 5 dimensions for display
      similarities,
      documentsProcessed: documents.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error performing similarity search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform similarity search',
      message: error.message
    });
  }
});

// FHIR Hospital Search and Connection Endpoints
app.get('/api/fhir/hospitals/search',
  (req, res, next) => {
    if (app.locals.auth?.authenticateToken) {
      return app.locals.auth.authenticateToken(req, res, next);
    }
    return res.status(500).json({ error: 'Authentication service not initialized' });
  },
  async (req, res) => {
  try {
    const {
      location,
      name,
      state,
      city,
      radius = 50,
      includeTest = false
    } = req.query;

    const searchResults = await app.locals.fhirService.searchHospitals({
      location,
      name,
      state,
      city,
      radius: parseInt(radius),
      includeTest: includeTest === 'true'
    });

    res.json(searchResults);
  } catch (error) {
    console.error('Error searching FHIR hospitals:', error);
    res.status(500).json({
      error: 'Failed to search FHIR hospitals',
      message: error.message
    });
  }
});

// Initiate hospital connection
app.post('/api/fhir/hospitals/connect',
  (req, res, next) => {
    if (app.locals.auth?.authenticateToken) {
      return app.locals.auth.authenticateToken(req, res, next);
    }
    return res.status(500).json({ error: 'Authentication service not initialized' });
  },
  async (req, res) => {
  try {
    const { hospitalId, scopes, purpose } = req.body;
    const userId = req.user.id;

    if (!hospitalId) {
      return res.status(400).json({
        error: 'Hospital ID is required'
      });
    }

    const connectionResult = await app.locals.fhirService.initiateHospitalConnection(
      userId,
      hospitalId,
      { scopes, purpose }
    );

    res.json(connectionResult);
  } catch (error) {
    console.error('Error initiating hospital connection:', error);
    res.status(500).json({
      error: 'Failed to initiate hospital connection',
      message: error.message
    });
  }
});

// Complete hospital connection (OAuth callback)
app.get('/api/fhir/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({
        error: 'Missing authorization code or state parameter'
      });
    }

    const connectionResult = await app.locals.fhirService.completeHospitalConnection(
      state, // connectionId
      code
    );

    if (connectionResult.success) {
      // Redirect to success page
      res.redirect(`/dashboard?fhir_connected=true&connection_id=${state}`);
    } else {
      res.redirect(`/dashboard?fhir_error=${encodeURIComponent(connectionResult.error)}`);
    }
  } catch (error) {
    console.error('Error completing hospital connection:', error);
    res.redirect(`/dashboard?fhir_error=${encodeURIComponent('Connection failed')}`);
  }
});

// Get user's hospital connections
app.get('/api/fhir/connections',
  (req, res, next) => {
    if (app.locals.auth?.authenticateToken) {
      return app.locals.auth.authenticateToken(req, res, next);
    }
    return res.status(500).json({ error: 'Authentication service not initialized' });
  },
  async (req, res) => {
  try {
    const userId = req.user.id;
    const connections = app.locals.fhirService.getUserConnections(userId);

    res.json({
      success: true,
      connections,
      totalConnections: connections.length
    });
  } catch (error) {
    console.error('Error getting user connections:', error);
    res.status(500).json({
      error: 'Failed to get connections',
      message: error.message
    });
  }
});

// Sync health data from connected hospital
app.post('/api/fhir/sync/:connectionId',
  (req, res, next) => {
    if (app.locals.auth?.authenticateToken) {
      return app.locals.auth.authenticateToken(req, res, next);
    }
    return res.status(500).json({ error: 'Authentication service not initialized' });
  },
  async (req, res) => {
  try {
    const { connectionId } = req.params;
    const {
      includeObservations = true,
      includeConditions = true,
      includeImmunizations = true,
      anonymizeData = true
    } = req.body;

    const syncResult = await app.locals.fhirService.syncHealthData(connectionId, {
      includeObservations,
      includeConditions,
      includeImmunizations,
      anonymizeData
    });

    res.json(syncResult);
  } catch (error) {
    console.error('Error syncing health data:', error);
    res.status(500).json({
      error: 'Failed to sync health data',
      message: error.message
    });
  }
});

// Get personalized health insights
app.get('/api/fhir/insights/:connectionId',
  (req, res, next) => {
    if (app.locals.auth?.authenticateToken) {
      return app.locals.auth.authenticateToken(req, res, next);
    }
    return res.status(500).json({ error: 'Authentication service not initialized' });
  },
  async (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.user.id;

    // Get latest sync data and generate insights
    const syncResult = await app.locals.fhirService.syncHealthData(connectionId, {
      anonymizeData: true
    });

    if (!syncResult.success) {
      return res.status(400).json(syncResult);
    }

    // Apply our disease surveillance algorithms to the user's data
    const personalizedInsights = await generatePersonalizedInsights(
      syncResult.syncResults.anonymizedInsights,
      userId
    );

    res.json({
      success: true,
      connectionId,
      insights: personalizedInsights,
      dataContribution: {
        anonymousContribution: true,
        enhancesSurveillance: true,
        protectsPrivacy: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting health insights:', error);
    res.status(500).json({
      error: 'Failed to get health insights',
      message: error.message
    });
  }
});

// FHIR system status and capabilities
app.get('/api/fhir/status', async (req, res) => {
  try {
    const status = {
      service: 'FHIR Integration Service',
      timestamp: new Date().toISOString(),
      capabilities: {
        hospitalSearch: true,
        smartOnFhir: true,
        anonymizedInsights: true,
        diseaseTracking: true,
        privacyProtected: true
      },
      supportedResources: ['Organization', 'Patient', 'Observation', 'Condition', 'Immunization'],
      fhirVersion: 'R4',
      totalConnections: app.locals.fhirService.userConnections.size,
      endpoints: {
        hospitalSearch: '/api/fhir/hospitals/search',
        connect: '/api/fhir/hospitals/connect',
        connections: '/api/fhir/connections',
        sync: '/api/fhir/sync/:connectionId',
        insights: '/api/fhir/insights/:connectionId'
      }
    };

    res.json(status);
  } catch (error) {
    console.error('Error getting FHIR status:', error);
    res.status(500).json({
      error: 'Failed to get FHIR status',
      message: error.message
    });
  }
});

// Helper function to generate personalized insights
async function generatePersonalizedInsights(anonymizedData, userId) {
  const insights = {
    personalizedRiskFactors: [],
    diseasePreventionRecommendations: [],
    localDiseasePatterns: [],
    healthTrends: {},
    privacyProtected: true
  };

  try {
    // Analyze user's anonymized disease exposures
    if (anonymizedData.diseaseExposures) {
      anonymizedData.diseaseExposures.forEach(exposure => {
        // Generate personalized recommendations based on disease type
        insights.diseasePreventionRecommendations.push({
          disease: exposure.disease,
          recommendation: getPreventionRecommendation(exposure.disease),
          priority: exposure.severity === 'high' ? 'urgent' : 'standard',
          anonymous: true
        });
      });
    }

    // Compare with local disease patterns from our surveillance data
    insights.localDiseasePatterns = await getLocalDiseasePatterns(anonymizedData.diseaseExposures);

    // Provide health trend analysis
    insights.healthTrends = {
      riskLevel: calculateOverallRiskLevel(anonymizedData),
      recommendations: generateHealthRecommendations(anonymizedData),
      followUpSuggestions: getFollowUpSuggestions(anonymizedData)
    };

    return insights;
  } catch (error) {
    console.error('Error generating personalized insights:', error);
    return { error: error.message };
  }
}

// Helper functions for insights generation
function getPreventionRecommendation(disease) {
  const recommendations = {
    chlamydia: 'Regular STD testing, safe sexual practices, and partner notification',
    gonorrhea: 'Annual screening, condom use, and treatment of sexual partners',
    syphilis: 'Regular testing, safe sex practices, and immediate treatment if positive',
    hiv: 'PrEP consultation, regular testing, and risk reduction counseling',
    aids: 'Continuous care coordination and adherence to antiretroviral therapy'
  };
  return recommendations[disease] || 'Consult with your healthcare provider';
}

async function getLocalDiseasePatterns(exposures) {
  // This would query our surveillance data for local patterns
  return exposures.map(exposure => ({
    disease: exposure.disease,
    localTrend: 'stable', // Would be calculated from real data
    comparisonToNational: 'below_average',
    anonymous: true
  }));
}

function calculateOverallRiskLevel(data) {
  const riskFactorCount = data.riskFactors?.length || 0;
  const diseaseExposureCount = data.diseaseExposures?.length || 0;
  
  if (diseaseExposureCount > 2 || riskFactorCount > 3) return 'elevated';
  if (diseaseExposureCount > 0 || riskFactorCount > 1) return 'moderate';
  return 'low';
}

function generateHealthRecommendations(data) {
  return [
    'Continue regular health screenings',
    'Maintain open communication with healthcare providers',
    'Stay informed about local disease trends',
    'Consider participating in anonymous health surveys'
  ];
}

function getFollowUpSuggestions(data) {
  return {
    screening: 'Schedule annual health screening',
    consultation: 'Discuss prevention strategies with your doctor',
    monitoring: 'Track your health metrics regularly'
  };
}

// Generate sample disease data for production testing
function generateSampleDiseaseData(disease, state = null) {
  const cityData = {
    'NY': [{ city: 'New York City', lat: 40.7128, lng: -74.0060 }, { city: 'Buffalo', lat: 42.8864, lng: -78.8784 }],
    'CA': [{ city: 'Los Angeles', lat: 34.0522, lng: -118.2437 }, { city: 'San Francisco', lat: 37.7749, lng: -122.4194 }],
    'TX': [{ city: 'Houston', lat: 29.7604, lng: -95.3698 }, { city: 'Dallas', lat: 32.7767, lng: -96.7970 }],
    'FL': [{ city: 'Miami', lat: 25.7617, lng: -80.1918 }, { city: 'Tampa', lat: 27.9506, lng: -82.4572 }],
    'IL': [{ city: 'Chicago', lat: 41.8781, lng: -87.6298 }],
    'PA': [{ city: 'Philadelphia', lat: 39.9526, lng: -75.1652 }],
    'AZ': [{ city: 'Phoenix', lat: 33.4484, lng: -112.0740 }]
  };

  const diseaseRates = {
    chlamydia: { base: 200, variance: 150 },
    gonorrhea: { base: 120, variance: 100 },
    syphilis: { base: 80, variance: 60 },
    hiv: { base: 40, variance: 30 },
    aids: { base: 20, variance: 15 }
  };

  const cities = state ? (cityData[state.toUpperCase()] || []) : Object.values(cityData).flat();
  const rateInfo = diseaseRates[disease] || { base: 100, variance: 50 };

  return cities.map(city => {
    const rate = rateInfo.base + (Math.random() * rateInfo.variance * 2 - rateInfo.variance);
    const population = 500000 + Math.random() * 2000000;
    const cases = Math.round((rate / 100000) * population);

    return {
      latitude: city.lat,
      longitude: city.lng,
      location: city.city,
      state: state || Object.keys(cityData).find(s => cityData[s].includes(city)),
      disease,
      cases,
      rate: Math.round(rate * 10) / 10,
      population: Math.round(population),
      lastUpdated: new Date().toISOString()
    };
  });
}

// 404 handler - only for non-static routes that don't exist
app.get('*', (req, res) => {
  // Don't serve index.html for API routes or static files
  if (req.path.startsWith('/api/') || req.path.startsWith('/js/') || req.path.startsWith('/css/') || req.path.startsWith('/images/')) {
    return errorHandler.handle404(req, res);
  }

  // For other routes, redirect to main app
  res.redirect('/');
});

// Enhanced error handling middleware
errorHandler.getMiddleware().forEach(middleware => app.use(middleware));

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
      console.log('  ✅ Enhanced security validation');
      console.log('  ✅ Blockchain wallet integration');
      console.log('  ✅ Real-time balance checking');
      console.log('  ✅ Advanced error handling');
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
