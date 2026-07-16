import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: ({ browser }) => ({
    name: "TabbyNotes",
    short_name: "TabbyNotes",
    description: "A local-first, tabbed Markdown notebook for your browser.",
    version: "5.0.0",
    action: {
      default_title: "Open TabbyNotes",
    },
    icons: {
      16: "kitty.png",
      48: "kitty.png",
      128: "kitty.png",
    },
    ...(browser === "firefox"
      ? {
          browser_specific_settings: {
            gecko: {
              id: "{ce3ec063-c416-458e-ab4b-7701f3f439bf}",
              data_collection_permissions: {
                required: ["none"],
              },
            },
          },
        }
      : {}),
  }),
  vite: () => ({
    plugins: [tailwindcss()],
    build: {
      // CodeMirror's Markdown parser is intentionally isolated in a lazy chunk.
      chunkSizeWarningLimit: 550,
    },
  }),
});
