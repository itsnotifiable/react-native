const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const sdkRoot = path.resolve(projectRoot, '..');

function escapePath(value) {
  return value.replace(/[/\\]/g, '[/\\\\]').replace(/\./g, '\\.');
}

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @notifiable/react-native is installed with file:.. and resolves to this repo.
 * Hierarchical lookup is off so SDK source loads React from this app.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [sdkRoot],
  resolver: {
    disableHierarchicalLookup: true,
    nodeModulesPaths: [path.resolve(projectRoot, 'node_modules')],
    blockList: [
      new RegExp(`^${escapePath(path.join(sdkRoot, 'node_modules'))}[/\\\\].*`),
    ],
    extraNodeModules: {
      react: path.resolve(projectRoot, 'node_modules/react'),
      'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
