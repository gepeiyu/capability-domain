export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  skillPath: string;
  type: 'skill';
}

export interface SkillContent {
  metadata: SkillMetadata;
  frontmatter: Record<string, any>;
  content: string;
  references?: string[];
  scripts?: string[];
  assets?: string[];
}

export interface SkillFrontmatter {
  name: string;
  description: string;
  [key: string]: any;
}
