const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

class EmailService {
    constructor(config) {
        this.config = config?.email || {
            provider: 'aws-ses',
            smtp: {
                host: 'email-smtp.us-east-1.amazonaws.com',
                port: 587,
                secure: false,
                auth: {
                    user: process.env.AWS_SES_SMTP_USERNAME || 'demo-user',
                    pass: process.env.AWS_SES_SMTP_PASSWORD || 'demo-password'
                }
            },
            from: process.env.EMAIL_FROM || 'diseaseZone Platform <noreply@disease.zone>',
            replyTo: process.env.EMAIL_REPLY_TO || 'support@disease.zone'
        };

        this.transporter = null;
        this.awsSES = null;
        this.initializeEmailProvider();
    }

    async initializeEmailProvider() {
        try {
            if (this.config.provider === 'aws-ses' && this.config.aws) {
                // Try AWS SES SDK first
                try {
                    const AWS = require('aws-sdk');
                    AWS.config.update({
                        accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID || this.config.aws.accessKeyId,
                        secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY || this.config.aws.secretAccessKey,
                        region: this.config.aws.region || 'us-east-1'
                    });
                    this.awsSES = new AWS.SES();
                    console.log('✅ AWS SES SDK initialized successfully');
                } catch (awsError) {
                    console.warn('⚠️ AWS SES SDK failed, falling back to SMTP:', awsError.message);
                }
            }

            // Initialize SMTP transporter (works for both AWS SES SMTP and other providers)
            const smtpConfig = this.config.smtp || this.config;
            this.transporter = nodemailer.createTransporter({
                host: smtpConfig.host,
                port: smtpConfig.port,
                secure: smtpConfig.secure,
                auth: smtpConfig.auth
            });

            // Verify the connection
            if (process.env.NODE_ENV !== 'test') {
                await this.transporter.verify();
                console.log('✅ Email SMTP transport initialized successfully');
            }
        } catch (error) {
            console.warn('⚠️ Email service initialization failed:', error.message);
            console.warn('📧 Emails will be logged to console instead');
            this.transporter = null;
            this.awsSES = null;
        }
    }

    async sendEmail(to, subject, html, text = null) {
        const mailOptions = {
            from: this.config.from,
            to,
            subject,
            html,
            text: text || this.stripHtml(html)
        };

        // Add reply-to if configured
        if (this.config.replyTo) {
            mailOptions.replyTo = this.config.replyTo;
        }

        try {
            // Try AWS SES SDK first if available
            if (this.awsSES) {
                const sesParams = {
                    Source: this.config.from,
                    Destination: { ToAddresses: [to] },
                    Message: {
                        Subject: { Data: subject },
                        Body: {
                            Html: { Data: html },
                            Text: { Data: text || this.stripHtml(html) }
                        }
                    }
                };

                if (this.config.replyTo) {
                    sesParams.ReplyToAddresses = [this.config.replyTo];
                }

                const result = await this.awsSES.sendEmail(sesParams).promise();
                console.log(`📧 Email sent via AWS SES to ${to}: ${subject}`);
                return { success: true, messageId: result.MessageId };
            }

            // Fallback to SMTP
            if (this.transporter) {
                const result = await this.transporter.sendMail(mailOptions);
                console.log(`📧 Email sent via SMTP to ${to}: ${subject}`);
                return { success: true, messageId: result.messageId };
            }

            // Development fallback: log email to console
            console.log('📧 EMAIL (Development Mode):');
            console.log(`To: ${to}`);
            console.log(`Subject: ${subject}`);
            console.log(`Content: ${text || this.stripHtml(html)}`);
            console.log('---');
            return { success: true, messageId: 'dev-mode-' + Date.now() };

        } catch (error) {
            console.error('❌ Failed to send email:', error);
            throw error;
        }
    }

    async sendPasswordResetEmail(email, resetToken, userFirstName = '') {
        const resetUrl = `${process.env.APP_URL || 'https://disease.zone'}/reset-password?token=${resetToken}`;

        const subject = 'Reset Your diseaseZone Password';

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 0; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px 20px; text-align: center;">
                    <div style="display: inline-flex; align-items: center; gap: 10px;">
                        <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                            🧬
                        </div>
                        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">diseaseZone</h1>
                    </div>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Global Health Intelligence Platform</p>
                </div>

                <!-- Content -->
                <div style="padding: 40px 30px;">
                    <h2 style="color: #1f2937; margin-bottom: 20px; font-size: 24px;">Password Reset Request</h2>

                    ${userFirstName ? `<p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Hi ${userFirstName},</p>` : ''}

                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                        We received a request to reset the password for your diseaseZone account. Click the button below to create a new password:
                    </p>

                    <!-- Reset Button -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" style="
                            display: inline-block;
                            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                            color: white;
                            padding: 15px 30px;
                            text-decoration: none;
                            border-radius: 8px;
                            font-weight: 600;
                            font-size: 16px;
                            box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3);
                        ">Reset My Password</a>
                    </div>

                    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 25px 0;">
                        This link will expire in 1 hour for security reasons. If you didn't request this password reset, you can safely ignore this email.
                    </p>

                    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 25px 0;">
                        If the button doesn't work, copy and paste this link into your browser:<br>
                        <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
                    </p>

                    <!-- Security Notice -->
                    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-top: 30px;">
                        <h3 style="color: #d97706; margin: 0 0 10px 0; font-size: 16px;">🔒 Security Notice</h3>
                        <p style="color: #4b5563; font-size: 14px; line-height: 1.5; margin: 0;">
                            For your security, always verify that password reset emails come from <strong>noreply@disease.zone</strong>.
                            Never share your password or reset links with others.
                        </p>
                    </div>
                </div>

                <!-- Footer -->
                <div style="background: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
                        diseaseZone - Global Health Intelligence Platform
                    </p>
                    <p style="color: #6b7280; font-size: 12px; margin: 0;">
                        © 2025 diseaseZone. All rights reserved.<br>
                        Need help? Contact us at <a href="mailto:support@disease.zone" style="color: #2563eb;">support@disease.zone</a>
                    </p>
                </div>
            </div>
        </body>
        </html>
        `;

        const text = `
        diseaseZone - Password Reset Request

        ${userFirstName ? `Hi ${userFirstName},` : 'Hello,'}

        We received a request to reset the password for your diseaseZone account.

        Click this link to reset your password:
        ${resetUrl}

        This link will expire in 1 hour for security reasons.

        If you didn't request this password reset, you can safely ignore this email.

        For security, always verify that emails come from noreply@disease.zone.

        Need help? Contact support@disease.zone

        © 2025 diseaseZone - Global Health Intelligence Platform
        `;

        return await this.sendEmail(email, subject, html, text);
    }

    async sendWelcomeEmail(email, firstName, tempPassword = null) {
        const subject = `Welcome to diseaseZone - Your Health Intelligence Platform`;

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to diseaseZone</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 0; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 30px 20px; text-align: center;">
                    <div style="display: inline-flex; align-items: center; gap: 10px;">
                        <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                            🧬
                        </div>
                        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">diseaseZone</h1>
                    </div>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Welcome to Global Health Intelligence</p>
                </div>

                <!-- Content -->
                <div style="padding: 40px 30px;">
                    <h2 style="color: #1f2937; margin-bottom: 20px; font-size: 24px;">Welcome, ${firstName}!</h2>

                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                        Thank you for joining diseaseZone, the world's leading platform for global health intelligence,
                        disease surveillance, and medical research collaboration.
                    </p>

                    <!-- Get Started Button -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.APP_URL || 'https://disease.zone'}" style="
                            display: inline-block;
                            background: linear-gradient(135deg, #059669 0%, #047857 100%);
                            color: white;
                            padding: 15px 30px;
                            text-decoration: none;
                            border-radius: 8px;
                            font-weight: 600;
                            font-size: 16px;
                            box-shadow: 0 4px 6px rgba(5, 150, 105, 0.3);
                        ">Start Exploring</a>
                    </div>

                    <!-- Features -->
                    <div style="margin: 30px 0;">
                        <h3 style="color: #1f2937; font-size: 18px; margin-bottom: 15px;">What you can do:</h3>
                        <ul style="color: #4b5563; font-size: 14px; line-height: 1.8; padding-left: 20px;">
                            <li>🦠 Track real-time disease outbreaks and surveillance data</li>
                            <li>📊 Access comprehensive health analytics and insights</li>
                            <li>🔬 Collaborate with medical professionals worldwide</li>
                            <li>📍 Get location-based health alerts for your area</li>
                            <li>📰 Stay updated with latest health news and research</li>
                        </ul>
                    </div>

                    ${tempPassword ? `
                    <!-- Temporary Password -->
                    <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-top: 30px;">
                        <h3 style="color: #d97706; margin: 0 0 10px 0; font-size: 16px;">🔑 Temporary Password</h3>
                        <p style="color: #92400e; font-size: 14px; line-height: 1.5; margin: 0;">
                            Your temporary password is: <strong>${tempPassword}</strong><br>
                            Please log in and change this password immediately for security.
                        </p>
                    </div>
                    ` : ''}
                </div>

                <!-- Footer -->
                <div style="background: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
                        diseaseZone - Global Health Intelligence Platform
                    </p>
                    <p style="color: #6b7280; font-size: 12px; margin: 0;">
                        Need help? Contact us at <a href="mailto:support@disease.zone" style="color: #059669;">support@disease.zone</a>
                    </p>
                </div>
            </div>
        </body>
        </html>
        `;

        const text = `
        Welcome to diseaseZone, ${firstName}!

        Thank you for joining the world's leading platform for global health intelligence.

        Start exploring: ${process.env.APP_URL || 'https://disease.zone'}

        What you can do:
        - Track real-time disease outbreaks
        - Access health analytics and insights
        - Collaborate with medical professionals
        - Get location-based health alerts
        - Stay updated with health news

        ${tempPassword ? `Temporary Password: ${tempPassword}\nPlease change this immediately after logging in.` : ''}

        Need help? Contact support@disease.zone

        © 2025 diseaseZone - Global Health Intelligence Platform
        `;

        return await this.sendEmail(email, subject, html, text);
    }

    stripHtml(html) {
        return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }

    async testEmailConnection() {
        try {
            if (this.transporter) {
                await this.transporter.verify();
                return { success: true, message: 'Email connection verified' };
            } else {
                return { success: false, message: 'Email transporter not initialized' };
            }
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
}

module.exports = EmailService;