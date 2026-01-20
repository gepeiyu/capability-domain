import * as fs from 'fs';
import * as path from 'path';

export interface FileScanResult {
  skillPath: string;
  fullPath: string;
}

export interface McpConfigResult {
  configPath: string;
  fullPath: string;
}

export class FileScanner {
  private domainsPath: string;

  constructor(domainsPath: string = './domains') {
    this.domainsPath = path.resolve(domainsPath);
  }

  /**
   * 扫描所有 SKILL.md 文件
   */
  scanSkillFiles(): FileScanResult[] {
    const results: FileScanResult[] = [];
    
    if (!fs.existsSync(this.domainsPath)) {
      return results;
    }

    const skillsPath = path.join(this.domainsPath, 'skills');
    
    if (!fs.existsSync(skillsPath)) {
      return results;
    }

    const skillFolders = fs.readdirSync(skillsPath, { withFileTypes: true })
      .filter((dirent: fs.Dirent) => dirent.isDirectory())
      .map((dirent: fs.Dirent) => dirent.name);

    for (const skillFolder of skillFolders) {
      const skillPath = path.join(skillsPath, skillFolder);
      const skillFile = path.join(skillPath, 'SKILL.md');
      
      if (fs.existsSync(skillFile)) {
        results.push({
          skillPath: path.join('skills', skillFolder),
          fullPath: skillFile
        });
      }
    }

    return results;
  }

  /**
   * 扫描所有 MCP 配置文件
   */
  scanMcpConfigs(): McpConfigResult[] {
    const results: McpConfigResult[] = [];
    
    if (!fs.existsSync(this.domainsPath)) {
      return results;
    }

    const mcpsPath = path.join(this.domainsPath, 'mcps');
    
    if (!fs.existsSync(mcpsPath)) {
      return results;
    }

    const configFiles = fs.readdirSync(mcpsPath, { withFileTypes: true })
      .filter((dirent: fs.Dirent) => dirent.isFile() && dirent.name.endsWith('.json'))
      .map((dirent: fs.Dirent) => dirent.name);

    for (const configFile of configFiles) {
      const configPath = path.join(mcpsPath, configFile);
      results.push({
        configPath: path.join('mcps', configFile),
        fullPath: configPath
      });
    }

    return results;
  }

  /**
   * 检查技能是否有额外的 references、scripts 或 assets 目录
   */
  scanSkillAdditionalFiles(skillPath: string): { references?: string[]; scripts?: string[]; assets?: string[] } {
    const result: { references?: string[]; scripts?: string[]; assets?: string[] } = {};
    
    const skillDir = path.dirname(skillPath);
    
    // 检查 references 目录
    const referencesPath = path.join(skillDir, 'references');
    if (fs.existsSync(referencesPath) && fs.statSync(referencesPath).isDirectory()) {
      const referenceFiles = fs.readdirSync(referencesPath)
        .filter((file: string) => file.endsWith('.md') || file.endsWith('.txt'))
        .map((file: string) => path.join(referencesPath, file));
      result.references = referenceFiles;
    }

    // 检查 scripts 目录
    const scriptsPath = path.join(skillDir, 'scripts');
    if (fs.existsSync(scriptsPath) && fs.statSync(scriptsPath).isDirectory()) {
      const scriptFiles = fs.readdirSync(scriptsPath)
        .map((file: string) => path.join(scriptsPath, file));
      result.scripts = scriptFiles;
    }

    // 检查 assets 目录
    const assetsPath = path.join(skillDir, 'assets');
    if (fs.existsSync(assetsPath) && fs.statSync(assetsPath).isDirectory()) {
      const assetFiles = fs.readdirSync(assetsPath)
        .map((file: string) => path.join(assetsPath, file));
      result.assets = assetFiles;
    }

    return result;
  }
}
