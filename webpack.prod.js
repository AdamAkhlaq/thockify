const { merge } = require('webpack-merge');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const baseConfig = require('./webpack.config.base');

module.exports = merge(baseConfig, {
  mode: 'production',
  devtool: 'source-map',
  optimization: {
    minimize: true,
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
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
