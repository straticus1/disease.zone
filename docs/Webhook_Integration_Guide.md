# Disease.Zone Webhook Integration Guide

## Overview
Webhooks provide real-time notifications for important events in the Disease.Zone platform. This guide covers webhook setup, event types, security, and integration best practices.

## Table of Contents
1. [Getting Started](#getting-started)
2. [Event Types](#event-types)
3. [Security](#security)
4. [Retry Logic](#retry-logic)
5. [Testing](#testing)
6. [Code Examples](#code-examples)
7. [Troubleshooting](#troubleshooting)

## Getting Started

### Prerequisites
- Active Disease.Zone account with Professional tier or higher
- Public HTTPS endpoint to receive webhooks
- Ability to verify HMAC signatures

### Setting Up Webhooks

#### 1. Register Webhook Endpoint
```javascript
POST /api/webhooks/register
{
  "url": "https://your-app.com/webhooks/disease-zone",
  "eventTypes": ["license_status_change", "violation_detected"],
  "secret": "optional_custom_secret"
}
```

#### 2. Response
```javascript
{
  "success": true,
  "webhook": {
    "id": 123,
    "url": "https://your-app.com/webhooks/disease-zone",
    "secret": "generated_secret_or_your_custom_secret",
    "eventTypes": ["license_status_change", "violation_detected"],
    "isActive": true,
    "createdAt": 1695139200000
  }
}
```

### Webhook Limits by Tier
- **Free**: 0 webhooks
- **Professional**: 10 webhooks  
- **Pro**: 50 webhooks
- **Enterprise**: Unlimited webhooks

## Event Types

### 1. License Status Change
Triggered when a healthcare provider's license status changes.

```javascript
{
  "event": "license_status_change",
  "timestamp": 1695139200000,
  "data": {
    "providerId": "prov_123456",
    "licenseNumber": "MD12345",
    "state": "CA",
    "oldStatus": "active",
    "newStatus": "suspended",
    "changeReason": "board_action",
    "effectiveDate": "2025-09-19"
  }
}
```

### 2. Violation Detected
Triggered when a new disciplinary action is detected.

```javascript
{
  "event": "violation_detected",
  "timestamp": 1695139200000,
  "data": {
    "providerId": "prov_123456",
    "licenseNumber": "MD12345",
    "violationType": "malpractice",
    "severity": "moderate",
    "description": "Medical malpractice settlement",
    "boardAction": "probation_6_months",
    "effectiveDate": "2025-09-15"
  }
}
```

### 3. Credential Expiring
Triggered when credentials are approaching expiration.

```javascript
{
  "event": "credential_expiring",
  "timestamp": 1695139200000,
  "data": {
    "providerId": "prov_123456",
    "licenseNumber": "MD12345",
    "credentialType": "medical_license",
    "expirationDate": "2025-12-31",
    "daysUntilExpiration": 30,
    "renewalRequired": true
  }
}
```

### 4. Outbreak Alert
Triggered when disease outbreak alerts are issued.

```javascript
{
  "event": "outbreak_alert",
  "timestamp": 1695139200000,
  "data": {
    "alertId": "alert_789",
    "disease": "influenza",
    "region": "california",
    "severity": "high",
    "description": "Seasonal influenza outbreak detected",
    "affectedPopulation": 15000,
    "recommendations": ["vaccination", "hygiene_measures"]
  }
}
```

### 5. Health Assessment Complete
Triggered when a health assessment is completed.

```javascript
{
  "event": "health_assessment_complete",
  "timestamp": 1695139200000,
  "data": {
    "assessmentId": "assess_456",
    "userId": "user_789",
    "riskScore": 75,
    "riskLevel": "moderate",
    "recommendations": ["follow_up_consultation", "lifestyle_changes"],
    "followUpRequired": true
  }
}
```

### 6. API Limit Reached
Triggered when API usage limits are reached.

```javascript
{
  "event": "api_limit_reached",
  "timestamp": 1695139200000,
  "data": {
    "userId": "user_123",
    "tier": "professional",
    "limitType": "daily_requests",
    "currentUsage": 15000,
    "limit": 15000,
    "resetTime": "2025-09-20T00:00:00Z"
  }
}
```

### 7. Payment Processed
Triggered when payments are processed.

```javascript
{
  "event": "payment_processed",
  "timestamp": 1695139200000,
  "data": {
    "userId": "user_123",
    "paymentId": "pay_abc123",
    "amount": 19.99,
    "currency": "USD",
    "status": "succeeded",
    "tier": "professional",
    "billingPeriod": "monthly"
  }
}
```

### 8. Subscription Changed
Triggered when subscription tiers change.

```javascript
{
  "event": "subscription_changed",
  "timestamp": 1695139200000,
  "data": {
    "userId": "user_123",
    "oldTier": "free",
    "newTier": "professional",
    "changeType": "upgrade",
    "effectiveDate": "2025-09-19T12:00:00Z",
    "prorationAmount": 12.99
  }
}
```

## Security

### HMAC Signature Verification
Every webhook includes an HMAC SHA256 signature for verification.

#### Headers
```
X-Disease-Zone-Signature: sha256=signature_here
X-Disease-Zone-Event: event_type
X-Disease-Zone-Delivery: unique_delivery_id
```

#### Verification Example (Node.js)
```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
    
  const providedSignature = signature.replace('sha256=', '');
  
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(providedSignature, 'hex')
  );
}

// Usage
app.post('/webhooks/disease-zone', (req, res) => {
  const signature = req.headers['x-disease-zone-signature'];
  const secret = 'your_webhook_secret';
  
  if (!verifyWebhookSignature(req.body, signature, secret)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook
  console.log('Verified webhook:', req.body);
  res.status(200).send('OK');
});
```

#### Verification Example (Python)
```python
import hmac
import hashlib
import json

def verify_webhook_signature(payload, signature, secret):
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        json.dumps(payload).encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    provided_signature = signature.replace('sha256=', '')
    
    return hmac.compare_digest(expected_signature, provided_signature)

# Usage in Flask
@app.route('/webhooks/disease-zone', methods=['POST'])
def handle_webhook():
    signature = request.headers.get('X-Disease-Zone-Signature')
    secret = 'your_webhook_secret'
    
    if not verify_webhook_signature(request.json, signature, secret):
        return 'Invalid signature', 401
    
    # Process webhook
    print('Verified webhook:', request.json)
    return 'OK', 200
```

## Retry Logic

### Retry Policy
- **Maximum Retries**: 3 attempts
- **Backoff**: Exponential (1s, 2s, 4s)
- **Timeout**: 30 seconds per attempt
- **Status Codes**: Retries on 5xx and connection errors

### Expected Response
Your webhook endpoint should:
- Return HTTP 200 for successful processing
- Respond within 30 seconds
- Return non-2xx status codes for processing errors

### Handling Failures
```javascript
app.post('/webhooks/disease-zone', async (req, res) => {
  try {
    // Verify signature first
    if (!verifyWebhookSignature(req.body, req.headers['x-disease-zone-signature'], secret)) {
      return res.status(401).send('Invalid signature');
    }
    
    // Process webhook
    await processWebhookEvent(req.body);
    
    // Return success
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    
    // Return error status to trigger retry
    res.status(500).send('Processing error');
  }
});
```

## Testing

### Test Webhook Endpoint
```javascript
POST /api/webhooks/{webhookId}/test
```

This sends a test event to verify your endpoint is working correctly.

### Test Event Payload
```javascript
{
  "event": "webhook_test",
  "timestamp": 1695139200000,
  "data": {
    "message": "This is a test webhook from Disease.Zone",
    "timestamp": "2025-09-19T12:00:00Z",
    "webhookId": 123
  }
}
```

### Local Testing with ngrok
```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 3000

# Use the HTTPS URL for webhook registration
# https://abc123.ngrok.io/webhooks/disease-zone
```

## Code Examples

### Complete Node.js Implementation
```javascript
const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.json());

const WEBHOOK_SECRET = 'your_webhook_secret';

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
    
  const providedSignature = signature.replace('sha256=', '');
  
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(providedSignature, 'hex')
  );
}

async function processWebhookEvent(event) {
  switch (event.event) {
    case 'license_status_change':
      await handleLicenseStatusChange(event.data);
      break;
      
    case 'violation_detected':
      await handleViolationDetected(event.data);
      break;
      
    case 'outbreak_alert':
      await handleOutbreakAlert(event.data);
      break;
      
    default:
      console.log('Unknown event type:', event.event);
  }
}

async function handleLicenseStatusChange(data) {
  console.log('License status changed:', data);
  
  // Update your database
  await updateProviderStatus(data.providerId, data.newStatus);
  
  // Send notifications
  if (data.newStatus === 'suspended') {
    await sendAlertToAdmin(data);
  }
}

async function handleViolationDetected(data) {
  console.log('Violation detected:', data);
  
  // Log violation
  await logViolation(data);
  
  // Check severity and take action
  if (data.severity === 'high') {
    await flagProviderForReview(data.providerId);
  }
}

async function handleOutbreakAlert(data) {
  console.log('Outbreak alert:', data);
  
  // Update outbreak status
  await updateOutbreakStatus(data.region, data.disease, data.severity);
  
  // Notify relevant stakeholders
  await notifyHealthOfficials(data);
}

app.post('/webhooks/disease-zone', async (req, res) => {
  try {
    const signature = req.headers['x-disease-zone-signature'];
    const deliveryId = req.headers['x-disease-zone-delivery'];
    
    // Verify signature
    if (!verifyWebhookSignature(req.body, signature, WEBHOOK_SECRET)) {
      console.error('Invalid webhook signature');
      return res.status(401).send('Invalid signature');
    }
    
    // Check for duplicate delivery (optional)
    if (await isDuplicateDelivery(deliveryId)) {
      console.log('Duplicate delivery, ignoring');
      return res.status(200).send('Duplicate');
    }
    
    // Process webhook
    await processWebhookEvent(req.body);
    
    // Record delivery
    await recordWebhookDelivery(deliveryId, req.body);
    
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).send('Processing error');
  }
});

app.listen(3000, () => {
  console.log('Webhook server listening on port 3000');
});
```

### Python Flask Implementation
```python
from flask import Flask, request, jsonify
import hmac
import hashlib
import json
import logging

app = Flask(__name__)

WEBHOOK_SECRET = 'your_webhook_secret'

def verify_webhook_signature(payload, signature, secret):
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        json.dumps(payload, separators=(',', ':')).encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    provided_signature = signature.replace('sha256=', '')
    
    return hmac.compare_digest(expected_signature, provided_signature)

async def process_webhook_event(event):
    event_type = event.get('event')
    data = event.get('data', {})
    
    if event_type == 'license_status_change':
        await handle_license_status_change(data)
    elif event_type == 'violation_detected':
        await handle_violation_detected(data)
    elif event_type == 'outbreak_alert':
        await handle_outbreak_alert(data)
    else:
        logging.warning(f'Unknown event type: {event_type}')

@app.route('/webhooks/disease-zone', methods=['POST'])
async def handle_webhook():
    try:
        signature = request.headers.get('X-Disease-Zone-Signature')
        delivery_id = request.headers.get('X-Disease-Zone-Delivery')
        
        # Verify signature
        if not verify_webhook_signature(request.json, signature, WEBHOOK_SECRET):
            logging.error('Invalid webhook signature')
            return 'Invalid signature', 401
        
        # Process webhook
        await process_webhook_event(request.json)
        
        return 'OK', 200
        
    except Exception as e:
        logging.error(f'Webhook processing error: {e}')
        return 'Processing error', 500

if __name__ == '__main__':
    app.run(port=3000, debug=True)
```

## Webhook Management

### List Webhooks
```javascript
GET /api/webhooks
```

### Update Webhook
```javascript
PUT /api/webhooks/{webhookId}
{
  "url": "https://new-url.com/webhooks",
  "eventTypes": ["license_status_change", "outbreak_alert"],
  "isActive": true
}
```

### Delete Webhook
```javascript
DELETE /api/webhooks/{webhookId}
```

### Get Delivery History
```javascript
GET /api/webhooks/{webhookId}/deliveries?limit=50
```

### Webhook Statistics
```javascript
GET /api/webhooks/stats
{
  "webhooks": [
    {
      "id": 123,
      "url": "https://your-app.com/webhooks",
      "successCount": 145,
      "failureCount": 3,
      "lastTriggered": 1695139200000,
      "totalDeliveries": 148,
      "successfulDeliveries": 145
    }
  ]
}
```

## Troubleshooting

### Common Issues

#### 1. Signature Verification Failing
- Ensure you're using the exact payload received
- Check that you're using the correct secret
- Verify the HMAC algorithm (SHA256)
- Make sure JSON is serialized consistently

#### 2. Webhooks Not Being Delivered
- Check that your endpoint is publicly accessible
- Verify HTTPS certificate is valid
- Ensure endpoint responds within 30 seconds
- Check firewall settings

#### 3. Duplicate Events
- Implement idempotency using delivery IDs
- Store processed delivery IDs to prevent duplicates
- Use database constraints to handle race conditions

#### 4. Missing Events
- Check webhook configuration includes desired event types
- Verify endpoint is returning 200 status codes
- Review delivery history for failed attempts

### Debugging Tips

#### 1. Enable Detailed Logging
```javascript
app.post('/webhooks/disease-zone', (req, res) => {
  console.log('Webhook Headers:', req.headers);
  console.log('Webhook Payload:', JSON.stringify(req.body, null, 2));
  
  // Process webhook...
});
```

#### 2. Validate Payload Structure
```javascript
function validateWebhookPayload(payload) {
  const required = ['event', 'timestamp', 'data'];
  
  for (const field of required) {
    if (!(field in payload)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  return true;
}
```

#### 3. Test Connectivity
```bash
# Test webhook endpoint
curl -X POST https://your-app.com/webhooks/disease-zone \
  -H "Content-Type: application/json" \
  -H "X-Disease-Zone-Signature: sha256=test" \
  -d '{"event":"test","timestamp":123456789,"data":{}}'
```

### Contact Support
- **Technical Issues**: support@disease.zone
- **Integration Help**: developers@disease.zone
- **Documentation**: docs@disease.zone

---

**Document Version**: 1.0.0  
**Last Updated**: September 19, 2025  
**API Version**: 2.0.0