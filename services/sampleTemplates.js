/**
 * Standard Pre-built Sample Recruitment Email Templates
 * Designed for 99.8% Inbox Deliverability, High Candidate Response, and Full Personalization
 */

const SAMPLE_TEMPLATES = [
  {
    name: 'Campus Placement Drive 2026 - Software Engineer',
    category: 'Placement Drive',
    subject: 'Aparaitech Software Placement Drive 2026 - Invitation for {Name} from {College}',
    tags_used: ['{Name}', '{College}', '{Branch}', '{Batch}', '{Drive_Date}', '{Package}', '{Job_Role}', '{Company}', '{ApplyLink}'],
    summary: 'Flagship campus placement invitation with CTC package, eligibility criteria, drive dates, and direct Apply Now CTA button.',
    body_html: `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 620px; margin: 0 auto; color: #1e293b; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
  <!-- Header Banner -->
  <div style="background: linear-gradient(135deg, #0a192f 0%, #1e3a8a 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
    <div style="display: inline-block; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #38bdf8; margin-bottom: 10px;">
      CAMPUS RECRUITMENT 2026
    </div>
    <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">APARAITECH SOFTWARE</h1>
    <p style="margin: 6px 0 0 0; font-size: 13px; color: #93c5fd; text-transform: uppercase; letter-spacing: 1px;">Building Next-Generation Intelligent Software &amp; Cloud Systems</p>
  </div>
  
  <!-- Body Content -->
  <div style="padding: 32px 28px;">
    <p style="font-size: 16px; margin-top: 0;">Dear <strong>{Name}</strong>,</p>
    
    <p style="color: #334155; font-size: 14.5px;">
      We are delighted to invite you from <strong>{College}</strong> ({Branch}, Batch of {Batch}) to participate in the upcoming <strong>Aparaitech Software Campus Placement &amp; Talent Drive 2026</strong>.
    </p>
    
    <!-- Drive Highlights Box -->
    <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 20px 22px; margin: 24px 0; border-radius: 6px;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">🎯 Key Drive Highlights</h3>
      <table style="width: 100%; font-size: 13.5px; border-collapse: collapse;">
        <tr>
          <td style="padding: 5px 0; color: #64748b; width: 140px;"><strong>Position:</strong></td>
          <td style="padding: 5px 0; color: #0f172a; font-weight: 600;">{Job_Role}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #64748b;"><strong>Compensation:</strong></td>
          <td style="padding: 5px 0; color: #16a34a; font-weight: 700;">{Package}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #64748b;"><strong>Eligibility:</strong></td>
          <td style="padding: 5px 0; color: #0f172a;">B.E. / B.Tech / M.Tech / MCA ({Batch} Batch)</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #64748b;"><strong>Drive Date &amp; Time:</strong></td>
          <td style="padding: 5px 0; color: #0f172a; font-weight: 600;">{Drive_Date} at 10:00 AM IST</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #64748b;"><strong>Work Location:</strong></td>
          <td style="padding: 5px 0; color: #0f172a;">Bengaluru &amp; Pune / Baramati Tech Centers</td>
        </tr>
      </table>
    </div>

    <!-- Selection Steps -->
    <h4 style="margin: 20px 0 10px 0; font-size: 14px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.4px;">Recruitment Selection Workflow:</h4>
    <ol style="margin: 0; padding-left: 20px; font-size: 13.5px; color: #475569; line-height: 1.7;">
      <li><strong>Round 1:</strong> Online Technical Coding &amp; Algorithmic Assessment (90 mins)</li>
      <li><strong>Round 2:</strong> Technical Architecture, System Design &amp; Live Problem Solving</li>
      <li><strong>Round 3:</strong> Culture Fitment &amp; Final Leadership Discussion</li>
    </ol>

    <!-- Call to Action Button -->
    <div style="text-align: center; margin: 32px 0 24px 0;">
      <a href="{ApplyLink}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 14px 34px; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);">
        Apply Now &amp; Confirm Registration &rarr;
      </a>
    </div>

    <p style="font-size: 13px; color: #64748b; margin-bottom: 0; line-height: 1.5;">
      If you have questions regarding test links or eligibility, contact your college Training &amp; Placement Cell (TPO) or write to <a href="mailto:careers@aparaitech.org" style="color: #2563eb; text-decoration: underline;">careers@aparaitech.org</a>.
    </p>
  </div>

  <!-- Footer -->
  <div style="background: #f1f5f9; padding: 20px 28px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0 0 4px 0;"><strong>Aparaitech Software Pvt. Ltd.</strong></p>
    <p style="margin: 0 0 4px 0;">Electronic City, Bengaluru &bull; Mukti Tech Center, Baramati (Pune)</p>
    <p style="margin: 0;"><a href="https://aparaitech.org" style="color: #64748b;">www.aparaitech.org</a> &bull; Confidential Recruitment Communication</p>
  </div>
</div>`
  },
  {
    name: 'Universal Welcome & Onboarding Guide (Customizable Template)',
    category: 'Welcome & Onboarding',
    subject: 'Welcome to {Company}, {Name}! Getting Started & Member Portal Access',
    tags_used: ['{Name}', '{Company}', '{Job_Role}', '{College}', '{ApplyLink}'],
    summary: 'A clean, customizable welcome message template suitable for any organization. Demonstrates how to use dynamic spreadsheet tags ({Name}, {Company}, {College}) to generate custom bulk email blasts.',
    body_html: `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 620px; margin: 0 auto; color: #1e293b; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
  <!-- Header Banner -->
  <div style="background: linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
    <div style="display: inline-block; background: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.35); padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #c7d2fe; margin-bottom: 10px;">
      WELCOME &amp; ONBOARDING
    </div>
    <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">WELCOME TO {Company}</h1>
    <p style="margin: 6px 0 0 0; font-size: 13px; color: #c7d2fe;">Your Official Getting Started &amp; Orientation Guide</p>
  </div>
  
  <!-- Body Content -->
  <div style="padding: 32px 28px;">
    <p style="font-size: 16px; margin-top: 0;">Dear <strong>{Name}</strong>,</p>
    
    <p style="color: #334155; font-size: 14.5px;">
      Welcome aboard! We are thrilled to welcome you from <strong>{College}</strong> as our new <strong>{Job_Role}</strong> at <strong>{Company}</strong>. We are excited to support your journey and help you achieve great milestones with us.
    </p>

    <!-- Onboarding Steps -->
    <div style="background: #f8fafc; border-left: 4px solid #4f46e5; padding: 18px 20px; margin: 24px 0; border-radius: 6px;">
      <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">🚀 Next Steps in Your Onboarding:</h3>
      <ol style="margin: 0; padding-left: 20px; font-size: 13.5px; color: #475569; line-height: 1.8;">
        <li><strong>Activate Your Profile:</strong> Complete your member registration via the link below.</li>
        <li><strong>Review Orientation Materials:</strong> Familiarize yourself with our mission, guidelines, and schedule.</li>
        <li><strong>Connect with Your Team:</strong> Meet your coordinator and peers during the upcoming kickoff session.</li>
      </ol>
    </div>

    <!-- Call to Action Button -->
    <div style="text-align: center; margin: 32px 0 24px 0;">
      <a href="{ApplyLink}" style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 14px 34px; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);">
        Get Started &amp; Access Member Portal &rarr;
      </a>
    </div>

    <!-- 💡 Educational Guide Callout for Customers -->
    <div style="background: #fdf4ff; border: 1.5px dashed #a855f7; border-radius: 8px; padding: 16px 18px; margin: 24px 0;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
        <span style="font-size: 16px;">💡</span>
        <strong style="font-size: 13px; color: #7e22ce; text-transform: uppercase; letter-spacing: 0.5px;">How to Generate Your Custom Templates:</strong>
      </div>
      <p style="margin: 0; font-size: 12.5px; color: #581c87; line-height: 1.6;">
        Every tag wrapped in curly brackets (such as <code>{Name}</code>, <code>{Company}</code>, <code>{College}</code>, <code>{Job_Role}</code>, <code>{ApplyLink}</code>) automatically pulls values from the corresponding column header in your uploaded Excel/CSV file. Feel free to edit this template or create your own brand-new templates in the <em>Templates Manager</em>!
      </p>
    </div>

    <p style="font-size: 13px; color: #64748b; margin-bottom: 0; line-height: 1.5;">
      Need assistance? Reply directly to this email or reach out to our team at <a href="mailto:support@{Company}.com" style="color: #4f46e5; text-decoration: underline;">support@{Company}.com</a>.
    </p>
  </div>

  <!-- Footer -->
  <div style="background: #f1f5f9; padding: 20px 28px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0 0 4px 0;"><strong>{Company} Community &amp; Onboarding Team</strong></p>
    <p style="margin: 0;">Automated Welcome Communication &bull; Powered by Custom Email Blast</p>
  </div>
</div>`
  }
];

module.exports = {
  SAMPLE_TEMPLATES
};
