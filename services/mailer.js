const nodemailer = require('nodemailer');
const { getDb } = require('../database/db');
const smtpPool = require('./smtpPool');
const { primeDns } = require('./dnsHelper');
const {
  htmlToPlainText,
  generateRFCCompliantMessageId,
  generateDeliverabilityHeaders
} = require('./spamShield');

/**
 * Get current mailer configuration from database settings
 */
function getMailerConfig() {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  return settings;
}

/**
 * Verify SMTP server connection
 */
async function verifySmtpConnection(customConfig = null) {
  const config = customConfig || getMailerConfig();
  const host = config.smtp_host || 'smtp.gmail.com';
  await primeDns(host);

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(config.smtp_port, 10) || 587,
      secure: config.smtp_secure === 'true' || config.smtp_port === '465' || config.secure === 1 || config.secure === true,
      auth: {
        user: (config.smtp_user || config.user || '').trim(),
        pass: (config.smtp_pass || config.pass || '').trim().replace(/\s+/g, '')
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
      dnsTimeout: 5000
    });

    await transporter.verify();
    return {
      success: true,
      mode: 'smtp',
      message: `Successfully connected to SMTP server (${host}:${config.smtp_port || 587}) for ${config.smtp_user || config.user}`
    };
  } catch (error) {
    return {
      success: false,
      mode: 'smtp',
      message: `SMTP Connection Failed: ${error.message}`
    };
  }
}

/**
 * Send an email through the configured SMTP account.
 */
async function sendEmail({
  to,
  recipientName,
  subject,
  html,
  campaignId = null,
  studentId = null,
  student = {},
  smtpAccount = null
}) {
  const config = getMailerConfig();
  const startTime = Date.now();

  const activeSmtp = smtpAccount || {
    id: null,
    host: config.smtp_host || 'smtp.gmail.com',
    port: parseInt(config.smtp_port, 10) || 587,
    secure: config.smtp_secure === 'true' || config.smtp_port === '465',
    user: config.smtp_user || 'recruitment@aparaitech.org',
    pass: config.smtp_pass || '',
    from_name: config.from_name || 'Aparaitech Software Recruitment Team',
    from_email: config.from_email || 'recruitment@aparaitech.org',
    reply_to: config.reply_to || 'careers@aparaitech.org'
  };

  const fromName = activeSmtp.from_name || config.from_name || 'Aparaitech Software Recruitment Team';
  const fromEmail = activeSmtp.from_email || activeSmtp.user || config.from_email || 'recruitment@aparaitech.org';
  const replyTo = activeSmtp.reply_to || config.reply_to || 'careers@aparaitech.org';
  const host = activeSmtp.host || 'smtp.gmail.com';
  await primeDns(host);

  // Live SMTP mode
  try {
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(activeSmtp.port, 10) || 587,
      secure: activeSmtp.secure === 1 || activeSmtp.secure === true || activeSmtp.port === 465 || activeSmtp.port === '465',
      auth: {
        user: (activeSmtp.user || '').trim(),
        pass: (activeSmtp.pass || '').trim().replace(/\s+/g, '')
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
      dnsTimeout: 5000
    });

    const plainText = htmlToPlainText(html);
    const domainMessageId = generateRFCCompliantMessageId(fromEmail);
    const deliverabilityHeaders = generateDeliverabilityHeaders({
      fromEmail,
      recipientEmail: to,
      replyTo,
      campaignId
    });

    const isGmail = fromEmail.toLowerCase().endsWith('@gmail.com') || (activeSmtp.host && activeSmtp.host.includes('gmail.com'));
    const effectiveReplyTo = isGmail ? fromEmail : (activeSmtp.reply_to || config.reply_to || fromEmail);

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: recipientName ? `"${recipientName}" <${to}>` : to,
      replyTo: effectiveReplyTo,
      subject,
      text: plainText,
      html
    };

    if (domainMessageId) {
      mailOptions.messageId = domainMessageId;
    }

    if (deliverabilityHeaders && Object.keys(deliverabilityHeaders).length > 0) {
      mailOptions.headers = deliverabilityHeaders;
    }

    const info = await transporter.sendMail(mailOptions);

    if (activeSmtp.id) {
      smtpPool.recordSendSuccess(activeSmtp.id);
    }

    return {
      success: true,
      messageId: info.messageId,
      latencyMs: Date.now() - startTime,
      mode: 'smtp',
      smtpAccountId: activeSmtp.id,
      smtpSender: fromEmail
    };
  } catch (error) {
    const isQuota = smtpPool.isQuotaError(error.message);
    if (isQuota && activeSmtp.id) {
      smtpPool.markLimitReached(activeSmtp.id);
    }

    return {
      success: false,
      isQuotaError: isQuota,
      error: error.message || 'Unknown SMTP transmission error',
      latencyMs: Date.now() - startTime,
      mode: 'smtp',
      smtpAccountId: activeSmtp.id,
      smtpSender: fromEmail
    };
  }
}

module.exports = {
  getMailerConfig,
  verifySmtpConnection,
  sendEmail
};
