const STORAGE_KEY = "kelly-position-helper-state-v3";
const HISTORY_KEY = "kelly-position-helper-history-v1";
const HISTORY_LIMIT = 12;

const modeCopyMap = {
  standard: "继续沿用你原来的输入方式：盈利金额、亏损本金、盈利概率、亏损概率。",
  worldCup:
    "更贴近世界杯实际投注场景：直接用赔率、主观胜率和单场上限来控制仓位。",
};

const modeButtons = [...document.querySelectorAll(".mode-btn")];
const standardForm = document.querySelector("#standardForm");
const worldCupForm = document.querySelector("#worldCupForm");
const standardResetButton = document.querySelector("#standardResetButton");
const worldResetButton = document.querySelector("#worldResetButton");
const clearHistoryButton = document.querySelector("#clearHistoryButton");
const installButton = document.querySelector("#installButton");
const installTip = document.querySelector("#installTip");
const modeCopy = document.querySelector("#modeCopy");
const binaryFields = document.querySelector("#binaryFields");
const threeWayFields = document.querySelector("#threeWayFields");
const applyScoreHelperButton = document.querySelector("#applyScoreHelperButton");

const standardInputs = {
  gainAmount: document.querySelector("#gainAmount"),
  lossAmount: document.querySelector("#lossAmount"),
  winProbability: document.querySelector("#winProbability"),
  lossProbability: document.querySelector("#lossProbability"),
  bankroll: document.querySelector("#bankroll"),
  riskFactor: document.querySelector("#riskFactor"),
};

const worldInputs = {
  matchName: document.querySelector("#matchName"),
  marketType: document.querySelector("#marketType"),
  selectionLabel: document.querySelector("#selectionLabel"),
  decimalOdds: document.querySelector("#decimalOdds"),
  subjectiveProbability: document.querySelector("#subjectiveProbability"),
  homeExpectedGoals: document.querySelector("#homeExpectedGoals"),
  awayExpectedGoals: document.querySelector("#awayExpectedGoals"),
  targetHomeGoals: document.querySelector("#targetHomeGoals"),
  targetAwayGoals: document.querySelector("#targetAwayGoals"),
  tempoBias: document.querySelector("#tempoBias"),
  homeTeam: document.querySelector("#homeTeam"),
  awayTeam: document.querySelector("#awayTeam"),
  homeProbability: document.querySelector("#homeProbability"),
  drawProbability: document.querySelector("#drawProbability"),
  awayProbability: document.querySelector("#awayProbability"),
  homeOdds: document.querySelector("#homeOdds"),
  drawOdds: document.querySelector("#drawOdds"),
  awayOdds: document.querySelector("#awayOdds"),
  worldBankroll: document.querySelector("#worldBankroll"),
  riskFactorWorld: document.querySelector("#riskFactorWorld"),
  maxStakePercent: document.querySelector("#maxStakePercent"),
};

const output = {
  title: document.querySelector("#resultTitle"),
  summary: document.querySelector("#resultSummary"),
  kellyValue: document.querySelector("#kellyValue"),
  kellyHint: document.querySelector("#kellyHint"),
  evValue: document.querySelector("#evValue"),
  evHint: document.querySelector("#evHint"),
  stakeRatio: document.querySelector("#stakeRatio"),
  stakeHint: document.querySelector("#stakeHint"),
  stakeAmount: document.querySelector("#stakeAmount"),
  amountHint: document.querySelector("#amountHint"),
  referenceLabel: document.querySelector("#referenceLabel"),
  referenceValue: document.querySelector("#referenceValue"),
  referenceHint: document.querySelector("#referenceHint"),
  strategyLabel: document.querySelector("#strategyLabel"),
  strategyValue: document.querySelector("#strategyValue"),
  strategyHint: document.querySelector("#strategyHint"),
  formulaTitle: document.querySelector("#formulaTitle"),
  formulaCode: document.querySelector("#formulaCode"),
  formulaExplain: document.querySelector("#formulaExplain"),
  notesList: document.querySelector("#notesList"),
};

const helperOutput = {
  probability: document.querySelector("#helperProbability"),
  probabilityHint: document.querySelector("#helperProbabilityHint"),
  fairOdds: document.querySelector("#helperFairOdds"),
  fairOddsHint: document.querySelector("#helperFairOddsHint"),
  outcomeSplit: document.querySelector("#helperOutcomeSplit"),
  outcomeHint: document.querySelector("#helperOutcomeHint"),
  topScores: document.querySelector("#helperTopScores"),
  topScoresHint: document.querySelector("#helperTopScoresHint"),
  note: document.querySelector("#helperNote"),
};

const historyList = document.querySelector("#historyList");
const historyEmpty = document.querySelector("#historyEmpty");

let currentMode = "standard";
let deferredInstallPrompt = null;
let latestScoreHelper = null;

const numberFormat = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 2,
});

const currencyFormat = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatNumber(value, digits = 4) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return value.toFixed(digits).replace(/\.?0+$/, "");
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return `${(value * 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

function formatMoney(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return `${currencyFormat.format(value)} 元`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseNumber(input) {
  const value = Number.parseFloat(input.value);
  return Number.isFinite(value) ? value : null;
}

function parseWholeNumber(input) {
  const value = parseNumber(input);
  if (value === null || !Number.isInteger(value)) {
    return null;
  }

  return value;
}

function getSelectedText(select) {
  return select.options[select.selectedIndex]?.textContent ?? "";
}

function normalizeSingleProbability(rawValue, label) {
  if (rawValue === null) {
    return null;
  }

  if (rawValue < 0) {
    return { error: `${label}不能小于 0。` };
  }

  if (rawValue <= 1) {
    return {
      value: rawValue,
      notes: ["检测到你输入的是 0 到 1 的小数概率，系统已自动识别。"],
    };
  }

  if (rawValue > 100) {
    return { error: `${label}不能大于 100%。` };
  }

  return {
    value: rawValue / 100,
    notes: [],
  };
}

function normalizeProbabilitySet(rawValues, label) {
  if (rawValues.some((value) => value === null)) {
    return null;
  }

  if (rawValues.some((value) => value < 0)) {
    return { error: `${label}中存在小于 0 的概率，请重新检查。` };
  }

  if (rawValues.some((value) => value > 100)) {
    return { error: `${label}中存在大于 100 的概率，请重新检查。` };
  }

  const useDecimal = rawValues.every((value) => value <= 1);
  const scaledValues = useDecimal ? rawValues.slice() : rawValues.map((value) => value / 100);
  const total = scaledValues.reduce((sum, value) => sum + value, 0);

  if (total <= 0) {
    return { error: `${label}之和必须大于 0。` };
  }

  const notes = [];
  if (useDecimal) {
    notes.push("检测到你输入的是 0 到 1 的小数概率，系统已自动识别。");
  }

  if (Math.abs(total - 1) > 0.0001) {
    notes.push(`${label}之和为 ${formatPercent(total)}，系统已按比例归一化后再计算。`);
  }

  return {
    values: scaledValues.map((value) => value / total),
    notes,
  };
}

function createEmptyMetricState(mode, message) {
  if (mode === "worldCup") {
    return {
      title: "世界杯模式结果",
      summary: message ?? "填写比赛参数后会自动更新结果。",
      kellyValue: "--",
      kellyHint: "等待输入",
      evValue: "--",
      evHint: "用于判断是否存在正优势",
      stakeRatio: "--",
      stakeHint: "会叠加仓位系数与单场上限",
      stakeAmount: "--",
      amountHint: "需要填写总资金",
      referenceLabel: "公平赔率",
      referenceValue: "--",
      referenceHint: "等待输入赔率",
      strategyLabel: "投注建议",
      strategyValue: "--",
      strategyHint: "等待输入比赛参数",
      formulaTitle: "世界杯模式说明",
      formulaCode: "b = 赔率 - 1；f = (b × p - q) / b",
      formulaExplain:
        "二元玩法会直接按赔率计算；胜平负会分别计算主胜、平局、客胜，再只推荐优势最高的一项。",
      notes: ["输入完整参数后，这里会显示赔率价值、仓位建议和风险提示。"],
    };
  }

  return {
    title: "标准凯利结果",
    summary: message ?? "填写参数后会自动更新结果。",
    kellyValue: "--",
    kellyHint: "等待输入",
    evValue: "--",
    evHint: "用于判断是否存在正优势",
    stakeRatio: "--",
    stakeHint: "已含仓位系数",
    stakeAmount: "--",
    amountHint: "需要填写总资金",
    referenceLabel: "盈亏比 b",
    referenceValue: "--",
    referenceHint: "盈利金额 ÷ 亏损本金",
    strategyLabel: "盈亏平衡胜率",
    strategyValue: "--",
    strategyHint: "用于判断是否高于保本线",
    formulaTitle: "标准模式公式",
    formulaCode: "f = (b × p - q) / b = p - q / b",
    formulaExplain: "其中 b 为盈亏比，p 为盈利概率，q 为亏损概率。",
    notes: ["输入完整参数后，这里会显示风险提示与说明。"],
  };
}

function renderNotes(notes) {
  output.notesList.innerHTML = "";
  notes.forEach((note) => {
    const item = document.createElement("li");
    item.textContent = note;
    output.notesList.append(item);
  });
}

function renderResult(state) {
  output.title.textContent = state.title;
  output.summary.textContent = state.summary;
  output.kellyValue.textContent = state.kellyValue;
  output.kellyHint.textContent = state.kellyHint;
  output.evValue.textContent = state.evValue;
  output.evHint.textContent = state.evHint;
  output.stakeRatio.textContent = state.stakeRatio;
  output.stakeHint.textContent = state.stakeHint;
  output.stakeAmount.textContent = state.stakeAmount;
  output.amountHint.textContent = state.amountHint;
  output.referenceLabel.textContent = state.referenceLabel;
  output.referenceValue.textContent = state.referenceValue;
  output.referenceHint.textContent = state.referenceHint;
  output.strategyLabel.textContent = state.strategyLabel;
  output.strategyValue.textContent = state.strategyValue;
  output.strategyHint.textContent = state.strategyHint;
  output.formulaTitle.textContent = state.formulaTitle;
  output.formulaCode.textContent = state.formulaCode;
  output.formulaExplain.textContent = state.formulaExplain;
  renderNotes(state.notes);
}

function renderEmpty(mode, message) {
  renderResult(createEmptyMetricState(mode, message));
}

function renderScoreHelperEmpty(message) {
  latestScoreHelper = null;
  helperOutput.probability.textContent = "--";
  helperOutput.probabilityHint.textContent = message;
  helperOutput.fairOdds.textContent = "--";
  helperOutput.fairOddsHint.textContent = "用于和实际比分赔率对比";
  helperOutput.outcomeSplit.textContent = "--";
  helperOutput.outcomeHint.textContent = "作为赛果倾向参考";
  helperOutput.topScores.textContent = "--";
  helperOutput.topScoresHint.textContent = "只作估值参考，不是直接推荐";
  helperOutput.note.textContent =
    "说明：这个辅助器基于预期进球做近似估值，目的是帮你先建立主观概率锚点，再回填到二元玩法的主观胜率。";
  applyScoreHelperButton.disabled = true;
}

function factorial(value) {
  let result = 1;
  for (let index = 2; index <= value; index += 1) {
    result *= index;
  }
  return result;
}

function poissonProbability(lambda, goals) {
  return (Math.exp(-lambda) * lambda ** goals) / factorial(goals);
}

function refreshScoreHelper() {
  const homeExpectedGoals = parseNumber(worldInputs.homeExpectedGoals);
  const awayExpectedGoals = parseNumber(worldInputs.awayExpectedGoals);
  const targetHomeGoals = parseWholeNumber(worldInputs.targetHomeGoals);
  const targetAwayGoals = parseWholeNumber(worldInputs.targetAwayGoals);
  const tempoBias = Number.parseFloat(worldInputs.tempoBias.value || "1");

  if (
    homeExpectedGoals === null ||
    awayExpectedGoals === null ||
    targetHomeGoals === null ||
    targetAwayGoals === null
  ) {
    renderScoreHelperEmpty("填写预期进球和目标比分后，这里会给出参考概率。");
    return;
  }

  if (homeExpectedGoals < 0 || awayExpectedGoals < 0) {
    renderScoreHelperEmpty("预期进球不能小于 0。");
    return;
  }

  if (targetHomeGoals < 0 || targetAwayGoals < 0) {
    renderScoreHelperEmpty("目标比分进球数不能小于 0。");
    return;
  }

  const homeLambda = homeExpectedGoals * tempoBias;
  const awayLambda = awayExpectedGoals * tempoBias;
  const targetProbability =
    poissonProbability(homeLambda, targetHomeGoals) *
    poissonProbability(awayLambda, targetAwayGoals);

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  const matrix = [];

  for (let homeGoals = 0; homeGoals <= 6; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals <= 6; awayGoals += 1) {
      const probability =
        poissonProbability(homeLambda, homeGoals) *
        poissonProbability(awayLambda, awayGoals);

      matrix.push({
        label: `${homeGoals}:${awayGoals}`,
        probability,
      });

      if (homeGoals > awayGoals) {
        homeWin += probability;
      } else if (homeGoals === awayGoals) {
        draw += probability;
      } else {
        awayWin += probability;
      }
    }
  }

  const topScores = matrix
    .sort((left, right) => right.probability - left.probability)
    .slice(0, 4);

  const fairOdds = targetProbability > 0 ? 1 / targetProbability : Infinity;
  latestScoreHelper = {
    probability: targetProbability,
    fairOdds,
    targetLabel: `${targetHomeGoals}:${targetAwayGoals}`,
    outcomeSplit: { homeWin, draw, awayWin },
    topScores,
    homeLambda,
    awayLambda,
  };

  helperOutput.probability.textContent = formatPercent(targetProbability);
  helperOutput.probabilityHint.textContent = `目标比分 ${targetHomeGoals}:${targetAwayGoals} 的参考命中率`;
  helperOutput.fairOdds.textContent = formatNumber(fairOdds, 2);
  helperOutput.fairOddsHint.textContent = "如果实际赔率高于公平赔率，才更可能存在价值";
  helperOutput.outcomeSplit.textContent = `${formatPercent(homeWin)} / ${formatPercent(draw)} / ${formatPercent(awayWin)}`;
  helperOutput.outcomeHint.textContent = "顺序为主胜 / 平局 / 客胜";
  helperOutput.topScores.textContent = topScores
    .map((item) => `${item.label} (${formatPercent(item.probability)})`)
    .join("、");
  helperOutput.topScoresHint.textContent = "这是在当前预期进球假设下最可能出现的比分";
  helperOutput.note.textContent = `当前按主队预期进球 ${formatNumber(homeLambda, 2)}、客队预期进球 ${formatNumber(awayLambda, 2)} 估算。比分玩法建议优先使用半凯利或四分之一凯利。`;
  applyScoreHelperButton.disabled = false;
}

function getStateSnapshot() {
  const standard = Object.fromEntries(
    Object.entries(standardInputs).map(([key, element]) => [key, element.value]),
  );
  const worldCup = Object.fromEntries(
    Object.entries(worldInputs).map(([key, element]) => [key, element.value]),
  );

  return {
    mode: currentMode,
    standard,
    worldCup,
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getStateSnapshot()));
}

function restoreState() {
  standardInputs.riskFactor.value = "0.5";
  worldInputs.marketType.value = "binary";
  worldInputs.riskFactorWorld.value = "0.5";
  worldInputs.maxStakePercent.value = "5";

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const state = JSON.parse(raw);

    if (state.mode === "worldCup" || state.mode === "standard") {
      currentMode = state.mode;
    }

    Object.entries(standardInputs).forEach(([key, element]) => {
      if (typeof state.standard?.[key] === "string") {
        element.value = state.standard[key];
      }
    });

    Object.entries(worldInputs).forEach(([key, element]) => {
      if (typeof state.worldCup?.[key] === "string") {
        element.value = state.worldCup[key];
      }
    });
  } catch {
    currentMode = "standard";
    standardInputs.riskFactor.value = "0.5";
    worldInputs.marketType.value = "binary";
    worldInputs.riskFactorWorld.value = "0.5";
    worldInputs.maxStakePercent.value = "5";
  }
}

function getHistory() {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) {
    return [];
  }

  try {
    const entries = JSON.parse(raw);
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

function saveHistory(entries) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, HISTORY_LIMIT)));
}

function appendHistory(entry) {
  const entries = [entry, ...getHistory()].slice(0, HISTORY_LIMIT);
  saveHistory(entries);
  renderHistory();
}

function renderHistory() {
  const entries = getHistory();
  historyList.innerHTML = "";
  historyEmpty.hidden = entries.length > 0;

  entries.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "history-item";

    const top = document.createElement("div");
    top.className = "history-top";

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = entry.modeLabel;

    const time = document.createElement("span");
    time.className = "history-time";
    time.textContent = new Date(entry.timestamp).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    top.append(badge, time);

    const title = document.createElement("p");
    title.className = "history-title";
    title.textContent = entry.title;

    const detail = document.createElement("p");
    detail.className = "history-detail";
    detail.textContent = entry.detail;

    const bottom = document.createElement("div");
    bottom.className = "history-bottom";

    const meta = document.createElement("p");
    meta.className = "history-meta";
    meta.textContent = `${entry.summary} · ${entry.stakeRatioText}`;

    const amount = document.createElement("span");
    amount.className = "history-time";
    amount.textContent = entry.stakeAmountText;

    bottom.append(meta, amount);
    item.append(top, title, detail, bottom);
    historyList.append(item);
  });
}

function updateModeUI() {
  const isWorldCup = currentMode === "worldCup";
  standardForm.hidden = isWorldCup;
  worldCupForm.hidden = !isWorldCup;
  modeCopy.textContent = modeCopyMap[currentMode];

  modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === currentMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function updateWorldMarketUI() {
  const isThreeWay = worldInputs.marketType.value === "threeWay";
  binaryFields.hidden = isThreeWay;
  threeWayFields.hidden = !isThreeWay;
}

function createStakeHints(adjustedKelly, displayedKelly, capRatio, riskFactorLabel) {
  if (adjustedKelly <= 0) {
    return "当前不建议下注";
  }

  if (displayedKelly !== adjustedKelly) {
    return `已按单场上限 ${formatPercent(capRatio)} 做了限制`;
  }

  return `${riskFactorLabel}已生效`;
}

function buildStakeAmount(bankroll, ratio) {
  if (!Number.isFinite(bankroll) || bankroll <= 0) {
    return {
      value: "--",
      hint: "如果填写总资金，就会自动换算成投入金额",
    };
  }

  return {
    value: formatMoney(bankroll * ratio),
    hint: `按总资金 ${formatMoney(bankroll)} 计算`,
  };
}

function calculateStandard(saveToHistory = false) {
  const gainAmount = parseNumber(standardInputs.gainAmount);
  const lossAmount = parseNumber(standardInputs.lossAmount);
  const winProbability = parseNumber(standardInputs.winProbability);
  const lossProbability = parseNumber(standardInputs.lossProbability);
  const bankroll = parseNumber(standardInputs.bankroll);
  const riskFactor = Number.parseFloat(standardInputs.riskFactor.value || "0.5");

  const requiredValues = [gainAmount, lossAmount, winProbability, lossProbability];
  if (requiredValues.some((value) => value === null)) {
    renderEmpty("standard", "补全标准模式参数后会自动计算。");
    return null;
  }

  if (gainAmount <= 0 || lossAmount <= 0) {
    renderEmpty("standard", "盈利金额和亏损本金都必须大于 0。");
    return null;
  }

  const probabilityPack = normalizeProbabilitySet(
    [winProbability, lossProbability],
    "盈利概率与亏损概率",
  );

  if (!probabilityPack) {
    renderEmpty("standard", "补全标准模式参数后会自动计算。");
    return null;
  }

  if (probabilityPack.error) {
    renderEmpty("standard", probabilityPack.error);
    return null;
  }

  const [p, q] = probabilityPack.values;
  const b = gainAmount / lossAmount;
  const decimalOdds = b + 1;
  const expectedValue = p * b - q;
  const rawKelly = expectedValue / b;
  const adjustedKelly = rawKelly * riskFactor;
  const displayedKelly = clamp(adjustedKelly, 0, 1);
  const breakEvenProbability = 1 / decimalOdds;
  const notes = [...probabilityPack.notes];
  const riskFactorLabel = getSelectedText(standardInputs.riskFactor);

  const summary =
    rawKelly <= 0
      ? "当前参数下没有正向优势，标准凯利公式不建议投入。"
      : rawKelly < 0.1
        ? "有正向优势，但边际较薄，建议控制仓位。"
        : rawKelly <= 1
          ? "参数表现为正向优势，可以把标准凯利结果当作参考。"
          : "满凯利结果已经超过 1，说明理论仓位非常激进。";

  const stakeAmount = buildStakeAmount(bankroll, displayedKelly);

  if (rawKelly <= 0) {
    notes.push("凯利指数小于等于 0，说明在当前胜率与盈亏比下，长期期望并不支持继续下注。");
  } else {
    notes.push(`当前选择的是 ${riskFactorLabel}，展示的建议投入比例已经自动乘以该系数。`);
  }

  notes.push(`盈亏平衡胜率约为 ${formatPercent(breakEvenProbability)}，你的真实胜率需要高于这条线。`);

  renderResult({
    title: "标准凯利结果",
    summary,
    kellyValue: formatNumber(rawKelly),
    kellyHint: rawKelly > 0 ? "这是原始满凯利结果" : "当前没有正优势",
    evValue: formatPercent(expectedValue),
    evHint: expectedValue > 0 ? "每承担 1 份风险的理论回报率" : "期望值不为正",
    stakeRatio: formatPercent(displayedKelly),
    stakeHint:
      adjustedKelly !== displayedKelly
        ? "原始结果超出了 0% 到 100%，展示值已做边界限制"
        : `${numberFormat.format(riskFactor * 100)}% 仓位系数已生效`,
    stakeAmount: stakeAmount.value,
    amountHint: stakeAmount.hint,
    referenceLabel: "盈亏比 b",
    referenceValue: `1 : ${formatNumber(b)}`,
    referenceHint: `等价十进制赔率约为 ${formatNumber(decimalOdds, 3)}`,
    strategyLabel: "盈亏平衡胜率",
    strategyValue: formatPercent(breakEvenProbability),
    strategyHint: `只要真实胜率高于 ${formatPercent(breakEvenProbability)}，才值得继续下注`,
    formulaTitle: "标准模式公式",
    formulaCode: "f = (b × p - q) / b = p - q / b",
    formulaExplain: `本次计算使用 b = ${formatNumber(b, 3)}，p = ${formatPercent(p)}，q = ${formatPercent(q)}。`,
    notes,
  });

  if (saveToHistory) {
    appendHistory({
      modeLabel: "标准凯利",
      title: "标准模式",
      detail: `满凯利 ${formatNumber(rawKelly)} · EV ${formatPercent(expectedValue)}`,
      summary,
      stakeRatioText: `建议 ${formatPercent(displayedKelly)}`,
      stakeAmountText: stakeAmount.value,
      timestamp: Date.now(),
    });
  }

  return true;
}

function calculateWorldBinary(saveToHistory = false) {
  const selection = worldInputs.selectionLabel.value.trim() || "当前投注项";
  const matchName = worldInputs.matchName.value.trim() || "本场比赛";
  const odds = parseNumber(worldInputs.decimalOdds);
  const probability = parseNumber(worldInputs.subjectiveProbability);
  const bankroll = parseNumber(worldInputs.worldBankroll);
  const maxStakePercent = parseNumber(worldInputs.maxStakePercent);
  const riskFactor = Number.parseFloat(worldInputs.riskFactorWorld.value || "0.5");

  if (odds === null || probability === null) {
    renderEmpty("worldCup", "补全二元玩法的赔率和主观胜率后会自动计算。");
    return null;
  }

  if (odds <= 1) {
    renderEmpty("worldCup", "十进制赔率必须大于 1。");
    return null;
  }

  const probabilityPack = normalizeSingleProbability(probability, "主观胜率");
  if (!probabilityPack) {
    renderEmpty("worldCup", "补全二元玩法的赔率和主观胜率后会自动计算。");
    return null;
  }

  if (probabilityPack.error) {
    renderEmpty("worldCup", probabilityPack.error);
    return null;
  }

  const p = probabilityPack.value;
  const q = 1 - p;
  const b = odds - 1;
  const expectedValue = p * odds - 1;
  const rawKelly = expectedValue / b;
  const capRatio = clamp((maxStakePercent ?? 5) / 100, 0, 1);
  const adjustedKelly = rawKelly * riskFactor;
  const displayedKelly = clamp(adjustedKelly, 0, capRatio);
  const fairOdds = 1 / p;
  const impliedProbability = 1 / odds;
  const edge = p - impliedProbability;
  const notes = [...probabilityPack.notes];
  const riskFactorLabel = getSelectedText(worldInputs.riskFactorWorld);
  const stakeAmount = buildStakeAmount(bankroll, displayedKelly);

  if (edge > 0) {
    notes.push(`你的主观胜率比庄家隐含概率高出 ${formatPercent(edge)}，说明这项赔率存在正价值。`);
  } else {
    notes.push(`你的主观胜率低于或等于庄家隐含概率 ${formatPercent(impliedProbability)}，赔率价值并不明显。`);
  }

  notes.push(`当前选择的是 ${riskFactorLabel}，并额外设置了单场上限 ${formatPercent(capRatio)}。`);
  notes.push("这类计算更适合让球、大小球、晋级这类只有赢或输的二元市场。");

  const summary =
    rawKelly <= 0
      ? `按你给出的胜率估计，“${selection}”当前没有正向优势，建议观望。`
      : displayedKelly < adjustedKelly
        ? `“${selection}”存在正向优势，但仓位已经被单场上限压住。`
        : `“${selection}”存在正向优势，可以把建议仓位作为世界杯实战参考。`;

  renderResult({
    title: "世界杯模式结果",
    summary,
    kellyValue: formatNumber(rawKelly),
    kellyHint: rawKelly > 0 ? `按“${selection}”计算的满凯利结果` : "当前不建议下注",
    evValue: formatPercent(expectedValue),
    evHint: expectedValue > 0 ? "每下注 1 单位的理论收益率" : "期望值不为正",
    stakeRatio: formatPercent(displayedKelly),
    stakeHint: createStakeHints(adjustedKelly, displayedKelly, capRatio, riskFactorLabel),
    stakeAmount: stakeAmount.value,
    amountHint: stakeAmount.hint,
    referenceLabel: "公平赔率",
    referenceValue: formatNumber(fairOdds, 3),
    referenceHint: `当前赔率 ${formatNumber(odds, 3)}，庄家隐含概率 ${formatPercent(impliedProbability)}`,
    strategyLabel: "投注项",
    strategyValue: selection,
    strategyHint: `比赛：${matchName}`,
    formulaTitle: "世界杯二元玩法公式",
    formulaCode: "b = 赔率 - 1；f = (b × p - q) / b",
    formulaExplain: `本次计算使用赔率 ${formatNumber(odds, 3)}，因此 b = ${formatNumber(b, 3)}，p = ${formatPercent(p)}，q = ${formatPercent(q)}。`,
    notes,
  });

  if (saveToHistory) {
    appendHistory({
      modeLabel: "世界杯",
      title: matchName,
      detail: `${selection} · 满凯利 ${formatNumber(rawKelly)} · EV ${formatPercent(expectedValue)}`,
      summary,
      stakeRatioText: `建议 ${formatPercent(displayedKelly)}`,
      stakeAmountText: stakeAmount.value,
      timestamp: Date.now(),
    });
  }

  return true;
}

function calculateWorldThreeWay(saveToHistory = false) {
  const matchName = worldInputs.matchName.value.trim();
  const homeTeam = worldInputs.homeTeam.value.trim() || "主队";
  const awayTeam = worldInputs.awayTeam.value.trim() || "客队";
  const probabilityValues = [
    parseNumber(worldInputs.homeProbability),
    parseNumber(worldInputs.drawProbability),
    parseNumber(worldInputs.awayProbability),
  ];
  const oddsValues = [
    parseNumber(worldInputs.homeOdds),
    parseNumber(worldInputs.drawOdds),
    parseNumber(worldInputs.awayOdds),
  ];
  const bankroll = parseNumber(worldInputs.worldBankroll);
  const maxStakePercent = parseNumber(worldInputs.maxStakePercent);
  const riskFactor = Number.parseFloat(worldInputs.riskFactorWorld.value || "0.5");

  if (probabilityValues.some((value) => value === null) || oddsValues.some((value) => value === null)) {
    renderEmpty("worldCup", "补全胜平负的三项概率和赔率后会自动计算。");
    return null;
  }

  if (oddsValues.some((value) => value <= 1)) {
    renderEmpty("worldCup", "胜平负三项赔率都必须大于 1。");
    return null;
  }

  const probabilityPack = normalizeProbabilitySet(probabilityValues, "胜平负概率");
  if (!probabilityPack) {
    renderEmpty("worldCup", "补全胜平负的三项概率和赔率后会自动计算。");
    return null;
  }

  if (probabilityPack.error) {
    renderEmpty("worldCup", probabilityPack.error);
    return null;
  }

  const [homeProbability, drawProbability, awayProbability] = probabilityPack.values;
  const capRatio = clamp((maxStakePercent ?? 5) / 100, 0, 1);
  const riskFactorLabel = getSelectedText(worldInputs.riskFactorWorld);
  const options = [
    { label: `${homeTeam}胜`, probability: homeProbability, odds: oddsValues[0] },
    { label: "平局", probability: drawProbability, odds: oddsValues[1] },
    { label: `${awayTeam}胜`, probability: awayProbability, odds: oddsValues[2] },
  ].map((option) => {
    const b = option.odds - 1;
    const expectedValue = option.probability * option.odds - 1;
    const rawKelly = expectedValue / b;
    const adjustedKelly = rawKelly * riskFactor;
    const displayedKelly = clamp(adjustedKelly, 0, capRatio);

    return {
      ...option,
      b,
      expectedValue,
      rawKelly,
      adjustedKelly,
      displayedKelly,
      fairOdds: 1 / option.probability,
      impliedProbability: 1 / option.odds,
    };
  });

  const positiveOptions = options.filter(
    (option) => option.expectedValue > 0 && option.rawKelly > 0,
  );
  const rankedOptions = [...options].sort((left, right) => right.rawKelly - left.rawKelly);
  const bestOption = positiveOptions.sort((left, right) => right.rawKelly - left.rawKelly)[0] ?? rankedOptions[0];
  const matchLabel = matchName || `${homeTeam} vs ${awayTeam}`;
  const stakeAmount = buildStakeAmount(bankroll, bestOption.displayedKelly);
  const notes = [...probabilityPack.notes];

  rankedOptions.forEach((option, index) => {
    notes.push(
      `${index + 1}. ${option.label}：赔率 ${formatNumber(option.odds, 3)}，EV ${formatPercent(option.expectedValue)}，满凯利 ${formatNumber(option.rawKelly)}`,
    );
  });

  notes.push(`当前选择的是 ${riskFactorLabel}，并额外设置了单场上限 ${formatPercent(capRatio)}。`);
  notes.push("胜平负模式会分别估值三项，只推荐优势最高的一项，不建议同时押三项。");

  const hasPositiveEdge = bestOption.expectedValue > 0 && bestOption.rawKelly > 0;
  const summary = hasPositiveEdge
    ? `当前最有优势的是“${bestOption.label}”，可以把它当作本场首选。`
    : "三项都没有明显的正期望优势，建议本场观望。";

  renderResult({
    title: "世界杯模式结果",
    summary,
    kellyValue: formatNumber(hasPositiveEdge ? bestOption.rawKelly : 0),
    kellyHint: hasPositiveEdge ? `按“${bestOption.label}”计算的满凯利结果` : "当前不建议下注",
    evValue: formatPercent(bestOption.expectedValue),
    evHint: hasPositiveEdge ? "推荐项的每下注 1 单位理论收益率" : "推荐项期望值也不为正",
    stakeRatio: formatPercent(hasPositiveEdge ? bestOption.displayedKelly : 0),
    stakeHint: hasPositiveEdge
      ? createStakeHints(
          bestOption.adjustedKelly,
          bestOption.displayedKelly,
          capRatio,
          riskFactorLabel,
        )
      : "建议本场观望",
    stakeAmount: hasPositiveEdge ? stakeAmount.value : "--",
    amountHint: hasPositiveEdge ? stakeAmount.hint : "当前没有值得出手的正优势选项",
    referenceLabel: "公平赔率",
    referenceValue: formatNumber(bestOption.fairOdds, 3),
    referenceHint: `推荐项当前赔率 ${formatNumber(bestOption.odds, 3)}，隐含概率 ${formatPercent(bestOption.impliedProbability)}`,
    strategyLabel: "推荐选项",
    strategyValue: hasPositiveEdge ? bestOption.label : "本场观望",
    strategyHint: `比赛：${matchLabel}`,
    formulaTitle: "胜平负模式说明",
    formulaCode: "分别计算主胜 / 平局 / 客胜的 EV 与 Kelly，只取优势最高的一项",
    formulaExplain: `本场按 ${homeTeam}胜、平局、${awayTeam}胜三项分别估值后，再输出优势最高的一项。`,
    notes,
  });

  if (saveToHistory) {
    appendHistory({
      modeLabel: "世界杯",
      title: matchLabel,
      detail: `${hasPositiveEdge ? bestOption.label : "观望"} · EV ${formatPercent(bestOption.expectedValue)} · 满凯利 ${formatNumber(hasPositiveEdge ? bestOption.rawKelly : 0)}`,
      summary,
      stakeRatioText: hasPositiveEdge ? `建议 ${formatPercent(bestOption.displayedKelly)}` : "建议观望",
      stakeAmountText: hasPositiveEdge ? stakeAmount.value : "--",
      timestamp: Date.now(),
    });
  }

  return true;
}

function calculateWorldCup(saveToHistory = false) {
  return worldInputs.marketType.value === "threeWay"
    ? calculateWorldThreeWay(saveToHistory)
    : calculateWorldBinary(saveToHistory);
}

function refreshCurrentCalculation(saveToHistory = false) {
  refreshScoreHelper();
  return currentMode === "worldCup"
    ? calculateWorldCup(saveToHistory)
    : calculateStandard(saveToHistory);
}

function resetStandardForm() {
  standardForm.reset();
  standardInputs.riskFactor.value = "0.5";
  saveState();
  refreshCurrentCalculation(false);
}

function resetWorldForm() {
  worldCupForm.reset();
  worldInputs.marketType.value = "binary";
  worldInputs.riskFactorWorld.value = "0.5";
  worldInputs.maxStakePercent.value = "5";
  updateWorldMarketUI();
  saveState();
  refreshCurrentCalculation(false);
}

function registerPwaSupport() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {
        installTip.textContent = "离线缓存注册失败，但页面仍可正常计算。";
      });
    });
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButton.hidden = false;
    installTip.textContent = "当前设备支持直接安装，点击按钮即可添加到主屏幕。";
  });

  window.addEventListener("appinstalled", () => {
    installButton.hidden = true;
    installTip.textContent = "应用已安装完成，后续可以像普通 App 一样打开。";
    deferredInstallPrompt = null;
  });
}

function bindInputListeners(elements) {
  elements.forEach((element) => {
    element.addEventListener("input", () => {
      if (element === worldInputs.marketType) {
        updateWorldMarketUI();
      }
      saveState();
      refreshCurrentCalculation(false);
    });

    element.addEventListener("change", () => {
      if (element === worldInputs.marketType) {
        updateWorldMarketUI();
      }
      saveState();
      refreshCurrentCalculation(false);
    });
  });
}

restoreState();
updateWorldMarketUI();
updateModeUI();
renderHistory();
refreshCurrentCalculation(false);
registerPwaSupport();

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentMode = button.dataset.mode;
    updateModeUI();
    saveState();
    refreshCurrentCalculation(false);
  });
});

standardForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveState();
  refreshCurrentCalculation(true);
});

worldCupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveState();
  refreshCurrentCalculation(true);
});

bindInputListeners([...Object.values(standardInputs), ...Object.values(worldInputs)]);

standardResetButton.addEventListener("click", resetStandardForm);
worldResetButton.addEventListener("click", resetWorldForm);

clearHistoryButton.addEventListener("click", () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});

applyScoreHelperButton.addEventListener("click", () => {
  if (!latestScoreHelper) {
    return;
  }

  worldInputs.subjectiveProbability.value = (latestScoreHelper.probability * 100)
    .toFixed(2)
    .replace(/\.?0+$/, "");
  worldInputs.selectionLabel.value = `比分 ${latestScoreHelper.targetLabel}`;
  saveState();
  refreshCurrentCalculation(false);
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    installTip.textContent = "当前环境暂不支持一键安装，请使用浏览器菜单手动添加到主屏幕。";
    return;
  }

  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  installTip.textContent =
    choice.outcome === "accepted"
      ? "安装请求已接受，系统会继续完成安装。"
      : "你刚刚取消了安装，之后仍然可以从浏览器菜单再次安装。";
  deferredInstallPrompt = null;
  installButton.hidden = true;
});
