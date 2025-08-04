const { merge } = require('webpack-merge');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const baseConfig = require('./webpack.config.base');

module.exports = merge(baseConfig, {
  mode: 'development',
  devtool: 'inline-source-map',
  optimization: {
    minimize: false,
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'manifest.json',
          to: 'manifest.json',
        },
        {
          from: 'src/popup/popup.html',
          to: 'popup.html',
        },
        {
          from: 'src/popup/popup.css',
          to: 'popup.css',
        },
        {
          from: 'assets',
          to: 'assets',
          noErrorOnMissing: true,
        },
        {
          from: '_locales',
          to: '_locales',
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
});
