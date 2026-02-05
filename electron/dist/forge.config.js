"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const maker_deb_1 = require("@electron-forge/maker-deb");
const config = {
    packagerConfig: {
        asar: true,
        icon: './public/apple-icon',
    },
    rebuildConfig: {},
    makers: [
        new maker_deb_1.MakerDeb({
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
exports.default = config;
//# sourceMappingURL=forge.config.js.map