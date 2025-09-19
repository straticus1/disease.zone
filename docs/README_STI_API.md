# STI/STD Surveillance API - Ready to Use!

## 🚀 **Immediate Usage - No API Keys Required**

Your disease tracking platform now includes comprehensive STI/STD surveillance with **immediate access** using disease.sh as the primary data source.

## 📊 **Available Data Sources**

### **Immediate Access (No Keys Needed):**
- ✅ **disease.sh** - Global disease data (COVID-19, Influenza, TB)
- ✅ **NHANES** - Herpes/HSV prevalence data (integrated datasets)
- ✅ **HPV-IMPACT** - HPV surveillance (structured placeholder data)

### **Enhanced Access (With CDC API Key):**
- 🔑 **CDC NNDSS** - Real-time STI surveillance (Syphilis, Gonorrhea, Chlamydia, HIV)
- 🔑 **CDC Cancer Registries** - HPV-associated cancer data

## 🎯 **Access Levels**

| Level | API Keys | Features | Rate Limit |
|-------|----------|----------|------------|
| **Standard** | None | disease.sh + NHANES + HPV placeholders | 100 req/min |
| **Enhanced** | 1 (CDC) | Above + Real-time CDC surveillance | 200 req/min |
| **Premium** | 2+ | Above + WHO + Advanced features | 500 req/min |

## 🛠️ **Quick Start**

### 1. **Start Immediately:**
```bash
# No configuration needed - works out of the box!
npm start
```

### 2. **Test Available Endpoints:**
```bash
# Global COVID-19 data
curl "http://localhost:3000/sti/global?disease=covid&scope=global"

# Herpes prevalence data
curl "http://localhost:3000/sti/herpes?dataType=prevalence"

# HPV information
curl "http://localhost:3000/sti/hpv?dataType=cancer&cancerType=cervical"

# Service status
curl "http://localhost:3000/sti/status"
```

## 📋 **Available Endpoints**

### **Main Data Endpoints:**
```
GET /sti/data          # Comprehensive multi-disease data
GET /sti/global        # Global disease data (COVID, Influenza, TB)
GET /sti/herpes        # Herpes/HSV prevalence & demographics
GET /sti/hpv           # HPV surveillance & cancer data
GET /sti/std           # Traditional STDs (when CDC key available)
```

### **Specific Disease Endpoints:**
```
GET /sti/hiv           # HIV surveillance (disease.sh + CDC if available)
GET /sti/aids          # AIDS surveillance
GET /sti/herpes/prevalence    # HSV-1/HSV-2 comparison
GET /sti/hpv/vaccination      # HPV vaccination data
GET /sti/hpv/guidelines       # Vaccination guidelines
```

### **System Monitoring:**
```
GET /sti/status        # Service status & capabilities
GET /sti/health        # Health check & circuit breakers
GET /sti/docs          # API documentation
```

## 🔧 **Configuration Options**

### **Environment Variables (.env):**
```bash
# Optional - system works without these
CDC_API_KEY=           # For enhanced CDC data access
DISEASE_API_KEY=       # Reserved for future premium features
WHO_API_KEY=           # For global health data (future)

# Access level (auto-detected based on available keys)
API_ACCESS_LEVEL=standard    # standard/enhanced/premium

# Data source toggles
ENABLE_DISEASE_SH=true      # Primary data source
ENABLE_NHANES_DATA=true     # Herpes prevalence data
ENABLE_HPV_IMPACT=true      # HPV surveillance
ENABLE_CDC_DATA=true        # Enhanced with API key

# Performance settings
API_REQUESTS_PER_MINUTE=100
DATA_CACHE_ENABLED=true
CACHE_EXPIRY_MINUTES=60
```

## 📈 **Data Examples**

### **COVID-19 Global Data:**
```json
{
  "success": true,
  "dataType": "covid-19",
  "data": {
    "cases": 676609955,
    "deaths": 6881955,
    "recovered": 665776297,
    "active": 3951703,
    "updated": "2024-01-15T10:20:30.000Z"
  },
  "source": "disease.sh"
}
```

### **Herpes Prevalence Data:**
```json
{
  "success": true,
  "dataType": "herpes-prevalence",
  "data": [
    {
      "virus": "HSV-1",
      "overall": {"prevalence": 47.8, "confidenceInterval": [45.4, 50.2]},
      "byAge": {"14-19": 27.2, "20-29": 41.8, "30-39": 54.1},
      "bySex": {"Male": 45.4, "Female": 50.3}
    }
  ],
  "source": "NHANES"
}
```

## 🛡️ **Reliability Features**

### **Automatic Fallbacks:**
1. **Primary:** disease.sh (immediate)
2. **Secondary:** CDC APIs (with key)
3. **Tertiary:** Cached data
4. **Last Resort:** Structured placeholders

### **Error Handling:**
- Circuit breaker pattern
- Exponential backoff for rate limits
- Graceful degradation
- Real-time health monitoring

### **Performance:**
- Intelligent caching (15min - 7 days based on data type)
- Request rate limiting
- Concurrent request management
- Background data refresh

## 🎯 **Upgrading to Enhanced Access**

When your CDC API application is approved:

1. **Add CDC API Key:**
```bash
# In your .env file:
CDC_API_KEY=your_approved_key_here
```

2. **Restart Service:**
```bash
npm restart
```

3. **Verify Enhanced Access:**
```bash
curl "http://localhost:3000/sti/status"
# Should show accessLevel: "enhanced"
```

4. **Access Real-time STD Data:**
```bash
curl "http://localhost:3000/sti/std?disease=syphilis&year=2024"
```

## 🔍 **Monitoring & Troubleshooting**

### **Check Service Health:**
```bash
curl "http://localhost:3000/sti/health"
```

### **Reset Circuit Breakers:**
```bash
curl -X POST "http://localhost:3000/sti/reset-circuit-breaker/disease.sh"
```

### **Clear Caches:**
```bash
curl -X DELETE "http://localhost:3000/sti/cache"
```

## 🎉 **You're Ready!**

The system is designed to provide immediate value with disease.sh while seamlessly upgrading when API keys become available. Start exploring disease data right away!