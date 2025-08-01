#!/usr/bin/env node

/**
 * Chrome Extension Hot Reload Script
 * Watches for file changes and rebuilds the extension automatically
 */

const chokidar = require('chokidar');
const { exec } = require('child_process');
const path = require('path');

console.log('🔥 Starting Thockify hot reload development server...');
console.log('👀 Watching for changes in src/ directory...');
console.log('📝 Extension will rebuild automatically when files change');
console.log('🔄 Reload the extension manually in Chrome after changes\n');

// Initial build
console.log('🏗️  Building extension...');
exec('npm run build:dev', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Initial build failed:', error);
    return;
  }
  console.log('✅ Initial build complete');
  console.log('📁 Extension built in dist/ directory');
  console.log('🎯 Load the dist/ folder as an unpacked extension in Chrome\n');
});

// Watch for changes
const watcher = chokidar.watch(
  [
    'src/**/*.ts',
    'src/**/*.html',
    'src/**/*.css',
    'assets/**/*',
    '_locales/**/*',
  ],
  {
    ignored: /node_modules/,
    persistent: true,
    ignoreInitial: true,
  }
);

let buildTimeout;

watcher.on('change', filePath => {
  console.log(`📝 File changed: ${path.relative(process.cwd(), filePath)}`);

  // Debounce builds (wait 500ms after last change)
  clearTimeout(buildTimeout);
  buildTimeout = setTimeout(() => {
    console.log('🔄 Rebuilding extension...');

    exec('npm run build:dev', (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Build failed:', error.message);
        return;
      }
      if (stderr) {
        console.warn('⚠️  Build warnings:', stderr);
      }

      console.log(
        '✅ Build complete! Reload the extension in Chrome to see changes\n'
      );
    });
  }, 500);
});

watcher.on('error', error => {
  console.error('❌ Watcher error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping hot reload server...');
  watcher.close();
  process.exit(0);
});
