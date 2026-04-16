/**
 * dependencyResolver.js
 * -------------------------------------------------------------------
 * Builds a dependency graph from a list of parameters and returns
 * them in topological execution order using Kahn's BFS algorithm.
 * Throws a descriptive error if a circular dependency is detected.
 *
 * Each parameter has:
 *   { key: string, formula: string }
 *
 * A formula like "weight * rate" means this parameter depends on
 * any OTHER parameter whose key matches "weight" or "rate".
 * -------------------------------------------------------------------
 */

const { parse } = require('mathjs');

/**
 * Extract all symbol/variable names from a mathjs formula string.
 * Uses the AST parser — completely safe, no eval.
 *
 * @param {string} formula
 * @returns {string[]}  array of variable names
 */
function extractVariables(formula) {
  try {
    const node = parse(formula);
    const vars = new Set();
    node.traverse((n) => {
      if (n.isSymbolNode) {
        // Exclude mathjs built-in constants like pi, e, true, false, etc.
        const builtins = new Set([
          'pi', 'e', 'true', 'false', 'Infinity', 'NaN',
          'i', 'phi', 'tau', 'null', 'undefined',
        ]);
        if (!builtins.has(n.name)) {
          vars.add(n.name);
        }
      }
    });
    return Array.from(vars);
  } catch (err) {
    throw new Error(`Invalid formula syntax: "${formula}" — ${err.message}`);
  }
}

/**
 * Perform Kahn's topological sort on the dependency graph.
 *
 * @param {Array<{key:string, formula:string}>} parameters
 * @returns {Array<{key:string, formula:string}>}  sorted parameters (dependencies first)
 * @throws Error on circular dependency
 */
function topologicalSort(parameters) {
  // Build a map key → parameter for O(1) lookups
  const paramMap = new Map(parameters.map((p) => [p.key, p]));
  const paramKeys = new Set(paramMap.keys());

  // Build adjacency list and in-degree map
  // Edge direction: A → B means "B depends on A" (A must run before B)
  const adjList = new Map();   // key → Set of keys that depend on it
  const inDegree = new Map();  // key → number of unresolved dependencies

  for (const param of parameters) {
    if (!adjList.has(param.key)) adjList.set(param.key, new Set());
    if (!inDegree.has(param.key)) inDegree.set(param.key, 0);

    const deps = extractVariables(param.formula);

    for (const dep of deps) {
      // Only count dependencies that are OTHER parameters (not raw inputs)
      if (paramKeys.has(dep) && dep !== param.key) {
        // dep must run before param.key
        if (!adjList.has(dep)) adjList.set(dep, new Set());
        adjList.get(dep).add(param.key);
        inDegree.set(param.key, (inDegree.get(param.key) || 0) + 1);
      }
    }
  }

  // Kahn's BFS: start with nodes that have no dependencies
  const queue = [];
  for (const [key, degree] of inDegree.entries()) {
    if (degree === 0) queue.push(key);
  }

  const sorted = [];
  while (queue.length > 0) {
    const current = queue.shift();
    sorted.push(paramMap.get(current));

    for (const neighbor of adjList.get(current) || []) {
      const newDegree = inDegree.get(neighbor) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  // If not all nodes were processed → circular dependency exists
  if (sorted.length !== parameters.length) {
    const remaining = parameters
      .filter((p) => !sorted.some((s) => s.key === p.key))
      .map((p) => `"${p.key}" (formula: ${p.formula})`)
      .join(', ');
    throw new Error(
      `Circular dependency detected among parameters: ${remaining}`
    );
  }

  return sorted;
}

/**
 * Extract variables from formula and return which ones are
 * "input variables" (not defined by any parameter).
 *
 * @param {string} formula
 * @param {string[]} paramKeys  all known parameter keys
 * @returns {string[]}  variables that need to be provided as user inputs
 */
function getInputVariables(formula, paramKeys) {
  const keySet = new Set(paramKeys);
  return extractVariables(formula).filter((v) => !keySet.has(v));
}

/**
 * Given an array of parameters, collect ALL unique input variables
 * required across all formulas (i.e. variables that are not
 * themselves a parameter key).
 *
 * @param {Array<{key:string, formula:string}>} parameters
 * @returns {string[]}
 */
function collectAllInputVariables(parameters) {
  const paramKeys = parameters.map((p) => p.key);
  const keySet = new Set(paramKeys);
  const inputs = new Set();

  for (const param of parameters) {
    const vars = extractVariables(param.formula);
    for (const v of vars) {
      if (!keySet.has(v)) inputs.add(v);
    }
  }

  return Array.from(inputs);
}

module.exports = {
  extractVariables,
  topologicalSort,
  getInputVariables,
  collectAllInputVariables,
};
