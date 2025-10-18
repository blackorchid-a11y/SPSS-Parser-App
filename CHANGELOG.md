# Changelog

All notable changes to this project will be documented in this file.

## [1.0.2] - 2025-10-18

### Added
- Full bilingual support for English and Spanish SPSS output files
- Support for "Variables in the Equation" (English) table headers
- Support for "Lower"/"Upper" (English) confidence interval column headers
- Support for "Step" (English) step identifiers
- Support for "Constant" (English) in variable tables
- Comprehensive bilingual documentation (BILINGUAL_SUPPORT.md)

### Fixed
- Parser now correctly detects logistic regression models in English SPSS output
- Fixed issue where only Spanish table headers ("Variables en la ecuación") were recognized
- Fixed issue where only Spanish CI headers ("Inferior"/"Superior") were recognized
- Fixed issue where only Spanish step identifiers ("Paso") were recognized

### Technical Details
- Added checks for both "Variables in the Equation" and "Variables en la ecuación"
- Added checks for both "Lower"/"Upper" and "Inferior"/"Superior" CI headers
- Added checks for both "Step" and "Paso" step identifiers
- Added checks for both "Constant" and "Constante" variable names

## [1.0.1] - Previous Version

### Features
- SPSS logistic regression output parser
- Forest plot generation
- Excel export functionality
- Support for stepwise regression
- Variable retention tracking

## [1.0.0] - Initial Release

### Features
- Initial release of SPSS Parser
- Basic logistic regression parsing (Spanish only)
- Forest plot visualization
- Export to Excel
