import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { FileScanner } from '../utils/fileScanner';
import { SkillMetadata, SkillContent, SkillFrontmatter } from '../types/skill';
import { createLogger, LogLevel } from '../utils/logger';

export class SkillLoader {
  private fileScanner: FileScanner;
  private logger = createLogger('SkillLoader', LogLevel.INFO);
  private skillMetadataCache: Map<string, SkillMetadata> = new Map();

  constructor(domainsPath: string = './domains') {
    this.fileScanner = new FileScanner(domainsPath);
  }

  /**
   * 加载所有 Skill 的元数据（渐进式加载的第一阶段）
   * 仅返回 name 和 description
   */
  loadAllSkillMetadata(): SkillMetadata[] {
    this.logger.info('Loading skill metadata...');
    
    const skillFiles = this.fileScanner.scanSkillFiles();
    const metadataList: SkillMetadata[] = [];

    for (const skillFile of skillFiles) {
      try {
        const content = fs.readFileSync(skillFile.fullPath, 'utf-8');
        const { data } = matter(content);
        const frontmatter = data as SkillFrontmatter;

        if (!frontmatter.name || !frontmatter.description) {
          this.logger.warn(`Skill missing name or description: ${skillFile.fullPath}`);
          continue;
        }

        const skillId = this.generateSkillId(skillFile.skillPath);
        const metadata: SkillMetadata = {
          id: skillId,
          name: frontmatter.name,
          description: frontmatter.description,
          skillPath: skillFile.skillPath,
          type: 'skill'
        };

        metadataList.push(metadata);
        this.skillMetadataCache.set(skillId, metadata);
      } catch (error) {
        this.logger.error(`Error loading skill metadata: ${skillFile.fullPath}`, error);
      }
    }

    this.logger.info(`Loaded ${metadataList.length} skill metadata`);
    return metadataList;
  }

  /**
   * 按需加载完整的 Skill 内容（渐进式加载的第二阶段）
   * 仅在需要执行时才读取完整内容
   */
  loadSkillContent(skillId: string): SkillContent | null {
    this.logger.debug(`Loading skill content: ${skillId}`);

    const metadata = this.skillMetadataCache.get(skillId);
    if (!metadata) {
      this.logger.error(`Skill metadata not found: ${skillId}`);
      return null;
    }

    try {
      const fullPath = path.join(
        this.fileScanner['domainsPath'],
        metadata.skillPath,
        'SKILL.md'
      );

      const fileContent = fs.readFileSync(fullPath, 'utf-8');
      const { data, content } = matter(fileContent);

      const additionalFiles = this.fileScanner.scanSkillAdditionalFiles(fullPath);

      const skillContent: SkillContent = {
        metadata,
        frontmatter: data,
        content,
        references: additionalFiles.references,
        scripts: additionalFiles.scripts,
        assets: additionalFiles.assets,
      };

      this.logger.debug(`Loaded skill content: ${skillId}`);
      return skillContent;
    } catch (error) {
      this.logger.error(`Error loading skill content: ${skillId}`, error);
      return null;
    }
  }

  /**
   * 生成唯一的 Skill ID
   */
  private generateSkillId(skillPath: string): string {
    const normalizedPath = skillPath.replace(/\\/g, '/');
    return normalizedPath;
  }

  /**
   * 刷新所有 Skill 元数据
   */
  refreshMetadata(): SkillMetadata[] {
    this.logger.info('Refreshing skill metadata...');
    this.skillMetadataCache.clear();
    return this.loadAllSkillMetadata();
  }

  /**
   * 获取缓存的 Skill 元数据
   */
  getSkillMetadata(skillId: string): SkillMetadata | undefined {
    return this.skillMetadataCache.get(skillId);
  }

  /**
   * 获取所有缓存的 Skill 元数据
   */
  getAllCachedMetadata(): SkillMetadata[] {
    return Array.from(this.skillMetadataCache.values());
  }
}
