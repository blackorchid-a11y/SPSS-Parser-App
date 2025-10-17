const { spawn } = require('child_process');
const path = require('path');

// Get the correct path to electron executable
const electronPath = require('electron');

const electron = spawn(electronPath, ['.'], {
  env: { ...process.env, NODE_ENV: 'development' },
  stdio: 'inherit'
});

electron.on('close', (code) => {
  process.exit(code);
});