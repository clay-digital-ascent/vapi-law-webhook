import { AzureOpenAI } from 'openai';

let openai;

function getOpenAI() {
  if (!openai) {
    openai = new AzureOpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION,
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    });
  }
  return openai;
}

export async function summarizeCall(payload) {
  const transcript = extractTranscript(payload);
  
  const prompt = `You are an assistant for a law firm. Analyze this phone call transcript and extract:

- Date and time of call (convert to Pacific Time if timestamp is provided in a different timezone)
- Caller's Name
- Caller's phone number
- Type of caller (current client, potential new client, provider, insurance adjuster)
- Brief summary of the call (2-3 sentences)
- Key action items or follow-up needed

Transcript:
${transcript}

Return your response in this JSON format:
{
  "dateOfCall": "YYYY-MM-DD",
  "timeOfCall": "HH:MM AM/PM",
  "callerName": "...",
  "callerPhone": "...",
  "callerType": "current client/potential new client/provider/insurance adjuster",
  "summary": "...",
  "actionItems": ["..."]
}`;

  const response = await getOpenAI().chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const result = JSON.parse(response.choices[0].message.content);
  
  // Convert to Pacific Time if we have a timestamp from VAPI
  let callTimePacific = result.timeOfCall;
  if (payload.call?.startedAt || payload.timestamp) {
    const timestamp = new Date(payload.call?.startedAt || payload.timestamp);
    callTimePacific = timestamp.toLocaleString('en-US', { 
      timeZone: 'America/Los_Angeles',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }
  
  // Try to extract phone number from VAPI payload if not in transcript
  let phoneNumber = result.callerPhone;
  if (!phoneNumber || phoneNumber === 'Not provided') {
    // Check various possible locations in VAPI payload
    phoneNumber = payload.call?.customer?.number || 
                  payload.call?.phoneNumber || 
                  payload.customer?.number ||
                  payload.phoneNumber ||
                  payload.call?.from ||
                  'Not provided';
  }
  
  const finalResult = {
    ...result,
    callerPhone: phoneNumber,
    timeOfCall: callTimePacific,
    processedAt: new Date().toISOString(),
  };
  
  console.log('📊 Summary Results:');
  console.log(`   Caller: ${finalResult.callerName} (${finalResult.callerPhone})`);
  console.log(`   Type: ${finalResult.callerType}`);
  console.log(`   Date/Time: ${finalResult.dateOfCall} ${finalResult.timeOfCall}`);
  
  return finalResult;
}

function extractTranscript(payload) {
  // VAPI sends different structures, adjust based on actual payload
  if (payload.transcript) return payload.transcript;
  if (payload.messages) return payload.messages.map(m => `${m.role}: ${m.content}`).join('\n');
  if (payload.call?.transcript) return payload.call.transcript;
  
  return JSON.stringify(payload, null, 2);
}
