# Disease Zone Deployment Guide

This guide explains how to deploy the disease.zone application to AWS using the provided automation scripts.

## 🚀 Quick Start

### 1. Deploy the Application

```bash
./deploy.sh
```

This single command will:
- ✅ Build the Docker image
- ✅ Push it to ECR
- ✅ Deploy to ECS
- ✅ Check deployment health
- ✅ Display application URLs

### 2. Configure API Keys (Optional)

```bash
./set-api-keys.sh
```

This interactive script helps you configure:
- Mapbox Access Token
- Google Maps API Key

## 📋 Prerequisites

Before running the deployment script, ensure you have:

- ✅ **AWS Infrastructure**: Terraform applied (`terraform apply`)
- ✅ **AWS CLI**: Installed and configured with valid credentials
- ✅ **Docker**: Installed and running (Docker Desktop)
- ✅ **Ansible**: Installed (`pip install ansible`)

## 🛠️ Deployment Scripts

### Main Deployment Script (`deploy.sh`)

**Full Deployment (default):**
```bash
./deploy.sh
# or
./deploy.sh deploy
```

**Build Docker image only:**
```bash
./deploy.sh build-only
```

**Push existing image to ECR:**
```bash
./deploy.sh push-only
```

**Check deployment status:**
```bash
./deploy.sh status
```

**Show help:**
```bash
./deploy.sh help
```

### API Keys Configuration Script (`set-api-keys.sh`)

**Interactive mode (default):**
```bash
./set-api-keys.sh
```

**Set specific API key:**
```bash
./set-api-keys.sh mapbox          # Mapbox only
./set-api-keys.sh google-maps     # Google Maps only
./set-api-keys.sh both            # Both API keys
```

**Check current status:**
```bash
./set-api-keys.sh check
```

## 🌐 Application URLs

After deployment, your application will be available at:

- **Load Balancer**: `http://diseasezone-alb-prod-XXXXXXXXXX.us-east-1.elb.amazonaws.com`
- **Custom Domain**: `https://disease.zone` (after DNS propagation)
- **Health Check**: `http://load-balancer-url/api/health`

## 📊 Monitoring & Management

### AWS Console Links

- **CloudWatch Dashboard**: Monitor application metrics and logs
- **ECS Service**: View container status and logs
- **ECR Repository**: Manage Docker images

### Key AWS Resources

- **ECS Cluster**: `diseasezone-cluster-prod`
- **ECS Service**: `diseasezone-service-prod`
- **ECR Repository**: `515966511618.dkr.ecr.us-east-1.amazonaws.com/diseasezone-prod`

## 🔧 Configuration

### Environment Variables

The application uses these environment variables (configured automatically):

- `NODE_ENV`: Set to `prod`
- `PORT`: Set to `3000`
- `MAPBOX_ACCESS_TOKEN`: Retrieved from AWS Systems Manager
- `GOOGLE_MAPS_API_KEY`: Retrieved from AWS Systems Manager

### SSL/HTTPS

- ✅ **SSL Certificate**: Automatically provisioned via ACM
- ✅ **HTTPS Listener**: Port 443 with automatic HTTP → HTTPS redirect
- ✅ **Security**: Modern TLS policy (`ELBSecurityPolicy-TLS-1-2-2017-01`)

### Auto-scaling

The application automatically scales based on:

- **CPU Utilization**: Target 70% (scale out), cooldown 5 minutes
- **Memory Utilization**: Target 80% (scale out), cooldown 5 minutes
- **Capacity**: Min 1 task, Max 10 tasks

## 🔍 Troubleshooting

### Common Issues

**1. Docker not running:**
```
Error: Docker is not running. Please start Docker Desktop.
```
**Solution**: Start Docker Desktop application

**2. AWS credentials expired:**
```
Error: AWS credentials not configured or expired
```
**Solution**: Run `aws configure` or refresh your session

**3. Terraform state not found:**
```
Error: Terraform state not found. Please run terraform apply first.
```
**Solution**: Ensure infrastructure is deployed with `terraform apply`

**4. Deployment health check fails:**
- Check ECS service logs in CloudWatch
- Verify application starts correctly
- Check security group rules

### Useful Commands

**View ECS service logs:**
```bash
aws logs tail /ecs/diseasezone-prod --follow
```

**Check ECS service status:**
```bash
aws ecs describe-services \
  --cluster diseasezone-cluster-prod \
  --services diseasezone-service-prod
```

**Force new deployment:**
```bash
aws ecs update-service \
  --cluster diseasezone-cluster-prod \
  --service diseasezone-service-prod \
  --force-new-deployment
```

## 📱 API Keys Setup

### Mapbox API Token

1. Go to [Mapbox Account](https://account.mapbox.com/access-tokens/)
2. Create a new public access token
3. Copy the token and use `./set-api-keys.sh mapbox`

### Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Google Maps JavaScript API
3. Create an API key with appropriate restrictions
4. Copy the key and use `./set-api-keys.sh google-maps`

## 🔄 CI/CD Integration

These scripts can be easily integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Deploy to AWS
  run: |
    chmod +x ./deploy.sh
    ./deploy.sh
```

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review AWS CloudWatch logs
3. Verify all prerequisites are met
4. Check AWS service limits and quotas

---

**🎉 Your disease.zone application is now ready for production!**