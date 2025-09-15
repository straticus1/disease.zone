# AWS Route53 Setup for disease.zone

## Overview

This guide will help you set up AWS Route53 DNS hosting for the disease.zone domain. Route53 will provide scalable, reliable DNS services for your Global Health Intelligence Platform.

## Prerequisites

- AWS Account with appropriate permissions
- Domain registrar access for disease.zone
- AWS CLI configured (optional but recommended)

## Step 1: Create Hosted Zone

### Via AWS Console

1. **Navigate to Route53**:
   - Go to AWS Console → Route53 → Hosted zones
   - Click "Create hosted zone"

2. **Configure Hosted Zone**:
   ```
   Domain name: disease.zone
   Type: Public hosted zone
   Comment: Global Health Intelligence Platform DNS
   Tags:
     - Environment: production
     - Project: diseaseZone
     - Purpose: health-surveillance
   ```

3. **Create the hosted zone**

### Via AWS CLI

```bash
aws route53 create-hosted-zone \
  --name disease.zone \
  --caller-reference "diseaseZone-$(date +%s)" \
  --hosted-zone-config Comment="Global Health Intelligence Platform DNS"
```

## Step 2: Get Your DNS Name Servers

After creating the hosted zone, AWS will assign 4 name servers. They will look like:

```
ns-1234.awsdns-12.com
ns-5678.awsdns-34.net
ns-9012.awsdns-56.org
ns-3456.awsdns-78.co.uk
```

### To Find Your Specific Name Servers:

#### Via AWS Console:
1. Go to Route53 → Hosted zones
2. Click on disease.zone
3. Note the 4 NS records in the record list

#### Via AWS CLI:
```bash
aws route53 get-hosted-zone --id YOUR_HOSTED_ZONE_ID
```

Or to get just the name servers:
```bash
aws route53 list-resource-record-sets --hosted-zone-id YOUR_HOSTED_ZONE_ID \
  --query "ResourceRecordSets[?Type=='NS'].ResourceRecords[].Value" \
  --output table
```

## Step 3: Update Domain Registrar

Update your domain registrar (where you bought disease.zone) with the AWS name servers:

1. **Log into your domain registrar**
2. **Find DNS/Nameserver settings**
3. **Replace existing nameservers** with the 4 AWS nameservers
4. **Save changes**

**Note**: DNS propagation can take 24-48 hours to complete worldwide.

## Step 4: Create DNS Records

### Production Environment

```bash
# A Record for main domain
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "disease.zone",
        "Type": "A",
        "TTL": 300,
        "ResourceRecords": [{"Value": "YOUR_SERVER_IP"}]
      }
    }]
  }'

# CNAME for www
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "www.disease.zone",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "disease.zone"}]
      }
    }]
  }'

# API subdomain
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.disease.zone",
        "Type": "A",
        "TTL": 300,
        "ResourceRecords": [{"Value": "YOUR_SERVER_IP"}]
      }
    }]
  }'
```

### Recommended DNS Records Structure

| Record Type | Name | Value | TTL | Purpose |
|-------------|------|-------|-----|---------|
| A | disease.zone | YOUR_SERVER_IP | 300 | Main domain |
| CNAME | www.disease.zone | disease.zone | 300 | WWW redirect |
| A | api.disease.zone | YOUR_SERVER_IP | 300 | API endpoint |
| A | admin.disease.zone | YOUR_SERVER_IP | 300 | Admin interface |
| CNAME | docs.disease.zone | disease.zone | 300 | Documentation |
| A | monitor.disease.zone | YOUR_SERVER_IP | 300 | Monitoring dashboard |
| TXT | disease.zone | "v=spf1 -all" | 300 | Email security |
| MX | disease.zone | 10 mail.disease.zone | 300 | Email routing |

## Step 5: SSL Certificate (AWS Certificate Manager)

### Request SSL Certificate

```bash
aws acm request-certificate \
  --domain-name disease.zone \
  --subject-alternative-names "*.disease.zone" \
  --validation-method DNS \
  --region us-east-1
```

### Validate Certificate via DNS

1. **Get validation records**:
```bash
aws acm describe-certificate --certificate-arn YOUR_CERT_ARN
```

2. **Add CNAME validation records** to Route53 (AWS Console will auto-create these)

## Step 6: Health Checks and Monitoring

### Create Health Check

```bash
aws route53 create-health-check \
  --caller-reference "diseaseZone-health-$(date +%s)" \
  --health-check-config '{
    "Type": "HTTPS",
    "ResourcePath": "/api/health",
    "FullyQualifiedDomainName": "disease.zone",
    "Port": 443,
    "RequestInterval": 30,
    "FailureThreshold": 3
  }'
```

## Step 7: Advanced Configuration

### Failover Configuration

```json
{
  "Changes": [{
    "Action": "CREATE",
    "ResourceRecordSet": {
      "Name": "disease.zone",
      "Type": "A",
      "SetIdentifier": "Primary",
      "Failover": "PRIMARY",
      "TTL": 60,
      "ResourceRecords": [{"Value": "PRIMARY_SERVER_IP"}],
      "HealthCheckId": "YOUR_HEALTH_CHECK_ID"
    }
  }, {
    "Action": "CREATE",
    "ResourceRecordSet": {
      "Name": "disease.zone",
      "Type": "A",
      "SetIdentifier": "Secondary",
      "Failover": "SECONDARY",
      "TTL": 60,
      "ResourceRecords": [{"Value": "BACKUP_SERVER_IP"}]
    }
  }]
}
```

### Geolocation Routing

```json
{
  "Changes": [{
    "Action": "CREATE",
    "ResourceRecordSet": {
      "Name": "api.disease.zone",
      "Type": "A",
      "SetIdentifier": "US-East",
      "GeoLocation": {"CountryCode": "US"},
      "TTL": 300,
      "ResourceRecords": [{"Value": "US_EAST_SERVER_IP"}]
    }
  }, {
    "Action": "CREATE",
    "ResourceRecordSet": {
      "Name": "api.disease.zone",
      "Type": "A",
      "SetIdentifier": "EU-West",
      "GeoLocation": {"CountryCode": "DE"},
      "TTL": 300,
      "ResourceRecords": [{"Value": "EU_WEST_SERVER_IP"}]
    }
  }]
}
```

## Expected DNS Name Servers Format

Your AWS Route53 name servers will follow this pattern:

```
ns-XXXX.awsdns-XX.com
ns-XXXX.awsdns-XX.net
ns-XXXX.awsdns-XX.org
ns-XXXX.awsdns-XX.co.uk
```

**Example** (your actual servers will be different):
```
ns-1234.awsdns-12.com
ns-5678.awsdns-34.net
ns-9012.awsdns-56.org
ns-3456.awsdns-78.co.uk
```

## Verification Commands

### Check DNS Propagation

```bash
# Check name servers
dig NS disease.zone

# Check A record
dig A disease.zone

# Check from specific DNS server
dig @8.8.8.8 disease.zone

# Check SSL certificate
openssl s_client -connect disease.zone:443 -servername disease.zone
```

### Global DNS Propagation Check

```bash
# Check from multiple global locations
for server in 8.8.8.8 1.1.1.1 208.67.222.222; do
  echo "Checking from $server:"
  dig @$server disease.zone
done
```

## Cost Estimation

### Route53 Pricing (us-east-1)

| Service | Cost | Description |
|---------|------|-------------|
| Hosted Zone | $0.50/month | Per hosted zone |
| DNS Queries | $0.40/million | First 1 billion queries |
| Health Checks | $0.50/month | Per health check |
| Domain Registration | ~$12/year | If registering through AWS |

**Estimated Monthly Cost**: $1-3 for basic setup

## Security Considerations

### DNSSEC (Optional)

```bash
# Enable DNSSEC for hosted zone
aws route53 enable-hosted-zone-dnssec \
  --hosted-zone-id YOUR_HOSTED_ZONE_ID
```

### DNS Firewall Rules

Consider implementing AWS Route53 Resolver DNS Firewall for additional security.

## Terraform Configuration (Optional)

```hcl
resource "aws_route53_zone" "disease_zone" {
  name = "disease.zone"

  tags = {
    Environment = "production"
    Project     = "diseaseZone"
    Purpose     = "health-surveillance"
  }
}

resource "aws_route53_record" "disease_zone_a" {
  zone_id = aws_route53_zone.disease_zone.zone_id
  name    = "disease.zone"
  type    = "A"
  ttl     = 300
  records = [var.server_ip]
}

resource "aws_route53_record" "www_disease_zone" {
  zone_id = aws_route53_zone.disease_zone.zone_id
  name    = "www.disease.zone"
  type    = "CNAME"
  ttl     = 300
  records = ["disease.zone"]
}

output "name_servers" {
  value = aws_route53_zone.disease_zone.name_servers
}
```

## Next Steps After Setup

1. **Update your server's nginx/apache** configuration for the new domain
2. **Configure SSL certificates** using AWS Certificate Manager
3. **Set up monitoring** for DNS health checks
4. **Test all subdomains** and routing
5. **Update application configuration** to use new domain

## Support and Troubleshooting

### Common Issues

1. **DNS not propagating**: Wait 24-48 hours for full global propagation
2. **SSL certificate issues**: Ensure DNS validation records are correct
3. **Health check failures**: Verify server is responding on specified path

### Helpful Commands

```bash
# Check current DNS settings
nslookup disease.zone

# Test specific record types
dig MX disease.zone
dig TXT disease.zone

# Check from authoritative servers
dig @ns-XXXX.awsdns-XX.com disease.zone
```

---

**Remember**: I cannot create the actual AWS resources for you. You'll need to execute these commands in your AWS account with appropriate permissions.