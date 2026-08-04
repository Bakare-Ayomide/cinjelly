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
