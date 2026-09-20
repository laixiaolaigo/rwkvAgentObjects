"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bot,
  CalendarDays,
  CircleAlert,
  Code2,
  ExternalLink,
  FileJson,
  FilterX,
  GitFork,
  Languages,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";

import {
  normalizeAgentProjects,
  type AgentProject,
} from "@/lib/agent-project-normalizer";
import {
  intlLocale,
  type DataLoadError,
  type Locale,
  type UiDictionary,
} from "@/lib/i18n";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
type SortMode = "updated" | "stars" | "name";

type AgentCatalogProps = {
  locale: Locale;
  dictionary: UiDictionary;
  projects: AgentProject[];
  loadError?: DataLoadError;
};

function formatDate(value: string | undefined, locale: Locale) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(intlLocale(locale), {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(date);
}

function dateTimestamp(value?: string) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function initials(value: string) {
  return value.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase() || "AI";
}

function DetailSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Bot;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Icon className="size-4 text-primary" />
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function TagList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item} variant="secondary" className="font-normal">
          {item}
        </Badge>
      ))}
    </div>
  );
}

function LinkList({ items }: { items: string[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <a
          key={item}
          href={item}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <span className="min-w-0 truncate">{item}</span>
          <ExternalLink className="size-3.5 shrink-0" />
        </a>
      ))}
    </div>
  );
}

function ProjectDetails({
  project,
  locale,
  dictionary,
}: {
  project: AgentProject;
  locale: Locale;
  dictionary: UiDictionary;
}) {
  const capabilities = project.primaryCapabilities ?? project.searchCapabilities;

  return (
    <>
      <SheetHeader className="border-b px-5 py-5 pr-14 sm:px-7">
        <div className="flex items-start gap-4">
          <Avatar className="size-12" size="lg">
            {project.avatarUrl ? <AvatarImage src={project.avatarUrl} alt="" /> : null}
            <AvatarFallback>{initials(project.projectName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-xl">{project.projectName}</SheetTitle>
            <SheetDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{project.creatorName}</span>
              {project.classification ? <Badge variant="outline">{project.classification}</Badge> : null}
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-7 px-5 py-6 sm:px-7">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              project.primaryLanguage ? [dictionary.projects.primaryLanguage, project.primaryLanguage] : null,
              project.license ? [dictionary.projects.license, project.license] : null,
              [dictionary.projects.stars, project.stars.toLocaleString(intlLocale(locale))],
              project.createdAt ? [dictionary.projects.createdAt, formatDate(project.createdAt, locale)] : null,
              project.updatedAt ? [dictionary.projects.updatedAt, formatDate(project.updatedAt, locale)] : null,
              project.accountType ? [dictionary.projects.accountType, project.accountType] : null,
            ].filter((item): item is [string, string] => item !== null).map(([label, value]) => (
              <div key={label} className="rounded-xl border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1.5 text-sm font-medium">{value}</p>
              </div>
            ))}
          </div>

          {project.introduction ? (
            <DetailSection icon={FileJson} title={dictionary.projects.introduction}>
              <p className="text-sm leading-7 text-muted-foreground">{project.introduction}</p>
            </DetailSection>
          ) : null}

          {project.agentLoop ? (
            <DetailSection icon={Bot} title={dictionary.projects.agentLoop}>
              <p className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-7 text-foreground/90">
                {project.agentLoop}
              </p>
            </DetailSection>
          ) : null}

          {project.classificationBasis ? (
            <DetailSection icon={ShieldCheck} title={dictionary.projects.classificationBasis}>
              <p className="text-sm leading-7 text-muted-foreground">{project.classificationBasis}</p>
            </DetailSection>
          ) : null}

          {capabilities?.length ? (
            <DetailSection
              icon={Sparkles}
              title={
                project.primaryCapabilities
                  ? dictionary.projects.primaryCapabilities
                  : dictionary.projects.searchCapabilities
              }
            >
              <TagList items={capabilities} />
            </DetailSection>
          ) : null}

          {project.knownLimitations?.length ? (
            <DetailSection icon={CircleAlert} title={dictionary.projects.limitations}>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {project.knownLimitations.map((item) => (
                  <li key={item} className="flex gap-3 rounded-lg border border-warning/20 bg-warning/5 p-3">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" />
                    <span className="leading-6">{item}</span>
                  </li>
                ))}
              </ul>
            </DetailSection>
          ) : null}

          {project.userFeedback?.length ? (
            <DetailSection icon={CircleAlert} title={dictionary.projects.userFeedback}>
              <TagList items={project.userFeedback} />
            </DetailSection>
          ) : null}

          {project.supportedPlatforms ? (
            <DetailSection icon={Code2} title={dictionary.projects.supportedPlatforms}>
              <p className="text-sm leading-7 text-muted-foreground">{project.supportedPlatforms}</p>
            </DetailSection>
          ) : null}

          {project.relatedProjects?.length ? (
            <DetailSection icon={GitFork} title={dictionary.projects.relatedProjects}>
              <LinkList items={project.relatedProjects} />
            </DetailSection>
          ) : null}

          {project.aliases?.length ? (
            <DetailSection icon={GitFork} title={dictionary.projects.aliases}>
              <LinkList items={project.aliases} />
            </DetailSection>
          ) : null}

          {project.sources?.length ? (
            <DetailSection icon={FileJson} title={dictionary.projects.sources}>
              <TagList items={project.sources} />
            </DetailSection>
          ) : null}

          {project.authorNote ? (
            <DetailSection icon={FileJson} title={dictionary.projects.authorNote}>
              <p className="text-sm leading-7 text-muted-foreground">{project.authorNote}</p>
            </DetailSection>
          ) : null}
        </div>
      </ScrollArea>

      {project.githubUrl ? (
        <div className="border-t p-4 sm:px-7">
          <Button
            className="w-full gap-2"
            nativeButton={false}
            render={<a href={project.githubUrl} target="_blank" rel="noopener noreferrer" />}
          >
            <GitFork />
            {dictionary.projects.openGitHub}
            <ArrowUpRight />
          </Button>
        </div>
      ) : null}
    </>
  );
}

export function AgentCatalog({
  locale,
  dictionary,
  projects: initialProjects,
  loadError,
}: AgentCatalogProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [projectLoadError, setProjectLoadError] = useState(loadError);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("updated");
  const [selectedProject, setSelectedProject] = useState<AgentProject | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refreshProjects() {
      const basePath = window.location.pathname.replace(/\/(?:en|zh)\/?$/, "");
      const response = await fetch(`${basePath}/agent-data.json?v=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`agent-data.json returned HTTP ${response.status}`);

      const latestProjects = normalizeAgentProjects(await response.json(), locale);
      if (!cancelled) {
        setProjects(latestProjects);
        setProjectLoadError(undefined);
      }
    }

    refreshProjects().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const targetLocale = locale === "en" ? "zh" : "en";
  const sortLabels: Record<SortMode, string> = {
    updated: dictionary.projects.sortUpdated,
    stars: dictionary.projects.sortStars,
    name: dictionary.projects.sortName,
  };

  const languages = useMemo(
    () => [...new Set(projects.map((item) => item.primaryLanguage).filter((item): item is string => Boolean(item)))].sort(),
    [projects]
  );
  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    return projects
      .filter((project) => {
        const searchable = [project.projectName, project.creatorName, project.projectType, project.introduction]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("zh-CN");
        return (
          (!normalizedQuery || searchable.includes(normalizedQuery)) &&
          (language === "all" || project.primaryLanguage === language)
        );
      })
      .sort((left, right) => {
        if (sortMode === "stars") return right.stars - left.stars;
        if (sortMode === "name") {
          return left.projectName.localeCompare(right.projectName, intlLocale(locale));
        }
        const leftTime = dateTimestamp(left.updatedAt);
        const rightTime = dateTimestamp(right.updatedAt);
        return rightTime - leftTime;
      });
  }, [language, locale, projects, query, sortMode]);

  const stats = useMemo(
    () => ({
      total: projects.length,
      languages: languages.length,
      stars: projects.reduce((total, project) => total + project.stars, 0),
    }),
    [languages.length, projects]
  );

  const hasFilters = Boolean(query || language !== "all" || sortMode !== "updated");
  const resetFilters = () => {
    setQuery("");
    setLanguage("all");
    setSortMode("updated");
  };

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
            <span className="hidden text-sm text-muted-foreground sm:inline">{dictionary.nav.section}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              className="hidden sm:inline-flex"
            >
              {dictionary.nav.agents}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              nativeButton={false}
              render={<Link href={`/${locale}/resources`} />}
            >
              {dictionary.nav.resources}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              nativeButton={false}
              render={
                <Link
                  href={`/${targetLocale}`}
                  aria-label={dictionary.nav.switchLanguage}
                />
              }
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
                {dictionary.hero.badge}
              </Badge>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
                {dictionary.hero.title}
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                {dictionary.hero.description}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border bg-border lg:w-[34rem]">
              {[
                [dictionary.hero.projects, stats.total],
                [dictionary.hero.languages, stats.languages],
                [dictionary.hero.stars, stats.stars],
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
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
                {dictionary.projects.eyebrow}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                {dictionary.projects.title}
              </h2>
            </div>
            <span className="text-sm text-muted-foreground">{filteredProjects.length} / {projects.length}</span>
          </div>

          <div className="mb-6 grid gap-3 rounded-2xl border bg-card/60 p-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={dictionary.projects.searchPlaceholder}
                aria-label={dictionary.projects.searchLabel}
                className="h-9 bg-background/60 pl-9"
              />
            </div>
            <Select value={language} onValueChange={(value) => setLanguage(value ?? "all")}>
              <SelectTrigger className="h-9 w-full bg-background/60 md:w-36">
                <SelectValue>
                  {(value) => value === "all" ? dictionary.projects.allLanguages : value}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{dictionary.projects.allLanguages}</SelectItem>
                {languages.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Select value={sortMode} onValueChange={(value) => setSortMode((value ?? "updated") as SortMode)}>
                <SelectTrigger className="h-9 flex-1 bg-background/60 md:w-44">
                  <SelectValue>
                    {(value) => sortLabels[value as SortMode] ?? dictionary.projects.sortUpdated}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated">{dictionary.projects.sortUpdated}</SelectItem>
                  <SelectItem value="stars">{dictionary.projects.sortStars}</SelectItem>
                  <SelectItem value="name">{dictionary.projects.sortName}</SelectItem>
                </SelectContent>
              </Select>
              {hasFilters ? (
                <Button
                  variant="outline"
                  size="icon-lg"
                  aria-label={dictionary.common.clearFilters}
                  onClick={resetFilters}
                >
                  <FilterX />
                </Button>
              ) : null}
            </div>
          </div>

          {projectLoadError ? (
            <Card className="border-destructive/30 bg-destructive/5 py-14 text-center shadow-none">
              <CardContent className="mx-auto max-w-lg space-y-3">
                <CircleAlert className="mx-auto size-7 text-destructive" />
                <h3 className="font-medium">
                  {projectLoadError.kind === "missing"
                    ? dictionary.projects.missingFile
                    : dictionary.projects.invalidFile}
                </h3>
              </CardContent>
            </Card>
          ) : projects.length === 0 ? (
            <Card className="border-dashed bg-transparent py-16 text-center shadow-none">
              <CardContent className="space-y-3">
                <FileJson className="mx-auto size-7 text-muted-foreground" />
                <h3 className="font-medium">{dictionary.projects.emptyFile}</h3>
              </CardContent>
            </Card>
          ) : filteredProjects.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredProjects.map((project) => (
                <Card
                  key={project.id}
                  className="project-card relative isolate gap-0 overflow-hidden py-0 shadow-none has-[.project-card-trigger:focus-visible]:border-primary/70 has-[.project-card-trigger:focus-visible]:ring-3 has-[.project-card-trigger:focus-visible]:ring-ring/25"
                >
                  <button
                    type="button"
                    className="project-card-trigger absolute inset-0 z-0 cursor-pointer rounded-xl outline-none"
                    aria-label={`${dictionary.projects.openDetails} ${project.projectName}`}
                    onClick={() => setSelectedProject(project)}
                  />
                  <CardHeader className="pointer-events-none relative z-1 flex flex-row items-start gap-4 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
                    <Avatar className="size-12 bg-muted ring-4 ring-background/70" size="lg">
                      {project.avatarUrl ? <AvatarImage src={project.avatarUrl} alt="" /> : null}
                      <AvatarFallback>{initials(project.projectName)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <h3 className="truncate text-lg font-semibold tracking-tight transition-colors group-hover/card:text-primary">
                          {project.projectName}
                        </h3>
                        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground/50 transition-all group-hover/card:-translate-y-0.5 group-hover/card:translate-x-0.5 group-hover/card:text-primary" />
                      </div>
                      <div className="mt-1.5 flex min-w-0 items-center gap-2">
                        <p className="truncate text-sm text-muted-foreground">{project.creatorName}</p>
                        {project.classification ? (
                          <Badge variant="outline" className="max-w-40 truncate border-primary/20 bg-primary/5 text-[0.68rem] text-primary/90">
                            {project.classification}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pointer-events-none relative z-1 space-y-4 px-5 pb-5 sm:px-6">
                    <div className="flex flex-wrap gap-2">
                      {project.primaryLanguage ? (
                        <Badge variant="secondary" className="gap-1.5 border border-border/60 bg-muted/70 font-normal"><Code2 />{project.primaryLanguage}</Badge>
                      ) : null}
                      <Badge variant="secondary" className="gap-1.5 border border-border/60 bg-muted/70 font-normal"><Star />{project.stars}</Badge>
                      {project.license ? (
                        <Badge variant="secondary" className="border border-border/60 bg-muted/70 font-normal">{project.license}</Badge>
                      ) : null}
                    </div>
                    {project.projectType ? (
                      <p className="text-sm font-medium leading-6 text-foreground/90">{project.projectType}</p>
                    ) : null}
                    {project.introduction ? (
                      <p className="line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-muted-foreground">
                        {project.introduction}
                      </p>
                    ) : null}
                    {project.updatedAt ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarDays className="size-3.5" />
                        <span>
                          {dictionary.projects.updatedPrefix} {formatDate(project.updatedAt, locale)}
                        </span>
                      </div>
                    ) : null}
                  </CardContent>
                  <CardFooter className="pointer-events-none relative z-1 flex min-h-14 justify-between border-t border-border/70 bg-gradient-to-r from-muted/20 to-primary/5 px-5 py-3 sm:px-6">
                    <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors group-hover/card:text-foreground">
                      <span className="size-1.5 rounded-full bg-primary/70 shadow-[0_0_10px_var(--primary)]" />
                      {dictionary.projects.cardDetailHint}
                    </span>
                    {project.githubUrl ? (
                      <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        className="pointer-events-auto relative z-10 gap-2 border-border/80 bg-background/70 text-foreground shadow-sm backdrop-blur-sm hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                        aria-label={`${dictionary.projects.githubAriaPrefix} ${project.projectName}${dictionary.projects.githubAriaSuffix}`}
                        render={<a href={project.githubUrl} target="_blank" rel="noopener noreferrer" />}
                      >
                        <GitFork />
                        GitHub
                        <ExternalLink className="size-3! opacity-60" />
                      </Button>
                    ) : null}
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed bg-transparent py-16 text-center shadow-none">
              <CardContent className="space-y-4">
                <Search className="mx-auto size-7 text-muted-foreground" />
                <div>
                  <h3 className="font-medium">{dictionary.projects.noResults}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {dictionary.projects.adjustFilters}
                  </p>
                </div>
                <Button variant="outline" onClick={resetFilters}>
                  {dictionary.common.clearFilters}
                </Button>
              </CardContent>
            </Card>
          )}
        </section>
      </div>

      <Sheet open={Boolean(selectedProject)} onOpenChange={(open) => { if (!open) setSelectedProject(null); }}>
        <SheetContent
          closeLabel={dictionary.common.close}
          className="w-full! gap-0 border-border/80 bg-popover p-0 sm:max-w-xl!"
        >
          {selectedProject ? (
            <ProjectDetails
              project={selectedProject}
              locale={locale}
              dictionary={dictionary}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </main>
  );
}
