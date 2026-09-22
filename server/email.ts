import nodemailer from 'nodemailer';
import { db, JellyfinConfig } from './db.js';

export const DEFAULT_VERIFICATION_SUBJECT = 'Verify Your Email Address - {app_name}';
export const DEFAULT_VERIFICATION_TEMPLATE = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0b0d17; color: #e2e8f0; padding: 30px; border-radius: 12px; border: 1px solid #1e293b;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="color: #f43f5e; font-size: 28px; margin: 0; font-weight: 800; letter-spacing: -1px;">{app_name}</h1>
    <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Unlimited Premium 4K Movies & TV Streaming</p>
  </div>
  <div style="background-color: #16192b; border: 1px solid #334155; padding: 25px; border-radius: 10px;">
    <h2 style="color: #ffffff; font-size: 20px; margin-top: 0;">Welcome, {username}! 👋</h2>
    <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">Thank you for registering. To complete your sign-up and activate your account, please verify your email address by clicking the button below:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{verification_link}" style="background: linear-gradient(135deg, #e11d48, #d97706); color: #ffffff; font-weight: bold; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(225,29,72,0.4);">Verify Email Address</a>
    </div>
    
    <p style="color: #94a3b8; font-size: 13px;">Or enter this verification code directly in the app:</p>
    <div style="background-color: #0f172a; border: 1px dashed #475569; padding: 12px; text-align: center; border-radius: 6px; font-size: 22px; font-weight: bold; letter-spacing: 6px; color: #f59e0b;">
      {verification_code}
    </div>

    <hr style="border: 0; border-top: 1px solid #334155; margin: 25px 0;">
    
    <p style="color: #94a3b8; font-size: 12px; margin-bottom: 5px;"><strong>Download Mobile Apps:</strong></p>
    <p style="color: #94a3b8; font-size: 12px; margin-top: 0;">
      📱 iOS App: <a href="{ios_app_link}" style="color: #f43f5e;">{ios_app_link}</a><br>
      🤖 Android App: <a href="{android_app_link}" style="color: #f59e0b;">{android_app_link}</a>
    </p>
  </div>
  <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 20px;">If you did not request this email, please ignore it.</p>
</div>`;

export const DEFAULT_WELCOME_SUBJECT = 'Welcome to {app_name} - Payment Verified!';
export const DEFAULT_WELCOME_TEMPLATE = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0b0d17; color: #e2e8f0; padding: 30px; border-radius: 12px; border: 1px solid #1e293b;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="color: #f43f5e; font-size: 28px; margin: 0; font-weight: 800; letter-spacing: -1px;">{app_name}</h1>
    <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Unlimited Premium 4K Movies & TV Streaming</p>
  </div>
  <div style="background-color: #16192b; border: 1px solid #334155; padding: 25px; border-radius: 10px;">
    <h2 style="color: #10b981; font-size: 20px; margin-top: 0;">🎉 Payment Approved, {username}!</h2>
    <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">Your subscription payment has been verified by the administrator. Your unlimited 4K streaming access is now active!</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{login_url}" style="background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; font-weight: bold; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; display: inline-block;">Start Watching Now</a>
    </div>

    <p style="color: #94a3b8; font-size: 13px;">Download our apps for seamless streaming on your phone or smart TV:</p>
    <p style="color: #94a3b8; font-size: 12px;">
      📱 iOS App: <a href="{ios_app_link}" style="color: #f43f5e;">Download for iPhone/iPad</a><br>
      🤖 Android App: <a href="{android_app_link}" style="color: #f59e0b;">Download for Android</a>
    </p>
  </div>
  <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 20px;">Thank you for choosing {app_name}. Happy Streaming!</p>
</div>`;

export const DEFAULT_NOTIFICATION_SUBJECT = 'Notification from {app_name}';
export const DEFAULT_NOTIFICATION_TEMPLATE = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0b0d17; color: #e2e8f0; padding: 30px; border-radius: 12px; border: 1px solid #1e293b;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="color: #f43f5e; font-size: 28px; margin: 0; font-weight: 800;">{app_name}</h1>
  </div>
  <div style="background-color: #16192b; border: 1px solid #334155; padding: 25px; border-radius: 10px;">
    <h2 style="color: #ffffff; font-size: 20px; margin-top: 0;">Hello {username},</h2>
    <div style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
      {notification_message}
    </div>
    <div style="text-align: center; margin-top: 25px;">
      <a href="{login_url}" style="background-color: #e11d48; color: #ffffff; font-weight: bold; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Open Streaming Portal</a>
    </div>
  </div>
</div>`;

export const DEFAULT_PASSWORD_RESET_SUBJECT = 'Reset Your Password - {app_name}';
export const DEFAULT_PASSWORD_RESET_TEMPLATE = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0c0406; color: #e2e8f0; padding: 32px 24px; border-radius: 16px; border: 1px solid #2e1015;">
  <div style="text-align: center; margin-bottom: 28px;">
    <div style="display: inline-block; padding: 10px 18px; background: rgba(211, 29, 56, 0.15); border: 1px solid rgba(211, 29, 56, 0.3); border-radius: 12px; margin-bottom: 12px;">
      <span style="font-size: 22px; font-weight: 900; color: #ff4d64; letter-spacing: -0.5px;">CINJELLY</span>
    </div>
    <h1 style="color: #ffffff; font-size: 22px; margin: 0; font-weight: 800;">Password Reset Request</h1>
    <p style="color: #a1a1aa; font-size: 13px; margin-top: 6px;">Secure account verification for {app_name}</p>
  </div>
  
  <div style="background-color: #14070a; border: 1px solid #2e1015; padding: 26px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
    <h2 style="color: #ffffff; font-size: 18px; margin-top: 0; font-weight: 700;">Hello, {username} 👋</h2>
    <p style="color: #d4d4d8; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
      We received a request to reset the password for your Cinode streaming account. Click the button below to choose a new password:
    </p>
    
    <div style="text-align: center; margin: 28px 0;">
      <a href="{reset_link}" style="background: linear-gradient(135deg, #d31d38, #b0162c); color: #ffffff; font-weight: 800; padding: 14px 34px; text-decoration: none; border-radius: 10px; font-size: 14px; display: inline-block; letter-spacing: 0.5px; box-shadow: 0 4px 18px rgba(211,29,56,0.45); text-transform: uppercase;">Reset Password</a>
    </div>
    
    <p style="color: #a1a1aa; font-size: 12px; line-height: 1.5; margin-top: 20px;">
      ⏱️ <strong>Security Notice:</strong> This password reset link is valid for <strong>60 minutes</strong> and can only be used once.
    </p>

    <p style="color: #71717a; font-size: 12px; line-height: 1.5; margin-top: 14px;">
      If you did not request a password reset, you can safely ignore this email. Your current password will remain completely secure and unchanged.
    </p>
    
    <hr style="border: 0; border-top: 1px solid #2e1015; margin: 24px 0 16px 0;">
    
    <p style="color: #71717a; font-size: 11px; word-break: break-all; margin: 0;">
      If the button above does not work, copy and paste this link into your browser:<br>
      <a href="{reset_link}" style="color: #ff4d64; text-decoration: underline;">{reset_link}</a>
    </p>
  </div>
  
  <p style="color: #52525b; font-size: 11px; text-align: center; margin-top: 24px;">
    Cinode 4K Cinema Network • Automated Security System
  </p>
</div>`;

export function replaceTemplateVariables(template: string, vars: Record<string, string>): string {
  let result = template || '';
  Object.keys(vars).forEach(key => {
    const val = vars[key] || '';
    // Replace {key}, {{key}}, {{ key }}
    result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}|\\{${key}\\}`, 'g'), val);
  });
  return result;
}

export function replaceTemplateVars(
  template: string, 
  user?: any, 
  config?: any, 
  customVars?: Record<string, string>
): string {
  const vars: Record<string, string> = {
    username: user?.username || user?.fullName || 'User',
    fullName: user?.fullName || user?.username || 'Valued Subscriber',
    email: user?.email || '',
    app_name: 'CINJELLY Stream',
    login_url: process.env.PUBLIC_APP_URL || 'https://zerolord.com',
    support_email: config?.contactEmail || config?.smtpFromEmail || 'support@zerolord.com',
    website_url: config?.serverUrl || process.env.PUBLIC_APP_URL || 'https://zerolord.com',
    current_year: new Date().getFullYear().toString(),
    ios_app_link: config?.iosDownloadUrl || 'https://apps.apple.com/app/jellyfin/id1601583420',
    android_app_link: config?.androidDownloadUrl || 'https://play.google.com/store/apps/details?id=org.jellyfin.mobile',
    ...(customVars || {})
  };

  return replaceTemplateVariables(template, vars);
}

export async function sendEmail(
  toOrOptions: string | { to: string; subject: string; html: string; text?: string },
  subjectOrConfig?: string | JellyfinConfig,
  htmlContent?: string,
  customConfig?: JellyfinConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    let to = '';
    let subject = '';
    let html = '';
    let text: string | undefined = undefined;
    let configToUse = customConfig;

    if (typeof toOrOptions === 'object') {
      to = toOrOptions.to;
      subject = toOrOptions.subject;
      html = toOrOptions.html;
      text = toOrOptions.text;
      configToUse = (subjectOrConfig as JellyfinConfig) || customConfig;
    } else {
      to = toOrOptions;
      subject = subjectOrConfig as string;
      html = htmlContent || '';
    }

    const config = configToUse || (await db.getConfig());
    if (!config) {
      return { success: false, error: 'System configuration not found.' };
    }

    if (!config.smtpEnabled || Number(config.smtpEnabled) !== 1) {
      console.log(`[SMTP Disabled] Email to ${to} was skipped because SMTP is turned off in settings.`);
      return { success: false, error: 'SMTP email sending is currently turned off in admin settings.' };
    }

    if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
      return { success: false, error: 'SMTP settings (Host, Username, Password) are incomplete.' };
    }

    const host = (config.smtpHost || '').replace(/^(ssl|tls|tcp|http|https):\/\//i, '').replace(/:.*$/, '').trim();
    const port = Number(config.smtpPort) || 587;
    const isSecure = Number(config.smtpSecure) === 1 || port === 465;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: isSecure,
      auth: {
        user: (config.smtpUser || '').trim(),
        pass: config.smtpPass
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000
    });

    const fromName = config.smtpFromName || 'CINJELLY Stream';
    const fromEmail = config.smtpFromEmail || config.smtpUser;

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>?/gm, '')
    });

    console.log(`[SMTP Success] Email sent to ${to} with subject: ${subject}`);
    return { success: true };
  } catch (err: any) {
    console.error('[SMTP Error] Failed to send email:', err.message);
    return { success: false, error: err.message };
  }
}

export async function testSmtpConnection(
  arg1: Partial<JellyfinConfig> | string,
  arg2: Partial<JellyfinConfig> | string
): Promise<{ success: boolean; error?: string }> {
  try {
    let smtpConfig: Partial<JellyfinConfig> = {};
    let testRecipient = '';

    if (typeof arg1 === 'string') {
      testRecipient = arg1;
      smtpConfig = (arg2 as Partial<JellyfinConfig>) || {};
    } else {
      smtpConfig = arg1 || {};
      testRecipient = arg2 as string;
    }

    if (!smtpConfig.smtpHost || !smtpConfig.smtpUser || !smtpConfig.smtpPass) {
      return { success: false, error: 'Please provide SMTP Host, Port, Username and Password.' };
    }

    const host = (smtpConfig.smtpHost || '').replace(/^(ssl|tls|tcp|http|https):\/\//i, '').replace(/:.*$/, '').trim();
    const port = Number(smtpConfig.smtpPort) || 587;
    const isSecure = Number(smtpConfig.smtpSecure) === 1 || port === 465;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: isSecure,
      auth: {
        user: (smtpConfig.smtpUser || '').trim(),
        pass: smtpConfig.smtpPass
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000
    });

    await transporter.verify();

    const fromName = smtpConfig.smtpFromName || 'CINJELLY Admin';
    const fromEmail = smtpConfig.smtpFromEmail || smtpConfig.smtpUser;

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: testRecipient,
      subject: 'SMTP Connection Test - CINJELLY',
      html: `<div style="font-family: Arial, sans-serif; padding: 20px; background: #0b0d17; color: #fff; border-radius: 8px;">
        <h2 style="color: #10b981;">✅ SMTP Test Successful!</h2>
        <p>Your SMTP mail server configuration is working properly.</p>
        <p style="color: #94a3b8; font-size: 12px;">Sent at: ${new Date().toLocaleString()}</p>
      </div>`
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
