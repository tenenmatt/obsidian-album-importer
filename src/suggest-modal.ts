import { App, SuggestModal } from "obsidian";
import { ReleaseGroupResult, formatResultLine } from "./musicbrainz";

/**
 * Disambiguation list (Step 4). `openAndAwait` resolves with the chosen release
 * group, or null if dismissed without a selection.
 */
export class ResultSuggestModal extends SuggestModal<ReleaseGroupResult> {
  private settled = false;
  private resolve!: (value: ReleaseGroupResult | null) => void;

  constructor(
    app: App,
    private results: ReleaseGroupResult[],
  ) {
    super(app);
    this.setPlaceholder("Select the correct release");
  }

  openAndAwait(): Promise<ReleaseGroupResult | null> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.open();
    });
  }

  getSuggestions(query: string): ReleaseGroupResult[] {
    const q = query.toLowerCase();
    return this.results.filter((r) => formatResultLine(r).toLowerCase().includes(q));
  }

  renderSuggestion(result: ReleaseGroupResult, el: HTMLElement): void {
    el.setText(formatResultLine(result));
  }

  onChooseSuggestion(result: ReleaseGroupResult): void {
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
