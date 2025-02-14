const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: './src/PlaylistPageEnhancer.ts',
  output: {
    filename: 'main.bundle.js',
    path: path.resolve(__dirname, 'package'),
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.(ts|js)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "src/templates", to: "templates" },
        { from: "src/styles", to: "styles" },
        { from: "icons", to: "icons" },
        { from: "manifest.json", to: "manifest.json" },
      ],
    }),
  ],
};
