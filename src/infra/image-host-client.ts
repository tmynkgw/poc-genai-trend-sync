import { Octokit } from '@octokit/rest';
import { InfraError } from '../domain/errors.js';

export class ImageHostClient {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private branch = 'generated-images';

  constructor(token: string, repository: string) {
    this.octokit = new Octokit({ auth: token });
    const [owner, repo] = repository.split('/');
    if (!owner || !repo) {
      throw new Error(`Invalid GITHUB_REPOSITORY format: ${repository}`);
    }
    this.owner = owner;
    this.repo = repo;
  }

  async uploadImage(
    articleId: string,
    imageData: Buffer,
    mimeType: 'image/png' | 'image/jpeg',
  ): Promise<string> {
    const ext = mimeType === 'image/png' ? 'png' : 'jpg';
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const path = `${year}/${month}/${articleId}.${ext}`;

    try {
      await this.ensureBranchExists();

      let sha: string | undefined;
      try {
        const existing = await this.octokit.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path,
          ref: this.branch,
        });
        if (!Array.isArray(existing.data) && 'sha' in existing.data) {
          sha = existing.data.sha;
        }
      } catch {
        // ファイルが存在しない場合は無視
      }

      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path,
        message: `chore: add generated image ${articleId}`,
        content: imageData.toString('base64'),
        branch: this.branch,
        sha,
      });

      return `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${this.branch}/${path}`;
    } catch (err) {
      if (err instanceof InfraError) throw err;
      throw new InfraError(`Failed to upload image to GitHub: ${String(err)}`, err);
    }
  }

  private async ensureBranchExists(): Promise<void> {
    try {
      await this.octokit.repos.getBranch({
        owner: this.owner,
        repo: this.repo,
        branch: this.branch,
      });
    } catch {
      // ブランチが存在しない場合は作成
      const { data: ref } = await this.octokit.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: 'heads/main',
      });
      await this.octokit.git.createRef({
        owner: this.owner,
        repo: this.repo,
        ref: `refs/heads/${this.branch}`,
        sha: ref.object.sha,
      });
    }
  }
}
