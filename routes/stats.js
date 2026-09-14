const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');

const { getPersistentMongoDb } = require('../database/mongo');

// GET /api/stats/dashboard - High-level metrics for dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const { getOptionalAuth } = require('./auth');
    const user = getOptionalAuth(req);

    // If request is from a customer, strictly scope to customer workspace (never show previous/other user data)
    if (user && user.role === 'customer') {
      const db = getDb();
      const customerId = user.id;

      const studentCount = db.prepare('SELECT COUNT(*) as count FROM students WHERE user_id = ? AND status = ?').get(customerId, 'Active').count;
      const distinctColleges = db.prepare("SELECT COUNT(DISTINCT college) as count FROM students WHERE user_id = ? AND college IS NOT NULL AND college != ''").get(customerId).count;

      const collegeAgg = db.prepare(`
        SELECT college, COUNT(*) as student_count
        FROM students
        WHERE user_id = ? AND college IS NOT NULL AND college != ''
        GROUP BY college
        ORDER BY student_count DESC
        LIMIT 8
      `).all(customerId);

      const batchGroups = db.prepare(`
        SELECT batch, COUNT(*) as count
        FROM students
        WHERE user_id = ? AND batch IS NOT NULL AND batch != ''
        GROUP BY batch
        ORDER BY batch DESC
      `).all(customerId);

      const recentCampaigns = db.prepare(`
        SELECT * FROM campaigns WHERE user_id = ? ORDER BY id DESC LIMIT 5
      `).all(customerId);

      const totals = db.prepare(`
        SELECT 
          COUNT(*) as total_campaigns,
          SUM(sent_count) as total_sent,
          SUM(success_count) as total_success,
          SUM(failed_count) as total_failed
        FROM campaigns
        WHERE user_id = ?
      `).get(customerId);

      const totalSent = totals.total_sent || 0;
      const totalSuccess = totals.total_success || 0;
      const totalFailed = totals.total_failed || 0;
      const successRate = totalSent > 0 ? Math.round((totalSuccess / totalSent) * 100) : 100;

      return res.json({
        success: true,
        stats: {
          totalStudents: studentCount,
          totalColleges: distinctColleges,
          totalCampaigns: totals.total_campaigns || 0,
          totalEmailsSent: totalSent,
          totalSuccess: totalSuccess,
          totalFailed: totalFailed,
          successRate,
          collegeDistribution: collegeAgg,
          batchBreakdown: batchGroups,
          recentCampaigns,
          recentDeliveries: []
        }
      });
    }

    if (process.env.MONGODB_URI) {
      try {
        const mongo = await getPersistentMongoDb();
        const [studentCount, collegeAgg, batchGroups, campaignsMongo, deliveriesMongo] = await Promise.all([
          mongo.collection('students').countDocuments({ status: 'Active' }),
          mongo.collection('students').aggregate([
            { $match: { college: { $nin: [null, ''] } } },
            { $group: { _id: '$college', student_count: { $sum: 1 } } },
            { $project: { _id: 0, college: '$_id', student_count: 1 } },
            { $sort: { student_count: -1 } },
            { $limit: 8 }
          ]).toArray(),
          mongo.collection('students').aggregate([
            { $match: { batch: { $nin: [null, ''] } } },
            { $group: { _id: '$batch', count: { $sum: 1 } } },
            { $project: { _id: 0, batch: '$_id', count: 1 } },
            { $sort: { batch: -1 } }
          ]).toArray(),
          mongo.collection('campaigns').find({}).sort({ _id: -1 }).limit(5).toArray(),
          mongo.collection('campaign_recipients').find({ status: { $in: ['sent', 'failed'] } }).sort({ _id: -1 }).limit(8).toArray()
        ]);

        const distinctColleges = await mongo.collection('students').distinct('college', { college: { $nin: [null, ''] } });

        let totalSent = 0;
        let totalSuccess = 0;
        let totalFailed = 0;
        campaignsMongo.forEach(c => {
          totalSent += (c.sent_count || 0);
          totalSuccess += (c.success_count || 0);
          totalFailed += (c.failed_count || 0);
        });

        const overallSuccessRate = totalSent > 0
          ? Math.round((totalSuccess / totalSent) * 100)
          : 100;

        return res.json({
          success: true,
          stats: {
            totalStudents: studentCount,
            totalColleges: distinctColleges.length,
            totalCampaigns: campaignsMongo.length,
            totalEmailsSent: totalSent,
            totalSuccess: totalSuccess,
            totalFailed: totalFailed,
            successRate: overallSuccessRate,
            collegeDistribution: collegeAgg,
            batchBreakdown: batchGroups,
            recentCampaigns: campaignsMongo.map(c => ({ ...c, id: c.sqlite_id || String(c._id) })),
            recentDeliveries: deliveriesMongo.map(r => ({ ...r, id: r.sqlite_id || String(r._id) }))
          }
        });
      } catch (mongoErr) {
        console.warn('MongoDB stats fallback to SQLite:', mongoErr.message);
      }
    }

    const db = getDb();

    // 1. Total active students
    const studentCount = db.prepare("SELECT COUNT(*) as count FROM students WHERE status = 'Active'").get().count;

    // 2. Total colleges
    const collegeCount = db.prepare('SELECT COUNT(DISTINCT college) as count FROM students').get().count;

    // 3. Campaign summary
    const campaignStats = db.prepare(`
      SELECT 
        COUNT(*) as total_campaigns,
        COALESCE(SUM(total_recipients), 0) as total_targeted,
        COALESCE(SUM(sent_count), 0) as total_sent,
        COALESCE(SUM(success_count), 0) as total_success,
        COALESCE(SUM(failed_count), 0) as total_failed
      FROM campaigns
    `).get();

    const overallSuccessRate = campaignStats.total_sent > 0
      ? Math.round((campaignStats.total_success / campaignStats.total_sent) * 100)
      : 100;

    // 4. College distribution (Top 8)
    const collegeDistribution = db.prepare(`
      SELECT college, COUNT(*) as student_count
      FROM students
      GROUP BY college
      ORDER BY student_count DESC
      LIMIT 8
    `).all();

    // 5. Batch breakdown
    const batchBreakdown = db.prepare(`
      SELECT batch, COUNT(*) as count
      FROM students
      WHERE batch IS NOT NULL AND batch != ''
      GROUP BY batch
      ORDER BY batch DESC
    `).all();

    // 6. Recent campaigns (Last 5)
    const recentCampaigns = db.prepare(`
      SELECT id, title, subject, total_recipients, sent_count, success_count, failed_count, status, started_at, completed_at, created_at
      FROM campaigns
      ORDER BY id DESC
      LIMIT 5
    `).all();

    // 7. Recent delivery logs (Last 8)
    const recentDeliveries = db.prepare(`
      SELECT cr.*, c.title as campaign_title
      FROM campaign_recipients cr
      LEFT JOIN campaigns c ON cr.campaign_id = c.id
      WHERE cr.status IN ('sent', 'failed')
      ORDER BY cr.id DESC
      LIMIT 8
    `).all();

    res.json({
      success: true,
      stats: {
        totalStudents: studentCount,
        totalColleges: collegeCount,
        totalCampaigns: campaignStats.total_campaigns,
        totalEmailsSent: campaignStats.total_sent,
        totalSuccess: campaignStats.total_success,
        totalFailed: campaignStats.total_failed,
        successRate: overallSuccessRate,
        collegeDistribution,
        batchBreakdown,
        recentCampaigns,
        recentDeliveries
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
