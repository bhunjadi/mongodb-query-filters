const path = require('path');
const glob = require('glob');

const isTest = !!process.env.TESTBUILD;

const outputPath = path.resolve(__dirname, isTest ? 'test-dist' : 'dist');
const entry = isTest ? glob.sync(path.resolve(__dirname, 'tests/**/*.test.ts')) : './src/index.ts';
const devtool = isTest ? 'source-map' : undefined;

module.exports = {
  entry,
  devtool,
  mode: process.env.NODE_ENV || 'development',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [{loader: 'ts-loader', options: {onlyCompileBundledFiles: true}}],
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [ '.ts', '.js' ],
  },
  output: {
    filename: 'bundle.js',
    path: outputPath,
  },
};
