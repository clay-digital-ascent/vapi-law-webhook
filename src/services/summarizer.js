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

export async function summarizeCall(payload) {
  const transcript = extractTranscript(payload);
  
  const prompt = `You are an AI assistant for Reardon Injury Law. Analyze this phone call transcript and intelligently determine:

1. **Caller Name**: Extract from the conversation (or "Unknown" if not provided)
2. **Caller Phone**: Extract if mentioned (or "Not provided")
3. **Caller Type**: Intelligently infer from context:
   - "potential new client" = Someone inquiring about legal services for a NEW case/injury they haven't hired the firm for yet. Keywords: "I was injured", "I had an accident", "I need a lawyer", "looking for representation", "can you help me with my case"
   - "current client" = Someone with an EXISTING case already being handled by the firm. Keywords: "my case", "update on my claim", "spoke with Victoria before", "following up", mentions case number or existing representation
   - "provider" = Medical provider, doctor's office, hospital, physical therapist, chiropractor calling about records, bills, liens, or treatment. Keywords: "medical records", "treatment notes", "billing", "lien", "doctor's office", "hospital", "clinic"
   - "insurance adjuster" = Insurance company representative. Keywords: "insurance adjuster", "claims adjuster", "settlement offer", "insurance company", mentions specific insurance carrier names
   - "other" = Anyone else (solicitor, wrong number, general inquiry, spam, etc.)

4. **Summary**: Write a detailed 2-4 sentence summary capturing the key points and reason for the call
5. **Action Items**: List specific follow-up actions needed

IMPORTANT: The caller will NOT explicitly state their type. You must infer it from what they say about their situation.

Transcript:
${transcript}

Return your response in this JSON format (IMPORTANT: return ONLY valid JSON, no markdown or code blocks):
{
  "dateOfCall": "YYYY-MM-DD",
  "timeOfCall": "HH:MM AM/PM",
  "callerName": "Unknown",
  "callerPhone": "Not provided",
  "callerType": "potential new client",
  "summary": "Detailed summary here",
  "actionItems": ["Action 1", "Action 2"]
}`;

  const gemini = getGemini();
  
  const request = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json', // Force JSON response
    },
  };

  console.log('🤖 Calling Gemini...');
  const response = await gemini.generateContent(request);
  
  // Extract the text response
  const responseText = response.response.candidates[0].content.parts[0].text;
  
  // Parse JSON response
  const result = JSON.parse(responseText);
  
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
  console.log(`   Model: ${process.env.GEMINI_MODEL || 'gemini-1.5-pro'} ✨`);
  
  return finalResult;
}

function extractTranscript(payload) {
  // VAPI sends different structures, adjust based on actual payload
  if (payload.transcript) return payload.transcript;
  if (payload.messages) return payload.messages.map(m => `${m.role}: ${m.content}`).join('\n');
  if (payload.call?.transcript) return payload.call.transcript;
  
  return JSON.stringify(payload, null, 2);
}
