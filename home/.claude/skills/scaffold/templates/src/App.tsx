/** Start with an immobile toolbar and independently scrolling content. */
export function App(
  /** No external configuration. */
  _props: Props,
) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <img src="/icon.svg" alt="" className="size-8 shrink-0" />
        <span className="min-w-0 truncate font-semibold">{{ PROJECT_TITLE }}</span>
      </header>
      <main className="app-content">
        <div className="flex min-h-full items-center justify-center p-4">
          <h1 className="text-center text-3xl font-bold sm:text-4xl">Hello, {{ PROJECT_TITLE }}</h1>
        </div>
      </main>
    </div>
  )
}

type Props = Record<string, never>
