import nodemailer from 'nodemailer';

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }
  return transporter;
}

// Format date to M/D format
function formatDate(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
  } catch (e) {
    return dateString;
  }
}

// Format time to H:MM AM/PM format
function formatTime(timeString) {
  if (!timeString) return '';
  try {
    // Extract time from string like "3:45 PM (Pacific Time)" or "15:45"
    const timeMatch = timeString.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!timeMatch) return timeString;
    
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2];
    const ampm = timeMatch[3];
    
    // If no AM/PM provided, assume 24-hour format
    if (!ampm) {
      const period = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${hours}:${minutes} ${period}`;
    }
    
    return `${hours}:${minutes} ${ampm.toUpperCase()}`;
  } catch (e) {
    return timeString;
  }
}

export async function sendEmail(recipient, summary, rawPayload) {
  // Determine header text based on caller type
  const isPotentialNewClient = summary.callerType && summary.callerType.toLowerCase().includes('potential new client');
  const headerText = isPotentialNewClient ? 'POTENTIAL NEW CLIENT' : 'New Call Received';
  
  // Conditional color scheme
  const headerGradient = isPotentialNewClient 
    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  const borderColor = isPotentialNewClient ? '#dc2626' : '#667eea';
  const badgeBackground = isPotentialNewClient ? '#fee2e2' : '#f0f3ff';
  const badgeTextColor = isPotentialNewClient ? '#dc2626' : '#667eea';
  
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="background: ${headerGradient}; padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">${headerText}</h1>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 30px;">
          <!-- Call Info Section -->
          <div style="margin-bottom: 30px;">
            <h2 style="color: #1a1a1a; font-size: 18px; font-weight: 600; margin: 0 0 15px 0; border-bottom: 2px solid ${borderColor}; padding-bottom: 8px;">Call Information</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; color: #666; font-size: 14px; width: 100px;"><strong>Date:</strong></td>
                <td style="padding: 10px 0; color: #1a1a1a; font-size: 14px;">${summary.dateOfCall || 'Not provided'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #666; font-size: 14px;"><strong>Time:</strong></td>
                <td style="padding: 10px 0; color: #1a1a1a; font-size: 14px;">${summary.timeOfCall || 'Not provided'} (Pacific Time)</td>
              </tr>
            </table>
          </div>
          
          <!-- Caller Info Section -->
          <div style="margin-bottom: 30px;">
            <h2 style="color: #1a1a1a; font-size: 18px; font-weight: 600; margin: 0 0 15px 0; border-bottom: 2px solid ${borderColor}; padding-bottom: 8px;">Caller Information</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; color: #666; font-size: 14px; width: 100px;"><strong>Name:</strong></td>
                <td style="padding: 10px 0; color: #1a1a1a; font-size: 14px;">${summary.callerName || 'Unknown'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #666; font-size: 14px;"><strong>Phone:</strong></td>
                <td style="padding: 10px 0; color: #1a1a1a; font-size: 14px;">${summary.callerPhone || 'Not provided'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #666; font-size: 14px;"><strong>Type:</strong></td>
                <td style="padding: 10px 0; color: #1a1a1a; font-size: 14px;">
                  <span style="display: inline-block; background-color: ${badgeBackground}; color: ${badgeTextColor}; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 500;">${summary.callerType || 'Unknown'}</span>
                </td>
              </tr>
            </table>
          </div>
          
          <!-- Summary Section -->
          <div style="margin-bottom: 30px;">
            <h2 style="color: #1a1a1a; font-size: 18px; font-weight: 600; margin: 0 0 15px 0; border-bottom: 2px solid ${borderColor}; padding-bottom: 8px;">Call Summary</h2>
            <p style="color: #1a1a1a; font-size: 14px; line-height: 1.6; margin: 0; background-color: #f8f9fa; padding: 15px; border-radius: 8px;">${summary.summary || 'No summary available'}</p>
          </div>
          
          ${summary.actionItems && summary.actionItems.length > 0 ? `
          <!-- Action Items Section -->
          <div style="margin-bottom: 30px;">
            <h2 style="color: #1a1a1a; font-size: 18px; font-weight: 600; margin: 0 0 15px 0; border-bottom: 2px solid ${borderColor}; padding-bottom: 8px;">Action Items</h2>
            <div style="background-color: #fff8e6; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px;">
              ${summary.actionItems.map(item => `
                <div style="color: #1a1a1a; font-size: 14px; line-height: 1.6; margin-bottom: 8px; padding-left: 20px; position: relative;">
                  <span style="position: absolute; left: 0; color: #ffc107;">•</span>
                  ${item}
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px 30px; border-top: 1px solid #e0e0e0;">
          <p style="color: #999; font-size: 12px; margin: 0; line-height: 1.5;">
            Processed: ${new Date(summary.processedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}<br>
            Routed to: ${recipient.name} (${recipient.email})
            ${recipient.ccEmails ? `<br>CC: ${recipient.ccEmails.join(', ')}` : ''}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  
  // Format date and time for subject line
  const formattedDate = formatDate(summary.dateOfCall);
  const formattedTime = formatTime(summary.timeOfCall);
  const dateTimeString = formattedDate && formattedTime ? ` - ${formattedDate} ${formattedTime}` : '';
  
  // Special subject line for potential new clients
  let subject;
  if (summary.callerType && summary.callerType.toLowerCase().includes('potential new client')) {
    subject = `POTENTIAL NEW CLIENT - ${summary.callerName || 'Unknown Caller'}${dateTimeString}`;
  } else {
    subject = `New Call: ${summary.callerName || 'Unknown Caller'} - ${summary.callerType || 'General Inquiry'}${dateTimeString}`;
  }
  
  const mailOptions = {
    from: fromAddress,
    to: recipient.email,
    cc: recipient.ccEmails || [],
    subject: subject,
    html: emailHtml,
  };
  
  console.log('📧 Email Details:');
  console.log(`   From: ${fromAddress}`);
  console.log(`   To: ${recipient.email} (${recipient.name})`);
  if (recipient.ccEmails && recipient.ccEmails.length > 0) {
    console.log(`   CC: ${recipient.ccEmails.join(', ')}`);
  }
  console.log(`   Subject: ${mailOptions.subject}`);
  
  const info = await getTransporter().sendMail(mailOptions);
  console.log('✅ Email sent successfully! Message ID:', info.messageId);
  
  return info;
}
