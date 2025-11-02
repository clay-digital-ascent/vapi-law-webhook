# CI/CD Setup Instructions

## 📋 Overview
This project uses GitHub Actions to automatically deploy to Google Cloud Run on every push to the `main` branch.

## 🔧 Setup Steps

### 1. Create GitHub Repository
```bash
# On GitHub.com, create a new repository named "vapi-law-webhook"
# Then push your local code:
git remote add origin https://github.com/YOUR_USERNAME/vapi-law-webhook.git
git branch -M main
git push -u origin main
```

### 2. Set Up Workload Identity Federation

Run these commands to create WIF:

```bash
# Enable IAM Service Account Credentials API
gcloud services enable iamcredentials.googleapis.com

# Create Workload Identity Pool
gcloud iam workload-identity-pools create "github-pool" \
  --project="reardon-injury-law" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Get the Workload Identity Pool ID
gcloud iam workload-identity-pools describe "github-pool" \
  --project="reardon-injury-law" \
  --location="global" \
  --format="value(name)"

# Create Workload Identity Provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project="reardon-injury-law" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Allow GitHub Actions to impersonate the service account
# Replace YOUR_GITHUB_USERNAME with your actual GitHub username
gcloud iam service-accounts add-iam-policy-binding "github-actions@reardon-injury-law.iam.gserviceaccount.com" \
  --project="reardon-injury-law" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/194632778145/locations/global/workloadIdentityPools/github-pool/attribute.repository/YOUR_GITHUB_USERNAME/vapi-law-webhook"

# Get the full Workload Identity Provider resource name
gcloud iam workload-identity-pools providers describe "github-provider" \
  --project="reardon-injury-law" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format="value(name)"
```

### 3. Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:

**WIF_PROVIDER**: (from the last command above, should look like):
```
projects/194632778145/locations/global/workloadIdentityPools/github-pool/providers/github-provider
```

**Environment Variables** (from your .env file):
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_DEPLOYMENT`
- `AZURE_OPENAI_API_VERSION`
- `OPENAI_API_VERSION`
- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_SECURE`
- `EMAIL_USER`
- `EMAIL_PASSWORD`
- `EMAIL_FROM`
- `VAPI_WEBHOOK_SECRET`

### 4. Test the CI/CD Pipeline

```bash
# Make a small change and push
echo "# Test" >> README.md
git add README.md
git commit -m "Test CI/CD pipeline"
git push
```

Watch the deployment at: https://github.com/YOUR_USERNAME/vapi-law-webhook/actions

## 🔄 Making Changes

1. Edit code locally
2. Test with: `npm run dev`
3. Commit and push to `main` branch
4. GitHub Actions automatically builds and deploys
5. Check Cloud Run logs for any issues

## 📊 Monitor Deployments

- **GitHub Actions**: https://github.com/YOUR_USERNAME/vapi-law-webhook/actions
- **Cloud Run Console**: https://console.cloud.google.com/run?project=reardon-injury-law
- **View Logs**: 
  ```bash
  gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=vapi-webhook-service" --project=reardon-injury-law
  ```

## 🛠️ Local Development

1. Create `.env` file with your credentials
2. Run locally: `npm run dev`
3. Test with ngrok (optional): `ngrok http 3020`
4. Make changes and test
5. Push to GitHub when ready

## 🚨 Troubleshooting

**Build fails with "permission denied"**:
- Check that the service account has all required roles
- Verify WIF Provider is correctly configured

**Deployment succeeds but service doesn't work**:
- Check that all GitHub secrets are set correctly
- View Cloud Run logs for errors
- Verify environment variables are being set

**Can't push to Artifact Registry**:
- Ensure `storage.admin` role is granted to service account
