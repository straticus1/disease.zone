#!/usr/bin/env node

require('dotenv').config();
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const readline = require('readline');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Smart defaults for different environments
function detectEnvironment() {
  // Check if we're in AWS (EC2, Lambda, ECS, etc.)
  const isAWS = process.env.AWS_REGION || 
                process.env.AWS_EXECUTION_ENV || 
                process.env.NODE_ENV === 'production' ||
                process.env.AWS_LAMBDA_FUNCTION_NAME;
  
  // Check if we're likely in a Docker container
  const isDocker = process.env.DOCKER_ENV || 
                   require('fs').existsSync('/.dockerenv');
  
  return { isAWS, isDocker };
}

const env = detectEnvironment();

// Database path with smart defaults
const DB_PATH = process.env.DB_PATH || 
               (env.isAWS ? '/opt/app/database/diseaseZone.db' : 
                env.isDocker ? '/app/database/diseaseZone.db' :
                path.join(__dirname, '..', 'database', 'diseaseZone.db'));

// API URL with smart defaults
const API_BASE_URL = process.env.API_URL || 
                    (env.isAWS ? 'https://disease.zone' : 
                     env.isDocker ? 'http://localhost:3000' :
                     'http://localhost:3000');

// Show environment info on startup
const ENV_INFO = {
  detected: env.isAWS ? 'AWS Production' : env.isDocker ? 'Docker' : 'Local Development',
  dbPath: DB_PATH,
  apiUrl: API_BASE_URL,
  nodeEnv: process.env.NODE_ENV || 'development'
};

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function colorize(text, color) {
  return colors[color] + text + colors.reset;
}

function showHeader() {
  console.log('\n' + colorize('='.repeat(70), 'cyan'));
  console.log(colorize('           DISEASE.ZONE LOGIN VALIDATOR', 'cyan'));
  console.log(colorize('='.repeat(70), 'cyan'));
  
  // Show environment information
  console.log(colorize('Environment:', 'yellow') + ` ${colorize(ENV_INFO.detected, 'white')}`);
  console.log(colorize('API URL:', 'yellow') + ` ${colorize(ENV_INFO.apiUrl, 'white')}`);
  console.log(colorize('Database:', 'yellow') + ` ${colorize(ENV_INFO.dbPath, 'white')}`);
  console.log(colorize('Node ENV:', 'yellow') + ` ${colorize(ENV_INFO.nodeEnv, 'white')}`);
  
  if (process.env.API_URL || process.env.DB_PATH) {
    console.log(colorize('\n[Environment variables detected - using custom settings]', 'magenta'));
  }
  
  console.log(colorize('='.repeat(70), 'cyan') + '\n');
}

function showAvailableUsers() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    
    db.all(`SELECT email, role, subscription_tier, verified, first_name, last_name 
            FROM users ORDER BY role, email`, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      console.log(colorize('Available Test Users:', 'yellow'));
      console.log(colorize('-'.repeat(80), 'yellow'));
      console.log('EMAIL'.padEnd(25) + 'ROLE'.padEnd(20) + 'TIER'.padEnd(10) + 'NAME'.padEnd(20) + 'VERIFIED');
      console.log(colorize('-'.repeat(80), 'yellow'));
      
      rows.forEach(user => {
        const email = user.email.padEnd(25);
        const role = user.role.padEnd(20);
        const tier = (user.subscription_tier || 'free').padEnd(10);
        const name = `${user.first_name} ${user.last_name}`.padEnd(20);
        const verified = user.verified ? colorize('✓', 'green') : colorize('✗', 'red');
        
        const roleColor = user.role === 'admin' ? 'magenta' : 
                         user.role === 'medical_professional' ? 'blue' : 'white';
        
        console.log(email + colorize(role, roleColor) + tier + name + verified);
      });
      
      console.log(colorize('-'.repeat(80), 'yellow') + '\n');
      db.close();
      resolve();
    });
  });
}

function validateLogin(email, password) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    
    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!user) {
        resolve({ success: false, message: 'User not found' });
        return;
      }
      
      const passwordMatch = bcrypt.compareSync(password, user.password_hash);
      
      if (passwordMatch) {
        resolve({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            subscription_tier: user.subscription_tier,
            verified: user.verified,
            first_name: user.first_name,
            last_name: user.last_name
          }
        });
      } else {
        resolve({ success: false, message: 'Invalid password' });
      }
      
      db.close();
    });
  });
}

function testApiLogin(email, password) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const http = require('http');
    const url = require('url');
    
    // Use configured API base URL
    const loginUrl = API_BASE_URL + '/api/auth/login';
    
    const postData = JSON.stringify({
      email: email,
      password: password
    });
    
    const parsedUrl = url.parse(loginUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      // For self-signed certificates in development
      rejectUnauthorized: false
    };
    
    const req = requestModule.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            response: response,
            headers: res.headers
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            response: { error: 'Invalid JSON response', raw: data },
            headers: res.headers
          });
        }
      });
    });
    
    req.on('error', (error) => {
      resolve({
        statusCode: 0,
        response: { error: 'Connection failed: ' + error.message },
        headers: {}
      });
    });
    
    req.write(postData);
    req.end();
  });
}

function resetPassword(email, newPassword) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    
    // First check if user exists
    db.get(`SELECT id, email, role FROM users WHERE email = ?`, [email], (err, user) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!user) {
        resolve({ success: false, message: 'User not found' });
        return;
      }
      
      // Hash the new password
      const hashedPassword = bcrypt.hashSync(newPassword, 12);
      
      // Update the password
      db.run(`UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?`, 
        [hashedPassword, email], (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        resolve({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            role: user.role
          },
          message: 'Password updated successfully'
        });
        
        db.close();
      });
    });
  });
}

function resetAllPasswords() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    
    // Default passwords for each user type
    const defaultPasswords = {
      'test@test.com': 'test123',
      'doctor@test.com': 'doctor123',
      'researcher@test.com': 'research123',
      'insurance@test.com': 'insurance123',
      'admin@disease.zone': 'admin123'
    };
    
    const updates = [];
    const results = [];
    
    // Get all users first
    db.all(`SELECT email, role FROM users`, (err, users) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Prepare updates
      users.forEach(user => {
        const defaultPassword = defaultPasswords[user.email] || 'password123';
        const hashedPassword = bcrypt.hashSync(defaultPassword, 12);
        
        updates.push({
          email: user.email,
          password: defaultPassword,
          hashedPassword: hashedPassword,
          role: user.role
        });
      });
      
      // Execute updates
      let completed = 0;
      updates.forEach(update => {
        db.run(`UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?`,
          [update.hashedPassword, update.email], (err) => {
          completed++;
          
          if (err) {
            results.push({ ...update, success: false, error: err.message });
          } else {
            results.push({ ...update, success: true });
          }
          
          if (completed === updates.length) {
            db.close();
            resolve({ success: true, results: results });
          }
        });
      });
      
      if (updates.length === 0) {
        db.close();
        resolve({ success: true, results: [], message: 'No users found' });
      }
    });
  });
}

function promptUser(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

function showMenu() {
  console.log(colorize('\nSelect an option:', 'cyan'));
  console.log(colorize('1. Test login credentials', 'white'));
  console.log(colorize('2. Reset single user password', 'white'));
  console.log(colorize('3. Reset all user passwords to defaults', 'white'));
  console.log(colorize('4. Show current user list', 'white'));
  console.log(colorize('5. Change environment settings', 'white'));
  console.log(colorize('6. Exit', 'white'));
}

async function handlePasswordReset() {
  console.log(colorize('\n=== PASSWORD RESET ===', 'yellow'));
  
  const email = await promptUser(colorize('Enter email address: ', 'cyan'));
  const newPassword = await promptUser(colorize('Enter new password: ', 'cyan'));
  
  console.log(colorize('\nResetting password...', 'yellow'));
  
  try {
    const result = await resetPassword(email, newPassword);
    
    if (result.success) {
      console.log(colorize('✓ Password reset successful!', 'green'));
      console.log(colorize(`  User: ${result.user.email}`, 'white'));
      console.log(colorize(`  Role: ${result.user.role}`, 'white'));
      console.log(colorize(`  New Password: ${newPassword}`, 'white'));
    } else {
      console.log(colorize('✗ Password reset failed: ' + result.message, 'red'));
    }
  } catch (error) {
    console.log(colorize('✗ Password reset error: ' + error.message, 'red'));
  }
}

async function handleResetAll() {
  console.log(colorize('\n=== RESET ALL PASSWORDS ===', 'yellow'));
  console.log(colorize('This will reset all user passwords to default values.', 'yellow'));
  
  const confirm = await promptUser(colorize('Are you sure? (yes/no): ', 'red'));
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log(colorize('Operation cancelled.', 'yellow'));
    return;
  }
  
  console.log(colorize('\nResetting all passwords...', 'yellow'));
  
  try {
    const result = await resetAllPasswords();
    
    if (result.success) {
      console.log(colorize('✓ All passwords reset successfully!', 'green'));
      console.log(colorize('\nDefault credentials:', 'white'));
      console.log(colorize('-'.repeat(50), 'yellow'));
      
      result.results.forEach(user => {
        if (user.success) {
          const roleColor = user.role === 'admin' ? 'magenta' : 
                           user.role === 'medical_professional' ? 'blue' : 'white';
          console.log(`${user.email.padEnd(25)} ${colorize(user.role.padEnd(20), roleColor)} ${user.password}`);
        }
      });
      
      console.log(colorize('-'.repeat(50), 'yellow'));
    } else {
      console.log(colorize('✗ Password reset failed', 'red'));
    }
  } catch (error) {
    console.log(colorize('✗ Password reset error: ' + error.message, 'red'));
  }
}

async function handleEnvironmentSettings() {
  console.log(colorize('\n=== ENVIRONMENT SETTINGS ===', 'yellow'));
  
  console.log(colorize('\nCurrent Settings:', 'white'));
  console.log(colorize(`Environment: ${ENV_INFO.detected}`, 'white'));
  console.log(colorize(`API URL: ${ENV_INFO.apiUrl}`, 'white'));
  console.log(colorize(`Database: ${ENV_INFO.dbPath}`, 'white'));
  console.log(colorize(`Node ENV: ${ENV_INFO.nodeEnv}`, 'white'));
  
  console.log(colorize('\nOverride Settings (press Enter to keep current):', 'cyan'));
  
  const newApiUrl = await promptUser(colorize(`API URL [${ENV_INFO.apiUrl}]: `, 'cyan'));
  if (newApiUrl.trim()) {
    process.env.API_URL = newApiUrl;
    console.log(colorize(`✓ API URL updated to: ${newApiUrl}`, 'green'));
  }
  
  const newDbPath = await promptUser(colorize(`Database Path [${ENV_INFO.dbPath}]: `, 'cyan'));
  if (newDbPath.trim()) {
    process.env.DB_PATH = newDbPath;
    console.log(colorize(`✓ Database path updated to: ${newDbPath}`, 'green'));
  }
  
  console.log(colorize('\nNote: Settings are active for this session only.', 'yellow'));
  console.log(colorize('To make permanent, set environment variables before running the script.', 'yellow'));
}

async function handleLogin() {
  console.log(colorize('\n=== LOGIN TEST ===', 'yellow'));
  
  // Get email
  const email = await promptUser(colorize('Enter email address: ', 'cyan'));
  
  // Get password (hidden input would be better, but this is for testing)
  const password = await promptUser(colorize('Enter password: ', 'cyan'));
    
  console.log('\n' + colorize('Testing login...', 'yellow'));
  
  // Test direct database validation
  console.log(colorize('1. Database Validation:', 'blue'));
  const dbResult = await validateLogin(email, password);
  
  if (dbResult.success) {
    console.log(colorize('   ✓ Database login successful!', 'green'));
    console.log(colorize(`   User: ${dbResult.user.first_name} ${dbResult.user.last_name}`, 'white'));
    console.log(colorize(`   Role: ${dbResult.user.role}`, 'white'));
    console.log(colorize(`   Subscription: ${dbResult.user.subscription_tier || 'free'}`, 'white'));
    console.log(colorize(`   Verified: ${dbResult.user.verified ? 'Yes' : 'No'}`, 'white'));
  } else {
    console.log(colorize('   ✗ Database login failed: ' + dbResult.message, 'red'));
  }
  
  // Test API login
  console.log(colorize('\n2. API Validation:', 'blue'));
  const apiResult = await testApiLogin(email, password);
  
  if (apiResult.statusCode === 200 && apiResult.response.success) {
    console.log(colorize('   ✓ API login successful!', 'green'));
    console.log(colorize(`   Token received: ${apiResult.response.token ? 'Yes' : 'No'}`, 'white'));
    console.log(colorize(`   User ID: ${apiResult.response.user?.id || 'N/A'}`, 'white'));
    console.log(colorize(`   Role: ${apiResult.response.user?.role || 'N/A'}`, 'white'));
  } else {
    console.log(colorize('   ✗ API login failed', 'red'));
    console.log(colorize(`   Status Code: ${apiResult.statusCode}`, 'red'));
    console.log(colorize(`   Error: ${JSON.stringify(apiResult.response, null, 2)}`, 'red'));
  }
  
  // Show recommendations
  if (dbResult.success && apiResult.statusCode !== 200) {
    console.log(colorize('\n🔍 DIAGNOSIS:', 'yellow'));
    console.log(colorize('   Database authentication works but API fails.', 'yellow'));
    console.log(colorize('   This suggests a server or API endpoint issue.', 'yellow'));
    console.log(colorize('   Make sure your server is running on the expected port.', 'yellow'));
  } else if (!dbResult.success) {
    console.log(colorize('\n🔍 DIAGNOSIS:', 'yellow'));
    console.log(colorize('   Database authentication failed.', 'yellow'));
    console.log(colorize('   Check if the email exists and password is correct.', 'yellow'));
  }
}

async function main() {
  try {
    showHeader();
    
    while (true) {
      showMenu();
      
      const choice = await promptUser(colorize('\nEnter your choice (1-6): ', 'cyan'));
      
      switch (choice) {
        case '1':
          await showAvailableUsers();
          await handleLogin();
          break;
          
        case '2':
          await showAvailableUsers();
          await handlePasswordReset();
          break;
          
        case '3':
          await handleResetAll();
          break;
          
        case '4':
          await showAvailableUsers();
          break;
          
        case '5':
          await handleEnvironmentSettings();
          break;
          
        case '6':
          console.log(colorize('\nGoodbye! 👋', 'cyan'));
          return;
          
        default:
          console.log(colorize('\nInvalid choice. Please enter 1-6.', 'red'));
      }
      
      // Ask if user wants to continue
      const continueChoice = await promptUser(colorize('\nPress Enter to continue or type "exit" to quit: ', 'cyan'));
      if (continueChoice.toLowerCase() === 'exit') {
        console.log(colorize('\nGoodbye! 👋', 'cyan'));
        return;
      }
    }
    
  } catch (error) {
    console.error(colorize('Error: ' + error.message, 'red'));
  } finally {
    rl.close();
  }
}

// Handle Ctrl+C gracefully
rl.on('SIGINT', () => {
  console.log(colorize('\n\nGoodbye! 👋', 'cyan'));
  process.exit(0);
});

main();