/** A repository range used by an explanation. */
export type ExplanationRepository = {
  /** Absolute path to the Git repository. */
  path: string
  /** Base revision for the explanation. */
  base: string
  /** Head revision for the explanation. */
  head: string
}

/** A headline metric shown beneath the explanation title. */
export type ExplanationSummaryItem = {
  /** Short value, such as a count or percentage. */
  value: string
  /** Plain-English label for the value. */
  label: string
}

/** A complete code excerpt included in the explanation. */
export type ExplanationCodeBlock = {
  /** Stable identifier used by a `{{CODE:id}}` placeholder. */
  id: string
  /** Short caption above the code. */
  title: string
  /** Shiki language identifier or supported short alias. */
  language: string
  /** Complete source excerpt to render without further slicing. */
  code?: string
  /** Pinned Git declaration to extract as a complete source excerpt. */
  source?: ExplanationCodeSource
  /** Repository-relative source path. */
  path?: string
  /** One-based source line for the VS Code link. */
  line?: number
  /** Explicit link when the source is outside the main repository. */
  href?: string
  /** Whether the source was deleted in the explained range. */
  deleted?: boolean
}

/** A complete declaration read from a pinned Git revision. */
export type ExplanationCodeSource = {
  /** `base`, `head`, or an explicit Git revision. */
  revision: string
  /** Repository-relative source path at that revision. */
  path: string
  /** Unique text within the declaration signature. */
  needle: string
}

/** A file shown in the always-visible file index. */
export type ExplanationFile = {
  /** Git status, such as A, M, D, or R100. */
  status: string
  /** Repository-relative path at the head revision. */
  path: string
  /** Previous path for a rename. */
  oldPath?: string
  /** One-sentence explanation of the file's role in the change. */
  description: string
  /** Searchable category labels shown under the description. */
  tags: string[]
  /** Explicit link that overrides the generated file or diff link. */
  href?: string
}

/** A long-page section in the explanation. */
export type ExplanationSection = {
  /** Stable HTML anchor. */
  id: string
  /** Sentence-case section title. */
  title: string
  /** Trusted HTML body authored for this explanation. */
  html: string
  /** Special renderer for the searchable file-card index. */
  kind?: "content" | "files"
}

/** Structured input consumed by the explain-diff renderer. */
export type ExplanationInput = {
  /** Input contract version. */
  schemaVersion: 1
  /** Document title. */
  title: string
  /** One-paragraph explanation of the range and its purpose. */
  lede: string
  /** ISO date used in companion artifact filenames. */
  date: string
  /** Filesystem-safe subject slug. */
  slug: string
  /** Git repository and immutable range. */
  repository: ExplanationRepository
  /** Compact context chips beneath the lede. */
  meta?: string[]
  /** Optional headline metrics. */
  summary?: ExplanationSummaryItem[]
  /** Complete code excerpts referenced by section placeholders. */
  codeBlocks?: ExplanationCodeBlock[]
  /** File index entries with human-authored descriptions. */
  files?: ExplanationFile[]
  /** Ordered long-page sections. */
  sections: ExplanationSection[]
  /** Short footer provenance line. */
  footer?: string
}

/** Result of extracting one braced declaration. */
export type BracedDeclaration = {
  /** One-based line where the excerpt starts. */
  line: number
  /** Complete declaration, including an adjacent JSDoc comment. */
  text: string
}

/** Inputs for building a companion diff file. */
export type BuildFileDiffOptions = {
  /** Absolute path to the Git repository. */
  repositoryPath: string
  /** Base revision. */
  base: string
  /** Head revision. */
  head: string
  /** Indexed files. */
  files: ExplanationFile[]
  /** Absolute output path for the combined diff. */
  outputPath: string
}

/** Paths written by the explanation renderer. */
export type RenderExplanationResult = {
  /** Absolute path to the self-contained HTML document. */
  outputPath: string
  /** Absolute path to the companion combined diff. */
  diffPath: string
}
