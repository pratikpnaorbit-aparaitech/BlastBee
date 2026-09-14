const { getDb } = require('./db');
const { SAMPLE_TEMPLATES } = require('../services/sampleTemplates');

function seedDatabase() {
  const db = getDb();
  console.log('🌱 Seeding Aparaitech Email Blast Database...');

  // 1. Seed Sample Placement Templates
  const findTemplate = db.prepare('SELECT id FROM templates WHERE name = ?');
  const insertTemplate = db.prepare(`
    INSERT INTO templates (name, category, subject, body_html, tags_used)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertTemplatesTx = db.transaction(() => {
    let seeded = 0;
    SAMPLE_TEMPLATES.forEach(t => {
      const exists = findTemplate.get(t.name);
      if (!exists) {
        insertTemplate.run(t.name, t.category, t.subject, t.body_html, JSON.stringify(t.tags_used));
        seeded++;
      }
    });
    if (seeded > 0) console.log(`✅ Seeded ${seeded} recruitment email templates.`);
  });
  insertTemplatesTx();

  // 2. Seed 50+ Realistic Students from diverse colleges
  const students = [
    { name: 'Rahul Sharma', email: 'rahul.sharma@iitb.ac.in', college: 'IIT Bombay', phone: '+91 9820123456', branch: 'Computer Science & Engineering', batch: '2026', tags: '["IIT", "B.Tech", "Shortlisted"]' },
    { name: 'Pooja Patel', email: 'pooja.patel@vjti.ac.in', college: 'VJTI Mumbai', phone: '+91 9820123457', branch: 'Information Technology', batch: '2026', tags: '["VJTI", "B.Tech", "Top 5%"]' },
    { name: 'Aditya Kulkarni', email: 'aditya.k@coep.ac.in', college: 'COEP Tech Pune', phone: '+91 9820123458', branch: 'Computer Engineering', batch: '2025', tags: '["COEP", "B.Tech"]' },
    { name: 'Ananya Deshmukh', email: 'ananya.d@mitwpu.edu.in', college: 'MIT-WPU Pune', phone: '+91 9820123459', branch: 'AI & Data Science', batch: '2026', tags: '["AI Track", "Python"]' },
    { name: 'Rohan Shinde', email: 'rohan.shinde@vpkbiet.org', college: 'VPKBIET Baramati', phone: '+91 9820123460', branch: 'Computer Engineering', batch: '2026', tags: '["Baramati Campus", "Fullstack"]' },
    { name: 'Sneha Jadhav', email: 'sneha.jadhav@vpkbiet.org', college: 'VPKBIET Baramati', phone: '+91 9820123461', branch: 'Information Technology', batch: '2026', tags: '["Baramati Campus", "React"]' },
    { name: 'Vikram Joshi', email: 'vikram.joshi@pict.edu', college: 'PICT Pune', phone: '+91 9820123462', branch: 'Computer Engineering', batch: '2026', tags: '["PICT", "Competitive Coder"]' },
    { name: 'Priya Iyer', email: 'priya.iyer@bits-pilani.ac.in', college: 'BITS Pilani', phone: '+91 9820123463', branch: 'Computer Science', batch: '2026', tags: '["BITS", "Machine Learning"]' },
    { name: 'Siddharth Nair', email: 'siddharth.nair@iitd.ac.in', college: 'IIT Delhi', phone: '+91 9820123464', branch: 'Electrical Engineering', batch: '2025', tags: '["IIT", "Cloud Architect"]' },
    { name: 'Neha Verma', email: 'neha.verma@dtu.ac.in', college: 'DTU Delhi', phone: '+91 9820123465', branch: 'Information Technology', batch: '2026', tags: '["DTU", "Node.js"]' },
    { name: 'Kunal Shah', email: 'kunal.shah@spit.ac.in', college: 'SPIT Mumbai', phone: '+91 9820123466', branch: 'Computer Engineering', batch: '2026', tags: '["SPIT", "Cybersecurity"]' },
    { name: 'Tanvi Gaikwad', email: 'tanvi.g@coep.ac.in', college: 'COEP Tech Pune', phone: '+91 9820123467', branch: 'Data Science', batch: '2026', tags: '["COEP", "Data Science"]' },
    { name: 'Manish Kumar', email: 'manish.k@vit.ac.in', college: 'VIT Vellore', phone: '+91 9820123468', branch: 'Computer Science', batch: '2025', tags: '["VIT", "Java"]' },
    { name: 'Swati Rane', email: 'swati.rane@vpkbiet.org', college: 'VPKBIET Baramati', phone: '+91 9820123469', branch: 'AI & Data Science', batch: '2026', tags: '["Baramati Campus", "GenAI"]' },
    { name: 'Arjun Rao', email: 'arjun.rao@rvce.edu.in', college: 'RVCE Bengaluru', phone: '+91 9820123470', branch: 'Computer Science', batch: '2026', tags: '["RVCE", "Bengaluru Pool"]' },
    { name: 'Divya Menon', email: 'divya.menon@pes.edu', college: 'PES University Bengaluru', phone: '+91 9820123471', branch: 'Computer Science & AI', batch: '2026', tags: '["PES", "Bengaluru Pool"]' },
    { name: 'Gaurav Patil', email: 'gaurav.p@pccoepune.org', college: 'PCCOE Pune', phone: '+91 9820123472', branch: 'Computer Engineering', batch: '2026', tags: '["PCCOE", "Web Development"]' },
    { name: 'Meera Chawla', email: 'meera.c@iiitb.ac.in', college: 'IIIT Bangalore', phone: '+91 9820123473', branch: 'M.Tech CSE', batch: '2025', tags: '["IIIT", "M.Tech", "Systems"]' },
    { name: 'Akash Sawant', email: 'akash.sawant@vpkbiet.org', college: 'VPKBIET Baramati', phone: '+91 9820123474', branch: 'Computer Engineering', batch: '2026', tags: '["Baramati Campus", "DevOps"]' },
    { name: 'Aishwarya Pawar', email: 'aishwarya.p@vjti.ac.in', college: 'VJTI Mumbai', phone: '+91 9820123475', branch: 'Computer Science', batch: '2026', tags: '["VJTI", "Algorithms"]' },
    { name: 'Varun Reddy', email: 'varun.reddy@iitm.ac.in', college: 'IIT Madras', phone: '+91 9820123476', branch: 'Computer Science', batch: '2026', tags: '["IIT", "High CGPA"]' },
    { name: 'Shruti Kadam', email: 'shruti.kadam@mitwpu.edu.in', college: 'MIT-WPU Pune', phone: '+91 9820123477', branch: 'Computer Science', batch: '2026', tags: '["MIT-WPU"]' },
    { name: 'Abhishek Pandey', email: 'abhishek.p@srmist.edu.in', college: 'SRM Chennai', phone: '+91 9820123478', branch: 'Software Engineering', batch: '2025', tags: '["SRM", "Backend"]' },
    { name: 'Kavita Hegde', email: 'kavita.h@bmsce.ac.in', college: 'BMSCE Bengaluru', phone: '+91 9820123479', branch: 'Information Science', batch: '2026', tags: '["BMSCE", "Bengaluru"]' },
    { name: 'Nikhil More', email: 'nikhil.more@vpkbiet.org', college: 'VPKBIET Baramati', phone: '+91 9820123480', branch: 'Civil / IT Bridge', batch: '2026', tags: '["Baramati Campus"]' },
    { name: 'Ritika Gupta', email: 'ritika.g@thapar.edu', college: 'Thapar University', phone: '+91 9820123481', branch: 'Computer Science', batch: '2026', tags: '["Thapar"]' },
    { name: 'Karthik Raja', email: 'karthik.r@nitt.edu', college: 'NIT Trichy', phone: '+91 9820123482', branch: 'Computer Science', batch: '2026', tags: '["NIT", "DSA"]' },
    { name: 'Pallavi Bhosale', email: 'pallavi.b@coep.ac.in', college: 'COEP Tech Pune', phone: '+91 9820123483', branch: 'Computer Engineering', batch: '2026', tags: '["COEP"]' },
    { name: 'Sameer Khan', email: 'sameer.k@amity.edu', college: 'Amity University', phone: '+91 9820123484', branch: 'B.Tech IT', batch: '2025', tags: '["Amity"]' },
    { name: 'Pranali Mane', email: 'pranali.m@vpkbiet.org', college: 'VPKBIET Baramati', phone: '+91 9820123485', branch: 'Computer Engineering', batch: '2026', tags: '["Baramati Campus", "Frontend"]' },
    { name: 'Tushar Agarwal', email: 'tushar.a@vit.ac.in', college: 'VIT Vellore', phone: '+91 9820123486', branch: 'Information Security', batch: '2026', tags: '["VIT"]' },
    { name: 'Rashmi Deshpande', email: 'rashmi.d@pict.edu', college: 'PICT Pune', phone: '+91 9820123487', branch: 'Information Technology', batch: '2026', tags: '["PICT"]' },
    { name: 'Yashwardhan Singh', email: 'yash.singh@manipal.edu', college: 'Manipal Tech Institute', phone: '+91 9820123488', branch: 'Computer Science', batch: '2026', tags: '["Manipal"]' },
    { name: 'Deepika Soni', email: 'deepika.s@msrit.edu', college: 'MSRIT Bengaluru', phone: '+91 9820123489', branch: 'Computer Science', batch: '2026', tags: '["MSRIT", "Bengaluru"]' },
    { name: 'Omkar Gholap', email: 'omkar.g@vpkbiet.org', college: 'VPKBIET Baramati', phone: '+91 9820123490', branch: 'Computer Engineering', batch: '2026', tags: '["Baramati Campus"]' },
    { name: 'Simran Walia', email: 'simran.w@dtu.ac.in', college: 'DTU Delhi', phone: '+91 9820123491', branch: 'Computer Engineering', batch: '2026', tags: '["DTU"]' },
    { name: 'Tejas Salunkhe', email: 'tejas.s@vjti.ac.in', college: 'VJTI Mumbai', phone: '+91 9820123492', branch: 'Electrical & CS', batch: '2026', tags: '["VJTI"]' },
    { name: 'Bhavna Murthy', email: 'bhavna.m@nitk.edu.in', college: 'NIT Surathkal', phone: '+91 9820123493', branch: 'Information Technology', batch: '2026', tags: '["NIT"]' },
    { name: 'Chaitanya Joshi', email: 'chaitanya.j@coep.ac.in', college: 'COEP Tech Pune', phone: '+91 9820123494', branch: 'Computer Engineering', batch: '2026', tags: '["COEP"]' },
    { name: 'Payal Jagtap', email: 'payal.jagtap@vpkbiet.org', college: 'VPKBIET Baramati', phone: '+91 9820123495', branch: 'Computer Engineering', batch: '2026', tags: '["Baramati Campus"]' }
  ];

  const findStudent = db.prepare('SELECT id FROM students WHERE email = ?');
  const insertStudent = db.prepare(`
    INSERT INTO students (name, email, college, phone, branch, batch, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertStudentsTx = db.transaction(() => {
    let seededStudents = 0;
    students.forEach(s => {
      const exists = findStudent.get(s.email);
      if (!exists) {
        insertStudent.run(s.name, s.email, s.college, s.phone, s.branch, s.batch, s.tags);
        seededStudents++;
      }
    });
    if (seededStudents > 0) console.log(`✅ Seeded ${seededStudents} diverse college students into database.`);
  });
  insertStudentsTx();

  // 3. Create a sample initial past campaign with delivery stats
  const checkCampaigns = db.prepare('SELECT count(*) as count FROM campaigns').get();
  if (checkCampaigns.count === 0) {
    const sampleStudents = db.prepare('SELECT * FROM students LIMIT 15').all();
    const campStmt = db.prepare(`
      INSERT INTO campaigns (title, subject, body_html, target_type, total_recipients, sent_count, success_count, failed_count, status, speed_eps, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', 3.8, datetime('now', '-2 days'), datetime('now', '-2 days', '+15 seconds'))
    `);

    const sampleCamp = campStmt.run(
      'Aparaitech Early Career Outreach - Maharashtra & Karnataka Tier-1 Colleges',
      'Campus Placement & Career Opportunity at Aparaitech Software for {Name}',
      SAMPLE_TEMPLATES[0].body_html,
      'all',
      sampleStudents.length,
      sampleStudents.length,
      sampleStudents.length - 1,
      1
    );

    const campId = sampleCamp.lastInsertRowid;
    const recipStmt = db.prepare(`
      INSERT INTO campaign_recipients (campaign_id, student_id, recipient_name, recipient_email, recipient_college, recipient_phone, status, latency_ms, error_message, sent_at, attempts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 days'), 1)
    `);

    sampleStudents.forEach((student, index) => {
      const isFailed = (index === 4); // Fail one for demonstration
      const status = isFailed ? 'failed' : 'sent';
      const errorMsg = isFailed ? '550 5.1.1 Mailbox storage quota exceeded' : '';
      const latency = Math.floor(Math.random() * 80) + 110;

      recipStmt.run(campId, student.id, student.name, student.email, student.college, student.phone, status, latency, errorMsg);

    });

    console.log(`✅ Seeded sample past campaign with ${sampleStudents.length} recipients.`);
  }

  console.log('✨ Database seeding successfully finished!');
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
