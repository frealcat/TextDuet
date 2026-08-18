import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'wxt';

const DISTRIBUTION_DOCUMENTS = ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md'] as const;

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  hooks: {
    'build:done': async () => {
      const outputDirectory = resolve('.output/chrome-mv3');
      await Promise.all(DISTRIBUTION_DOCUMENTS.map((fileName) =>
        copyFile(resolve(fileName), resolve(outputDirectory, fileName)),
      ));
    },
  },
  manifest: {
    name: 'TextDuet',
    description: 'Use your own model API to read webpages in bilingual mode.',
    permissions: ['activeTab', 'scripting', 'storage'],
    optional_host_permissions: ['https://*/*'],
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
    action: {
      default_title: 'TextDuet',
      default_icon: {
        16: 'icons/icon-16.png',
        32: 'icons/icon-32.png',
        48: 'icons/icon-48.png',
        128: 'icons/icon-128.png',
      },
    },
  },
});
