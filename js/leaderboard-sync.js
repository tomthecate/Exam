/**
 * Serverless Leaderboard and Score Sharing Module
 * Enables multi-user score comparison on static GitHub Pages without requiring a backend server.
 */
class LeaderboardSync {
  constructor() {
    this.storageKey = 'gate_global_leaderboard';
    this.cloudBinId = localStorage.getItem('gate_cloud_bin_id') || '';
    this.cloudApiKey = localStorage.getItem('gate_cloud_api_key') || '';
  }

  saveCloudConfig(binId, apiKey) {
    this.cloudBinId = binId.trim();
    this.cloudApiKey = apiKey.trim();
    localStorage.setItem('gate_cloud_bin_id', this.cloudBinId);
    localStorage.setItem('gate_cloud_api_key', this.cloudApiKey);
  }

  /**
   * Save a local submission record
   */
  saveSubmission(sub) {
    const list = this.getLeaderboard();
    // Replace if same candidate & paperId, or add new
    const idx = list.findIndex(item => item.candidateName.toLowerCase() === sub.candidateName.toLowerCase() && item.paperId === sub.paperId);
    if (idx >= 0) {
      list[idx] = sub;
    } else {
      list.push(sub);
    }
    this.saveLeaderboard(list);

    // Try cloud sync if configured
    if (this.cloudBinId && this.cloudApiKey) {
      this.pushToCloud(list);
    }

    return list;
  }

  getLeaderboard() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) return [];
      const list = JSON.parse(data);
      // Sort by score descending, then accuracy
      list.sort((a, b) => b.score - a.score || b.accuracyPercent - a.accuracyPercent);
      return list;
    } catch (e) {
      return [];
    }
  }

  saveLeaderboard(list) {
    list.sort((a, b) => b.score - a.score || b.accuracyPercent - a.accuracyPercent);
    localStorage.setItem(this.storageKey, JSON.stringify(list));
  }

  /**
   * Generate an encrypted/encoded shareable score string
   */
  generateScoreCode(sub) {
    const payload = [
      sub.candidateName,
      sub.rollNo,
      sub.paperId || 'default',
      sub.score,
      sub.maxScore || 40,
      sub.accuracyPercent,
      sub.correctCount,
      sub.incorrectCount,
      sub.unattemptedCount,
      sub.submittedAt || new Date().toISOString()
    ].join('~');

    return btoa(unescape(encodeURIComponent(payload)));
  }

  /**
   * Generate a clickable URL to send to a friend via WhatsApp or email
   */
  generateShareUrl(sub) {
    const code = this.generateScoreCode(sub);
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?score=${encodeURIComponent(code)}`;
  }

  /**
   * Decode and import a friend's score code
   */
  importScoreCode(code) {
    try {
      const decoded = decodeURIComponent(escape(atob(code.trim())));
      const parts = decoded.split('~');
      if (parts.length < 9) throw new Error('Invalid code format');

      const friendSub = {
        candidateName: parts[0],
        rollNo: parts[1],
        paperId: parts[2],
        score: parseFloat(parts[3]),
        maxScore: parseFloat(parts[4]),
        accuracyPercent: parseFloat(parts[5]),
        correctCount: parseInt(parts[6], 10),
        incorrectCount: parseInt(parts[7], 10),
        unattemptedCount: parseInt(parts[8], 10),
        submittedAt: parts[9] || new Date().toISOString()
      };

      this.saveSubmission(friendSub);
      return { success: true, submission: friendSub };
    } catch (e) {
      return { success: false, error: 'Failed to decode score: ' + e.message };
    }
  }

  /**
   * Automatically import from URL parameters on page load
   */
  checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const scoreParam = params.get('score');
    if (scoreParam) {
      const res = this.importScoreCode(scoreParam);
      if (res.success) {
        // Clean URL without reloading
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        return res.submission;
      }
    }
    return null;
  }

  /**
   * Optional JSONBin cloud sync
   */
  async pushToCloud(list) {
    try {
      await fetch(`https://api.jsonbin.io/v3/b/${this.cloudBinId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': this.cloudApiKey
        },
        body: JSON.stringify(list)
      });
    } catch (e) {
      console.warn('Cloud sync error:', e);
    }
  }

  async fetchFromCloud() {
    if (!this.cloudBinId || !this.cloudApiKey) return this.getLeaderboard();
    try {
      const resp = await fetch(`https://api.jsonbin.io/v3/b/${this.cloudBinId}/latest`, {
        headers: { 'X-Master-Key': this.cloudApiKey }
      });
      if (resp.ok) {
        const data = await resp.json();
        const cloudList = data.record || [];
        this.saveLeaderboard(cloudList);
        return cloudList;
      }
    } catch (e) {
      console.warn('Cloud fetch error:', e);
    }
    return this.getLeaderboard();
  }
}

window.LeaderboardSync = LeaderboardSync;
