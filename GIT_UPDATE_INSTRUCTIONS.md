# Git Update Instructions for v1.0.2

## Quick Method (Windows)
Simply double-click `update-to-v1.0.2.bat` in the project folder.

## Manual Method (All Platforms)

Open a terminal/command prompt in the project folder and run these commands:

### Step 1: Check what files have changed
```bash
git status
```

You should see:
- Modified: src/App.jsx
- Modified: package.json
- New file: CHANGELOG.md
- New file: BILINGUAL_SUPPORT.md
- New file: update-to-v1.0.2.bat (optional)
- New file: GIT_UPDATE_INSTRUCTIONS.md (optional)

### Step 2: Stage all changes
```bash
git add .
```

### Step 3: Commit the changes
```bash
git commit -m "Release v1.0.2: Add bilingual support for English and Spanish SPSS output"
```

### Step 4: Create a version tag
```bash
git tag -a v1.0.2 -m "Version 1.0.2 - Bilingual Support"
```

### Step 5: Push to GitHub
```bash
git push origin main
git push origin v1.0.2
```

## What Changed in v1.0.2?

### Main Changes:
1. **Full bilingual support** - Parser now works with both English and Spanish SPSS output
2. **Updated App.jsx** - Added checks for English language patterns:
   - "Variables in the Equation" (was only "Variables en la ecuación")
   - "Lower"/"Upper" CI headers (was only "Inferior"/"Superior")
   - "Step" identifiers (was only "Paso")
   - "Constant" (was only "Constante")

3. **New Documentation**:
   - CHANGELOG.md - Version history
   - BILINGUAL_SUPPORT.md - Comprehensive language support documentation

4. **Version bump**: package.json updated from 1.0.1 to 1.0.2

## Creating a GitHub Release (Optional)

After pushing, you can create a release on GitHub:

1. Go to your repository on GitHub
2. Click "Releases" on the right sidebar
3. Click "Draft a new release"
4. Choose tag: v1.0.2
5. Release title: "v1.0.2 - Bilingual Support"
6. Description:
   ```
   ## What's New in v1.0.2
   
   ### 🌐 Bilingual Support
   The parser now fully supports both English and Spanish SPSS output files!
   
   ### Added
   - Support for English SPSS output ("Variables in the Equation")
   - Support for English CI headers ("Lower"/"Upper")
   - Support for English step identifiers ("Step 1", "Step 2")
   - Comprehensive bilingual documentation
   
   ### Fixed
   - Parser now correctly detects models in English SPSS output
   - Improved language pattern detection
   
   ### Documentation
   - Added CHANGELOG.md
   - Added BILINGUAL_SUPPORT.md with detailed language support info
   ```
7. Click "Publish release"

## Troubleshooting

### If git push fails:
```bash
# Pull first if there are remote changes
git pull origin main --rebase

# Then try pushing again
git push origin main
git push origin v1.0.2
```

### If you need to undo the commit (before pushing):
```bash
git reset --soft HEAD~1
```

### If you need to delete the tag:
```bash
git tag -d v1.0.2
```
