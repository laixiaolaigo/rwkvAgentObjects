import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EcosystemCatalog } from "@/components/ecosystem-catalog";
import { getDictionary } from "@/lib/dictionaries";
import {
  readEcosystemProjects,
  readRepositoryReviewSummary,
  type EcosystemProject,
  type RepositoryReviewSummary,
} from "@/lib/ecosystem-projects";
import { isLocale } from "@/lib/i18n";

type ResourcesPageProps = {
  params: Promise<{ lang: string }>;
};

export async function generateMetadata({
  params,
}: ResourcesPageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dictionary = await getDictionary(lang);

  return {
    title: dictionary.ecosystem.metadataTitle,
    description: dictionary.ecosystem.metadataDescription,
    alternates: {
      canonical: `/${lang}/resources`,
      languages: {
        en: "/en/resources",
        "zh-CN": "/zh/resources",
      },
    },
  };
}

export default async function ResourcesPage({ params }: ResourcesPageProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dictionary = await getDictionary(lang);
  let projects: EcosystemProject[] = [];
  let reviewSummary: RepositoryReviewSummary | undefined;
  let loadError = false;

  try {
    [projects, reviewSummary] = await Promise.all([
      readEcosystemProjects(lang),
      readRepositoryReviewSummary(),
    ]);
  } catch {
    loadError = true;
  }

  return (
    <EcosystemCatalog
      locale={lang}
      dictionary={dictionary}
      projects={projects}
      reviewSummary={reviewSummary}
      loadError={loadError}
    />
  );
}
