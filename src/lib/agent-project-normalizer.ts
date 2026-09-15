import type { Locale } from "@/lib/i18n";
import {
  asRecord,
  asString,
  asStringArray,
  localizedString,
  localizedStringArray,
} from "@/lib/localized-json";

export type AgentProject = {
  id: string;
  creatorName: string;
  accountType?: string;
  authorNote?: string;
  avatarUrl?: string;
  githubUrl: string;
  aliases?: string[];
  projectName: string;
  createdAt?: string;
  updatedAt?: string;
  primaryLanguage?: string;
  license?: string;
  stars: number;
  projectType?: string;
  introduction?: string;
  agentLoop?: string;
  searchCapabilities?: string[];
  primaryCapabilities?: string[];
  knownLimitations?: string[];
  relatedProjects?: string[];
  sources?: string[];
  classification?: string;
  classificationBasis?: string;
  userFeedback?: string[];
  supportedPlatforms?: string;
};

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeProject(value: unknown, index: number, locale: Locale): AgentProject {
  const item = asRecord(value);
  const creatorName = asString(item["创建用户名"]) ?? "—";
  const projectName = asString(item["项目名称"]) ?? "—";
  const githubUrl = asString(item["GitHub地址"]) ?? "";

  return {
    id: githubUrl || `${creatorName}/${projectName}/${index}`,
    creatorName,
    accountType: localizedString(item["账号类型"], locale, "账号类型"),
    authorNote: localizedString(item["作者备注"], locale, "作者备注"),
    avatarUrl: asString(item["用户头像"]),
    githubUrl,
    aliases: asStringArray(item["曾用名或别名地址"]),
    projectName,
    createdAt: asString(item["创建时间"]),
    updatedAt: asString(item["最后更新时间"]),
    primaryLanguage: asString(item["主要语言"]),
    license: asString(item["许可证"]),
    stars: asNumber(item.Stars),
    projectType: localizedString(item["项目类型"], locale, "项目类型"),
    introduction: localizedString(item["介绍"], locale, "介绍"),
    agentLoop: localizedString(item["Agent循环判断"], locale, "Agent循环判断"),
    searchCapabilities: localizedStringArray(item["搜索能力"], locale, "搜索能力"),
    primaryCapabilities: localizedStringArray(item["主要能力"], locale, "主要能力"),
    knownLimitations: localizedStringArray(item["已知限制"], locale, "已知限制"),
    relatedProjects: asStringArray(item["关联项目"]),
    sources: localizedStringArray(item["信息来源"], locale, "信息来源"),
    classification: localizedString(item["分类结论"], locale, "分类结论"),
    classificationBasis: localizedString(item["分类依据"], locale, "分类依据"),
    userFeedback: localizedStringArray(item["用户反馈"], locale, "用户反馈"),
    supportedPlatforms: localizedString(item["支持平台"], locale, "支持平台"),
  };
}

export function normalizeAgentProjects(value: unknown, locale: Locale): AgentProject[] {
  if (!Array.isArray(value)) {
    throw new Error("agent.json 的顶层结构必须是数组");
  }

  return value.map((item, index) => normalizeProject(item, index, locale));
}
