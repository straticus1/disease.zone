# Disease.Zone Utility Scripts

This directory contains utility scripts for managing and debugging the Disease.Zone platform.

## 🔐 Login Validator & Password Reset Tool

### `login-validate.js`

A comprehensive tool for testing authentication, resetting passwords, and debugging login issues.

**Features:**
- Test login credentials against both database and API
- Reset individual user passwords
- Emergency mass password reset to defaults
- Show all users with roles and subscription tiers
- Environment configuration management
- Smart environment detection (Local/Docker/AWS)

**Usage:**

```bash
# From project root
node scripts/login-validate.js

# Or run directly from scripts directory
cd scripts && node login-validate.js
```

**Menu Options:**
1. **Test login credentials** - Validate email/password combinations
2. **Reset single user password** - Change any user's password
3. **Reset all user passwords to defaults** - Emergency recovery
4. **Show current user list** - Display all users and their details
5. **Change environment settings** - Update API URL and database path
6. **Exit** - Quit the application

### `login-validate-prod.sh`

Production wrapper script that sets appropriate environment variables for AWS/production use.

**Usage:**

```bash
# Local development
./scripts/login-validate-prod.sh

# AWS/Production (sets production defaults)
./scripts/login-validate-prod.sh
```

**Environment Variables:**
- `API_URL` - API endpoint (default: https://disease.zone in prod)
- `DB_PATH` - Database file path (default: /opt/app/database/diseaseZone.db in prod)
- `NODE_ENV` - Environment (default: production)
- `AWS_REGION` - AWS region (default: us-east-1)

## 🔧 Default Test Credentials

After running option 3 (reset all passwords), these are the default credentials:

| Email | Password | Role | Subscription |
|-------|----------|------|-------------|
| `admin@disease.zone` | `admin123` | admin | premium |
| `doctor@test.com` | `doctor123` | medical_professional | premium |
| `test@test.com` | `test123` | user | free |
| `researcher@test.com` | `research123` | researcher | free |
| `insurance@test.com` | `insurance123` | insurance | free |

## 🚨 Emergency Recovery

If you can't access the platform due to login issues:

1. **Run the login validator:**
   ```bash
   node scripts/login-validate.js
   ```

2. **Choose option 3** - "Reset all user passwords to defaults"

3. **Confirm with "yes"**

4. **Use admin credentials:**
   - Email: `admin@disease.zone`
   - Password: `admin123`

## 🌐 AWS Deployment

The script automatically detects AWS environments and adjusts paths accordingly. For manual override:

```bash
export API_URL=https://your-domain.com
export DB_PATH=/path/to/your/database.db
node scripts/login-validate.js
```

## 🐳 Docker Support

The script detects Docker environments and uses appropriate container paths:
- Database: `/app/database/diseaseZone.db`
- API: `http://localhost:3000`

## Other Scripts

- `deploy.sh` - Deployment script
- `generate-hashes.js` - Hash generation utility
- `verify-hashes.js` - Hash verification utility

## 📝 Notes

- The login validator requires `bcryptjs` and `sqlite3` dependencies
- All password resets are logged with timestamps
- Environment settings changes are session-only unless environment variables are set permanently
- The script provides both database-level and API-level authentication testing for comprehensive debugging