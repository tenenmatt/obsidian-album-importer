import { App, Modal, Setting } from "obsidian";

/**
 * A single-input modal (Step 2). `openAndAwait` resolves with the submitted
 * search string, or null if the modal is dismissed without submitting.
 */
export class SearchModal extends Modal {
  private settled = false;
  private resolve!: (value: string | null) => void;
  private value: string;

  constructor(
    app: App,
    initial: string,
    private providerName: string,
  ) {
    super(app);
    this.value = initial;
  }

  openAndAwait(): Promise<string | null> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.open();
    });
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "Import album metadata" });

    new Setting(contentEl).setName(`Search ${this.providerName}`).addText((text) => {
      text.setValue(this.value).onChange((v) => (this.value = v));
      text.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.submit();
        }
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });

    new Setting(contentEl).addButton((btn) =>
      btn.setButtonText("Search").setCta().onClick(() => this.submit()),
    );
  }

  private submit(): void {
    this.settled = true;
    this.resolve(this.value);
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.settled) this.resolve(null);
  }
}
