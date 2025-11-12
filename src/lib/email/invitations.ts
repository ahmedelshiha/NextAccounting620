import { sendEmail } from '@/lib/email';
import { logger } from '@/lib/logger';

export interface SendInvitationEmailParams {
  email: string;
  role: string;
  invitationToken: string;
  tenantId: string;
  invitedBy: string;
}

const roleLabels: Record<string, string> = {
  CLIENT_OWNER: 'Account Owner',
  FINANCE_MANAGER: 'Finance Manager',
  ACCOUNTANT: 'Accountant',
  VIEWER: 'Viewer',
  AUDITOR: 'Auditor',
  ADVISOR: 'Advisor',
};

const roleDescriptions: Record<string, string> = {
  CLIENT_OWNER: 'Full control over all entities and settings',
  FINANCE_MANAGER: 'Manage invoices, payments, and financial operations',
  ACCOUNTANT: 'Prepare and submit tax filings and documentation',
  VIEWER: 'Read-only access to all documents and reports',
  AUDITOR: 'Audit oversight with read-only access to audit logs',
  ADVISOR: 'Limited access to documents and messaging',
};

export async function sendInvitationEmail({
  email,
  role,
  invitationToken,
  tenantId,
  invitedBy,
}: SendInvitationEmailParams): Promise<void> {
  try {
    const acceptUrl = new URL('/auth/accept-invitation', process.env.NEXTAUTH_URL || 'https://app.example.com');
    acceptUrl.searchParams.set('token', invitationToken);
    acceptUrl.searchParams.set('tenantId', tenantId);

    const subject = `You're invited to join our accounting platform`;
    
    const htmlContent = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
      .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
      .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 20px 0; }
      .button:hover { background: #5568d3; }
      .role-box { background: white; padding: 15px; border-left: 4px solid #667eea; margin: 15px 0; }
      .role-title { font-weight: 600; color: #667eea; }
      .footer { color: #999; font-size: 12px; text-align: center; margin-top: 20px; }
      .divider { border-top: 1px solid #ddd; margin: 20px 0; }
      .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; border-radius: 4px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>You're Invited!</h1>
        <p>Join us to manage your tax compliance with ease</p>
      </div>
      
      <div class="content">
        <p>Hello,</p>
        
        <p>You've been invited to join our accounting platform as a <strong>${roleLabels[role] || role}</strong>.</p>
        
        <div class="role-box">
          <div class="role-title">${roleLabels[role] || role}</div>
          <p>${roleDescriptions[role] || 'Access to platform features based on your role'}</p>
        </div>

        <p>To accept this invitation and create your account, click the button below:</p>
        
        <center>
          <a href="${acceptUrl.toString()}" class="button">Accept Invitation</a>
        </center>

        <p>Or copy this link: <a href="${acceptUrl.toString()}">${acceptUrl.toString()}</a></p>

        <div class="divider"></div>

        <div class="warning">
          <strong>⏰ This invitation expires in 7 days</strong>
          <p>Please accept it soon to avoid having to request a new invitation.</p>
        </div>

        <div class="divider"></div>

        <p>If you have any questions or didn't expect this invitation, you can contact our support team.</p>

        <p>Best regards,<br><strong>The Accounting Platform Team</strong></p>

        <div class="footer">
          <p>© 2025 Accounting Platform. All rights reserved.</p>
          <p>You received this email because you were invited to join. If you believe this was sent in error, please ignore it.</p>
        </div>
      </div>
    </div>
  </body>
</html>
`;

    const plainTextContent = `
You've been invited to join the accounting platform as a ${roleLabels[role] || role}.

${roleDescriptions[role] || 'Access to platform features based on your role'}

To accept this invitation, visit:
${acceptUrl.toString()}

This invitation expires in 7 days.

If you have questions, contact our support team.

Best regards,
The Accounting Platform Team
`;

    await sendEmail({
      to: email,
      subject,
      htmlContent,
      plainTextContent,
    });

    logger.info('Invitation email sent', { email, role, tenantId });
  } catch (error) {
    logger.error('Failed to send invitation email', {
      email,
      role,
      tenantId,
      error,
    });
    throw error;
  }
}

export async function send2FASetupEmail({
  email,
  setupUrl,
}: {
  email: string;
  setupUrl: string;
}): Promise<void> {
  try {
    const subject = 'Set up Two-Factor Authentication';
    
    const htmlContent = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: #667eea; color: white; padding: 30px; border-radius: 8px 8px 0 0; }
      .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
      .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 20px 0; }
      .info-box { background: white; padding: 15px; border-left: 4px solid #667eea; margin: 15px 0; }
      .footer { color: #999; font-size: 12px; text-align: center; margin-top: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Secure Your Account</h1>
        <p>Two-Factor Authentication Setup</p>
      </div>
      
      <div class="content">
        <p>Hello,</p>
        
        <p>We're helping you secure your account with Two-Factor Authentication (2FA).</p>
        
        <div class="info-box">
          <strong>What is 2FA?</strong>
          <p>Two-Factor Authentication adds an extra layer of security by requiring a second verification method beyond your password. You can use:</p>
          <ul>
            <li>Authenticator app (Google Authenticator, Authy, Microsoft Authenticator)</li>
            <li>SMS text messages</li>
          </ul>
        </div>

        <p>To set up 2FA, click the button below:</p>
        
        <center>
          <a href="${setupUrl}" class="button">Set Up 2FA</a>
        </center>

        <p>Or copy this link: <a href="${setupUrl}">${setupUrl}</a></p>

        <div style="border-top: 1px solid #ddd; margin: 20px 0;"></div>

        <p>If you didn't request this, please secure your account by changing your password.</p>

        <p>Best regards,<br><strong>The Security Team</strong></p>

        <div class="footer">
          <p>© 2025 Accounting Platform. All rights reserved.</p>
        </div>
      </div>
    </div>
  </body>
</html>
`;

    const plainTextContent = `
Secure Your Account with Two-Factor Authentication

Two-Factor Authentication (2FA) adds an extra layer of security to your account.

To set up 2FA, visit:
${setupUrl}

You can use:
- Authenticator app (Google Authenticator, Authy, Microsoft Authenticator)
- SMS text messages

Best regards,
The Security Team
`;

    await sendEmail({
      to: email,
      subject,
      htmlContent,
      plainTextContent,
    });

    logger.info('2FA setup email sent', { email });
  } catch (error) {
    logger.error('Failed to send 2FA setup email', { email, error });
    throw error;
  }
}
