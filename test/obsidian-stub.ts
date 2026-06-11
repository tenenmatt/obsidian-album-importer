// Minimal runtime stand-in for the `obsidian` module used during tests.
// Types come from the real `obsidian` dev dependency at compile time; this file
// only supplies just-enough runtime so imports resolve and UI shells can be
// constructed. HTTP-touching code mocks `requestUrl` per-test.

export class Notice {
  constructor(public message: string) {}
  setMessage(message: string): this {
    this.message = message;
    return this;
  }
  hide(): void {}
}

export class Plugin {
  constructor(
    public app: unknown,
    public manifest: unknown,
  ) {}
  addCommand(): void {}
  addSettingTab(): void {}
  async loadData(): Promise<unknown> {
    return {};
  }
  async saveData(): Promise<void> {}
}

export class PluginSettingTab {
  containerEl: { empty(): void } = { empty() {} };
  constructor(
    public app: unknown,
    public plugin: unknown,
  ) {}
}

export class Modal {
  contentEl: unknown = {};
  constructor(public app: unknown) {}
  open(): void {}
  close(): void {}
}

export class SuggestModal<T> {
  constructor(public app: unknown) {}
  open(): void {}
  close(): void {}
  setPlaceholder(_text: string): void {}
  getSuggestions(_query: string): T[] | Promise<T[]> {
    return [];
  }
}

export class Setting {
  constructor(_containerEl: unknown) {}
  setName(): this {
    return this;
  }
  setDesc(): this {
    return this;
  }
  addText(): this {
    return this;
  }
  addToggle(): this {
    return this;
  }
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
}

export interface RequestUrlResponse {
  status: number;
  headers: Record<string, string>;
  arrayBuffer: ArrayBuffer;
  json: unknown;
  text: string;
}

export function requestUrl(_options: unknown): Promise<RequestUrlResponse> {
  throw new Error("requestUrl must be mocked in tests");
}
