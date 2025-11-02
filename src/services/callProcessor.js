import { summarizeCall } from './summarizer.js';
import { routeToRecipient } from './router.js';
import { sendEmail } from './emailService.js';

export async function processVapiCall(payload) {
  try {
    // Step 1: Summarize the call using AI
    console.log('📝 Summarizing call...');
    const summary = await summarizeCall(payload);
    
    // Step 2: Route to appropriate recipient
    console.log('🎯 Routing to recipient...');
    const recipient = await routeToRecipient(summary, payload);
    
    // Step 3: Send email
    console.log('📧 Sending email...');
    await sendEmail(recipient, summary, payload);
    
    console.log('✅ Call processing complete');
    
  } catch (error) {
    console.error('❌ Error processing call:', error);
    throw error;
  }
}
