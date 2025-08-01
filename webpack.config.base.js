const path = require('path');

const baseConfig = {
  entry: {
    'service-worker': './src/background/service-worker.ts',
    'content-script': './src/content/content-script.ts',
    popup: './src/popup/popup.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  target: 'web',
};

module.exports = baseConfig;
