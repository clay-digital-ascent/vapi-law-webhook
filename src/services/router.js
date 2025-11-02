import { VertexAI } from '@google-cloud/vertexai';

let vertexAI;
let model;

function getGemini() {
  if (!vertexAI) {
    vertexAI = new VertexAI({
      project: process.env.GCP_PROJECT_ID,
      location: process.env.GCP_LOCATION,
    });
    
    model = vertexAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
    });
  }
  return model;
}

// Define your team members and their specialties
const TEAM_MEMBERS = [
  {
    name: 'Victoria Quezada',
    email: 'victoria@reardoninjurylaw.com',
  },
  {
    name: 'Mike',
    email: 'mike@reardoninjurylaw.com',
  },
  {
    name: 'John Reardon',
    email: 'john@reardoninjurylaw.com',
  },
  {
    name: 'Clay Reardon',
    email: 'clay@reardoninjurylaw.com',
  },
  {
    name: 'Kennedy Cervantes',
    email: 'admin@reardoninjurylaw.com',
  },
];

export async function routeToRecipient(summary, payload) {
  console.log('🤖 Using AI-based routing...');
  return await aiBasedRouting(summary);
}

async function aiBasedRouting(summary) {
  // Extract only relevant fields for routing (exclude rawPayload and processedAt to save tokens)
  const routingData = {
    callerName: summary.callerName,
    callerType: summary.callerType,
    summary: summary.summary,
    actionItems: summary.actionItems
  };
  
  const prompt = `You are a law firm routing assistant. Based on the call summary below, select the appropriate team member.

Team Members:
${JSON.stringify(TEAM_MEMBERS, null, 2)}

Routing Rules (in priority order - check top rules first):
1. ABSOLUTE HIGHEST PRIORITY: If the caller is a potential new client, send to ALL USERS (all 5 email addresses). This rule ALWAYS takes precedence over everything else, including name mentions. Return: victoria@reardoninjurylaw.com,mike@reardoninjurylaw.com,john@reardoninjurylaw.com,clay@reardoninjurylaw.com,admin@reardoninjurylaw.com

2. If the caller specifically REQUESTS to speak with a team member by name or wants to leave a message with that team member, send to that person who was specified AND Victoria Quezada. Return both email addresses separated by comma.

3. If the caller is a current client, send to Victoria Quezada
4. If the caller is a provider, send to Victoria Quezada
5. If the caller is an insurance adjuster, send to Victoria Quezada
6. If unsure, default to Victoria Quezada

Call Summary:
Caller: ${routingData.callerName}
Type: ${routingData.callerType}
Summary: ${routingData.summary}

CRITICAL DISTINCTION:
- "My name is Clay" = caller introducing themselves → NOT a personal request, apply other rules
- "I need to speak with Clay" = caller requesting a team member → IS a personal request, apply Rule #2
- If someone is a potential new client AND mentions a name, Rule #1 takes priority → send to ALL 5 people

Return ONLY the email address(es). For multiple recipients, separate with commas (no spaces).`;

  const gemini = getGemini();
  
  const request = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 256,
    },
  };

  const response = await gemini.generateContent(request);
  const selectedEmails = response.response.candidates[0].content.parts[0].text.trim();
  
  console.log('🤖 AI selected:', selectedEmails);
  
  // Handle multiple emails separated by commas
  if (selectedEmails.includes(',')) {
    const emails = selectedEmails.split(',').map(e => e.trim());
    // Return first valid email as primary recipient, store others for CC
    const primaryEmail = emails[0];
    const recipient = TEAM_MEMBERS.find(m => m.email === primaryEmail) || TEAM_MEMBERS[0];
    recipient.ccEmails = emails.slice(1); // Store additional emails for CC
    console.log(`✉️  Primary: ${recipient.name} (${recipient.email})`);
    console.log(`📧 CC: ${recipient.ccEmails.join(', ')}`);
    return recipient;
  }
  
  const recipient = TEAM_MEMBERS.find(m => m.email === selectedEmails) || TEAM_MEMBERS[0];
  console.log(`✉️  Recipient: ${recipient.name} (${recipient.email})`);
  return recipient;
}
