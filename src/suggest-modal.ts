import { App, SuggestModal } from "obsidian";
import { AlbumSearchResult, formatResultLine } from "./album";

/**
 * Disambiguation list (Step 4). `openAndAwait` resolves with the chosen result,
 * or null if dismissed without a selection.
 */
export class ResultSuggestModal extends SuggestModal<AlbumSearchResult> {
  private settled = false;
  private resolve!: (value: AlbumSearchResult | null) => void;

  constructor(
    app: App,
    private results: AlbumSearchResult[],
  ) {
    super(app);
    this.setPlaceholder("Select the correct release");
  }

  openAndAwait(): Promise<AlbumSearchResult | null> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.open();
    });
  }

  getSuggestions(query: string): AlbumSearchResult[] {
    const q = query.toLowerCase();
    return this.results.filter((r) => formatResultLine(r).toLowerCase().includes(q));
  }

  renderSuggestion(result: AlbumSearchResult, el: HTMLElement): void {
    el.setText(formatResultLine(result));
  }

  onChooseSuggestion(result: AlbumSearchResult): void {
    this.settled = true;
    this.resolve(result);
  }

  onClose(): void {
    // On a mouse selection, Obsidian can fire onClose (modal teardown) before
    // onChooseSuggestion. Defer the dismissal so a pending selection — which
    // runs synchronously right after — wins the single-resolve race.
    window.setTimeout(() => {
      if (!this.settled) this.resolve(null);
    }, 0);
  }
}
