"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bot,
  Box,
  BrainCircuit,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Eye,
  GitFork,
  GraduationCap,
  Languages,
  Search,
  Star,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type {
  EcosystemProject,
  RepositoryCategory,
  RepositoryReviewSummary,
} from "@/lib/ecosystem-projects";
import { intlLocale, type Locale, type UiDictionary } from "@/lib/i18n";

type CategoryFilter = "all" | RepositoryCategory;
type SortMode = "updated" | "stars" | "name";

const pageSize = 24;

type EcosystemCatalogProps = {
  locale: Locale;
  dictionary: UiDictionary;
  projects: EcosystemProject[];
  reviewSummary?: RepositoryReviewSummary;
  loadError?: boolean;
};

const categoryIcons = {
  package: Box,
  inference: BrainCircuit,
  training: GraduationCap,
};

function dateTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatDate(value: string, locale: Locale) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(intlLocale(locale), {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(date);
}

export function EcosystemCatalog({
  locale,
  dictionary,
  projects,
  reviewSummary,
  loadError,
}: EcosystemCatalogProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("updated");
  const [currentPage, setCurrentPage] = useState(1);
  const targetLocale = locale === "en" ? "zh" : "en";
  const labels = dictionary.ecosystem;

  const categoryLabels: Record<RepositoryCategory, string> = {
    package: labels.packages,
    inference: labels.inference,
    training: labels.training,
  };
  const sortLabels: Record<SortMode, string> = {
    updated: labels.sortUpdated,
    stars: labels.sortStars,
    name: labels.sortName,
  };

  const counts = useMemo(
    () => ({
      package: projects.filter((project) => project.category === "package").length,
      inference: projects.filter((project) => project.category === "inference").length,
      training: projects.filter((project) => project.category === "training").length,
    }),
    [projects]
  );

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(intlLocale(locale));
    return projects
      .filter((project) => {
        const searchable = [
          project.name,
          project.owner,
          project.summary,
          project.language,
          project.license,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase(intlLocale(locale));
        return (
          (!normalizedQuery || searchable.includes(normalizedQuery)) &&
          (category === "all" || project.category === category)
        );
      })
      .sort((left, right) => {
        if (sortMode === "stars") return right.stars - left.stars;
        if (sortMode === "name") {
          return left.name.localeCompare(right.name, intlLocale(locale));
        }
        return dateTimestamp(right.lastUpdated) - dateTimestamp(left.lastUpdated);
      });
  }, [category, locale, projects, query, sortMode]);

  const pageCount = Math.max(1, Math.ceil(filteredProjects.length / pageSize));
  const activePage = Math.min(currentPage, pageCount);
  const visibleProjects = filteredProjects.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize
  );

  function goToPage(page: number) {
    setCurrentPage(Math.min(Math.max(page, 1), pageCount));
    requestAnimationFrame(() => {
      document.getElementById("catalog")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-border/70 bg-background/70 backdrop-blur-xl">
        <nav
          className="mx-auto flex h-full w-full max-w-7xl items-center justify-between px-5 sm:px-8"
          aria-label={dictionary.nav.mainAria}
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-medium tracking-tight">RWKV</span>
            <Separator orientation="vertical" className="h-5" />
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {dictionary.nav.section}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              nativeButton={false}
              render={<Link href={`/${locale}`} />}
            >
              {dictionary.nav.agents}
            </Button>
            <Button variant="secondary" size="sm" className="hidden sm:inline-flex">
              {dictionary.nav.resources}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              nativeButton={false}
              render={<Link href={`/${targetLocale}/resources`} />}
            >
              <Languages />
              {dictionary.nav.switchLanguageLabel}
            </Button>
          </div>
        </nav>
      </header>

      <div className="mx-auto w-full max-w-7xl px-5 pb-24 pt-24 sm:px-8 sm:pt-28">
        <section className="hero-surface overflow-hidden rounded-2xl border p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <Badge variant="outline" className="mb-5 gap-2 border-primary/30 bg-primary/10 text-primary">
                <span className="size-1.5 rounded-full bg-primary" />
                {labels.badge}
              </Badge>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
                {labels.title}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                {labels.description}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <a
                  href="https://github.com/search?o=desc&p=1&q=rwkv&s=updated&type=Repositories"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  {labels.reviewedSource}
                  <ExternalLink className="size-3" />
                </a>
                <span>{labels.reviewedPages}</span>
                {reviewSummary ? (
                  <span>
                    {labels.reviewedSummary
                      .replace("{total}", String(reviewSummary.totalSearchResults))
                      .replace("{pages}", String(reviewSummary.pagesReviewed))
                      .replace("{included}", String(reviewSummary.includedCount))
                      .replace("{excluded}", String(reviewSummary.excludedCount))}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4 lg:w-[36rem]">
              {[
                [labels.totalProjects, projects.length],
                [labels.packages, counts.package],
                [labels.inference, counts.inference],
                [labels.training, counts.training],
              ].map(([label, value]) => (
                <div key={label} className="bg-card/90 px-4 py-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 font-mono text-xl font-semibold text-primary">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="catalog" className="scroll-mt-20 pt-8">
          <div className="mb-6 grid gap-3 rounded-2xl border bg-card/60 p-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder={labels.searchPlaceholder}
                aria-label={labels.searchLabel}
                className="h-9 bg-background/60 pl-9"
              />
            </div>
            <Select
              value={category}
              onValueChange={(value) => {
                setCategory((value ?? "all") as CategoryFilter);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-full bg-background/60 md:w-44">
                <SelectValue>
                  {(value) =>
                    value === "all"
                      ? labels.allCategories
                      : categoryLabels[value as RepositoryCategory]
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{labels.allCategories}</SelectItem>
                <SelectItem value="package">{labels.packages}</SelectItem>
                <SelectItem value="inference">{labels.inference}</SelectItem>
                <SelectItem value="training">{labels.training}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={sortMode}
              onValueChange={(value) => {
                setSortMode((value ?? "updated") as SortMode);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-full bg-background/60 md:w-44">
                <SelectValue>
                  {(value) => sortLabels[value as SortMode] ?? labels.sortUpdated}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">{labels.sortUpdated}</SelectItem>
                <SelectItem value="stars">{labels.sortStars}</SelectItem>
                <SelectItem value="name">{labels.sortName}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loadError ? (
            <Card className="border-destructive/30 bg-destructive/5 py-14 text-center shadow-none">
              <CardContent className="space-y-3">
                <CircleAlert className="mx-auto size-7 text-destructive" />
                <h2 className="font-medium">{labels.loadError}</h2>
              </CardContent>
            </Card>
          ) : filteredProjects.length ? (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                {visibleProjects.map((project) => {
                  const CategoryIcon = categoryIcons[project.category];
                  return (
                    <Card key={project.repositoryUrl} className="gap-0 overflow-hidden py-0 shadow-none">
                    <CardHeader className="flex flex-row items-start gap-4 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-primary/8 text-primary">
                        <CategoryIcon className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-lg font-semibold tracking-tight">{project.name}</h2>
                          <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                            {categoryLabels[project.category]}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{project.owner}</p>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 px-5 pb-5 sm:px-6">
                      <p className="min-h-12 text-sm leading-6 text-muted-foreground">{project.summary}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{project.language ?? "—"}</Badge>
                        <Badge variant="secondary">{project.license ?? "—"}</Badge>
                        <Badge variant="secondary" className="gap-1.5"><Star />{project.stars}</Badge>
                        <Badge variant="secondary" className="gap-1.5"><GitFork />{project.forks}</Badge>
                        <Badge variant="secondary" className="gap-1.5"><Eye />{project.watchers}</Badge>
                      </div>
                    </CardContent>
                    <CardFooter className="flex min-h-14 justify-between gap-4 border-t bg-muted/20 px-5 py-3 sm:px-6">
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarDays className="size-3.5" />
                        {labels.updatedPrefix} {formatDate(project.lastUpdated, locale)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        className="gap-2"
                        render={<a href={project.repositoryUrl} target="_blank" rel="noopener noreferrer" />}
                      >
                        {labels.openGitHub}
                        <ArrowUpRight />
                      </Button>
                    </CardFooter>
                    </Card>
                  );
                })}
              </div>
              {pageCount > 1 ? (
                <nav
                  className="mt-8 flex items-center justify-center gap-3"
                  aria-label={labels.paginationLabel}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={activePage === 1}
                    onClick={() => goToPage(activePage - 1)}
                  >
                    <ChevronLeft />
                    {labels.previousPage}
                  </Button>
                  <span
                    className="min-w-24 text-center text-sm text-muted-foreground"
                    aria-live="polite"
                  >
                    {labels.pageStatus
                      .replace("{current}", String(activePage))
                      .replace("{total}", String(pageCount))}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={activePage === pageCount}
                    onClick={() => goToPage(activePage + 1)}
                  >
                    {labels.nextPage}
                    <ChevronRight />
                  </Button>
                </nav>
              ) : null}
            </>
          ) : (
            <Card className="border-dashed bg-transparent py-16 text-center shadow-none">
              <CardContent className="space-y-3">
                <Bot className="mx-auto size-7 text-muted-foreground" />
                <h2 className="font-medium">{labels.noResults}</h2>
                <p className="text-sm text-muted-foreground">{labels.adjustFilters}</p>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}
