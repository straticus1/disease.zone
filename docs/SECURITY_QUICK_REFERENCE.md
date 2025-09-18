# 🔐 Security Quick Reference Card

## 🚀 Quick Setup (Post-Security Releases)

### 1. Generate Secrets (Choose One)
```bash
# Option A: Display secrets in terminal
npm run security:generate-secrets

# Option B: Create .env.secure file
npm run security:generate-secrets-file
```

### 2. Configure .env File
```bash
# Copy generated secrets to your .env file
# REQUIRED:
JWT_SECRET=your_64_character_jwt_secret
SESSION_SECRET=your_64_character_session_secret

# RECOMMENDED:
MFA_SECRET=your_32_character_mfa_secret
RECOVERY_CODE_SALT=your_16_character_salt
```

### 3. Validate & Start
```bash
# Validate configuration
npm run security:validate-config

# Start application
npm start
```

## 🛠️ Common Commands

### Security Operations
```bash
npm run security:generate-secrets          # Generate new secrets
npm run security:generate-secrets-file     # Create .env.secure file
npm run security:validate-config           # Check current config
npm run security:validate-secret "secret"  # Test secret strength
```

### Manual Secret Generation
```bash
openssl rand -hex 64  # JWT/Session secrets
openssl rand -hex 32  # MFA secrets
openssl rand -hex 16  # Salt values
```

## 🚨 Troubleshooting

### App Won't Start?
```bash
# Check what's missing
npm run security:validate-config

# Generate missing secrets
npm run security:generate-secrets-file

# Copy to .env and try again
npm start
```

### Security Score Low?
- Ensure all secrets are 32+ characters
- Replace any default/weak passwords
- Set NODE_ENV appropriately
- Configure all required variables

## 📊 Security Dashboard

### Access (Admin Only)
- **Dashboard:** `GET /api/security/dashboard`
- **IP Events:** `GET /api/security/events/:ip`
- **IP Check:** `GET /api/security/check/:ip`  
- **Health:** `GET /api/security/health`

## 🔄 Emergency Rollback

```bash
# Rollback specific release
git revert 9eee352  # Security Release 4
git revert 36b6a23  # Security Release 3
git revert 1b4b2ae  # Security Release 2
git revert 08d9990  # Security Release 1

# Full rollback (emergency)
git revert 9eee352 36b6a23 1b4b2ae 08d9990
```

## ✅ Production Checklist

- [ ] All 4 security releases implemented
- [ ] Secure secrets generated & configured
- [ ] Configuration validation passes (100/100)
- [ ] Authentication tested & working
- [ ] Security monitoring active
- [ ] NODE_ENV=production set
- [ ] Strong database passwords
- [ ] Redis configured (recommended)

## 🎯 Target Security Score: 100/100

Run `npm run security:validate-config` to see your current score and any issues to fix.

---
**For full details, see [SECURITY_RELEASES_GUIDE.md](./SECURITY_RELEASES_GUIDE.md)**