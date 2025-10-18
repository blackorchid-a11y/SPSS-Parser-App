# Bilingual Support Documentation

This SPSS Logistic Regression Parser fully supports both **English** and **Spanish** SPSS output files.

## Language-Dependent Patterns Supported

### 1. Table Headers
- **English**: "Variables in the Equation"
- **Spanish**: "Variables en la ecuación"
- **Location**: Main table identifier
- **Status**: ✅ Fully supported

### 2. Confidence Interval Column Headers
- **English**: "Lower" / "Upper"
- **Spanish**: "Inferior" / "Superior"
- **Location**: 95% CI column headers (typically columns 8-9)
- **Status**: ✅ Fully supported (checks all variations)

### 3. Step Identifiers
- **English**: "Step 1", "Step 2", etc. (or "Step 1a", "Step 1b")
- **Spanish**: "Paso 1", "Paso 2", etc.
- **Location**: Row identifier for each regression step
- **Status**: ✅ Fully supported

### 4. Constant Variable
- **English**: "Constant"
- **Spanish**: "Constante"
- **Location**: Last row in variable tables (excluded from results)
- **Status**: ✅ Fully supported (automatically skipped)

## SPSS Syntax Commands (Always in English)

These patterns are **language-independent** because SPSS syntax is always in English:
- `LOGISTIC REGRESSION VARIABLES`
- `FILTER BY`
- `USE ALL`
- `/METHOD=ENTER`
- `/PRINT=CI(95)`

## Testing Your File

The parser will work correctly if your SPSS output contains:
1. A table header matching either "Variables in the Equation" OR "Variables en la ecuación"
2. CI column headers with "Lower"/"Inferior" OR "Upper"/"Superior"
3. Step identifiers containing "Step" OR "Paso"
4. The standard SPSS logistic regression output structure

## Column Structure Expected

Regardless of language, the parser expects this column structure in the regression table:

| Column | Content | Notes |
|--------|---------|-------|
| 0 | Step identifier | "Step 1a" or "Paso 1" |
| 1 | Variable name | Variable identifier |
| 2 | B | Beta coefficient |
| 3 | S.E. | Standard error |
| 4 | Wald | Wald statistic |
| 5 | df | Degrees of freedom |
| 6 | Sig. | P-value |
| 7 | Exp(B) | **Odds Ratio (OR)** |
| 8 | Lower CI | **Lower 95% CI** |
| 9 | Upper CI | **Upper 95% CI** |

## What Gets Extracted

For each model, the parser extracts:
- **Outcome variable**: From `LOGISTIC REGRESSION VARIABLES [outcome]`
- **Population**: From `FILTER BY [population]` or "All patients"
- **Variables**: All variables with their OR, 95% CI, and P-values
- **Step information**: For stepwise regression
- **Retention status**: Whether variable was retained or removed

## Troubleshooting

If your file is not recognized:
1. Check that it's in Excel format (.xlsx or .xls)
2. Verify it contains the "Variables in the Equation" table (English) or "Variables en la ecuación" (Spanish)
3. Ensure the table includes 95% confidence intervals (Lower/Upper or Inferior/Superior columns)
4. Confirm the table structure matches the expected column order above

## Future Language Support

To add support for additional languages:
1. Identify the translation of "Variables in the Equation"
2. Identify CI column header translations
3. Identify step identifier patterns
4. Identify constant variable translation
5. Add checks in App.jsx at the marked locations
