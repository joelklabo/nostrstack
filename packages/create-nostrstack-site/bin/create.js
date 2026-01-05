#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prompts from 'prompts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

async function main() {
  console.log('\n🚀 Welcome to create-nostrstack-site!\n');

  const response = await prompts([
    {
      type: 'text',
      name: 'projectName',
      message: 'What is your project name?',
      initial: 'my-nostr-site',
      validate: (value) => {
        if (!value) return 'Project name is required';
        if (!/^[a-z0-9-]+$/.test(value)) {
          return 'Project name must contain only lowercase letters, numbers, and hyphens';
        }
        return true;
      },
    },
    {
      type: 'select',
      name: 'template',
      message: 'Which template would you like to use?',
      choices: [
        { title: 'Minimal - Basic Nostr feed', value: 'minimal' },
        { title: 'Full - Complete social app with all features', value: 'full' },
      ],
      initial: 0,
    },
    {
      type: 'confirm',
      name: 'installDeps',
      message: 'Install dependencies now?',
      initial: true,
    },
  ]);

  if (!response.projectName) {
    console.log('\n❌ Setup cancelled\n');
    process.exit(0);
  }

  const { projectName, template, installDeps } = response;
  const targetDir = path.join(process.cwd(), projectName);

  // Check if directory already exists
  if (fs.existsSync(targetDir)) {
    console.error(`\n❌ Error: Directory "${projectName}" already exists\n`);
    process.exit(1);
  }

  console.log(`\n📦 Creating ${projectName} from ${template} template...\n`);

  // Copy template
  const templateDir = path.join(TEMPLATES_DIR, template);
  copyDirectory(templateDir, targetDir);

  // Update package.json with project name
  const pkgPath = path.join(targetDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    pkg.name = projectName;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }

  console.log('✅ Project created successfully!\n');

  // Install dependencies
  if (installDeps) {
    console.log('📥 Installing dependencies...\n');
    try {
      execSync('npm install', { cwd: targetDir, stdio: 'inherit' });
      console.log('\n✅ Dependencies installed!\n');
    } catch (err) {
      console.error('\n❌ Failed to install dependencies. You can install them manually with:\n');
      console.error(`   cd ${projectName} && npm install\n`);
    }
  }

  // Print next steps
  console.log('🎉 All done! Next steps:\n');
  console.log(`   cd ${projectName}`);
  if (!installDeps) {
    console.log('   npm install');
  }
  console.log('   npm run dev\n');
}

function copyDirectory(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
