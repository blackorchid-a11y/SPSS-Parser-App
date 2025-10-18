# SPSS Logistic Regression Parser

A powerful desktop application for extracting and visualizing logistic regression results from SPSS output files.

[![Version](https://img.shields.io/badge/version-1.0.2-blue.svg)](https://github.com/yourusername/spss-parser-app/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## 🌐 Bilingual Support

**NEW in v1.0.2:** Full support for both **English** and **Spanish** SPSS output files!

- ✅ English: "Variables in the Equation"
- ✅ Spanish: "Variables en la ecuación"
- ✅ Automatic language detection
- ✅ All features work in both languages

## Features

### 📊 Data Extraction
- Parse SPSS logistic regression output from Excel files
- Extract OR (Odds Ratios) with 95% confidence intervals
- Support for stepwise regression analysis
- Track variable retention across multiple steps
- Handle multiple models in a single file

### 📈 Forest Plot Generation
- Create publication-ready forest plots
- Customizable plot settings (scale, font size, dimensions)
- Linear or logarithmic scale options
- Color coding for variables
- Custom variable display names
- Export as SVG or high-resolution PNG (800 DPI)

### 📤 Export Capabilities
- Export results to Excel format
- Organized sheets for each model
- Includes OR, CI, P-values, and retention status
- Professional formatting

## Installation

### From Release (Recommended)
1. Download the latest release from [Releases](https://github.com/yourusername/spss-parser-app/releases)
2. Run the installer
3. Launch the application

### From Source
```bash
# Clone the repository
git clone https://github.com/yourusername/spss-parser-app.git
cd spss-parser-app

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
npm run dist
```

## Usage

### Step 1: Prepare Your SPSS Output
1. Run your logistic regression analysis in SPSS
2. Export the output to Excel format (.xlsx or .xls)
3. Ensure your output includes the "Variables in the Equation" (or "Variables en la ecuación") table with 95% CI

### Step 2: Upload and Parse
1. Launch the SPSS Parser application
2. Click "Upload SPSS Output (Excel format)"
3. Select your SPSS Excel file
4. The app will automatically detect and parse all logistic regression models

### Step 3: Review Results
- View detected models with outcome variables and populations
- See variable retention status (retained vs removed)
- Check step information for stepwise regression

### Step 4: Generate Forest Plots (Optional)
1. Click "Forest Plot" for any model
2. Customize settings:
   - Select variables to include
   - Choose linear or logarithmic scale
   - Customize colors and display names
   - Adjust plot dimensions
3. Download as SVG or PNG

### Step 5: Export to Excel
1. Select models to export (checkboxes)
2. Click "Export Selected Model(s) to Excel"
3. Save the Excel file with organized results

## Supported SPSS Output Structure

The parser expects SPSS logistic regression output with this structure:

| Column | Content | Required |
|--------|---------|----------|
| Step | Step identifier | Yes |
| Variable | Variable name | Yes |
| B | Beta coefficient | No |
| S.E. | Standard error | No |
| Wald | Wald statistic | No |
| df | Degrees of freedom | No |
| Sig. | P-value | Yes |
| Exp(B) | Odds Ratio | Yes |
| Lower | Lower 95% CI | Yes |
| Upper | Upper 95% CI | Yes |

## Language Support Details

See [BILINGUAL_SUPPORT.md](BILINGUAL_SUPPORT.md) for comprehensive documentation on language support.

**Supported Languages:**
- English (Variables in the Equation, Lower/Upper, Step, Constant)
- Spanish (Variables en la ecuación, Inferior/Superior, Paso, Constante)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and detailed changes.

## Technical Stack

- **Frontend:** React 18
- **Desktop:** Electron
- **Build Tool:** Vite
- **Excel Processing:** SheetJS (xlsx)
- **CSV Parsing:** PapaParse
- **Icons:** Lucide React

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Create distributable
npm run dist           # All platforms
npm run dist:win       # Windows only
npm run dist:mac       # macOS only
```

## Requirements

- Node.js 16+ for development
- Windows 10+ or macOS 10.13+ for running the app
- Excel file with SPSS logistic regression output

## Troubleshooting

### File Not Recognized
- Ensure your file is in Excel format (.xlsx or .xls)
- Verify it contains "Variables in the Equation" or "Variables en la ecuación" table
- Check that 95% confidence intervals are included in the output

### Missing Variables
- Confirm your SPSS output includes the Exp(B) column
- Verify CI columns are present (Lower/Upper or Inferior/Superior)

### Forest Plot Issues
- Variables with invalid values (0, NaN, or infinity) will be listed but not plotted
- Ensure at least one variable has valid OR and CI values

For more help, see [GIT_UPDATE_INSTRUCTIONS.md](GIT_UPDATE_INSTRUCTIONS.md) or open an issue.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Author

Jorge [Your Last Name]

## Acknowledgments

- Built for researchers and statisticians working with SPSS
- Designed to streamline the workflow from SPSS analysis to publication-ready figures

## Version History

- **v1.0.2** (2025-10-18): Added bilingual support for English and Spanish
- **v1.0.1**: Previous version with Spanish support only
- **v1.0.0**: Initial release

---

For detailed version information, see [CHANGELOG.md](CHANGELOG.md)
