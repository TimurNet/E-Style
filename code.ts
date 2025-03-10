/**
 * E-Style Plugin
 * Copyright (C) 2025 [Timur Iakshimbetov]
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

// Отображение UI
figma.showUI(__html__, { width: 400, height: 372 });

// Функция для получения всех переменных в драфте и их отправки в UI
async function getAllVariables() {
  try {
    const variables = await figma.variables.getLocalVariablesAsync();
    if (variables && Array.isArray(variables) && variables.length > 0) {
      const enrichedVariables = await Promise.all(variables.map(async (variable) => {
        const resolvedVariable = await figma.variables.getVariableByIdAsync(variable.id);
        return {
          id: variable.id,
          name: resolvedVariable?.name || 'Unnamed',
          resolvedType: resolvedVariable?.resolvedType || 'Undefined',
        };
      }));

      // Фильтрация переменных с типом String
      const stringVariables = enrichedVariables.filter(variable => variable.resolvedType === 'STRING');

      console.log("Fetched String variables:", stringVariables);
      figma.ui.postMessage({ type: 'display-variables', data: stringVariables });
    } else {
      console.warn("No variables found in the draft.");
      figma.ui.postMessage({ type: 'display-variables', data: [] });
    }
  } catch (error) {
    console.error("Error fetching variables:", error);
    figma.ui.postMessage({ type: 'display-variables', data: [] });
  }
}

async function getAllTextStyles() {
  const localStyles = await figma.getLocalTextStylesAsync();
  const variables = await figma.variables.getLocalVariablesAsync();

  // Проверка на завершение загрузки всех переменных
  if (!variables || !Array.isArray(variables) || variables.length === 0) {
    console.error("No variables fetched or variables not loaded correctly.");
    return [];
  }

  const groupedStyles = localStyles.reduce((groups, style) => {
    const fontFamily = style.fontName.family;
    if (!groups[fontFamily]) {
      groups[fontFamily] = [];
    }
    groups[fontFamily].push(style);
    return groups;
  }, {});

  return Object.entries(groupedStyles).map(([fontFamily, styles]) => {
    return {
      fontFamily,
      styles: Array.isArray(styles) ? styles.map(style => {
        return {
          id: style.id,
          name: style.name || `${fontFamily} (Unnamed Style)`
        };
      }) : []
    };
  });
}

// Функция для обновления привязки переменной для стиля
async function updateBoundVariable(styleId, field, variableId) {
  const textStyle = await figma.getStyleByIdAsync(styleId);
  if (textStyle && textStyle.type === 'TEXT') {
    const variable = variableId ? await figma.variables.getVariableByIdAsync(variableId) : null;
    if (variable) {
      await textStyle.setBoundVariable(field, variable);
    }
  }
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'close-plugin') {
    figma.closePlugin();
  } else if (msg.type === 'apply-variable-to-font-family') {
    const { variableId, field, fontFamily } = msg;
    const groupedStyles = await getAllTextStyles();
    const stylesToUpdate = groupedStyles.find(group => group.fontFamily === fontFamily)?.styles || [];

    for (const style of stylesToUpdate) {
      await updateBoundVariable(style.id, field, variableId);
    }

    figma.ui.postMessage({ type: 'variable-applied-to-font-family' });
  } else if (msg.type === 'get-variables') {
    await getAllVariables();
  } else if (msg.type === 'get-text-styles') {
    const textStyles = await getAllTextStyles();
    figma.ui.postMessage({ type: 'text-styles', data: textStyles });
  }
};
