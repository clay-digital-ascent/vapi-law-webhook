import express from 'express';
import { processVapiCall } from '../services/callProcessor.js';

export const webhookRouter = express.Router();

webhookRouter.post('/vapi', async (req, res) => {
  try {
    const payload = req.body;
    const eventType = payload.message?.type;
    
    // Log ALL incoming webhooks for debugging (including non-end-of-call)
    console.log(`[${new Date().toISOString()}] Webhook received: ${eventType || 'unknown'}`);
    
    // Only log minimal info for non-end-of-call events
    if (eventType !== 'end-of-call-report') {
      // Silent skip for most events to reduce noise
      return res.status(200).json({ received: true });
    }
    
    // Log only for end-of-call-report
    console.log('\n📞 End-of-call report received');
    
    // Verify webhook secret if configured
    // TEMPORARILY DISABLED - uncomment to re-enable
    /*
    const expectedSecret = process.env.VAPI_WEBHOOK_SECRET;
    if (expectedSecret) {
      const receivedSecret = req.headers['x-vapi-secret'] || req.headers['authorization']?.replace('Bearer ', '');
      
      if (!receivedSecret || receivedSecret !== expectedSecret) {
        console.error('❌ Webhook verification failed: Invalid or missing secret');
        return res.status(401).json({ error: 'Unauthorized' });
      }
      console.log('✅ Webhook secret verified');
    }
    */
    console.log('⚠️  Webhook secret verification disabled');
    
    
    // Process the call asynchronously
    console.log('🎯 Processing call...');
    processVapiCall(payload)
      .then(() => console.log('✅ Call processed successfully\n'))
      .catch(err => console.error('❌ Error processing call:', err));
    
    // Respond immediately to VAPI
    res.status(200).json({ received: true });
    
  } catch (error) {
    console.error('Error in webhook handler:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
