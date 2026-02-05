import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDeb } from '@electron-forge/maker-deb';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: './public/apple-icon',
  },
  rebuildConfig: {},
  makers: [
    new MakerDeb({
      options: {
        maintainer: 'Council Team',
        homepage: 'https://github.com/council/council',
        categories: ['Office'],
        description: 'AI-powered brainstorming and strategic planning tool',
        productName: 'Council',
        genericName: 'council',
        icon: './public/apple-icon.png',
      },
    }),
  ],
};

export default config;