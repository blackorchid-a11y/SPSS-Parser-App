import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Download, TrendingUp } from 'lucide-react';

export default function SPSSRegressionParser() {
  const [spssFile, setSpssFile] = useState(null);
  const [models, setModels] = useState([]);
  const [selectedModels, setSelectedModels] = useState([]);
  const [status, setStatus] = useState('Upload an SPSS Excel file to begin');
  const [processing, setProcessing] = useState(false);
  const [forestPlotModel, setForestPlotModel] = useState(null);
  const [forestSettings, setForestSettings] = useState({
    title: 'Forest Plot',
    footnote: 'Error bars represent 95% confidence intervals',
    scale: 'linear',
    fontSize: 14,
    plotWidth: 1100,
    plotHeight: 600,
    showOnlyRetained: false
  });
  const [variableSettings, setVariableSettings] = useState({});
  const svgRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSpssFile(file);
    setStatus('Analyzing file...');
    setProcessing(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, {
        cellStyles: true,
        cellFormulas: true,
        cellDates: true,
        cellNF: true,
        sheetStubs: true
      });

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      // Find all "Variables en la ecuación" tables and group by model
      const modelGroups = [];
      let currentModelSteps = [];
      let lastModelContext = null;
      
      for (let i = 0; i < data.length - 5; i++) {
        const row = data[i];
        
        // Detect model context - look for "FILTER BY [population]" or "USE ALL"
        if (row[0]) {
          const cellText = row[0].toString();
          
          // Check for "FILTER BY [population]"
          if (cellText.includes("FILTER BY") && cellText.includes(".")) {
            // If we have accumulated steps, save them
            if (currentModelSteps.length > 0) {
              modelGroups.push({
                context: lastModelContext,
                steps: currentModelSteps
              });
              currentModelSteps = [];
            }
            
            // Extract population name
            const match = cellText.match(/FILTER BY\s+([^.\s]+)/);
            lastModelContext = match ? match[1] : 'Unknown';
          }
          // Check for "USE ALL" without FILTER BY (means all population)
          else if (cellText.includes("USE ALL")) {
            // Check if next few rows have FILTER BY
            let hasFilter = false;
            for (let j = i; j < Math.min(i + 5, data.length); j++) {
              if (data[j][0] && data[j][0].toString().includes("FILTER BY")) {
                hasFilter = true;
                break;
              }
            }
            
            // If no filter found, this is "All patients"
            if (!hasFilter && currentModelSteps.length > 0) {
              modelGroups.push({
                context: lastModelContext,
                steps: currentModelSteps
              });
              currentModelSteps = [];
              lastModelContext = 'All patients';
            }
          }
        }
        
        // Look for "Variables en la ecuación" header
        if (row[0] === "Variables en la ecuación") {
          const headerRow1 = data[i + 1];
          const headerRow2 = data[i + 2];
          
          // Try to find outcome variable by looking backwards for "LOGISTIC REGRESSION VARIABLES"
          // Search far back to handle long stepwise regressions (e.g., 16+ steps)
          let outcomeVariable = null;
          for (let k = Math.max(0, i - 500); k < i; k++) {
            const cellText = data[k][0] ? data[k][0].toString().trim() : '';
            
            // Look for "LOGISTIC REGRESSION VARIABLES [outcome]"
            if (cellText.toUpperCase().includes("LOGISTIC") && cellText.toUpperCase().includes("REGRESSION") && cellText.toUpperCase().includes("VARIABLES")) {
              // Extract outcome - it's between "VARIABLES" and either "/" or newline
              // Handle potential variations: "VARIABLES Exitus", "VARIABLES Exitus /METHOD", etc.
              const match = cellText.match(/VARIABLES\s+([A-Za-z_]\w*)/i);
              if (match && match[1]) {
                outcomeVariable = match[1];
                console.log(`Found outcome: ${outcomeVariable}`);
                break;
              }
            }
          }
          
          // Check if this has confidence intervals
          if (headerRow2 && (headerRow2[8] === "Inferior" || headerRow2.includes("Inferior"))) {
            const variables = [];
            let stepNumber = null;
            let consecutiveEmptyRows = 0;
            
            // Extract variables - search further for complete stepwise results
            for (let j = i + 3; j < Math.min(data.length, i + 200); j++) {
              const varRow = data[j];
              
              // Check for step number (e.g., "Paso 1", "Paso 2", etc.)
              // The step number and first variable are IN THE SAME ROW
              if (varRow[0] && varRow[0].toString().includes("Paso")) {
                stepNumber = varRow[0].toString().trim();
                consecutiveEmptyRows = 0; // Reset empty row counter
                // DO NOT continue - process the variable data in this same row
              }
              
              // Track consecutive empty rows to detect end of table
              if (!varRow[1] || varRow[1] === "") {
                consecutiveEmptyRows++;
                // Stop if we have 3+ consecutive empty rows (likely end of table)
                if (consecutiveEmptyRows >= 3) {
                  break;
                }
                continue;
              }
              
              // Reset empty row counter if we found data
              consecutiveEmptyRows = 0;
              
              // Skip "Constante"
              if (varRow[1] === "Constante") {
                continue;
              }
              
              // Must have OR (Exp(B)) data
              if (varRow[7] !== undefined && varRow[7] !== null && varRow[7] !== '') {
                variables.push({
                  name: varRow[1],
                  OR: varRow[7],
                  lowerCI: varRow[8],
                  upperCI: varRow[9],
                  pValue: varRow[6],
                  step: stepNumber || 'Paso 1'
                });
              }
            }
            
            if (variables.length > 0) {
              currentModelSteps.push({
                rowStart: i,
                stepNumber: stepNumber || 'Paso 1',
                variables: variables,
                outcome: outcomeVariable
              });
            }
          }
        }
      }
      
      // Add last model if exists
      if (currentModelSteps.length > 0) {
        modelGroups.push({
          context: lastModelContext || 'All patients',
          steps: currentModelSteps
        });
      }

      // Process each model group to create comprehensive variable list
      const processedModels = modelGroups.map((group, idx) => {
        const variableHistory = {};
        
        // Get outcome from first step (should be consistent across steps)
        const outcome = group.steps[0]?.outcome || null;
        
        // Track all variables across all steps - keep updating with latest values
        group.steps.forEach(step => {
          step.variables.forEach(variable => {
            // Always update to keep the most recent appearance
            variableHistory[variable.name] = {
              name: variable.name,
              OR: variable.OR,
              lowerCI: variable.lowerCI,
              upperCI: variable.upperCI,
              pValue: variable.pValue,
              lastStep: step.stepNumber,
              lastStepNumber: parseInt(step.stepNumber.replace(/\D/g, '')) || 1
            };
          });
        });
        
        // Get final step
        const finalStep = group.steps[group.steps.length - 1];
        const finalVariableNames = new Set(finalStep.variables.map(v => v.name));
        
        // Create comprehensive variable list
        const allVariables = Object.values(variableHistory).map(data => ({
          ...data,
          inFinalModel: finalVariableNames.has(data.name),
          status: finalVariableNames.has(data.name) ? 'Retained' : 'Removed'
        }));
        
        // Sort: retained first (by name), then removed (by name)
        allVariables.sort((a, b) => {
          if (a.inFinalModel !== b.inFinalModel) {
            return a.inFinalModel ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
        
        return {
          id: idx,
          name: group.context || `Model ${idx + 1}`,
          outcome: outcome,
          totalSteps: group.steps.length,
          finalStepNumber: finalStep.stepNumber,
          variables: allVariables,
          retainedCount: allVariables.filter(v => v.inFinalModel).length,
          removedCount: allVariables.filter(v => !v.inFinalModel).length
        };
      });

      setModels(processedModels);
      setSelectedModels(processedModels.map(m => m.id));
      setStatus(`✅ Found ${processedModels.length} logistic regression model(s)`);
      setProcessing(false);

    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
      setProcessing(false);
      console.error(error);
    }
  };

  const toggleModel = (modelId) => {
    if (selectedModels.includes(modelId)) {
      setSelectedModels(selectedModels.filter(id => id !== modelId));
    } else {
      setSelectedModels([...selectedModels, modelId]);
    }
  };

  const exportToExcel = () => {
    if (selectedModels.length === 0) {
      setStatus('❌ Please select at least one model to export');
      return;
    }

    setStatus('Creating Excel file...');

    try {
      const wb = XLSX.utils.book_new();
      const usedSheetNames = new Set();

      selectedModels.forEach(modelId => {
        const model = models.find(m => m.id === modelId);
        if (!model) return;

        // Helper function to round numbers
        const roundNum = (val) => {
          if (val === null || val === undefined || val === '') return '';
          const num = parseFloat(val);
          return isNaN(num) ? val : num.toFixed(1);
        };

        // Create data array with outcome and population as title
        const titleRows = [
          [`Outcome Variable: ${model.outcome || 'Unknown'}`]
        ];
        
        if (model.name !== 'All patients') {
          titleRows.push([`Population: ${model.name}`]);
        } else {
          titleRows.push(['Population: All patients']);
        }
        
        titleRows.push([`Analysis: ${model.finalStepNumber} (${model.totalSteps} total steps)`]);
        titleRows.push([]);
        
        const sheetData = [
          ...titleRows,
          ['Variable', 'Status', 'OR', '95% CI Lower', '95% CI Upper', 'P-Value'],
          ...model.variables.map(v => [
            v.name,
            v.status,
            roundNum(v.OR),
            roundNum(v.lowerCI),
            roundNum(v.upperCI),
            v.pValue < 0.001 ? '<0.001' : roundNum(v.pValue)
          ])
        ];

        // Create worksheet
        const ws = XLSX.utils.aoa_to_sheet(sheetData);

        // Set column widths
        ws['!cols'] = [
          { wch: 25 },
          { wch: 10 },
          { wch: 10 },
          { wch: 12 },
          { wch: 12 },
          { wch: 12 }
        ];

        // Style the title rows
        if (ws['A1']) ws['A1'].s = { font: { bold: true, sz: 14 } };
        if (ws['A2']) ws['A2'].s = { font: { bold: true } };
        if (ws['A3']) ws['A3'].s = { font: { italic: true } };
        
        // Style header row (row 5)
        ['A5', 'B5', 'C5', 'D5', 'E5', 'F5'].forEach(cell => {
          if (ws[cell]) {
            ws[cell].s = { 
              font: { bold: true },
              fill: { fgColor: { rgb: "E0E0E0" } },
              alignment: { horizontal: 'center' }
            };
          }
        });

        // Add to workbook with safe and unique sheet name
        const modelName = model.name || `Model_${modelId + 1}`;
        let baseSheetName = modelName.substring(0, 28).replace(/[:\\/?*\[\]]/g, '_');
        let sheetName = baseSheetName;
        let counter = 1;
        
        // Ensure uniqueness
        while (usedSheetNames.has(sheetName)) {
          sheetName = `${baseSheetName}_${counter}`;
          counter++;
        }
        
        usedSheetNames.add(sheetName);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });

      // Generate file
      const outputBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const blob = new Blob([outputBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'SPSS_Logistic_Regression_Results.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus('✅ Excel file downloaded!');

    } catch (error) {
      setStatus(`❌ Error creating file: ${error.message}`);
      console.error(error);
    }
  };

  const openForestPlot = (model) => {
    setForestPlotModel(model);
    setForestSettings({
      ...forestSettings,
      title: `${model.outcome || 'Outcome'} - ${model.name}`,
      showOnlyRetained: true
    });
    
    // Helper to check if values are valid for plotting
    const isValidValue = (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && isFinite(num) && num > 0;
    };
    
    // Initialize variable settings for this model
    const varSettings = {};
    model.variables.forEach(v => {
      const isSignificant = !(v.lowerCI <= 1.0 && v.upperCI >= 1.0);
      
      varSettings[v.name] = {
        enabled: v.inFinalModel, // Default: show retained variables (even if invalid values)
        color: isSignificant ? '#000000' : '#808080', // Default: black for significant, gray for non-significant
        displayName: v.name // Default: use original name
      };
    });
    setVariableSettings(varSettings);
  };

  const updateVariableSetting = (varName, field, value) => {
    setVariableSettings(prev => ({
      ...prev,
      [varName]: {
        ...prev[varName],
        [field]: value
      }
    }));
  };

  const scaleValue = (value) => {
    if (forestSettings.scale === 'log') {
      return Math.log(value);
    }
    return value;
  };

  const renderForestPlot = () => {
    if (!forestPlotModel) return null;

    // Filter based on individual variable enabled/disabled state
    const displayVars = forestPlotModel.variables.filter(v => 
      variableSettings[v.name]?.enabled
    );

    if (displayVars.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No variables selected. Please enable at least one variable to display.
        </div>
      );
    }

    // Helper to check if values are valid for plotting
    const isValidValue = (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && isFinite(num) && num > 0;
    };

    const hasValidValues = (v) => {
      return isValidValue(v.OR) && isValidValue(v.lowerCI) && isValidValue(v.upperCI);
    };

    // Get only valid variables for scale calculation
    const validVarsForScale = displayVars.filter(v => hasValidValues(v));

    if (validVarsForScale.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <p className="font-semibold mb-2">Cannot calculate plot scale</p>
          <p>All selected variables have invalid values (zero, NaN, or negative).</p>
          <p className="mt-2 text-xs">These variables will be listed but cannot be plotted.</p>
        </div>
      );
    }

    const margin = { top: 80, right: 240, bottom: 80, left: 280 };
    const plotWidth = forestSettings.plotWidth - margin.left - margin.right;
    const plotHeight = forestSettings.plotHeight - margin.top - margin.bottom;
    
    // Get all actual data values including CIs - ONLY from valid variables for scale calculation
    const allValues = validVarsForScale.flatMap(d => [
      parseFloat(d.lowerCI), 
      parseFloat(d.OR), 
      parseFloat(d.upperCI)
    ]).filter(v => !isNaN(v) && v > 0); // Filter out invalid values
    
    const dataMin = Math.min(...allValues);
    const dataMax = Math.max(...allValues);
    
    // For logarithmic scale, calculate appropriate bounds
    let paddedMin, paddedMax;
    if (forestSettings.scale === 'log') {
      // Round down to nearest power of 10 or common tick mark
      const logMin = Math.log10(dataMin);
      const logMax = Math.log10(dataMax);
      
      // Extend range by ~20% in log space
      const logRange = logMax - logMin;
      const extendedLogMin = logMin - logRange * 0.2;
      const extendedLogMax = logMax + logRange * 0.2;
      
      paddedMin = Math.pow(10, extendedLogMin);
      paddedMax = Math.pow(10, extendedLogMax);
    } else {
      // Linear scale padding
      paddedMin = dataMin * 0.7;
      paddedMax = dataMax * 1.3;
    }
    
    const xScale = (val) => {
      const scaled = scaleValue(val);
      const minScaled = scaleValue(paddedMin);
      const maxScaled = scaleValue(paddedMax);
      return margin.left + (scaled - minScaled) / (maxScaled - minScaled) * plotWidth;
    };
    
    // Generate appropriate tick marks for logarithmic scale
    const getLogTicks = () => {
      const ticks = [];
      const allPossibleTicks = [
        0.01, 0.02, 0.05, 
        0.1, 0.2, 0.5, 
        1, 2, 5, 
        10, 20, 50, 
        100, 200, 500
      ];
      
      for (let tick of allPossibleTicks) {
        if (tick >= paddedMin && tick <= paddedMax) {
          ticks.push(tick);
        }
      }
      
      // Always include 1.0 if it's within reasonable range
      if (paddedMin <= 1 && paddedMax >= 1 && !ticks.includes(1)) {
        ticks.push(1);
        ticks.sort((a, b) => a - b);
      }
      
      // Ensure we have at least 3 ticks
      if (ticks.length < 3) {
        // Add more intermediate ticks if needed
        const logMin = Math.log10(paddedMin);
        const logMax = Math.log10(paddedMax);
        const logStep = (logMax - logMin) / 4;
        
        for (let i = 0; i <= 4; i++) {
          const tickVal = Math.pow(10, logMin + i * logStep);
          if (!ticks.some(t => Math.abs(t - tickVal) < tickVal * 0.01)) {
            ticks.push(tickVal);
          }
        }
        ticks.sort((a, b) => a - b);
      }
      
      return ticks;
    };
    
    const rowHeight = plotHeight / displayVars.length;
    
    const problematicCount = displayVars.filter(v => !hasValidValues(v)).length;
    
    return (
      <>
        {problematicCount > 0 && (
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
            <p className="font-semibold text-blue-800">ℹ️ Note: {problematicCount} variable(s) displayed without confidence intervals</p>
            <p className="text-blue-700 mt-1">
              Variables with invalid values (zero, NaN, or not estimable) are listed but shown without bars. This typically indicates perfect prediction or model convergence issues.
            </p>
          </div>
        )}
        <svg 
        ref={svgRef} 
        width={forestSettings.plotWidth} 
        height={forestSettings.plotHeight}
        style={{ fontFamily: 'Arial', fontSize: forestSettings.fontSize }}
      >
        <rect width={forestSettings.plotWidth} height={forestSettings.plotHeight} fill="white" />
        
        <text 
          x={forestSettings.plotWidth / 2} 
          y={30} 
          textAnchor="middle" 
          fontSize={forestSettings.fontSize + 4} 
          fontWeight="bold"
        >
          {forestSettings.title}
        </text>
        
        <text 
          x={margin.left - 10} 
          y={margin.top - 20} 
          textAnchor="end" 
          fontWeight="bold"
        >
          Variable
        </text>
        <text 
          x={forestSettings.plotWidth - margin.right + 10} 
          y={margin.top - 20} 
          textAnchor="start" 
          fontWeight="bold"
        >
          OR (95% CI)
        </text>
        
        {/* Null effect line at OR = 1 */}
        {paddedMin <= 1 && paddedMax >= 1 && (
          <line 
            x1={xScale(1)} 
            y1={margin.top} 
            x2={xScale(1)} 
            y2={forestSettings.plotHeight - margin.bottom} 
            stroke="#000" 
            strokeWidth="1.5"
          />
        )}
        
        {displayVars.map((row, idx) => {
          const y = margin.top + (idx + 0.5) * rowHeight;
          const color = variableSettings[row.name]?.color || '#000000';
          const displayName = variableSettings[row.name]?.displayName || row.name;
          const isValid = hasValidValues(row);
          
          return (
            <g key={idx}>
              <text x={margin.left - 10} y={y + 5} textAnchor="end" fill={isValid ? '#000' : '#999'}>
                {displayName}
              </text>
              
              {isValid ? (
                <>
                  {/* Draw confidence interval bar and point for valid variables */}
                  <line 
                    x1={xScale(parseFloat(row.lowerCI))} 
                    y1={y} 
                    x2={xScale(parseFloat(row.upperCI))} 
                    y2={y} 
                    stroke={color} 
                    strokeWidth="2" 
                  />
                  <line 
                    x1={xScale(parseFloat(row.lowerCI))} 
                    y1={y - 5} 
                    x2={xScale(parseFloat(row.lowerCI))} 
                    y2={y + 5} 
                    stroke={color} 
                    strokeWidth="2" 
                  />
                  <line 
                    x1={xScale(parseFloat(row.upperCI))} 
                    y1={y - 5} 
                    x2={xScale(parseFloat(row.upperCI))} 
                    y2={y + 5} 
                    stroke={color} 
                    strokeWidth="2" 
                  />
                  <rect 
                    x={xScale(parseFloat(row.OR)) - 4} 
                    y={y - 4} 
                    width="8" 
                    height="8" 
                    fill={color} 
                  />
                  <text x={forestSettings.plotWidth - margin.right + 10} y={y + 5} textAnchor="start">
                    {parseFloat(row.OR).toFixed(2)} ({parseFloat(row.lowerCI).toFixed(2)}-{parseFloat(row.upperCI).toFixed(2)})
                  </text>
                </>
              ) : (
                <>
                  {/* For invalid variables, just show the text values in gray/italics */}
                  <text 
                    x={forestSettings.plotWidth - margin.right + 10} 
                    y={y + 5} 
                    textAnchor="start" 
                    fill="#999"
                    fontStyle="italic"
                  >
                    {row.OR} ({row.lowerCI}-{row.upperCI}) - Not estimable
                  </text>
                </>
              )}
            </g>
          );
        })}
        
        {/* X-axis ticks and labels */}
        {forestSettings.scale === 'linear' && (
          <g>
            {[paddedMin, (paddedMin + paddedMax) / 2, paddedMax].map((val, idx) => (
              <g key={idx}>
                <line 
                  x1={xScale(val)} 
                  y1={forestSettings.plotHeight - margin.bottom} 
                  x2={xScale(val)} 
                  y2={forestSettings.plotHeight - margin.bottom + 5} 
                  stroke="#000" 
                  strokeWidth="1"
                />
                <text 
                  x={xScale(val)} 
                  y={forestSettings.plotHeight - margin.bottom + 20} 
                  textAnchor="middle"
                  fontSize={forestSettings.fontSize - 2}
                >
                  {val.toFixed(2)}
                </text>
              </g>
            ))}
          </g>
        )}
        
        {forestSettings.scale === 'log' && (
          <g>
            {getLogTicks().map(val => (
              <g key={val}>
                <line 
                  x1={xScale(val)} 
                  y1={margin.top} 
                  x2={xScale(val)} 
                  y2={forestSettings.plotHeight - margin.bottom} 
                  stroke="#e0e0e0" 
                  strokeWidth="1"
                  strokeDasharray={val === 1 ? "0" : "3,3"}
                />
                <line 
                  x1={xScale(val)} 
                  y1={forestSettings.plotHeight - margin.bottom} 
                  x2={xScale(val)} 
                  y2={forestSettings.plotHeight - margin.bottom + 5} 
                  stroke="#000" 
                  strokeWidth="1"
                />
                <text 
                  x={xScale(val)} 
                  y={forestSettings.plotHeight - margin.bottom + 20} 
                  textAnchor="middle"
                  fontSize={forestSettings.fontSize - 2}
                >
                  {val < 1 ? val.toFixed(2) : val.toFixed(val >= 10 ? 0 : 1)}
                </text>
              </g>
            ))}
          </g>
        )}
        
        <text 
          x={forestSettings.plotWidth / 2} 
          y={forestSettings.plotHeight - 20} 
          textAnchor="middle" 
          fontSize={forestSettings.fontSize - 2}
          fontStyle="italic"
        >
          {forestSettings.footnote}
        </text>
      </svg>
      </>
    );
  };

  const downloadForestPlotSVG = () => {
    const svgElement = svgRef.current;
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `forest-plot-${forestPlotModel.name.replace(/[^a-z0-9]/gi, '_')}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadForestPlotPNG = () => {
    const svgElement = svgRef.current;
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    const dpi = 800;
    const scaleFactor = dpi / 96;
    canvas.width = forestSettings.plotWidth * scaleFactor;
    canvas.height = forestSettings.plotHeight * scaleFactor;
    ctx.scale(scaleFactor, scaleFactor);
    
    img.onload = () => {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `forest-plot-${forestPlotModel.name.replace(/[^a-z0-9]/gi, '_')}.png`;
        link.click();
        URL.revokeObjectURL(url);
      });
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            SPSS Logistic Regression Parser
          </h1>
          <p className="text-gray-600 mb-6">
            Extract comprehensive results from stepwise logistic regression
          </p>

          {/* File Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload SPSS Output (Excel format)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-6 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
            />
            {spssFile && (
              <p className="text-xs text-green-600 mt-2">✓ {spssFile.name}</p>
            )}
          </div>

          {/* Status */}
          <div className="mb-6">
            <div className={`p-4 rounded-lg ${
              status.includes('✅') ? 'bg-green-50 border border-green-200' :
              status.includes('❌') ? 'bg-red-50 border border-red-200' :
              'bg-blue-50 border border-blue-200'
            }`}>
              <p className="text-sm font-medium">{status}</p>
            </div>
          </div>

          {/* Models List */}
          {models.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Found Models ({models.length})
              </h2>
              <div className="space-y-3">
                {models.map(model => (
                  <div
                    key={model.id}
                    className={`p-4 rounded-lg border-2 ${
                      selectedModels.includes(model.id)
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1 cursor-pointer" onClick={() => toggleModel(model.id)}>
                        <h3 className="font-semibold text-gray-800">
                          <span className="text-purple-600">Outcome: {model.outcome || 'Unknown'}</span>
                          {model.name !== 'All patients' && (
                            <span className="text-blue-600 ml-2">• Population: {model.name}</span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {model.totalSteps} steps (final: {model.finalStepNumber}) • 
                          <span className="text-green-600 ml-1">{model.retainedCount} retained</span> • 
                          <span className="text-orange-600 ml-1">{model.removedCount} removed</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openForestPlot(model)}
                          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 text-sm"
                          title="Generate Forest Plot"
                        >
                          <TrendingUp size={16} />
                          Forest Plot
                        </button>
                        <input
                          type="checkbox"
                          checked={selectedModels.includes(model.id)}
                          onChange={() => toggleModel(model.id)}
                          className="w-5 h-5 text-purple-600 rounded"
                        />
                      </div>
                    </div>
                    
                    {/* Variable preview */}
                    <div className="mt-3 text-xs">
                      <div className="text-green-700 mb-1">
                        <span className="font-medium">Retained: </span>
                        {model.variables.filter(v => v.inFinalModel).slice(0, 4).map(v => v.name).join(', ')}
                        {model.retainedCount > 4 && '...'}
                      </div>
                      {model.removedCount > 0 && (
                        <div className="text-orange-700">
                          <span className="font-medium">Removed: </span>
                          {model.variables.filter(v => !v.inFinalModel).slice(0, 4).map(v => v.name).join(', ')}
                          {model.removedCount > 4 && '...'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Export Button */}
          {models.length > 0 && (
            <button
              onClick={exportToExcel}
              disabled={selectedModels.length === 0}
              className={`w-full py-4 px-6 rounded-lg font-semibold text-white transition-colors ${
                selectedModels.length > 0
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              Export {selectedModels.length} Selected Model(s) to Excel
            </button>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-800 mb-3">How it works:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
            <li>Upload your SPSS logistic regression output (Excel format)</li>
            <li>The tool finds all "Variables en la ecuación" tables</li>
            <li>For stepwise regression, it tracks variables across all steps</li>
            <li>Creates comprehensive tables showing:
              <ul className="list-disc list-inside ml-6 mt-1">
                <li><strong>Retained variables:</strong> Final step values</li>
                <li><strong>Removed variables:</strong> Last step values before removal</li>
              </ul>
            </li>
            <li>Export includes OR, CI, P-value, and status for each variable</li>
            <li><strong>NEW:</strong> Generate publication-ready forest plots for each model</li>
          </ol>
        </div>
      </div>

      {/* Forest Plot Modal */}
      {forestPlotModel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Forest Plot Generator</h2>
                <button
                  onClick={() => setForestPlotModel(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Settings */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Title</label>
                  <input
                    type="text"
                    value={forestSettings.title}
                    onChange={(e) => setForestSettings({...forestSettings, title: e.target.value})}
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Scale</label>
                  <select
                    value={forestSettings.scale}
                    onChange={(e) => setForestSettings({...forestSettings, scale: e.target.value})}
                    className="w-full px-2 py-1 border rounded text-sm"
                  >
                    <option value="linear">Linear</option>
                    <option value="log">Logarithmic</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Font Size</label>
                  <input
                    type="number"
                    value={forestSettings.fontSize}
                    onChange={(e) => setForestSettings({...forestSettings, fontSize: parseInt(e.target.value)})}
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 mt-6">
                    <button
                      onClick={() => {
                        const newSettings = {...variableSettings};
                        forestPlotModel.variables.forEach(v => {
                          newSettings[v.name] = {...newSettings[v.name], enabled: true};
                        });
                        setVariableSettings(newSettings);
                      }}
                      className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => {
                        const newSettings = {...variableSettings};
                        forestPlotModel.variables.forEach(v => {
                          newSettings[v.name] = {...newSettings[v.name], enabled: false};
                        });
                        setVariableSettings(newSettings);
                      }}
                      className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Clear All
                    </button>
                  </label>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Footnote</label>
                <input
                  type="text"
                  value={forestSettings.footnote}
                  onChange={(e) => setForestSettings({...forestSettings, footnote: e.target.value})}
                  className="w-full px-2 py-1 border rounded text-sm"
                />
              </div>

              {/* Variable Selection Table */}
              <div className="mb-4 max-h-60 overflow-y-auto border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Include</th>
                      <th className="px-3 py-2 text-left">Variable</th>
                      <th className="px-3 py-2 text-left">Display Name</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">OR (95% CI)</th>
                      <th className="px-3 py-2 text-left">Color</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forestPlotModel.variables.map((v, idx) => {
                      const isValidValue = (val) => {
                        const num = parseFloat(val);
                        return !isNaN(num) && isFinite(num) && num > 0;
                      };
                      const hasProblematicValues = !isValidValue(v.OR) || !isValidValue(v.lowerCI) || !isValidValue(v.upperCI);
                      
                      return (
                        <tr key={idx} className={`border-t hover:bg-gray-50 ${hasProblematicValues ? 'bg-blue-50' : ''}`}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={variableSettings[v.name]?.enabled || false}
                              onChange={(e) => updateVariableSetting(v.name, 'enabled', e.target.checked)}
                              className="w-4 h-4"
                            />
                          </td>
                          <td className="px-3 py-2 font-medium">
                            {v.name}
                            {hasProblematicValues && (
                              <span className="ml-2 text-xs text-blue-700" title="Will be listed without confidence interval bars (not estimable)">
                                ℹ️
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={variableSettings[v.name]?.displayName || v.name}
                              onChange={(e) => updateVariableSetting(v.name, 'displayName', e.target.value)}
                              className="w-full px-2 py-1 border rounded text-sm"
                              placeholder={v.name}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              v.inFinalModel 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-orange-100 text-orange-800'
                            }`}>
                              {v.status}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {parseFloat(v.OR).toFixed(2)} ({parseFloat(v.lowerCI).toFixed(2)}-{parseFloat(v.upperCI).toFixed(2)})
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="color"
                              value={variableSettings[v.name]?.color || '#000000'}
                              onChange={(e) => updateVariableSetting(v.name, 'color', e.target.value)}
                              className="w-12 h-8 border rounded cursor-pointer"
                              disabled={!variableSettings[v.name]?.enabled || hasProblematicValues}
                              title={hasProblematicValues ? "Color not applicable for non-estimable variables" : ""}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Preview */}
              <div className="bg-gray-50 p-4 rounded-lg mb-4 overflow-auto">
                {renderForestPlot()}
              </div>

              {/* Download Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={downloadForestPlotSVG}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  Download SVG
                </button>
                <button
                  onClick={downloadForestPlotPNG}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  Download PNG (800 DPI)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}