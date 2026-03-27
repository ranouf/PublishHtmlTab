const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const packageJson = require('./package.json');

module.exports = {
  entry: {
    tabContent: './src/tabContent.tsx',
  },
  output: {
    assetModuleFilename: 'assets/[name][ext]',
  },

  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    alias: {
      'azure-devops-extension-sdk': path.resolve(
        'node_modules/azure-devops-extension-sdk',
      ),
    },
  },
  stats: {
    warnings: false,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
      },
      {
        test: /\.scss$/,
        use: [
          'style-loader',
          'css-loader',
          'azure-devops-ui/buildScripts/css-variables-loader',
          'sass-loader',
        ],
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.woff$/,
        type: 'asset/inline',
      },
      {
        test: /\.woff2$/,
        type: 'asset/inline',
      },
      {
        test: /\.html$/,
        loader: 'file-loader',
      },
    ],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [{ from: '*.html', context: 'src/' }],
    }),
    new webpack.DefinePlugin({
      APP_VERSION: JSON.stringify(packageJson.version),
    }),
    new webpack.SourceMapDevToolPlugin({}),
  ],
};
