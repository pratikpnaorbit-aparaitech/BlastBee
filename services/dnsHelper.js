const dns = require('dns');
const net = require('net');

let nodemailerShared;
try {
  nodemailerShared = require('nodemailer/lib/shared');
} catch (e) {
  // Ignore if nodemailer is not available
}

// Configure reliable public DNS servers for Node.js c-ares resolver (Google & Cloudflare DNS)
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  // Ignore if system restricts setting DNS servers
}

/**
 * Pre-populate Nodemailer's internal dnsCache using Windows OS getaddrinfo (dns.lookup).
 * This completely prevents "queryA ETIMEOUT" caused by c-ares UDP socket timeouts on local/ISP DNS.
 * 
 * @param {string} host - Hostname to prime, e.g. 'smtp.gmail.com'
 */
async function primeDns(host) {
  if (!host || net.isIP(host)) return;

  if (nodemailerShared && nodemailerShared.dnsCache && nodemailerShared.dnsCache.has(host)) {
    const cached = nodemailerShared.dnsCache.get(host);
    if (cached && cached.expires > Date.now() + 60000) {
      return;
    }
  }

  try {
    const addresses = await new Promise((resolve, reject) => {
      dns.lookup(host, { all: true }, (err, addrs) => {
        if (err) reject(err);
        else resolve(addrs);
      });
    });

    if (addresses && addresses.length > 0) {
      const ips = addresses.map(a => a.address);
      if (nodemailerShared && nodemailerShared.dnsCache) {
        nodemailerShared.dnsCache.set(host, {
          value: {
            addresses: ips,
            servername: host
          },
          expires: Date.now() + 24 * 60 * 60 * 1000 // Cache for 24 hours
        });
      }
    }
  } catch (err) {
    console.warn(`[DNS] Could not pre-prime DNS for ${host}: ${err.message}`);
  }
}

// Prime default SMTP hosts immediately on startup
primeDns('smtp.gmail.com');
primeDns('smtp.office365.com');

module.exports = {
  primeDns
};
