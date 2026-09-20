import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Locale } from "@/lib/i18n";
import { asRecord, asString, localizedString } from "@/lib/localized-json";

export const repositoryCategories = ["package", "inference", "training"] as const;

export type RepositoryCategory = (typeof repositoryCategories)[number];

export type EcosystemProject = {
  repositoryUrl: string;
  owner: string;
  name: string;
  category: RepositoryCategory;
  summary: string;
  lastUpdated: string;
  stars: number;
  watchers: number;
  forks: number;
  language?: string;
  license?: string;
  sourcePage: number;
};

export type RepositoryReviewSummary = {
  totalSearchResults: number;
  pagesReviewed: number;
  includedCount: number;
  excludedCount: number;
};

function asNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number`);
  }
  return value;
}

function asCategory(value: unknown): RepositoryCategory {
  if (
    typeof value !== "string" ||
    !repositoryCategories.includes(value as RepositoryCategory)
  ) {
    throw new Error("category must be package, inference, or training");
  }
  return value as RepositoryCategory;
}

function requiredString(value: unknown, field: string): string {
  const result = asString(value);
  if (!result) throw new Error(`${field} must be a non-empty string`);
  return result;
}

export async function readEcosystemProjects(
  locale: Locale
): Promise<EcosystemProject[]> {
  const filePath = path.join(process.cwd(), "rwkv_projects.json");
  const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error("rwkv_projects.json must contain an array");
  }

  return parsed.map((value) => {
    const item = asRecord(value);
    return {
      repositoryUrl: requiredString(item.repositoryUrl, "repositoryUrl"),
      owner: requiredString(item.owner, "owner"),
      name: requiredString(item.name, "name"),
      category: asCategory(item.category),
      summary: requiredString(
        localizedString(item.summary, locale, "summary"),
        "summary"
      ),
      lastUpdated: requiredString(item.lastUpdated, "lastUpdated"),
      stars: asNumber(item.stars, "stars"),
      watchers: asNumber(item.watchers, "watchers"),
      forks: asNumber(item.forks, "forks"),
      language: asString(item.language),
      license: asString(item.license),
      sourcePage: asNumber(item.sourcePage, "sourcePage"),
    };
  });
}

export async function readRepositoryReviewSummary(): Promise<RepositoryReviewSummary> {
  const filePath = path.join(process.cwd(), "rwkv_repository_review.json");
  const item = asRecord(JSON.parse(await readFile(filePath, "utf8")));
  return {
    totalSearchResults: asNumber(item.totalSearchResults, "totalSearchResults"),
    pagesReviewed: asNumber(item.pagesReviewed, "pagesReviewed"),
    includedCount: asNumber(item.includedCount, "includedCount"),
    excludedCount: asNumber(item.excludedCount, "excludedCount"),
  };
}
