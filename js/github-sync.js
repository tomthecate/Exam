/**
 * GitHub API Synchronization Module
 * Allows committing new question papers directly to a GitHub repository from the browser.
 */
class GitHubSync {
  constructor() {
    this.owner = localStorage.getItem('gate_gh_owner') || '';
    this.repo = localStorage.getItem('gate_gh_repo') || '';
    this.token = localStorage.getItem('gate_gh_token') || '';
    this.branch = localStorage.getItem('gate_gh_branch') || 'main';
  }

  saveConfig(owner, repo, token, branch = 'main') {
    this.owner = owner.trim();
    this.repo = repo.trim();
    this.token = token.trim();
    this.branch = branch.trim() || 'main';

    localStorage.setItem('gate_gh_owner', this.owner);
    localStorage.setItem('gate_gh_repo', this.repo);
    localStorage.setItem('gate_gh_token', this.token);
    localStorage.setItem('gate_gh_branch', this.branch);
  }

  isConfigured() {
    return Boolean(this.owner && this.repo && this.token);
  }

  /**
   * Commit and push updated today_paper.json directly to GitHub repository
   * @param {Object} paperData - The JSON paper object
   * @returns {Promise<{success: boolean, message: string, url?: string}>}
   */
  async pushPaperToGitHub(paperData) {
    if (!this.isConfigured()) {
      throw new Error('GitHub configuration missing. Please enter your GitHub Owner, Repo, and Token in Admin Settings.');
    }

    const filePath = 'data/today_paper.json';
    const apiUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${filePath}?ref=${this.branch}`;

    // Step 1: Check if file exists to obtain current sha
    let currentSha = null;
    try {
      const getResp = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (getResp.ok) {
        const fileInfo = await getResp.json();
        currentSha = fileInfo.sha;
      }
    } catch (e) {
      // file might not exist yet
    }

    // Step 2: Encode content in UTF-8 base64
    const jsonString = JSON.stringify(paperData, null, 2);
    // Safe unicode base64 encoding
    const base64Content = btoa(unescape(encodeURIComponent(jsonString)));

    const todayStr = new Date().toISOString().split('T')[0];
    const commitMessage = `Update today's exam paper (${todayStr}) via Admin Portal`;

    const putPayload = {
      message: commitMessage,
      content: base64Content,
      branch: this.branch
    };
    if (currentSha) {
      putPayload.sha = currentSha;
    }

    const putResp = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(putPayload)
    });

    if (!putResp.ok) {
      const errData = await putResp.json().catch(() => ({}));
      throw new Error(errData.message || `GitHub API error (HTTP ${putResp.status})`);
    }

    const result = await putResp.json();
    return {
      success: true,
      message: `Paper committed successfully to GitHub branch "${this.branch}"! GitHub Pages will update shortly.`,
      commitUrl: result.commit ? result.commit.html_url : null
    };
  }

  /**
   * One-click download of today_paper.json for manual upload to GitHub
   */
  downloadTodayPaperJson(paperData) {
    const jsonString = JSON.stringify(paperData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'today_paper.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Load question paper from any GitHub Raw URL or public JSON link
   */
  async fetchFromRawUrl(rawUrl) {
    const resp = await fetch(rawUrl);
    if (!resp.ok) {
      throw new Error(`Failed to fetch from URL: HTTP ${resp.status}`);
    }
    return await resp.json();
  }
}

window.GitHubSync = GitHubSync;
