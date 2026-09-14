const assert = require('assert');
const {
  analyzeSpamRisk,
  htmlToPlainText,
  resolveSpintax,
  generateRFCCompliantMessageId,
  generateDeliverabilityHeaders,
  humanizeDelay
} = require('../services/spamShield');
const { renderText } = require('../services/templateEngine');

console.log('🧪 Starting Anti-Spam Deliverability System Test Suite...\n');

// Test 1: High Spam Risk Detection
console.log('1. Testing High Spam Risk Detection:');
const badMail = {
  subject: 'WIN ₹2,50,000 CASH PRIZE NOW!!! 100% GUARANTEED OFFER',
  html: '<p>URGENT! Claim your cash prize now at https://forms.gle/test123</p>',
  applyLink: 'https://forms.gle/test123'
};
const badResult = analyzeSpamRisk(badMail);
console.log(`   Spam Score for Bad Mail: ${badResult.score}/100 (${badResult.label})`);
assert(badResult.score < 50, 'Bad mail should have a high spam risk score (< 50)');
assert(badResult.issues.length >= 3, 'Should detect multiple spam triggers');
console.log('   ✅ Successfully flagged bad spam triggers, caps, and forms.gle!\n');

// Test 2: Pristine Corporate Recruitment Template
console.log('2. Testing Pristine Corporate Recruitment Template:');
const goodMail = {
  subject: 'Application Invitation: Software Trainee Cohort 2026 – {Name}',
  html: `
    <div>
      <p>Dear {Name},</p>
      <p>We are pleased to invite students from {College} to review the 2026 Software Engineer role.</p>
      <p><a href="{ApplyLink}">Submit Application</a></p>
      <p>Office: Pune, Maharashtra, India</p>
      <p>If you wish to unsubscribe, please reply with Unsubscribe.</p>
    </div>
  `,
  applyLink: 'https://aparaitech.org/apply'
};
const goodResult = analyzeSpamRisk(goodMail);
console.log(`   Spam Score for Clean Mail: ${goodResult.score}/100 (${goodResult.label})`);
assert(goodResult.score >= 90, 'Clean corporate mail should achieve a pristine deliverability score (>= 90)');
console.log('   ✅ Pristine template verified with near-zero spam penalty!\n');

// Test 3: HTML to Plain-Text Alternative (RFC 2046)
console.log('3. Testing RFC 2046 Plain Text Generation:');
const rawHtml = `
  <h2>Aparaitech Software</h2>
  <p>Hello <strong>Rahul</strong>,</p>
  <ul>
    <li>Role: Software Engineer</li>
    <li>Location: Pune</li>
  </ul>
  <a href="https://aparaitech.org/apply">Apply Now</a>
  <p>Reply Unsubscribe to opt out.</p>
`;
const plainText = htmlToPlainText(rawHtml);
assert(plainText.includes('Aparaitech Software'));
assert(plainText.includes('Rahul'));
assert(plainText.includes('Apply Now (https://aparaitech.org/apply)'));
assert(plainText.includes('• Role: Software Engineer'));
assert(!plainText.includes('<p>') && !plainText.includes('</h2>'), 'All HTML tags must be stripped');
console.log('   Generated Plain Text Output Sample:\n---');
console.log(plainText);
console.log('---\n   ✅ HTML converted to compliant multipart plain-text!\n');

// Test 4: Spintax Dynamic Variations
console.log('4. Testing Spintax Variation Resolution:');
const spintaxTemplate = '{Dear|Hello|Greetings} {Name}, {we are pleased|we invite you} to apply.';
const variations = new Set();
for (let i = 0; i < 20; i++) {
  const rendered = resolveSpintax(spintaxTemplate);
  variations.add(rendered);
}
console.log(`   Generated ${variations.size} distinct variations across 20 iterations.`);
assert(variations.size > 1, 'Spintax must generate multiple varied phrases');
console.log('   Sample variations:');
variations.forEach(v => console.log('   - ' + v));
console.log('   ✅ Spintax working, preventing identical hash fingerprinting!\n');

// Test 5: Deliverability Headers & Domain Message-ID
console.log('5. Testing RFC 8058 Deliverability Headers & Domain Message-ID:');
const msgId = generateRFCCompliantMessageId('careers@aparaitech.org');
assert(msgId.endsWith('@aparaitech.org>'), 'Message-ID must be bound to sender domain');
console.log(`   Domain-bound Message-ID: ${msgId}`);

const headers = generateDeliverabilityHeaders({
  fromEmail: 'recruitment@aparaitech.org',
  recipientEmail: 'candidate@college.ac.in',
  replyTo: 'careers@aparaitech.org',
  campaignId: 42
});
assert(headers['List-Unsubscribe'], 'List-Unsubscribe header is required');
assert.strictEqual(headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click', 'RFC 8058 one-click header required');
assert(headers['X-Entity-Ref-ID'], 'X-Entity-Ref-ID required');
console.log('   Generated Headers:', JSON.stringify(headers, null, 2));
console.log('   ✅ Full compliance with Google/Yahoo 2024 bulk sender rules!\n');

// Test 6: Humanized Jitter Delay
console.log('6. Testing Humanized Anti-Spam Dispatch Pacing:');
const delays = [];
for (let i = 0; i < 5; i++) {
  delays.push(humanizeDelay(300));
}
console.log(`   Humanized dispatches for base 300ms: [${delays.join(', ')}] ms`);
const allIdentical = delays.every(d => d === delays[0]);
assert(!allIdentical, 'Delays must have dynamic jitter variance');
console.log('   ✅ Non-robotic pacing verified!\n');

// Test 7: Integration with Template Engine
console.log('7. Testing Full Integration in templateEngine.renderText:');
const fullRendered = renderText('{Hello|Dear|Greetings} {Name} from {College}', {
  name: 'Ananya Deshmukh',
  college: 'COEP Pune'
});
console.log(`   Rendered Result: "${fullRendered}"`);
assert(fullRendered.includes('Ananya Deshmukh') && fullRendered.includes('COEP Pune'));
assert(fullRendered.startsWith('Hello') || fullRendered.startsWith('Dear') || fullRendered.startsWith('Greetings'));
console.log('   ✅ Combined Spintax and student tag personalization verified!\n');

console.log('🎉 ALL 7 ANTI-SPAM TESTS PASSED WITH 100% SUCCESS!\n');
