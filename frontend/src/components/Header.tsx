interface HeaderProps {
  onOpenConfig: () => void;
}

export function Header({ onOpenConfig }: HeaderProps) {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-4">
        <a
          href="#top"
          className="font-display text-lg font-bold tracking-tight text-zinc-950 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
        >
          ClipForge
        </a>

        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600">
          <a
            href="#workspace"
            className="hover:text-zinc-950 transition-colors whitespace-nowrap shrink-0"
          >
            Clipper
          </a>
          <a
            href="#edge-gateway"
            className="hover:text-zinc-950 transition-colors whitespace-nowrap shrink-0"
          >
            Edge Gateway
          </a>
          <a
            href="#bot-resilience"
            className="hover:text-zinc-950 transition-colors whitespace-nowrap shrink-0"
          >
            Bot-Check
          </a>
          <a
            href="#deployment"
            className="hover:text-zinc-950 transition-colors whitespace-nowrap shrink-0"
          >
            Deploy
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenConfig}
            className="rounded-lg bg-zinc-950 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
          >
            Backend Config
          </button>
        </div>
      </div>
    </header>
  );
}
