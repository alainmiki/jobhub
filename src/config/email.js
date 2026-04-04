import nodemailer from 'nodemailer';
import logger from './logger.js';

let transporter = null;

export const initEmailService = () => {
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = process.env.SMTP_PORT || 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    logger.warn('SMTP not configured - email features disabled');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort, 10),
    secure: smtpPort === '465',
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  logger.info(`Email service initialized with host: ${smtpHost}`);
  return transporter;
};

export const sendEmail = async (to, subject, html) => {
  if (!transporter) {
    logger.warn('Email transporter not initialized');
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || 'JobHub <noreply@jobhub.com>',
      to,
      subject,
      html
    });
    logger.info(`Email sent to: ${to} MessageID: ${info.messageId}`);
    return true;
  } catch (error) {
    logger.error(`Email failed to send: ${error.message}`);
    return false;
  }
};

export const sendVerificationEmail = async ({ user, url, token }) => {
  const verificationUrl = url;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Welcome to JobHub!</h2>
      <p>Hi ${user.name || 'there'},</p>
      <p>Thank you for signing up. Please verify your email address to activate your account.</p>
      <div style="margin: 30px 0;">
        <a href="${verificationUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Verify Email
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">
        Or copy and paste this link in your browser:<br>
        ${verificationUrl}
      </p>
      <p style="color: #666; font-size: 14px; margin-top: 20px;">
        This link will expire in 24 hours. If you didn't create an account, please ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #999; font-size: 12px;">JobHub - Connecting candidates with opportunities</p>
    </div>
  `;

  return sendEmail(user.email, 'Verify your email address - JobHub', html);
};

export const sendPasswordResetEmail = async ({ user, url, token }, request) => {
  const resetUrl = url;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Reset Your Password</h2>
      <p>Hi ${user.name || 'there'},</p>
      <p>We received a request to reset your password. Click the button below to create a new password.</p>
      <div style="margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">
        Or copy and paste this link in your browser:<br>
        ${resetUrl}
      </p>
      <p style="color: #666; font-size: 14px; margin-top: 20px;">
        This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #999; font-size: 12px;">JobHub - Connecting candidates with opportunities</p>
    </div>
  `;

  return sendEmail(user.email, 'Reset your password - JobHub', html);
};

export const sendPasswordResetCompleteEmail = async ({ user }) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Password Changed</h2>
      <p>Hi ${user.name || 'there'},</p>
      <p>Your password has been successfully reset.</p>
      <p style="color: #666; font-size: 14px; margin-top: 20px;">
        If you didn't make this change, please contact us immediately.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #999; font-size: 12px;">JobHub - Connecting candidates with opportunities</p>
    </div>
  `;

  return sendEmail(user.email, 'Your password has been changed - JobHub', html);
};

export const sendApplicationNotification = async (userEmail, userName, jobTitle, companyName, status) => {
  let statusText = '';
  let statusColor = '';
  
  switch (status) {
    case 'accepted':
      statusText = 'Accepted';
      statusColor = '#16A34A';
      break;
    case 'rejected':
      statusText = 'Rejected';
      statusColor = '#DC2626';
      break;
    case 'pending':
    default:
      statusText = 'Under Review';
      statusColor = '#F59E0B';
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Application Update</h2>
      <p>Hi ${userName || 'there'},</p>
      <p>Your application for <strong>${jobTitle}</strong> at <strong>${companyName}</strong> has been <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span>.</p>
      <p style="color: #666; font-size: 14px; margin-top: 20px;">
        Log in to your JobHub account to view more details.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #999; font-size: 12px;">JobHub - Connecting candidates with opportunities</p>
    </div>
  `;

  return sendEmail(userEmail, `Application Status Update - ${jobTitle}`, html);
};