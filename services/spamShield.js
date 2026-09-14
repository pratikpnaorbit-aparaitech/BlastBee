const crypto = require('crypto');
const dns = require('dns').promises;

/**
 * High, Medium, and Contextual Spam Trigger Words Dictionary
 */
const SPAM_RULES = [
  // High-Risk Words (Direct Spam Filter Triggers)
  { phrase: 'win cash', score: 25, severity: 'high', category: 'financial' },
  { phrase: 'win ₹', score: 25, severity: 'high', category: 'financial' },
  { phrase: 'win rs', score: 25, severity: 'high', category: 'financial' },
  { phrase: 'guaranteed stipend', score: 25, severity: 'high', category: 'promises' },
  { phrase: '100% guaranteed', score: 25, severity: 'high', category: 'promises' },
  { phrase: '100% free', score: 25, severity: 'high', category: 'promises' },
  { phrase: 'earn money', score: 20, severity: 'high', category: 'financial' },
  { phrase: 'earn ₹', score: 20, severity: 'high', category: 'financial' },
  { phrase: 'cash prize', score: 20, severity: 'high', category: 'financial' },
  { phrase: 'get paid', score: 15, severity: 'high', category: 'financial' },
  { phrase: 'risk-free', score: 15, severity: 'high', category: 'promises' },
  { phrase: 'risk free', score: 15, severity: 'high', category: 'promises' },
  { phrase: 'act now', score: 15, severity: 'high', category: 'urgency' },
  { phrase: 'apply now or miss out', score: 20, severity: 'high', category: 'urgency' },
  { phrase: 'instant approval', score: 20, severity: 'high', category: 'promises' },
  { phrase: 'congratulations you won', score: 30, severity: 'high', category: 'financial' },
  { phrase: 'claim your offer', score: 15, severity: 'high', category: 'promotional' },

  // Medium-Risk Words (Promotions Tab / Aggressive Cold Emailing)
  { phrase: 'urgent', score: 12, severity: 'medium', category: 'urgency' },
  { phrase: 'hurry up', score: 12, severity: 'medium', category: 'urgency' },
  { phrase: 'hurry', score: 10, severity: 'medium', category: 'urgency' },
  { phrase: 'limited seats', score: 8, severity: 'medium', category: 'urgency' },
  { phrase: 'limited time', score: 8, severity: 'medium', category: 'urgency' },
  { phrase: 'don\'t miss out', score: 10, severity: 'medium', category: 'urgency' },
  { phrase: 'wipro-oriented', score: 15, severity: 'medium', category: 'brand_impersonation', advice: 'Avoid referencing third-party IT giants (Wipro/TCS/Infosys) in subject or disclaimers; spam filters treat this as deceptive hiring.' },
  { phrase: 'tcs-oriented', score: 15, severity: 'medium', category: 'brand_impersonation' },
  { phrase: 'infosys-oriented', score: 15, severity: 'medium', category: 'brand_impersonation' },
  { phrase: 'no experience required', score: 10, severity: 'medium', category: 'promises' },
  { phrase: 'no qualifications', score: 15, severity: 'medium', category: 'promises' },
  { phrase: 'exclusive offer', score: 10, severity: 'medium', category: 'promotional' },
  { phrase: 'special promotion', score: 12, severity: 'medium', category: 'promotional' },
  { phrase: 'massive discount', score: 15, severity: 'medium', category: 'promotional' },

  // Negative Legal Clusters (Clustered disclaimers that trip spam algorithms)
  { phrase: 'does not automatically guarantee', score: 10, severity: 'medium', category: 'disclaimer_bloat', advice: 'Avoid clustering negative legal disclaimers ("does not guarantee employment, stipend, ppo") into body text. Keep disclaimers concise in the footer.' }
];

// Suspicious URL domains often flagged by Gmail & Yahoo
const SUSPICIOUS_URL_DOMAINS = [
  { domain: 'forms.gle', advice: 'Shortened Google Forms URLs (forms.gle) have a high spam penalty in bulk SMTP. Use direct branded URLs (e.g. https://aparaitech.org/apply).' },
  { domain: 'bit.ly', advice: 'URL shorteners (bit.ly) hide destinations and are heavily penalized by spam filters. Use direct domain links.' },
  { domain: 'tinyurl.com', advice: 'Avoid tinyurl.com in recruitment blasts.' },
  { domain: 't.co', advice: 'Twitter/X redirect links should not be used in email CTAs.' },
  { domain: 'goo.gl', advice: 'Deprecated shortlink format flagged by email filters.' }
];

/**
 * Analyze subject line, body HTML, links, and headers for Spam Risk
 */
function analyzeSpamRisk({ subject = '', html = '', applyLink = '', senderEmail = '' }) {
  let penalty = 0;
  const issues = [];
  const suggestions = [];

  const cleanSubject = (subject || '').trim();
  const cleanBodyText = htmlToPlainText(html);
  const combinedText = `${cleanSubject}\n${cleanBodyText}`.toLowerCase();

  // 1. Keyword Scan
  SPAM_RULES.forEach(rule => {
    if (combinedText.includes(rule.phrase.toLowerCase())) {
      penalty += rule.score;
      issues.push({
        severity: rule.severity,
        type: 'spam_keyword',
        phrase: rule.phrase,
        category: rule.category,
        message: `Found spam trigger phrase: "${rule.phrase}"`,
        advice: rule.advice || `Replace "${rule.phrase}" with formal, professional recruitment language.`
      });
    }
  });

  // 2. Subject Line Analysis
  if (!cleanSubject) {
    penalty += 30;
    issues.push({ severity: 'high', type: 'empty_subject', message: 'Subject line is empty.' });
  } else {
    // Excessive caps check
    const upperCount = (cleanSubject.match(/[A-Z]/g) || []).length;
    const letterCount = (cleanSubject.match(/[a-zA-Z]/g) || []).length;
    if (letterCount > 6 && (upperCount / letterCount) > 0.45) {
      penalty += 20;
      issues.push({
        severity: 'high',
        type: 'subject_all_caps',
        message: 'Subject line has excessive capital letters (>45%).',
        advice: 'Use natural sentence case or standard title case for subjects.'
      });
    }

    // Excessive exclamation or question marks
    if (/[!]{2,}|\?{2,}/.test(cleanSubject)) {
      penalty += 15;
      issues.push({
        severity: 'medium',
        type: 'excessive_punctuation',
        message: 'Multiple exclamation marks (!!) or question marks in subject.',
        advice: 'Remove repeated exclamation marks from the subject line.'
      });
    }

    // Pipes or spam prefixes
    if (/^(\s*adv:|\s*re:|\s*fwd:)/i.test(cleanSubject)) {
      penalty += 15;
      issues.push({
        severity: 'medium',
        type: 'fake_prefix',
        message: 'Avoid deceptive prefixes like "RE:" or "FWD:" unless it is an actual reply.'
      });
    }

    // Length check
    if (cleanSubject.length > 78) {
      penalty += 5;
      suggestions.push('Subject line is longer than 78 characters. Keep under 60 chars for mobile readability.');
    }
  }

  // 3. Link & URL Analysis
  const linkToCheck = (applyLink || '').toLowerCase();
  SUSPICIOUS_URL_DOMAINS.forEach(item => {
    if (linkToCheck.includes(item.domain) || combinedText.includes(item.domain)) {
      penalty += 25;
      issues.push({
        severity: 'high',
        type: 'risky_url_shortener',
        message: `Detected flagged URL shortener or generic link: "${item.domain}"`,
        advice: item.advice
      });
    }
  });

  // Raw IP address check in link
  if (/https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(linkToCheck) || /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(html)) {
    penalty += 35;
    issues.push({
      severity: 'high',
      type: 'raw_ip_url',
      message: 'Email contains raw IP address URLs instead of a verified domain name.',
      advice: 'Always use domain names (https://example.com) with valid SSL certificates.'
    });
  }

  // 4. Content Structure & Deliverability Health
  const plainTextLen = cleanBodyText.length;
  const htmlLen = (html || '').length;

  // Text-to-HTML ratio check
  if (htmlLen > 0 && plainTextLen < 120 && htmlLen > 800) {
    penalty += 15;
    issues.push({
      severity: 'medium',
      type: 'low_text_ratio',
      message: 'Low text-to-HTML ratio. Too much markup/styling compared to actual text.',
      advice: 'Add more descriptive text or simplify the HTML template structure.'
    });
  }

  // Personalization Check
  const hasPersonalization = /\{name\}|\{first_name\}|\{college\}|\{branch\}/i.test(subject + html);
  if (!hasPersonalization) {
    penalty += 10;
    suggestions.push('Add dynamic recipient tags like {First_Name} or {College} to make the email individualized.');
  }

  // Unsubscribe / Compliance Notice Check
  const hasUnsubNotice = /unsubscribe|opt-out|opt out|remove.*records/i.test(combinedText);
  if (!hasUnsubNotice) {
    penalty += 12;
    issues.push({
      severity: 'medium',
      type: 'missing_opt_out',
      message: 'No opt-out or unsubscription note detected in the email footer.',
      advice: 'Include a simple notice: "If you wish to opt out, reply with Unsubscribe."'
    });
  }

  // Physical Location / Company Identification
  const hasCompanyFooter = /pune|bengaluru|maharashtra|baramati|india|address|road|complex/i.test(combinedText);
  if (!hasCompanyFooter) {
    suggestions.push('Include your physical office location (e.g., Pune / Bengaluru, India) to comply with international anti-spam standards.');
  }

  // Calculate final score
  const score = Math.max(0, Math.min(100, 100 - penalty));

  let status = 'pristine';
  let label = 'Pristine (Direct to Primary Inbox)';
  let color = '#10b981'; // Green

  if (score < 50) {
    status = 'critical';
    label = 'High Spam Risk (Likely Spam Folder)';
    color = '#ef4444'; // Red
  } else if (score < 75) {
    status = 'warning';
    label = 'Moderate Risk (Likely Promotions Tab)';
    color = '#f59e0b'; // Amber
  } else if (score < 90) {
    status = 'good';
    label = 'Good Deliverability';
    color = '#3b82f6'; // Blue
  }

  return {
    score,
    status,
    label,
    color,
    issues,
    suggestions,
    metrics: {
      subjectLength: cleanSubject.length,
      plainTextLength: plainTextLen,
      hasPersonalization,
      hasUnsubscribe: hasUnsubNotice
    }
  };
}

/**
 * Convert HTML to clean, readable plain text (RFC 2046 alternative)
 */
function htmlToPlainText(html = '') {
  if (!html) return '';

  let text = html;

  // Remove <style> and <script> contents
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Convert links: <a href="URL">TEXT</a> -> TEXT (URL)
  text = text.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, (match, url, label) => {
    const cleanLabel = label.replace(/<[^>]+>/g, '').trim();
    if (!cleanLabel || cleanLabel.toLowerCase() === url.toLowerCase()) {
      return url;
    }
    return `${cleanLabel} (${url})`;
  });

  // Line breaks for structural elements
  text = text.replace(/<(?:p|div|tr|h[1-6])[^>]*>/gi, '\n');
  text = text.replace(/<\/(?:p|div|tr|h[1-6])>/gi, '\n');
  text = text.replace(/<br\s*[\/]?>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '\n  • ');
  text = text.replace(/<\/li>/gi, '');
  text = text.replace(/<hr[^>]*>/gi, '\n----------------------------------------\n');

  // Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&bull;/gi, '•')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&rarr;/gi, '->')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"');

  // Clean excessive spaces and blank lines
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');

  return text.trim();
}

/**
 * Resolve Spintax syntax: {Option A|Option B|Option C}
 * Ensures each email sent has a slightly unique content hash.
 */
function resolveSpintax(text = '') {
  if (!text || typeof text !== 'string') return '';

  // Match {word|word|...} where there is at least one pipe '|'
  const spintaxRegex = /\{([^{}]+?\|[^{}]+?)\}/g;

  let current = text;
  let iterations = 0;

  while (spintaxRegex.test(current) && iterations < 5) {
    current = current.replace(spintaxRegex, (match, choices) => {
      const options = choices.split('|');
      const picked = options[Math.floor(Math.random() * options.length)];
      return picked !== undefined ? picked.trim() : match;
    });
    iterations++;
  }

  return current;
}

/**
 * Generate authentic, RFC-compliant Message-ID bound to sender domain
 */
function generateRFCCompliantMessageId(fromEmail = 'recruitment@aparaitech.org') {
  let domain = 'aparaitech.org';
  if (fromEmail && fromEmail.includes('@')) {
    domain = fromEmail.split('@')[1].trim().toLowerCase();
  }

  // Never override Message-ID on Google Mail (@gmail.com / googlemail.com)
  // Google's SMTP servers automatically sign their own DKIM-aligned Message-ID.
  // Overriding it from an external app causes Gmail to flag the message as altered or unaligned!
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return undefined;
  }

  const timestamp = Date.now();
  const randomHex = crypto.randomBytes(8).toString('hex');
  return `<mail.${timestamp}.${randomHex}@${domain}>`;
}

/**
 * Generate RFC 8058 & CAN-SPAM compliant headers for high deliverability
 */
function generateDeliverabilityHeaders({ fromEmail, recipientEmail, replyTo, campaignId }) {
  const isGmail = (fromEmail || '').toLowerCase().endsWith('@gmail.com') || (fromEmail || '').toLowerCase().endsWith('@googlemail.com');

  // CRITICAL ANTI-SPAM RULE:
  // When sending from @gmail.com accounts via smtp.gmail.com,
  // NEVER attach 'Precedence: bulk' or 'List-Unsubscribe'.
  // Gmail's incoming spam filter marks @gmail.com senders with bulk headers
  // as malicious automated botnets and routes them to Spam/Promotions!
  if (isGmail) {
    return {
      'X-Entity-Ref-ID': `camp-${campaignId || 0}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
    };
  }

  const unsubscribeEmail = replyTo || fromEmail || 'support@aparaitech.org';

  return {
    'List-Unsubscribe': `<mailto:${unsubscribeEmail}?subject=Unsubscribe%20${encodeURIComponent(recipientEmail || '')}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    'X-Entity-Ref-ID': `camp-${campaignId || 0}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
  };
}

/**
 * Calculate humanized jitter delay (prevents robotic fixed-rate tripping)
 */
function humanizeDelay(baseDelayMs = 300) {
  const safeBase = Math.max(150, parseInt(baseDelayMs, 10) || 300);
  // Add -20% to +35% random variation
  const variation = (Math.random() * 0.55) - 0.20;
  return Math.round(safeBase * (1 + variation));
}

/**
 * Test DNS records (MX, SPF, DMARC) for a sender domain
 */
async function checkDomainDns(domain) {
  const cleanDomain = (domain || '').trim().toLowerCase().replace(/^@/, '');
  const result = {
    domain: cleanDomain,
    mx: { exists: false, records: [] },
    spf: { exists: false, record: null, status: 'missing' },
    dmarc: { exists: false, record: null, status: 'missing' },
    overallStatus: 'warning'
  };

  if (!cleanDomain || !cleanDomain.includes('.')) {
    return { ...result, error: 'Invalid domain format' };
  }

  try {
    // 1. Check MX records
    try {
      const mx = await dns.resolveMx(cleanDomain);
      if (mx && mx.length > 0) {
        result.mx.exists = true;
        result.mx.records = mx.map(m => `${m.exchange} (pri: ${m.priority})`);
      }
    } catch (e) {
      result.mx.error = e.message;
    }

    // 2. Check SPF (TXT records on root)
    try {
      const txtRecords = await dns.resolveTxt(cleanDomain);
      const flattened = txtRecords.map(chunk => chunk.join(''));
      const spfRecord = flattened.find(txt => txt.toLowerCase().startsWith('v=spf1'));

      if (spfRecord) {
        result.spf.exists = true;
        result.spf.record = spfRecord;
        result.spf.status = 'valid';
      }
    } catch (e) {
      result.spf.error = e.message;
    }

    // 3. Check DMARC (TXT record on _dmarc.domain)
    try {
      const dmarcTxt = await dns.resolveTxt(`_dmarc.${cleanDomain}`);
      const flattenedDmarc = dmarcTxt.map(chunk => chunk.join(''));
      const dmarcRecord = flattenedDmarc.find(txt => txt.toLowerCase().startsWith('v=dmarc1'));

      if (dmarcRecord) {
        result.dmarc.exists = true;
        result.dmarc.record = dmarcRecord;
        result.dmarc.status = 'valid';
      }
    } catch (e) {
      result.dmarc.error = e.message;
    }

    // Evaluate overall health
    const isUnreachable = result.mx.error && result.mx.error.includes('ECONNREFUSED');
    if (isUnreachable) {
      result.overallStatus = 'unverified';
      result.notice = 'DNS query server was unreachable from this network environment. Verify DNS manually.';
    } else if (result.mx.exists && result.spf.exists && result.dmarc.exists) {
      result.overallStatus = 'optimal';
    } else if (result.mx.exists && (result.spf.exists || result.dmarc.exists)) {
      result.overallStatus = 'good';
    } else if (result.mx.exists) {
      result.overallStatus = 'fair';
    } else {
      result.overallStatus = 'poor';
    }

    return result;
  } catch (err) {
    return { ...result, error: err.message, overallStatus: 'unverified' };
  }
}

module.exports = {
  analyzeSpamRisk,
  htmlToPlainText,
  resolveSpintax,
  generateRFCCompliantMessageId,
  generateDeliverabilityHeaders,
  humanizeDelay,
  checkDomainDns,
  SPAM_RULES
};
