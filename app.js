const STORAGE_KEY = "kelly-position-helper";

const form = document.querySelector("#kellyForm");
const resetButton = document.querySelector("#resetButton");
const installButton = document.querySelector("#installButton");
const installTip = document.querySelector("#installTip");

const inputs = {
  gainAmount: document.querySelector("#gainAmount"),
  lossAmount: document.querySelector("#lossAmount"),
  winProbability: document.querySelector("#winProbability"),
  lossProbability: document.querySelector("#lossProbability"),
  bankroll: document.querySelector("#bankroll"),
  riskFactor: document.querySelector("#riskFactor"),
};

const output = {
  summary: document.querySelector("#resultSummary"),
  kellyValue: document.querySelector("#kellyValue"),
  kellyHint: document.querySelector("#kellyHint"),
  stakeRatio: document.querySelector("#stakeRatio"),
  stakeHint: document.querySelector("#stakeHint"),
  stakeAmount: document.querySelector("#stakeAmount"),
  amountHint: document.querySelector("#amountHint"),
  profitRatio: document.querySelector("#profitRatio"),
  ratioHint: document.querySelector("#ratioHint"),
  formulaExplain: document.querySelector("#formulaExplain"),
  notesList: document.querySelector("#notesList"),
};

let deferredInstallPrompt = null;

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

function parseNumber(input) {
  const value = Number.parseFloat(input.value);
  return Number.isFinite(value) ? value : null;
}

function saveState() {
  const payload = Object.fromEntries(
    Object.entries(inputs).map(([key, element]) => [key, element.value]),
  );

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function restoreState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    inputs.riskFactor.value = "0.5";
    return;
  }

  try {
    const state = JSON.parse(raw);
    Object.entries(inputs).forEach(([key, element]) => {
      if (typeof state[key] === "string") {
        element.value = state[key];
      }
    });
  } catch {
    inputs.riskFactor.value = "0.5";
  }
}

function renderNotes(notes) {
  output.notesList.innerHTML = "";
  notes.forEach((note) => {
    const item = document.createElement("li");
    item.textContent = note;
    output.notesList.append(item);
  });
}

function renderEmpty(message = "填写参数后会自动更新结果。") {
  output.summary.textContent = message;
  output.kellyValue.textContent = "--";
  output.kellyHint.textContent = "等待输入";
  output.stakeRatio.textContent = "--";
  output.stakeHint.textContent = "已含仓位系数";
  output.stakeAmount.textContent = "--";
  output.amountHint.textContent = "需要填写总资金";
  output.profitRatio.textContent = "--";
  output.ratioHint.textContent = "盈利金额 ÷ 亏损本金";
  output.formulaExplain.textContent =
    "其中 b 为盈亏比，p 为盈利概率，q 为亏损概率。";
  renderNotes(["输入完整参数后，这里会显示风险提示与说明。"]);
}

function normalizeProbabilities(winRaw, lossRaw) {
  const note = [];
  let win = winRaw;
  let loss = lossRaw;

  if (winRaw <= 1 && lossRaw <= 1) {
    note.push("检测到你输入的是 0 到 1 的小数概率，系统已自动识别。");
  }

  const total = win + loss;
  if (total <= 0) {
    return null;
  }

  if (Math.abs(total - 100) > 0.01 && Math.abs(total - 1) > 0.0001) {
    note.push(`盈利概率与亏损概率之和为 ${formatNumber(total, 2)}，系统已按比例归一化后再计算。`);
  }

  return {
    win: win / total,
    loss: loss / total,
    note,
  };
}

function calculateKelly() {
  const gainAmount = parseNumber(inputs.gainAmount);
  const lossAmount = parseNumber(inputs.lossAmount);
  const winProbability = parseNumber(inputs.winProbability);
  const lossProbability = parseNumber(inputs.lossProbability);
  const bankroll = parseNumber(inputs.bankroll);
  const riskFactor = Number.parseFloat(inputs.riskFactor.value || "0.5");

  const requiredValues = [gainAmount, lossAmount, winProbability, lossProbability];
  if (requiredValues.some((value) => value === null)) {
    renderEmpty("还差一些输入项，补全后就会自动计算。");
    return;
  }

  if (gainAmount <= 0 || lossAmount <= 0) {
    renderEmpty("盈利金额和亏损本金都必须大于 0。");
    renderNotes(["请把盈利金额和亏损本金填写为正数。"]);
    return;
  }

  if (winProbability < 0 || lossProbability < 0) {
    renderEmpty("概率不能小于 0。");
    renderNotes(["请检查盈利概率和亏损概率，不能输入负数。"]);
    return;
  }

  const probabilityPack = normalizeProbabilities(winProbability, lossProbability);
  if (!probabilityPack) {
    renderEmpty("概率之和必须大于 0。");
    renderNotes(["盈利概率和亏损概率至少要有一个大于 0。"]);
    return;
  }

  const p = probabilityPack.win;
  const q = probabilityPack.loss;
  const b = gainAmount / lossAmount;
  const rawKelly = (b * p - q) / b;
  const adjustedKelly = rawKelly * riskFactor;
  const cappedStake = Math.min(Math.max(adjustedKelly, 0), 1);
  const notes = [...probabilityPack.note];

  output.kellyValue.textContent = formatNumber(rawKelly);
  output.kellyHint.textContent = rawKelly > 0 ? "原始满凯利结果" : "结果小于等于 0";
  output.stakeRatio.textContent = formatPercent(cappedStake);
  output.stakeHint.textContent =
    adjustedKelly !== cappedStake
      ? "原始结果超过了 0% 到 100%，实际展示已做边界限制"
      : `${numberFormat.format(riskFactor * 100)}% 仓位系数已生效`;
  output.profitRatio.textContent = `1 : ${formatNumber(b)}`;
  output.ratioHint.textContent = `每亏损 1 份本金，对应盈利 ${formatNumber(b)} 份`;
  output.formulaExplain.textContent =
    `本次计算使用 b = ${formatNumber(b, 3)}，p = ${formatPercent(p)}，q = ${formatPercent(q)}。`;

  if (Number.isFinite(bankroll) && bankroll > 0) {
    const stakeAmount = bankroll * cappedStake;
    output.stakeAmount.textContent = formatMoney(stakeAmount);
    output.amountHint.textContent = `按总资金 ${formatMoney(bankroll)} 计算`;
  } else {
    output.stakeAmount.textContent = "--";
    output.amountHint.textContent = "如果填写总资金，就会自动换算成投入金额";
  }

  if (rawKelly <= 0) {
    output.summary.textContent = "当前参数下没有正向优势，凯利公式不建议投入。";
    notes.push("凯利指数小于等于 0，说明在当前胜率与盈亏比下，长期期望并不支持继续下注。");
  } else if (rawKelly < 0.1) {
    output.summary.textContent = "有正向优势，但边际较薄，建议控制仓位。";
    notes.push("满凯利结果较小，实操中使用半凯利或四分之一凯利通常更稳妥。");
  } else if (rawKelly <= 1) {
    output.summary.textContent = "参数表现为正向优势，可以按凯利仓位做参考。";
    notes.push("凯利公式强调长期资金曲线最优，不代表单次交易一定盈利。");
  } else {
    output.summary.textContent = "满凯利结果超过 1，说明理论仓位非常激进。";
    notes.push("原始凯利指数已经超过 100%，实操中通常会把投入比例限制在总资金以内。");
  }

  notes.push(`当前选择的是 ${inputs.riskFactor.selectedOptions[0].textContent}，展示的建议投入比例已自动乘以该系数。`);
  renderNotes(notes);
}

function resetForm() {
  form.reset();
  inputs.riskFactor.value = "0.5";
  localStorage.removeItem(STORAGE_KEY);
  renderEmpty("表单已清空，可以重新输入参数。");
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

restoreState();
calculateKelly();
registerPwaSupport();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  saveState();
  calculateKelly();
});

Object.values(inputs).forEach((element) => {
  element.addEventListener("input", () => {
    saveState();
    calculateKelly();
  });
  element.addEventListener("change", () => {
    saveState();
    calculateKelly();
  });
});

resetButton.addEventListener("click", resetForm);

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
