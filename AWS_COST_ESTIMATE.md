# AWS Monthly Cost Estimate for diseaseZone

## Infrastructure Overview
- **Environment**: Production
- **Region**: us-east-1
- **Architecture**: Highly available, auto-scaling ECS Fargate deployment
- **Traffic Assumption**: 10,000 requests/month, ~333 requests/day

## Detailed Cost Breakdown

### 1. ECS Fargate
**Configuration**:
- CPU: 0.25 vCPU per task
- Memory: 0.5 GB per task
- Tasks: 2 (minimum) with auto-scaling up to 10
- Uptime: 100% (24/7)

**Cost Calculation**:
- vCPU: 0.25 × 2 tasks × 730 hours × $0.04048/vCPU-hour = **$14.78**
- Memory: 0.5 GB × 2 tasks × 730 hours × $0.004445/GB-hour = **$3.24**
- **Subtotal**: $18.02/month

### 2. Application Load Balancer (ALB)
**Configuration**:
- 1 ALB running 24/7
- Processing ~10,000 requests/month
- 2 Load Balancer Capacity Units (LCUs) average

**Cost Calculation**:
- ALB hours: 730 hours × $0.0225/hour = **$16.43**
- LCU usage: 730 hours × 2 LCUs × $0.008/LCU-hour = **$11.68**
- **Subtotal**: $28.11/month

### 3. Route53
**Configuration**:
- 1 hosted zone for disease.zone
- ~10,000 DNS queries/month
- 1 health check

**Cost Calculation**:
- Hosted zone: $0.50/month
- DNS queries: 10,000 queries × $0.40/million = **$0.004**
- Health check: $0.50/month
- **Subtotal**: $1.00/month

### 4. Certificate Manager (ACM)
**Configuration**:
- SSL/TLS certificate for disease.zone and *.disease.zone

**Cost**: **$0.00** (Free for certificates used with AWS services)

### 5. VPC & Networking
**Configuration**:
- 2 NAT Gateways (one per AZ)
- Internet Gateway (free)
- VPC, subnets, route tables (free)

**Cost Calculation**:
- NAT Gateway hours: 2 × 730 hours × $0.045/hour = **$65.70**
- Data processing: Minimal traffic, ~1GB × $0.045/GB = **$0.045**
- **Subtotal**: $65.75/month

### 6. CloudWatch
**Configuration**:
- Log groups with 7-day retention
- Custom metrics and alarms
- Dashboard

**Cost Calculation**:
- Logs ingestion: ~100MB/month × $0.50/GB = **$0.05**
- Logs storage: ~100MB × $0.03/GB = **$0.003**
- Custom metrics: 10 metrics × $0.30/metric = **$3.00**
- Alarms: 5 alarms × $0.10/alarm = **$0.50**
- Dashboard: 1 dashboard × $3.00/dashboard = **$3.00**
- **Subtotal**: $6.55/month

### 7. S3 (ALB Access Logs)
**Configuration**:
- Access logs storage with 30-day retention
- Minimal data volume

**Cost Calculation**:
- Storage: ~1GB × $0.023/GB = **$0.023**
- Lifecycle transitions: Minimal
- **Subtotal**: $0.02/month

### 8. ECR (Container Registry)
**Configuration**:
- Store Docker images
- Keep last 30 versions

**Cost Calculation**:
- Storage: ~2GB × $0.10/GB = **$0.20**
- **Subtotal**: $0.20/month

### 9. SNS (Alerts)
**Configuration**:
- Email notifications for alerts
- Minimal usage

**Cost Calculation**:
- Email notifications: ~10/month × $0.000002 = **$0.00002**
- **Subtotal**: $0.00/month

### 10. Systems Manager Parameter Store
**Configuration**:
- Store API keys and secrets
- Standard parameters

**Cost**: **$0.00** (Free tier covers standard parameters)

## Monthly Cost Summary

| Service | Monthly Cost |
|---------|-------------|
| ECS Fargate | $18.02 |
| Application Load Balancer | $28.11 |
| Route53 | $1.00 |
| ACM Certificate | $0.00 |
| VPC & NAT Gateways | $65.75 |
| CloudWatch | $6.55 |
| S3 (Logs) | $0.02 |
| ECR | $0.20 |
| SNS | $0.00 |
| Parameter Store | $0.00 |
| **TOTAL** | **$119.65** |

## Cost Optimization Recommendations

### Immediate Savings (Reduce to ~$54/month):
1. **Single AZ deployment**: Remove second NAT Gateway (-$33/month)
2. **Spot instances**: Use FARGATE_SPOT for 70% of capacity (-$5-7/month)
3. **Scheduled scaling**: Scale down to 1 task during off-hours (-$9/month)

### Development Environment (Reduce to ~$25/month):
1. **Development-specific settings**:
   - Remove health checks (-$0.50/month)
   - Use single AZ (-$33/month)
   - Reduce log retention to 1 day (-$2/month)
   - Remove dashboard (-$3/month)
   - Use smaller instance sizes

## Traffic Scaling Impact

| Monthly Requests | ALB LCUs | Additional Cost |
|-----------------|----------|-----------------|
| 10,000 (current) | 2 | $0 |
| 100,000 | 3-4 | +$6-12/month |
| 1,000,000 | 10-15 | +$40-65/month |
| 10,000,000 | 50+ | +$200+/month |

## Free Tier Benefits (First 12 months)
- ALB: 750 hours free
- ECS: No free tier for Fargate
- CloudWatch: 5GB logs, 10 custom metrics free
- Route53: First hosted zone free

**Estimated first-year savings**: ~$20-25/month for first 12 months

## Annual Cost Projection
- **Monthly**: $119.65
- **Annual**: $1,435.80
- **With optimizations**: $648/year (single AZ, spot instances)
- **Development environment**: $300/year