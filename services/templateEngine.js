/**
 * Personalization & Dynamic Variable Rendering Engine
 * Replaces tags like {Name}, {College}, {Branch}, {Job_Role} etc. in Subject and Body
 */

const DEFAULT_VARIABLES = {
  Company: 'Aparaitech Software',
  Company_Website: 'https://aparaitech.org',
  Company_Location: 'Baramati & Bengaluru, India',
  Job_Role: 'Associate Software Engineer / AI Solutions Developer',
  Drive_Date: 'August 28, 2026',
  Package: '₹6.5 LPA - ₹12.0 LPA + Performance Incentives',
  Application_Link: 'https://aparaitech.org/apply',
  Apply_Link: 'https://aparaitech.org/apply',
  ApplyLink: 'https://aparaitech.org/apply',
  Apply_Url: 'https://aparaitech.org/apply',
  ApplyUrl: 'https://aparaitech.org/apply',
  ApplyNow_Link: 'https://aparaitech.org/apply',
  ApplyNow: 'https://aparaitech.org/apply',
  Recruiter_Name: 'Campus Recruitment Team',
  Recruiter_Email: 'recruitment@aparaitech.org'
};

const { resolveSpintax } = require('./spamShield');

function renderText(templateString, student = {}, customVariables = {}) {
  if (!templateString) return '';

  // 1. Resolve dynamic Spintax variations first: {Hello|Dear|Greetings}
  let processed = resolveSpintax(templateString);

  const firstName = student.name ? student.name.trim().split(' ')[0] : 'Candidate';
  const applyLink = customVariables.apply_link || customVariables.ApplyLink || customVariables.Apply_Link || student.apply_link || DEFAULT_VARIABLES.Apply_Link;

  const mergedVars = {
    ...DEFAULT_VARIABLES,
    Apply_Link: applyLink,
    ApplyLink: applyLink,
    Application_Link: applyLink,
    ApplicationLink: applyLink,
    Apply_Url: applyLink,
    ApplyUrl: applyLink,
    ApplyNow_Link: applyLink,
    ApplyNow: applyLink,
    Name: student.name || 'Candidate',
    First_Name: firstName,
    Email: student.email || '',
    College: student.college || 'your college',
    Phone: student.phone || '',
    Branch: student.branch || 'Computer Engineering',
    Batch: student.batch || '2026',
    ...customVariables
  };

  // 2. Replace case-insensitive {Tag} and {{Tag}}
  return processed.replace(/\{{1,2}\s*([\w_]+)\s*\}{1,2}/gi, (match, key) => {
    // Find key case-insensitively
    const foundKey = Object.keys(mergedVars).find(k => k.toLowerCase() === key.toLowerCase());
    return foundKey !== undefined ? mergedVars[foundKey] : match;
  });
}

function extractTags(text) {
  if (!text) return [];
  const matches = text.match(/\{{1,2}\s*([\w_]+)\s*\}{1,2}/gi) || [];
  return [...new Set(matches.map(m => '{' + m.replace(/[\{\}\s]/g, '') + '}'))];
}

module.exports = {
  renderText,
  extractTags,
  DEFAULT_VARIABLES
};
