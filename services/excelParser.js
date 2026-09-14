const xlsx = require('xlsx');

// Standard synonyms for automatic column mapping
const SYNONYMS = {
  name: ['name', 'student name', 'student_name', 'full name', 'fullname', 'candidate name', 'candidate', 'student'],
  email: ['email', 'email id', 'email_id', 'email address', 'e-mail', 'student email', 'mail', 'mail id', 'emailid'],
  college: ['college', 'college name', 'college_name', 'institute', 'institution', 'university', 'campus', 'school'],
  phone: ['phone', 'phone number', 'phone_number', 'mobile', 'mobile number', 'mobile_no', 'contact', 'contact no', 'contact number', 'cell'],
  branch: ['branch', 'department', 'dept', 'degree', 'course', 'stream', 'specialization', 'discipline', 'major'],
  batch: ['batch', 'year', 'passout year', 'graduation year', 'grad year', 'passing year', 'yop', 'batch year']
};

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Detect column mappings based on header names
 */
function autoDetectMapping(headers) {
  const mapping = {
    name: null,
    email: null,
    college: null,
    phone: null,
    branch: null,
    batch: null
  };

  headers.forEach(header => {
    const clean = header.trim().toLowerCase();
    for (const [field, synonymList] of Object.entries(SYNONYMS)) {
      if (!mapping[field] && synonymList.includes(clean)) {
        mapping[field] = header;
      }
    }
  });

  // Second pass: partial match
  headers.forEach(header => {
    const clean = header.trim().toLowerCase();
    for (const [field, synonymList] of Object.entries(SYNONYMS)) {
      if (!mapping[field] && synonymList.some(s => clean.includes(s))) {
        mapping[field] = header;
      }
    }
  });

  return mapping;
}

/**
 * Parse Excel or CSV buffer
 */
function parseFileBuffer(buffer) {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('The uploaded spreadsheet has no sheets.');
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawRows = xlsx.utils.sheet_to_json(worksheet, { defval: '', raw: false });

  if (rawRows.length === 0) {
    throw new Error('The uploaded spreadsheet contains no data rows.');
  }

  const headers = Object.keys(rawRows[0]);
  const detectedMapping = autoDetectMapping(headers);

  return {
    headers,
    detectedMapping,
    rawRows
  };
}

/**
 * Validate and normalize rows according to column mapping
 */
function validateAndNormalizeRows(rawRows, mapping) {
  const validatedRows = [];
  let validCount = 0;
  let invalidCount = 0;

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2; // Accounting for 1-based index + header row
    const errors = [];

    const name = String(row[mapping.name] || '').trim();
    const email = String(row[mapping.email] || '').trim().toLowerCase();
    const college = String(row[mapping.college] || '').trim();
    const phone = String(row[mapping.phone] || '').trim();
    const branch = String(row[mapping.branch] || 'Computer Science').trim();
    const batch = String(row[mapping.batch] || '2026').trim();

    if (!name) {
      errors.push('Missing Student Name');
    }
    if (!email) {
      errors.push('Missing Email Address');
    } else if (!EMAIL_REGEX.test(email)) {
      errors.push(`Invalid email format ("${email}")`);
    }

    const isValid = errors.length === 0;
    if (isValid) {
      validCount++;
    } else {
      invalidCount++;
    }

    validatedRows.push({
      rowNumber,
      isValid,
      errors,
      raw: row,
      normalized: {
        name: name || 'N/A',
        email,
        college: college || 'General Pool',
        phone: phone || '',
        branch: branch || 'Computer Science',
        batch: batch || '2026',
        status: 'Active',
        tags: JSON.stringify([branch || 'B.Tech', batch || '2026'])
      }
    });
  });

  return {
    totalRows: rawRows.length,
    validCount,
    invalidCount,
    rows: validatedRows
  };
}

/**
 * Generate sample CSV template
 */
function generateSampleData() {
  return [
    {
      'Student Name': 'Rahul Sharma',
      'Email ID': 'rahul.sharma@iitb.ac.in',
      'College Name': 'IIT Bombay',
      'Phone Number': '+91 9876543210',
      'Branch / Degree': 'Computer Science & Engineering',
      'Graduation Year': '2026'
    },
    {
      'Student Name': 'Pooja Patel',
      'Email ID': 'pooja.patel@vjti.ac.in',
      'College Name': 'VJTI Mumbai',
      'Phone Number': '+91 9876543211',
      'Branch / Degree': 'Information Technology',
      'Graduation Year': '2026'
    },
    {
      'Student Name': 'Aditya Kulkarni',
      'Email ID': 'aditya.k@coep.ac.in',
      'College Name': 'COEP Tech Pune',
      'Phone Number': '+91 9876543212',
      'Branch / Degree': 'Computer Engineering',
      'Graduation Year': '2025'
    },
    {
      'Student Name': 'Ananya Deshmukh',
      'Email ID': 'ananya.d@mitwpu.edu.in',
      'College Name': 'MIT-WPU Pune',
      'Phone Number': '+91 9876543213',
      'Branch / Degree': 'AI & Data Science',
      'Graduation Year': '2026'
    },
    {
      'Student Name': 'Rohan Shinde',
      'Email ID': 'rohan.shinde@vpkbiet.org',
      'College Name': 'VPKBIET Baramati',
      'Phone Number': '+91 9876543214',
      'Branch / Degree': 'Electronics & Telecommunication',
      'Graduation Year': '2026'
    }
  ];
}

module.exports = {
  parseFileBuffer,
  autoDetectMapping,
  validateAndNormalizeRows,
  generateSampleData
};
