// Minimal ambient types for Google Identity Services (GSI) loaded via
// https://accounts.google.com/gsi/client — only the parts we use.
// The file is a global script (no top-level import/export) so `interface
// Window` below merges into the DOM's Window declaration automatically.

interface GsiCredentialResponse {
  credential: string;
}

interface GsiInitializeConfig {
  client_id: string;
  callback: (response: GsiCredentialResponse) => void;
}

interface GsiRenderOptions {
  theme: "outline";
  size: "large";
  width: string;
}

interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (config: GsiInitializeConfig) => void;
        renderButton: (parent: HTMLElement | null, options: GsiRenderOptions) => void;
      };
    };
  };
}