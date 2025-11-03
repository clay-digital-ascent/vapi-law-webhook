import { VertexAI } from '@google-cloud/vertexai';

// Pre-initialize Vertex AI client at module load time (not on first request)
// This happens when the container starts, not when the first request arrives
console.log('⚡ Initializing Vertex AI client...');
const vertexAI = new VertexAI({
  project: process.env.GCP_PROJECT_ID,
  location: process.env.GCP_LOCATION,
});

const model = vertexAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-001',
});
console.log(`✅ Vertex AI client ready (model: ${process.env.GEMINI_MODEL || 'gemini-2.0-flash-001'})`);

function getGemini() {
  return model;
}

export async function summarizeCall(payload) {
  const transcript = extractTranscript(payload);
  
  // Log transcript info for debugging
  const transcriptLength = transcript.length;
  const estimatedTokens = Math.ceil(transcriptLength / 4); // Rough estimate: 1 token ≈ 4 chars
  console.log(`📝 Transcript length: ${transcriptLength} characters (~${estimatedTokens} tokens)`);
  
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
  const startTime = Date.now();
  const response = await gemini.generateContent(request);
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  // Log token usage
  const usage = response.response.usageMetadata;
  console.log(`⚡ Gemini response time: ${duration}s`);
  if (usage) {
    console.log(`📊 Token usage: ${usage.promptTokenCount} input + ${usage.candidatesTokenCount} output = ${usage.totalTokenCount} total`);
  }
  
  // Extract the text response
  const responseText = response.response.candidates[0].content.parts[0].text;
  
  // Parse JSON response
  const result = JSON.parse(responseText);
  
  // Extract date and time from VAPI payload metadata
  let callDate = result.dateOfCall;
  let callTime = result.timeOfCall;
  
  // Try different possible locations for the timestamp
  const timestamp = payload.message?.call?.startedAt || 
                   payload.call?.startedAt || 
                   payload.message?.startedAt ||
                   payload.startedAt ||
                   payload.timestamp;
  
  if (timestamp) {
    const date = new Date(timestamp);
    
    // Format date as YYYY-MM-DD
    callDate = date.toLocaleDateString('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).split('/').reverse().join('-').replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1-$3-$2');
    
    // Format time as HH:MM AM/PM Pacific
    callTime = date.toLocaleString('en-US', { 
      timeZone: 'America/Los_Angeles',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).replace(/^.*?, /, ''); // Remove date part, keep only time
    
    console.log(`📅 Extracted timestamp: ${timestamp} -> ${callDate} ${callTime} PT`);
  } else {
    console.warn('⚠️  No timestamp found in payload, using Gemini extraction');
  }
  
  // Try to extract phone number from VAPI payload if not in transcript
  let phoneNumber = result.callerPhone;
  if (!phoneNumber || phoneNumber === 'Not provided') {
    // Check various possible locations in VAPI payload
    phoneNumber = payload.message?.call?.customer?.number ||
                  payload.message?.customer?.number ||
                  payload.call?.customer?.number || 
                  payload.call?.phoneNumber || 
                  payload.customer?.number ||
                  payload.phoneNumber ||
                  payload.call?.from ||
                  payload.message?.phoneNumber ||
                  payload.message?.call?.phoneNumber ||
                  'Not provided';
    
    console.log('📞 Phone extraction attempt:');
    console.log('  payload.message?.call?.customer?.number:', payload.message?.call?.customer?.number);
    console.log('  payload.call?.customer?.number:', payload.call?.customer?.number);
    console.log('  Final phone:', phoneNumber);
  }
  
  const finalResult = {
    ...result,
    callerPhone: phoneNumber,
    dateOfCall: callDate,
    timeOfCall: callTime,
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
  // VAPI end-of-call-report structure
  // Try different possible locations for the transcript
  
  // Most common: payload.message.transcript
  if (payload.message?.transcript) {
    console.log('✅ Found transcript in payload.message.transcript');
    return payload.message.transcript;
  }
  
  // Alternative: payload.transcript
  if (payload.transcript) {
    console.log('✅ Found transcript in payload.transcript');
    return payload.transcript;
  }
  
  // Alternative: payload.call.transcript
  if (payload.call?.transcript) {
    console.log('✅ Found transcript in payload.call.transcript');
    return payload.call.transcript;
  }
  
  // Alternative: payload.messages (array format)
  if (payload.messages && Array.isArray(payload.messages)) {
    console.log('✅ Found transcript in payload.messages (array)');
    return payload.messages.map(m => `${m.role}: ${m.content}`).join('\n');
  }
  
  // Alternative: payload.message.call.transcript
  if (payload.message?.call?.transcript) {
    console.log('✅ Found transcript in payload.message.call.transcript');
    return payload.message.call.transcript;
  }
  
  // Fallback: dump entire payload for debugging
  console.warn('⚠️  Could not find transcript in expected locations, using full payload');
  console.warn('Payload keys:', Object.keys(payload));
  if (payload.message) console.warn('Message keys:', Object.keys(payload.message));
  return JSON.stringify(payload, null, 2);
}
