# VAPI Law Webhook

Automated webhook handler for law firm call processing via VAPI.

## Features

- 📞 Receives VAPI webhook calls
- 🤖 AI-powered call summarization using OpenAI
- 🎯 Intelligent routing to team members based on case type
- 📧 Automatic email notifications
- 🐳 Docker containerized for Mac Mini deployment

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
- `OPENAI_API_KEY`: Your OpenAI API key
- `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASSWORD`: SMTP email settings

### 3. Configure Team Members

Edit `src/services/router.js` to add your team members and their specialties.

### 4. Run Locally (Development)

```bash
npm run dev
```

### 5. Run with Docker

```bash
docker compose up -d
```

## VAPI Configuration

In your VAPI dashboard, set the webhook URL to:

```
http://your-mac-mini-ip:3000/webhook/vapi
```

For local testing with ngrok:

```bash
ngrok http 3000
```

Then use the ngrok URL in VAPI.

## Endpoints

- `GET /health` - Health check
- `POST /webhook/vapi` - VAPI webhook receiver

## Architecture

1. **Webhook Receiver** (`routes/webhook.js`) - Accepts VAPI payload
2. **Summarizer** (`services/summarizer.js`) - Extracts key info using OpenAI
3. **Router** (`services/router.js`) - Routes to appropriate team member
4. **Email Service** (`services/emailService.js`) - Sends formatted emails

## Customization

### Adding Team Members

Edit `TEAM_MEMBERS` array in `src/services/router.js`:

```javascript
{
  name: 'John Doe',
  email: 'john@lawfirm.com',
  specialty: ['real estate', 'contracts'],
  maxUrgency: 'high',
}
```

### Modifying Email Template

Edit the `emailHtml` template in `src/services/emailService.js`.

## Logs

Logs are stored in the `./logs` directory (mounted volume in Docker).

## Support

For issues or questions, check the console logs:

```bash
docker compose logs -f
```

## 🎉 CI/CD Status
✅ Automatic deployment configured and ready!

Push to `main` branch to trigger deployment.
