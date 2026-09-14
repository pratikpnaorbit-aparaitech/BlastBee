const http = require('http');

async function testEndpoints() {
  const app = require('../server');
  
  const server = app.listen(0, async () => {
    const port = server.address().port;
    console.log('🚀 Test server running on port:', port);

    try {
      // 1. Test POST /api/campaigns/spam-check
      const res = await fetch(`http://localhost:${port}/api/campaigns/spam-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: 'WIN CASH ₹50,000 NOW!!!',
          body_html: '<p>Urgent limited time claim at https://forms.gle/xyz</p>',
          apply_link: 'https://forms.gle/xyz'
        })
      });
      const data = await res.json();
      console.log('1. POST /api/campaigns/spam-check:');
      console.log('   Status:', data.status, '| Score:', data.score, '| Issues found:', data.issues.length);
      if (data.score > 50) throw new Error('Spam check should have returned low score for bad input');

      // 2. Test GET /api/campaigns/dns-check
      const dnsRes = await fetch(`http://localhost:${port}/api/campaigns/dns-check?domain=google.com`);
      const dnsData = await dnsRes.json();
      console.log('2. GET /api/campaigns/dns-check:');
      console.log('   Domain:', dnsData.domain, '| Health:', dnsData.overallStatus, '| SPF status:', dnsData.spf.status);
      if (!dnsData.success) throw new Error('DNS check should return success: true');

      console.log('\n✅ All Anti-Spam REST API endpoints verified successfully!');
      server.close();
    } catch (err) {
      console.error('❌ API Test Failed:', err);
      server.close();
    }
  });
}

testEndpoints();
