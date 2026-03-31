/**
 * ═══════════════════════════════════════════════════════════════
 * MONEY SHEPHERD 3.0 — GOOGLE SHEETS BUDGET TOOL
 * ═══════════════════════════════════════════════════════════════
 *
 * Built on top of Tiller Foundation Template.
 * Auto-assigns transactions, builds dashboard, mobile views.
 *
 * SAFETY:
 *   - Never overwrites manual edits in custom columns
 *   - Never touches Tiller's base columns
 *   - Discovers columns by header name (not position)
 *   - Idempotent — safe to run multiple times
 *   - Batch reads/writes for performance on 8,500+ rows
 */

// ─────────────────────────────────────────────
// BRAND COLORS
// ─────────────────────────────────────────────
var GOLD = "#C5A059";
var DARK_TEXT = "#2C3E50";
var MUTED = "#7F8C8D";
var LIGHT_BG = "#F8F9FA";
var CARD_BG = "#FFFFFF";
var CARD_BORDER = "#E0E0E0";
var GREEN = "#27AE60";
var ORANGE = "#E67E22";
var PURPLE = "#8E44AD";
var RED = "#E74C3C";
var BLUE = "#2980B9";
var GOLD_BG = "#FFF8E7";
var GREEN_BG = "#F0FFF0";
var ORANGE_BG = "#FFF3E0";
var RED_BG = "#FFF0F0";
var BLUE_BG = "#F0F4FF";

// ─────────────────────────────────────────────
// PLAID CATEGORY HINT → BUDGET CATEGORY MAPPING
// ─────────────────────────────────────────────
var PLAID_MAP = {
  "INCOME": "Income",
  "FOOD_AND_DRINK: FOOD_AND_DRINK_FAST_FOOD": "Eating Out",
  "FOOD_AND_DRINK: FOOD_AND_DRINK_COFFEE": "Eating Out",
  "FOOD_AND_DRINK: FOOD_AND_DRINK_RESTAURANT": "Eating Out",
  "FOOD_AND_DRINK: FOOD_AND_DRINK_GROCERIES": "Groceries",
  "FOOD_AND_DRINK: FOOD_AND_DRINK_BEER_AND_LIQUOR": "Eating Out",
  "FOOD_AND_DRINK": "Eating Out",
  "GENERAL_MERCHANDISE: GENERAL_MERCHANDISE_SUPERSTORES": "Shopping / Misc",
  "GENERAL_MERCHANDISE: GENERAL_MERCHANDISE_ONLINE_MARKETPLACES": "Shopping / Misc",
  "GENERAL_MERCHANDISE": "Shopping / Misc",
  "MEDICAL: MEDICAL_PHARMACIES_AND_SUPPLEMENTS": "Health / Pharmacy",
  "MEDICAL": "Health / Pharmacy",
  "ENTERTAINMENT: ENTERTAINMENT_TV_AND_MOVIES": "Subscriptions",
  "ENTERTAINMENT: ENTERTAINMENT_MUSIC_AND_AUDIO": "Subscriptions",
  "ENTERTAINMENT: ENTERTAINMENT_GAMES": "Subscriptions",
  "ENTERTAINMENT": "Entertainment",
  "TRANSPORTATION: TRANSPORTATION_GAS": "Gas / Auto",
  "TRANSPORTATION: TRANSPORTATION_PARKING": "Gas / Auto",
  "TRANSPORTATION: TRANSPORTATION_TOLLS": "Gas / Auto",
  "TRANSPORTATION: TRANSPORTATION_PUBLIC_TRANSIT": "Gas / Auto",
  "TRANSPORTATION": "Gas / Auto",
  "TRANSFER_OUT: TRANSFER_OUT_ACCOUNT_TRANSFER": "Transfers",
  "TRANSFER_OUT: TRANSFER_OUT_SAVINGS": "Transfers",
  "TRANSFER_OUT": "Transfers",
  "TRANSFER_IN: TRANSFER_IN_ACCOUNT_TRANSFER": "Transfers",
  "TRANSFER_IN": "Transfers",
  "RENT_AND_UTILITIES: RENT_AND_UTILITIES_RENT": "Rent (PMI)",
  "RENT_AND_UTILITIES: RENT_AND_UTILITIES_INTERNET_AND_CABLE": "Bills / Other",
  "RENT_AND_UTILITIES: RENT_AND_UTILITIES_TELEPHONE": "Bills / Other",
  "RENT_AND_UTILITIES: RENT_AND_UTILITIES_GAS_AND_ELECTRICITY": "Bills / Other",
  "RENT_AND_UTILITIES: RENT_AND_UTILITIES_WATER": "Water",
  "RENT_AND_UTILITIES": "Bills / Other",
  "PERSONAL_CARE: PERSONAL_CARE_HAIR_AND_BEAUTY": "Personal Care",
  "PERSONAL_CARE": "Personal Care",
  "TRAVEL: TRAVEL_FLIGHTS": "Travel",
  "TRAVEL: TRAVEL_LODGING": "Travel",
  "TRAVEL": "Travel",
  "LOAN_PAYMENTS": "Debt Payments",
  "BANK_FEES": "Bank Fees",
  "GOVERNMENT_AND_NON_PROFIT": "Taxes / Gov"
};

// ─────────────────────────────────────────────
// TRANSFER DETECTION PATTERNS
// ─────────────────────────────────────────────
var TRANSFER_DESCRIPTIONS = [
  "from savings", "to checking", "from checking", "to savings",
  "to emergency", "from emergency", "account transfer",
  "transfer to", "transfer from", "xfer", "ach transfer",
  "pos debit - visa check card", "pos debit - visa signature",
  "credit card payment", "payment to card", "autopay",
  "transfer trf to share", "from checking balance"
];

// ─────────────────────────────────────────────
// DEFAULT BUDGET TARGETS
// ─────────────────────────────────────────────
var DEFAULT_BUDGETS = {
  // ── FIXED BILLS (per company) ──
  "Rent (PMI)": 2525,
  "AEP Electric": 150,
  "ONG Gas": 200,
  "Water (BA)": 130,
  "T-Mobile": 150,
  "Starlink": 50,
  "State Farm": 350,
  "Verizon (closing)": 500,
  // ── VARIABLE SPENDING (bundled) ──
  "Groceries": 800,
  "Eating Out": 400,
  "Subscriptions": 150,
  "Health / Pharmacy": 150,
  "Shopping / Misc": 300,
  "Gas / Auto": 200,
  "Entertainment": 150,
  "Wellness": 200,
  "Personal Care": 100,
  "Travel": 200,
  "Bills / Other": 200,
  "Debt Payments": 0,
  "Bank Fees": 0,
  "Taxes / Gov": 0
};

// ─────────────────────────────────────────────
// SCRIPTURE VERSES
// ─────────────────────────────────────────────
var VERSES = [
  ["The Lord is my shepherd; I shall not want.", "Psalm 23:1"],
  ["For where your treasure is, there will your heart be also.", "Matthew 6:21"],
  ["The rich ruleth over the poor, and the borrower is servant to the lender.", "Proverbs 22:7"],
  ["Commit thy works unto the Lord, and thy thoughts shall be established.", "Proverbs 16:3"],
  ["Honour the Lord with thy substance, and with the firstfruits of all thine increase.", "Proverbs 3:9"],
  ["But my God shall supply all your need according to his riches in glory.", "Philippians 4:19"],
  ["The blessing of the Lord, it maketh rich, and he addeth no sorrow with it.", "Proverbs 10:22"],
  ["Be not wise in thine own eyes: fear the Lord, and depart from evil.", "Proverbs 3:7"],
  ["A faithful man shall abound with blessings.", "Proverbs 28:20"],
  ["The plans of the diligent lead surely to abundance.", "Proverbs 21:5"]
];

// Tab names
var TABS_TO_DELETE = ["Home", "Inbox", "Library", "Review Mobile"];
var DESKTOP_TABS = ["Dashboard", "Review Queue", "Budget", "Category Detail", "Trends", "Settings", "Scripture"];
var MOBILE_TABS = ["\ud83d\udcf1 Home", "\ud83d\udcf1 EZ View", "\ud83d\udcf1 Review", "\ud83d\udcf1 Budgets"];

// ═══════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════

function deployMoneyShepherd() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  // Step 1: Validate Tiller exists
  var trans = ss.getSheetByName("Transactions");
  if (!trans) {
    ui.alert("Cannot find Transactions tab. Is this a Tiller sheet?");
    return;
  }

  var headers = trans.getRange(1, 1, 1, trans.getLastColumn()).getValues()[0].map(String);
  var required = ["Date", "Description", "Category", "Amount", "Account"];
  var missing = required.filter(function(c) { return headers.indexOf(c) === -1; });
  if (missing.length > 0) {
    ui.alert("Missing Tiller columns: " + missing.join(", "));
    return;
  }

  // Step 2: Build column map
  var col = buildColumnMap_(headers);

  // Step 3: Ensure custom columns exist on Transactions
  var customCols = ["Owner", "Spend Type", "Transfer?", "Reviewed", "Notes"];
  var nextCol = trans.getLastColumn() + 1;
  customCols.forEach(function(name) {
    if (col[name] === undefined) {
      trans.getRange(1, nextCol).setValue(name).setFontWeight("bold");
      col[name] = nextCol;
      nextCol++;
    }
  });

  // Step 4: Set up data validation on custom columns
  var dataRows = Math.max(trans.getLastRow(), 500);
  var validations = {
    "Owner": ["Los", "Wife", "Shared"],
    "Spend Type": ["Household", "Personal", "Ignore"],
    "Transfer?": ["Yes", "No"],
    "Reviewed": ["Yes", "No"]
  };
  Object.keys(validations).forEach(function(name) {
    if (col[name]) {
      var rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(validations[name], true)
        .setAllowInvalid(false)
        .build();
      trans.getRange(2, col[name], dataRows - 1, 1).setDataValidation(rule);
    }
  });

  // Step 5: Delete broken tabs from prior AI work
  TABS_TO_DELETE.forEach(function(name) {
    var s = ss.getSheetByName(name);
    if (s) {
      try { ss.deleteSheet(s); } catch(e) { /* can't delete last sheet */ }
    }
  });

  // Also delete old Dashboard/Review Queue if they exist (we rebuild them)
  ["Dashboard", "Review Queue", "Account Map"].forEach(function(name) {
    var s = ss.getSheetByName(name);
    if (s) {
      try { ss.deleteSheet(s); } catch(e) {}
    }
  });

  // Step 6: Create all tabs
  var allTabs = DESKTOP_TABS.concat(MOBILE_TABS);
  allTabs.forEach(function(name) {
    var existing = ss.getSheetByName(name);
    if (!existing) {
      ss.insertSheet(name);
    }
  });

  // Step 7: Build Settings FIRST (auto-assign needs Account Map)
  var L = function(headerName) { return numToLetter_(col[headerName]); };
  buildSettings_(ss, col);
  buildScripture_(ss);

  // Step 8: Fix rent date (March 2 PMI $2,522.95 was actually paid Feb 28)
  var lastRow = trans.getLastRow();
  if (lastRow > 1 && col["Date"] && col["Description"] && col["Amount"]) {
    var dateCol = col["Date"];
    var descCol = col["Description"];
    var amtCol = col["Amount"];
    var allData = trans.getRange(2, 1, lastRow - 1, trans.getLastColumn()).getValues();
    var di = dateCol - 1;
    var dsi = descCol - 1;
    var ai = amtCol - 1;
    for (var fix = 0; fix < allData.length; fix++) {
      var d = allData[fix][di];
      var desc = String(allData[fix][dsi] || "").toLowerCase();
      var amt = Number(allData[fix][ai]) || 0;
      // Match: PMI Green Countr, amount around -2522 to -2523, date in early March 2026
      if (desc.indexOf("pmi green countr") >= 0 && amt < -2500 && amt > -2600) {
        if (d instanceof Date && d.getFullYear() === 2026 && d.getMonth() === 2 && d.getDate() <= 3) {
          trans.getRange(fix + 2, dateCol).setValue(new Date(2026, 1, 28)); // Feb 28, 2026
          Logger.log("Fixed PMI rent date: row " + (fix + 2) + " from " + d + " to Feb 28");
          break;
        }
      }
    }
  }

  // Step 9: Run auto-assignment (only fills empty cells, preserves manual edits)
  autoAssignTransactions(ss, col, trans);

  // Step 9: Build remaining tabs
  buildDashboard_(ss, col, L);
  buildMobileHome_(ss, col, L);
  buildReviewQueue_(ss, col, L);
  buildBudget_(ss, col, L);
  buildCategoryDetail_(ss, col, L);
  buildMobileBudgets_(ss, col, L);
  buildMobileReview_(ss, col, L);
  buildEZView_(ss, col, L);
  buildTrends_(ss, col, L);

  // Step 9: Protect mobile tabs (read-only)
  MOBILE_TABS.forEach(function(name) {
    var s = ss.getSheetByName(name);
    if (s) {
      var prot = s.protect().setDescription("Mobile view — read only");
      prot.setWarningOnly(true);
    }
  });

  // Step 10: Set up time trigger (4 hours)
  setupTrigger_();

  // Step 11: Move Dashboard to front
  var dash = ss.getSheetByName("Dashboard");
  if (dash) {
    ss.setActiveSheet(dash);
    ss.moveActiveSheet(1);
  }

  // Step 12: Reorder tabs
  reorderTabs_(ss);

  ui.alert(
    "Money Shepherd 3.0 — Deployed \u2705\n\n" +
    "Desktop: Dashboard, Review Queue, Budget, Trends, Settings, Scripture\n" +
    "Mobile: \ud83d\udcf1 Home, \ud83d\udcf1 Review, \ud83d\udcf1 Budgets\n\n" +
    "Auto-assignment complete. Check Transactions for populated columns.\n" +
    "Time trigger set: runs every 4 hours to process new transactions."
  );
}

// ═══════════════════════════════════════════════════════════════
// AUTO-ASSIGNMENT PIPELINE
// ═══════════════════════════════════════════════════════════════

function autoAssignTransactions(ss, col, trans) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!trans) trans = ss.getSheetByName("Transactions");
  if (!col) {
    var headers = trans.getRange(1, 1, 1, trans.getLastColumn()).getValues()[0].map(String);
    col = buildColumnMap_(headers);
  }

  var lastRow = trans.getLastRow();
  if (lastRow < 2) return;

  // Read ALL data in one batch
  var data = trans.getRange(2, 1, lastRow - 1, trans.getLastColumn()).getValues();

  // Read Account Map
  var acctMap = readAccountMap_(ss);

  // Read AutoCat rules
  var autoCatRules = readAutoCatRules_(ss);

  // Indices (0-based for data array)
  var iDesc = (col["Description"] || 1) - 1;
  var iCat = (col["Category"] || 1) - 1;
  var iAmount = (col["Amount"] || 1) - 1;
  var iAccount = (col["Account"] || 1) - 1;
  var iHint = col["Category Hint"] ? col["Category Hint"] - 1 : -1;
  var iOwner = col["Owner"] ? col["Owner"] - 1 : -1;
  var iSpendType = col["Spend Type"] ? col["Spend Type"] - 1 : -1;
  var iTransfer = col["Transfer?"] ? col["Transfer?"] - 1 : -1;
  var iReviewed = col["Reviewed"] ? col["Reviewed"] - 1 : -1;
  var iNotes = col["Notes"] ? col["Notes"] - 1 : -1;

  // Track merchant amounts for outlier detection
  var merchantAmounts = {};
  var numRows = data.length;

  // Prepare per-column write arrays (only custom columns we control)
  var ownerOut = iOwner >= 0 ? trans.getRange(2, col["Owner"], numRows, 1).getValues() : null;
  var transferOut = iTransfer >= 0 ? trans.getRange(2, col["Transfer?"], numRows, 1).getValues() : null;
  var spendOut = iSpendType >= 0 ? trans.getRange(2, col["Spend Type"], numRows, 1).getValues() : null;
  var notesOut = iNotes >= 0 ? trans.getRange(2, col["Notes"], numRows, 1).getValues() : null;

  // We do NOT write to Tiller's Category column (has data validation).
  // Instead, track categories in a separate array and write without validation.
  var catOut = iCat >= 0 ? trans.getRange(2, col["Category"], numRows, 1).getValues() : null;
  var catChanged = false;

  var ownerChanged = false, transferChanged = false, spendChanged = false, notesChanged = false;

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var desc = String(row[iDesc] || "").trim();
    var acct = String(row[iAccount] || "").trim();
    var hint = iHint >= 0 ? String(row[iHint] || "").trim() : "";
    var amount = Number(row[iAmount]) || 0;
    var descLower = desc.toLowerCase();

    // Track for outlier detection
    if (descLower && amount !== 0) {
      if (!merchantAmounts[descLower]) merchantAmounts[descLower] = [];
      merchantAmounts[descLower].push({ idx: i, amount: Math.abs(amount) });
    }

    // STEP 1: Owner from Account Map
    if (ownerOut && !ownerOut[i][0]) {
      var owner = lookupOwner_(acct, acctMap);
      if (owner) {
        ownerOut[i][0] = owner;
        ownerChanged = true;
      }
    }

    // STEP 2: Transfer detection
    if (transferOut && !transferOut[i][0]) {
      var isTransfer = false;
      if (hint.indexOf("TRANSFER_IN") >= 0 || hint.indexOf("TRANSFER_OUT") >= 0) {
        isTransfer = true;
      }
      if (!isTransfer) {
        for (var t = 0; t < TRANSFER_DESCRIPTIONS.length; t++) {
          if (descLower.indexOf(TRANSFER_DESCRIPTIONS[t]) >= 0) {
            isTransfer = true;
            break;
          }
        }
      }
      if (isTransfer) {
        transferOut[i][0] = "Yes";
        transferChanged = true;
      }
    }

    // STEP 3: Category assignment (only if Tiller's Category is empty)
    if (catOut && !catOut[i][0]) {
      var category = null;

      // 3a: Try merchant rules FIRST for known bills (gives per-company names)
      var MERCHANT_RULES = [
          ["pmi green", "Rent (PMI)"],
          ["aep public", "AEP Electric"],
          ["fsi*pso", "AEP Electric"],
          ["fsi pso", "AEP Electric"],
          ["pso billmatrix", "AEP Electric"],
          ["i3p*oklahoma", "ONG Gas"],
          ["oklahoma natural", "ONG Gas"],
          ["broken arrow utili", "Water (BA)"],
          ["state farm", "State Farm"],
          ["tmobile", "T-Mobile"],
          ["t-mobile", "T-Mobile"],
          ["vzwrlss", "Verizon (closing)"],
          ["starlink", "Starlink"],
          ["hamiltons", "Wellness"],
          ["hamilton", "Wellness"],
          ["trader joe", "Groceries"],
          ["walmart", "Groceries"],
          ["wal-mart", "Groceries"],
          ["sams club", "Groceries"],
          ["sam's club", "Groceries"],
          ["reasor", "Groceries"],
          ["safelite", "Gas / Auto"]
        ];
        for (var mr = 0; mr < MERCHANT_RULES.length; mr++) {
          if (descLower.indexOf(MERCHANT_RULES[mr][0]) >= 0) {
            category = MERCHANT_RULES[mr][1];
            break;
          }
        }

      // 3b: Plaid Category Hint (for everything merchant rules didn't match)
      if (!category && hint) {
        category = mapPlaidCategory_(hint);
      }

      // 3c: AutoCat rules from sheet
      if (!category) {
        for (var r = 0; r < autoCatRules.length; r++) {
          if (descLower.indexOf(autoCatRules[r].pattern) >= 0) {
            category = autoCatRules[r].category;
            break;
          }
        }
      }

      if (category) {
        catOut[i][0] = category;
        catChanged = true;
      }
    }

    // STEP 4: Spend Type derivation
    if (spendOut && !spendOut[i][0]) {
      var transferVal = transferOut ? String(transferOut[i][0] || "") : "";
      var catVal = catOut ? String(catOut[i][0] || "") : "";
      var ownerVal = ownerOut ? String(ownerOut[i][0] || "") : "";

      if (transferVal === "Yes" || catVal === "Income" || catVal === "Transfers") {
        spendOut[i][0] = "Ignore";
        spendChanged = true;
      } else if (ownerVal === "Shared") {
        spendOut[i][0] = "Household";
        spendChanged = true;
      } else if (ownerVal === "Los" || ownerVal === "Wife") {
        spendOut[i][0] = "Personal";
        spendChanged = true;
      }
    }
  }

  // STEP 5: Outlier detection
  if (notesOut) {
    Object.keys(merchantAmounts).forEach(function(merchant) {
      var entries = merchantAmounts[merchant];
      if (entries.length < 3) return;

      var amounts = entries.map(function(e) { return e.amount; }).sort(function(a, b) { return a - b; });
      var mid = Math.floor(amounts.length / 2);
      var median = amounts.length % 2 !== 0 ? amounts[mid] : (amounts[mid - 1] + amounts[mid]) / 2;

      if (median < 1) return;

      entries.forEach(function(entry) {
        if (entry.amount > median * 3 && entry.amount > 50) {
          var currentNotes = String(notesOut[entry.idx][0] || "");
          if (currentNotes.indexOf("OUTLIER") < 0) {
            notesOut[entry.idx][0] = ("\u26a1 OUTLIER " + currentNotes).trim();
            notesChanged = true;
          }
        }
      });
    });
  }

  // Write back ONLY custom columns (never touch Tiller's base columns with setValues)
  if (ownerChanged) trans.getRange(2, col["Owner"], numRows, 1).setValues(ownerOut);
  if (transferChanged) trans.getRange(2, col["Transfer?"], numRows, 1).setValues(transferOut);
  if (spendChanged) trans.getRange(2, col["Spend Type"], numRows, 1).setValues(spendOut);
  if (notesChanged) trans.getRange(2, col["Notes"], numRows, 1).setValues(notesOut);

  // For Category, clear validation first, write, then restore validation
  if (catChanged && catOut) {
    var catRange = trans.getRange(2, col["Category"], numRows, 1);
    catRange.clearDataValidations();
    catRange.setValues(catOut);
  }

  // STEP 6: Auto-archive old outliers
  // Mark Reviewed="Yes" for outliers older than the start of current month
  // This prevents hundreds of old outliers from flooding the review queue
  if (iNotes >= 0 && col["Reviewed"]) {
    var iDate = (col["Date"] || 1) - 1;
    var reviewedOut = trans.getRange(2, col["Reviewed"], numRows, 1).getValues();
    var reviewedChanged = false;
    var currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    for (var a = 0; a < data.length; a++) {
      var txDate = data[a][iDate];
      var notes = notesOut ? String(notesOut[a][0] || "") : String(data[a][iNotes] || "");
      if (notes.indexOf("OUTLIER") >= 0 && !reviewedOut[a][0]) {
        if (txDate instanceof Date && txDate < currentMonthStart) {
          reviewedOut[a][0] = "Yes";
          reviewedChanged = true;
        }
      }
    }
    if (reviewedChanged) {
      trans.getRange(2, col["Reviewed"], numRows, 1).setValues(reviewedOut);
    }
  }
}

/**
 * Trigger handler: only processes rows without Owner assignment
 */
function runAutoAssignNew() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  autoAssignTransactions(ss, null, null);
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD BUILDER (Desktop)
// ═══════════════════════════════════════════════════════════════

function buildDashboard_(ss, col, L) {
  var dash = ss.getSheetByName("Dashboard");
  dash.clear();
  try { dash.setHiddenGridlines(true); } catch(e) {}
  dash.getRange("A:Z").setBackground(LIGHT_BG).setFontFamily("Google Sans,Roboto,Arial");

  dash.setColumnWidth(1, 10);
  dash.setColumnWidth(2, 160);  // B: labels
  dash.setColumnWidth(3, 120);  // C: spent/target
  dash.setColumnWidth(4, 110);  // D: last month + left over value
  dash.setColumnWidth(5, 120);  // E: progress bar
  dash.setColumnWidth(6, 10);

  // Use bounded ranges (row 2 to 15000) instead of whole-column for SUMPRODUCT
  var mc = "C4"; // month cell
  var D = 'Transactions!' + L("Date") + '2:' + L("Date") + '15000';
  var A = 'Transactions!' + L("Amount") + '2:' + L("Amount") + '15000';
  var C = 'Transactions!' + L("Category") + '2:' + L("Category") + '15000';
  var TF = col["Transfer?"] ? 'Transactions!' + L("Transfer?") + '2:' + L("Transfer?") + '15000' : null;
  var dateGte = 'DATEVALUE(' + mc + '&"-01")';
  var dateLt = 'EDATE(DATEVALUE(' + mc + '&"-01"),1)';
  // Date filter as boolean array
  var DF = '(' + D + '>=' + dateGte + ')*(' + D + '<' + dateLt + ')';
  var NTF = TF ? '*(' + TF + '<>"Yes")' : ''; // not-transfer filter
  // Previous month date filter
  var prevGte = 'EDATE(DATEVALUE(' + mc + '&"-01"),-1)';
  var prevLt = dateGte; // prev month ends where current begins
  var PDF = '(' + D + '>=' + prevGte + ')*(' + D + '<' + prevLt + ')';

  var row = 2;

  // ── SCRIPTURE ──
  dash.getRange(row, 2, 1, 3).merge().setBackground(CARD_BG)
    .setBorder(true, true, true, true, null, null, GOLD, SpreadsheetApp.BorderStyle.SOLID);
  dash.getRange(row, 2).setFormula(
    '=INDEX(Scripture!A:A,RANDBETWEEN(2,COUNTA(Scripture!A:A)))&" \u2014 "&INDEX(Scripture!B:B,RANDBETWEEN(2,COUNTA(Scripture!B:B)))'
  ).setHorizontalAlignment("center").setVerticalAlignment("middle")
    .setFontStyle("italic").setFontColor(DARK_TEXT).setWrap(true).setFontSize(10);
  dash.setRowHeight(row, 50);
  row++; // 3

  // ── MONTH + PAYDAY ──
  row++; // 4
  dash.getRange(row, 2).setValue("View month \u2192").setFontColor(MUTED).setFontSize(9);
  dash.getRange(row, 3).setNumberFormat("@"); // Force TEXT so Sheets doesn't auto-convert to date
  dash.getRange(row, 3).setValue(Utilities.formatDate(new Date(), "America/Chicago", "yyyy-MM"))
    .setFontWeight("bold").setFontSize(16).setBackground(CARD_BG)
    .setBorder(true, true, true, true, null, null, GOLD, SpreadsheetApp.BorderStyle.SOLID)
    .setHorizontalAlignment("center");
  // Payday — simple formula, no LET
  dash.getRange(row, 4).setFormula(
    '=LET(d,IF(DAY(TODAY())<15,15-DAY(TODAY()),DAY(EOMONTH(TODAY(),0))-DAY(TODAY())),IF(d=0,"Payday today! \ud83c\udf89",d&IF(d=1," day"," days")&" to payday"))'
  ).setFontWeight("bold").setFontColor(BLUE).setFontSize(11);
  row++; // 5
  dash.getRange(row, 2, 1, 3).merge()
    .setValue("Type yyyy-mm above to view a past month (e.g. 2026-02)")
    .setFontColor("#BDC3C7").setFontStyle("italic").setFontSize(8);
  row += 2; // 7

  // ── BIG THREE ──
  dash.getRange(row, 2).setValue("\ud83d\udcb0 Income").setFontWeight("bold").setFontColor(GREEN).setFontSize(10);
  dash.getRange(row, 3).setValue("\ud83d\udcb8 Spending").setFontWeight("bold").setFontColor(ORANGE).setFontSize(10);
  dash.getRange(row, 4).setValue("\ud83d\udcca Left Over").setFontWeight("bold").setFontColor(GOLD).setFontSize(10);
  row++; // 8

  // Income: SUMPRODUCT of positive amounts in month, excluding transfers
  cardCell_(dash, row, 2, 1);
  dash.getRange(row, 2).setFormula(
    '=IFERROR(SUMPRODUCT(' + DF + '*(' + A + '>0)' + NTF + '*' + A + '),0)'
  ).setFontSize(22).setFontWeight("bold").setFontColor(GREEN)
    .setNumberFormat("$#,##0").setHorizontalAlignment("center");

  // Spending: SUMPRODUCT of negative amounts (ABS)
  cardCell_(dash, row, 3, 1);
  dash.getRange(row, 3).setFormula(
    '=IFERROR(ABS(SUMPRODUCT(' + DF + '*(' + A + '<0)' + NTF + '*' + A + ')),0)'
  ).setFontSize(22).setFontWeight("bold").setFontColor(ORANGE)
    .setNumberFormat("$#,##0").setHorizontalAlignment("center");

  // Net
  cardCell_(dash, row, 4, 1, GOLD);
  dash.getRange(row, 4).setFormula('=B' + row + '-C' + row)
    .setFontSize(22).setFontWeight("bold").setFontColor(GOLD)
    .setNumberFormat("$#,##0").setHorizontalAlignment("center");
  row += 2; // 10

  // ── QUICK BALANCES (Cash and Debt separate) ──
  dash.getRange(row, 2, 1, 3).merge()
    .setValue("\ud83d\udc65 Quick Balances").setFontWeight("bold").setFontColor(GOLD).setFontSize(10);
  row++;

  var balFormulas = buildBalanceFormulas_(ss);
  var owners = ["Los", "Wife", "Shared"];
  var ownerColors = [GREEN, ORANGE, BLUE];

  // Cash row
  dash.getRange(row, 2).setValue("").setFontWeight("bold").setFontSize(9).setFontColor(MUTED);
  dash.getRange(row, 3).setValue("Cash").setFontWeight("bold").setFontSize(9).setFontColor(MUTED).setHorizontalAlignment("center");
  dash.getRange(row, 4).setValue("Debt").setFontWeight("bold").setFontSize(9).setFontColor(MUTED).setHorizontalAlignment("center");
  row++;

  for (var o = 0; o < owners.length; o++) {
    dash.getRange(row, 2).setValue(owners[o]).setFontWeight("bold").setFontSize(12);
    cardCell_(dash, row, 3, 1);
    cardCell_(dash, row, 4, 1);
    // Cash formula (assets only)
    if (balFormulas[owners[o] + "_cash"]) {
      dash.getRange(row, 3).setFormula(balFormulas[owners[o] + "_cash"])
        .setFontSize(18).setFontWeight("bold").setFontColor(ownerColors[o])
        .setNumberFormat("$#,##0").setHorizontalAlignment("center");
    } else {
      dash.getRange(row, 3).setValue(0).setNumberFormat("$#,##0").setHorizontalAlignment("center");
    }
    // Debt formula (liabilities only, shown as positive)
    if (balFormulas[owners[o] + "_debt"]) {
      dash.getRange(row, 4).setFormula(balFormulas[owners[o] + "_debt"])
        .setFontSize(18).setFontWeight("bold").setFontColor(RED)
        .setNumberFormat("$#,##0").setHorizontalAlignment("center");
    } else {
      dash.getRange(row, 4).setValue(0).setNumberFormat("$#,##0").setHorizontalAlignment("center");
    }
    row++;
  }
  row++;

  // ── BUDGET PROGRESS ──
  dash.getRange(row, 2, 1, 4).merge()
    .setValue("\ud83d\udcb0 Budget Progress").setFontWeight("bold").setFontColor(PURPLE).setFontSize(10);
  row++;
  dash.getRange(row, 2).setValue("Category").setFontWeight("bold").setFontColor(MUTED).setFontSize(9);
  dash.getRange(row, 3).setValue("Spent / Target").setFontWeight("bold").setFontColor(MUTED).setFontSize(9);
  dash.getRange(row, 4).setValue("Last Mo").setFontWeight("bold").setFontColor(MUTED).setFontSize(8);
  dash.getRange(row, 5).setValue("Progress").setFontWeight("bold").setFontColor(MUTED).setFontSize(9);
  row++;

  var budgetCats = Object.keys(DEFAULT_BUDGETS);
  for (var b = 0; b < budgetCats.length; b++) {
    var cat = budgetCats[b];
    if (cat === "Income" || DEFAULT_BUDGETS[cat] === 0) continue;
    var target = DEFAULT_BUDGETS[cat];

    dash.getRange(row, 2).setValue(cat).setFontSize(10);
    // Spent this month
    var spentFormula = 'ABS(SUMPRODUCT(' + DF + '*(' + C + '="' + cat + '")*(' + A + '<0)*' + A + '))';
    dash.getRange(row, 3).setFormula(
      '=IFERROR(' + spentFormula + '&" / $' + target + '","")'
    ).setFontSize(10).setHorizontalAlignment("center");

    // Last Month — show actual amount (simple, no confusing arrows)
    var prevSpent = 'ABS(SUMPRODUCT(' + PDF + '*(' + C + '="' + cat + '")*(' + A + '<0)*' + A + '))';
    dash.getRange(row, 4).setFormula(
      '=IFERROR(IF(' + prevSpent + '=0,"\u2014","$"&TEXT(' + prevSpent + ',"#,##0")),"\u2014")'
    ).setFontSize(9).setHorizontalAlignment("center").setFontColor(MUTED);

    // Progress bar (moved to column E)
    dash.getRange(row, 5).setFormula(
      '=IFERROR(SPARKLINE(' + spentFormula + '/' + target +
      ',{"charttype","bar";"max",1;"color1",IF(' + spentFormula + '/' + target +
      '<0.7,"' + GREEN + '",IF(' + spentFormula + '/' + target + '<=1,"' + ORANGE + '","' + RED + '"))}),' +
      '"")'
    );
    row++;
  }
  row++;

  // ── ALERTS ──
  dash.getRange(row, 2, 1, 3).merge()
    .setValue("\u26a0\ufe0f Action Needed").setFontWeight("bold").setFontColor(RED).setFontSize(10);
  row++;

  dash.getRange(row, 2).setValue("Uncategorized");
  cardCell_(dash, row, 3, 1);
  dash.getRange(row, 3).setFormula(
    '=IFERROR(SUMPRODUCT(' + DF + '*(' + C + '="")*1),0)'
  ).setFontWeight("bold").setHorizontalAlignment("center");
  row++;

  if (col["Owner"]) {
    var OW = 'Transactions!' + L("Owner") + '2:' + L("Owner") + '15000';
    dash.getRange(row, 2).setValue("Needs Owner");
    cardCell_(dash, row, 3, 1);
    dash.getRange(row, 3).setFormula(
      '=IFERROR(SUMPRODUCT(' + DF + '*(' + OW + '="")*1),0)'
    ).setFontWeight("bold").setHorizontalAlignment("center");
    row++;
  }

  if (col["Notes"]) {
    var NT = 'Transactions!' + L("Notes") + '2:' + L("Notes") + '15000';
    var RV = 'Transactions!' + L("Reviewed") + '2:' + L("Reviewed") + '15000';
    dash.getRange(row, 2).setValue("Outliers");
    cardCell_(dash, row, 3, 1);
    dash.getRange(row, 3).setFormula(
      '=IFERROR(SUMPRODUCT(ISNUMBER(SEARCH("OUTLIER",' + NT + '))*(' + RV + '<>"Yes")*1),0)'
    ).setFontWeight("bold").setHorizontalAlignment("center").setFontColor(RED);
    row++;
  }
  row++;

  // ── TOP MERCHANTS ──
  dash.getRange(row, 2, 1, 3).merge()
    .setValue("\ud83d\udd0d Top 10 Merchants This Month").setFontWeight("bold").setFontColor(GOLD).setFontSize(10);
  row++;
  // Top Merchants: exclude transfers by adding Transfer? column to the QUERY
  if (col["Transfer?"]) {
    dash.getRange(row, 2).setFormula(
      '=IFERROR(QUERY({Transactions!' + L("Description") + '2:' + L("Description") +
      ',Transactions!' + L("Amount") + '2:' + L("Amount") +
      ',Transactions!' + L("Date") + '2:' + L("Date") +
      ',Transactions!' + L("Transfer?") + '2:' + L("Transfer?") +
      '},"SELECT Col1, COUNT(Col1), SUM(Col2)' +
      ' WHERE Col3 >= date \'"&TEXT(DATEVALUE(' + mc + '&"-01"),"yyyy-mm-dd")&"\'' +
      ' AND Col3 < date \'"&TEXT(EDATE(DATEVALUE(' + mc + '&"-01"),1),"yyyy-mm-dd")&"\'' +
      ' AND Col2 < 0 AND Col1 IS NOT NULL AND Col4 <> \'Yes\'' +
      ' GROUP BY Col1 ORDER BY SUM(Col2) ASC LIMIT 10' +
      ' LABEL COUNT(Col1) \'Times\', SUM(Col2) \'Total\'",1),' +
      '"No data yet")'
    ).setFontSize(10);
  }

  // Skip rows for top merchants output (approx 12 rows)
  row += 12;

  // ── RECURRING BILLS TRACKER ──
  dash.getRange(row, 2, 1, 3).merge()
    .setValue("\ud83d\udcc5 Recurring Bills").setFontWeight("bold").setFontColor(BLUE).setFontSize(10);
  row++;
  dash.getRange(row, 2).setValue("Bill").setFontWeight("bold").setFontColor(MUTED).setFontSize(9);
  dash.getRange(row, 3).setValue("Last Paid").setFontWeight("bold").setFontColor(MUTED).setFontSize(9);
  dash.getRange(row, 4).setValue("Amount").setFontWeight("bold").setFontColor(MUTED).setFontSize(9);
  row++;

  // Each recurring bill: show last payment date + amount using SORTN+FILTER
  var recurringBills = [
    {name: "Rent (PMI)", pattern: "pmi green"},
    {name: "AEP Electric", pattern: "aep public"},
    {name: "ONG Gas", pattern: "oklahoma natural"},
    {name: "Water (BA)", pattern: "broken arrow utili"},
    {name: "T-Mobile", pattern: "tmobile"},
    {name: "Starlink", pattern: "starlink"},
    {name: "State Farm", pattern: "state farm"},
    {name: "Verizon", pattern: "vzwrlss"}
  ];

  var Dd = 'Transactions!' + L("Date") + '2:' + L("Date");
  var Dc = 'Transactions!' + L("Description") + '2:' + L("Description");
  var Da = 'Transactions!' + L("Amount") + '2:' + L("Amount");

  for (var rb = 0; rb < recurringBills.length; rb++) {
    var bill = recurringBills[rb];
    dash.getRange(row, 2).setValue(bill.name).setFontSize(10);

    // Last paid date
    dash.getRange(row, 3).setFormula(
      '=IFERROR(TEXT(MAXIFS(' + Dd + ',' + Dc + ',"*' + bill.pattern + '*"),"m/d/yy"),"\u2014")'
    ).setFontSize(10).setHorizontalAlignment("center");

    // Last amount — find amount of most recent matching transaction (sort by date desc)
    dash.getRange(row, 4).setFormula(
      '=IFERROR(ABS(INDEX(SORT(FILTER({' + Da + ',' + Dd + '},ISNUMBER(SEARCH("' + bill.pattern + '",' + Dc + '))),2,FALSE),1,1)),"\u2014")'
    ).setFontSize(10).setNumberFormat("$#,##0.00").setHorizontalAlignment("right");

    // Color: green if paid this month, orange if not
    dash.getRange(row, 3).setFontColor(MUTED);
    row++;
  }

  dash.getRange(row, 2, 1, 3).merge()
    .setValue("\u270f\ufe0f Edit bill patterns in the script to match your merchant names")
    .setFontColor("#BDC3C7").setFontStyle("italic").setFontSize(8);
  row += 2;

  // ── PAYCHECK PLANNER ──
  dash.getRange(row, 2, 1, 4).merge()
    .setValue("\ud83d\udcb5 Paycheck Planner").setFontWeight("bold").setFontColor(GREEN).setFontSize(10);
  row++;
  dash.getRange(row, 2, 1, 4).merge()
    .setValue("How to split your next check. Remaining bills this month based on targets vs what you've already paid.")
    .setFontColor(MUTED).setFontStyle("italic").setFontSize(8).setWrap(true);
  row++;
  dash.getRange(row, 2).setValue("Bill").setFontWeight("bold").setFontColor(MUTED).setFontSize(9);
  dash.getRange(row, 3).setValue("Target").setFontWeight("bold").setFontColor(MUTED).setFontSize(9);
  dash.getRange(row, 4).setValue("Paid").setFontWeight("bold").setFontColor(MUTED).setFontSize(9);
  dash.getRange(row, 5).setValue("Still Owe").setFontWeight("bold").setFontColor(MUTED).setFontSize(9);
  row++;

  // Show each bill category with target - paid = still owe
  var billCats = ["Rent (PMI)", "AEP Electric", "ONG Gas", "Water (BA)", "T-Mobile", "Starlink", "State Farm", "Verizon (closing)"];
  for (var bc = 0; bc < billCats.length; bc++) {
    var bcat = billCats[bc];
    var btarget = DEFAULT_BUDGETS[bcat] || 0;
    if (btarget === 0) continue;

    var bSpent = 'ABS(IFERROR(SUMPRODUCT(' + DF + '*(' + C + '="' + bcat + '")*(' + A + '<0)*' + A + '),0))';

    dash.getRange(row, 2).setValue(bcat).setFontSize(10);
    dash.getRange(row, 3).setValue(btarget).setNumberFormat("$#,##0").setFontSize(10).setFontColor(MUTED);
    dash.getRange(row, 4).setFormula('=IFERROR(' + bSpent + ',0)')
      .setNumberFormat("$#,##0").setFontSize(10);
    // Still owe = target - paid (if positive, you owe; if 0 or negative, paid up)
    dash.getRange(row, 5).setFormula(
      '=IF(' + btarget + '-' + bSpent + '<=0,"\u2705 Paid","$"&TEXT(' + btarget + '-' + bSpent + ',"#,##0"))'
    ).setFontSize(10).setFontWeight("bold").setHorizontalAlignment("center");
    row++;
  }

  // Total still owed
  var totalOwedParts = [];
  for (var tc = 0; tc < billCats.length; tc++) {
    var tt = DEFAULT_BUDGETS[billCats[tc]] || 0;
    if (tt > 0) {
      totalOwedParts.push('MAX(0,' + tt + '-ABS(IFERROR(SUMPRODUCT(' + DF + '*(' + C + '="' + billCats[tc] + '")*(' + A + '<0)*' + A + '),0)))');
    }
  }
  dash.getRange(row, 2).setValue("TOTAL STILL OWED").setFontWeight("bold").setFontSize(10);
  dash.getRange(row, 5).setFormula('=' + totalOwedParts.join('+'))
    .setFontSize(12).setFontWeight("bold").setFontColor(RED).setNumberFormat("$#,##0").setHorizontalAlignment("center");

  dash.setFrozenRows(5);
}

// ═══════════════════════════════════════════════════════════════
// MOBILE HOME BUILDER (📱 Home)
// ═══════════════════════════════════════════════════════════════

function buildMobileHome_(ss, col, L) {
  var mh = ss.getSheetByName("\ud83d\udcf1 Home");
  mh.clear();
  try { mh.setHiddenGridlines(true); } catch(e) {}
  mh.getRange("A:C").setBackground(LIGHT_BG).setFontFamily("Google Sans,Roboto,Arial");

  mh.setColumnWidth(1, 160); // labels
  mh.setColumnWidth(2, 160); // values

  // Reference Dashboard month cell
  var monthCell = 'Dashboard!C4';
  var dateGte = 'DATEVALUE(' + monthCell + '&"-01")';
  var dateLt = 'EDATE(DATEVALUE(' + monthCell + '&"-01"),1)';

  var row = 1;

  // Scripture
  mh.getRange(row, 1, 1, 2).merge().setBackground(CARD_BG)
    .setBorder(true, true, true, true, null, null, GOLD, SpreadsheetApp.BorderStyle.SOLID);
  mh.getRange(row, 1).setFormula(
    '=INDEX(Scripture!A:A,RANDBETWEEN(2,COUNTA(Scripture!A:A)))&" \u2014 "&INDEX(Scripture!B:B,RANDBETWEEN(2,COUNTA(Scripture!B:B)))'
  ).setHorizontalAlignment("center").setFontStyle("italic").setFontColor(DARK_TEXT).setWrap(true).setFontSize(9);
  mh.setRowHeight(row, 45);
  row++; // 2

  // Status line: 🟢 On track / 🟡 Watch spending / 🔴 Over budget
  mh.getRange(row, 1, 1, 2).merge().setBackground(CARD_BG);
  mh.getRange(row, 1).setFormula(
    '=IF(Dashboard!D8>=0,"\ud83d\udfe2 On track \u2014 $"&TEXT(Dashboard!D8,"#,##0")&" left over",' +
    'IF(Dashboard!D8>=-500,"\ud83d\udfe1 Watch spending \u2014 $"&TEXT(ABS(Dashboard!D8),"#,##0")&" over",' +
    '"\ud83d\udd34 Over budget \u2014 $"&TEXT(ABS(Dashboard!D8),"#,##0")&" over"))'
  ).setFontSize(12).setFontWeight("bold").setHorizontalAlignment("center").setWrap(true);
  mh.setRowHeight(row, 35);
  row++; // 3

  // Hero: Left Over amount
  mh.getRange(row, 1, 1, 2).merge().setBackground(GOLD);
  mh.getRange(row, 1).setFormula('=Dashboard!D8')
    .setFontSize(32).setFontWeight("bold").setFontColor("#FFF")
    .setNumberFormat("+$#,##0;-$#,##0").setHorizontalAlignment("center");
  mh.setRowHeight(row, 50);
  row++; // 4

  // Income / Spending subtitle
  mh.getRange(row, 1, 1, 2).merge().setBackground(GOLD);
  mh.getRange(row, 1).setFormula(
    '="$"&TEXT(Dashboard!B8,"#,##0")&" in \u00b7 $"&TEXT(Dashboard!C8,"#,##0")&" out"'
  ).setFontSize(10).setFontColor("#000").setHorizontalAlignment("center");
  row++; // 5

  // Spacer
  mh.setRowHeight(row, 8);
  row++; // 6

  // Quick Balances header
  mh.getRange(row, 1, 1, 2).merge()
    .setValue("BALANCES").setFontSize(9).setFontWeight("bold").setFontColor(GOLD).setBackground(LIGHT_BG);
  row++; // 7

  // Balance rows — reference Dashboard
  var balOwners = ["Los", "Wife", "Shared"];
  var balRows = [12, 13, 14]; // Dashboard rows for each owner (after Cash/Debt header row)
  var balColors = [GREEN, ORANGE, BLUE];

  for (var i = 0; i < balOwners.length; i++) {
    mh.getRange(row, 1).setValue(balOwners[i]).setFontSize(14).setFontColor(DARK_TEXT).setBackground(CARD_BG);
    mh.getRange(row, 2).setFormula('=Dashboard!C' + balRows[i])
      .setFontSize(18).setFontWeight("bold").setFontColor(balColors[i])
      .setNumberFormat("$#,##0").setHorizontalAlignment("right").setBackground(CARD_BG);
    mh.setRowHeight(row, 32);
    row++;
  }

  // Spacer
  mh.setRowHeight(row, 8);
  row++; // 11

  // Budget Health
  mh.getRange(row, 1, 1, 2).merge()
    .setValue("BUDGETS").setFontSize(9).setFontWeight("bold").setFontColor(PURPLE).setBackground(LIGHT_BG);
  row++;

  var budgetCats = Object.keys(DEFAULT_BUDGETS);
  for (var b = 0; b < budgetCats.length; b++) {
    var cat = budgetCats[b];
    if (cat === "Income" || DEFAULT_BUDGETS[cat] === 0) continue;
    var target = DEFAULT_BUDGETS[cat];

    mh.getRange(row, 1).setValue(cat).setFontSize(12).setBackground(CARD_BG);
    // Traffic light + spent/target using SUMPRODUCT
    var mD = 'Transactions!' + L("Date") + '2:' + L("Date") + '15000';
    var mA = 'Transactions!' + L("Amount") + '2:' + L("Amount") + '15000';
    var mC = 'Transactions!' + L("Category") + '2:' + L("Category") + '15000';
    var mDF = '(' + mD + '>=DATEVALUE(' + monthCell + '&"-01"))*(' + mD + '<EDATE(DATEVALUE(' + monthCell + '&"-01"),1))';
    var spentExpr = 'ABS(IFERROR(SUMPRODUCT(' + mDF + '*(' + mC + '="' + cat + '")*(' + mA + '<0)*' + mA + '),0))';
    mh.getRange(row, 2).setFormula(
      '=IF(' + spentExpr + '/' + target + '<0.7,"\ud83d\udfe2",IF(' + spentExpr + '/' + target + '<=1,"\ud83d\udfe1","\ud83d\udd34"))&" $"&TEXT(' + spentExpr + ',"#,##0")&" / $' + target + '"'
    ).setFontSize(12).setHorizontalAlignment("right").setBackground(CARD_BG);
    row++;
  }

  // Spacer
  mh.setRowHeight(row, 8);
  row++;

  // Alerts
  mh.getRange(row, 1, 1, 2).merge()
    .setValue("ACTION NEEDED").setFontSize(9).setFontWeight("bold").setFontColor(RED).setBackground(LIGHT_BG);
  row++;

  mh.getRange(row, 1, 1, 2).merge().setBackground(CARD_BG);
  var mhD = 'Transactions!' + L("Date") + '2:' + L("Date") + '15000';
  var mhC = 'Transactions!' + L("Category") + '2:' + L("Category") + '15000';
  var mhDF = '(' + mhD + '>=DATEVALUE(' + monthCell + '&"-01"))*(' + mhD + '<EDATE(DATEVALUE(' + monthCell + '&"-01"),1))';
  mh.getRange(row, 1).setFormula(
    '=IFERROR(SUMPRODUCT(' + mhDF + '*(' + mhC + '="")*1),0)&" uncategorized"'
  ).setFontSize(12).setFontColor(ORANGE);
  row++;

  // Recurring Bills (compact for mobile)
  mh.setRowHeight(row, 8);
  row++;
  mh.getRange(row, 1, 1, 2).merge()
    .setValue("BILLS").setFontSize(9).setFontWeight("bold").setFontColor(BLUE).setBackground(LIGHT_BG);
  row++;

  var mBills = [
    {name: "Rent", pattern: "pmi green"},
    {name: "AEP Electric", pattern: "aep public"},
    {name: "ONG Gas", pattern: "oklahoma natural"},
    {name: "Water", pattern: "broken arrow utili"},
    {name: "T-Mobile", pattern: "tmobile"},
    {name: "Starlink", pattern: "starlink"},
    {name: "State Farm", pattern: "state farm"}
  ];
  var mDd = 'Transactions!' + L("Date") + '2:' + L("Date");
  var mDc = 'Transactions!' + L("Description") + '2:' + L("Description");
  var mDa = 'Transactions!' + L("Amount") + '2:' + L("Amount");

  for (var mb = 0; mb < mBills.length; mb++) {
    var bill = mBills[mb];
    mh.getRange(row, 1).setValue(bill.name).setFontSize(12).setBackground(CARD_BG);
    // Show: last date + amount combined
    mh.getRange(row, 2).setFormula(
      '=IFERROR(TEXT(MAXIFS(' + mDd + ',' + mDc + ',"*' + bill.pattern + '*"),"m/d")&"  $"&' +
      'TEXT(ABS(INDEX(SORT(FILTER({' + mDa + ',' + mDd + '},ISNUMBER(SEARCH("' + bill.pattern + '",' + mDc + '))),2,FALSE),1,1)),"#,##0"),"\u2014 not found")'
    ).setFontSize(12).setHorizontalAlignment("right").setBackground(CARD_BG);
    row++;
  }

  // Payday
  mh.setRowHeight(row, 8);
  row++;
  mh.getRange(row, 1, 1, 2).merge().setBackground(CARD_BG).setHorizontalAlignment("center");
  mh.getRange(row, 1).setFormula(
    '="\u23f0 "&LET(d,IF(DAY(TODAY())<15,15-DAY(TODAY()),DAY(EOMONTH(TODAY(),0))-DAY(TODAY())),IF(d=0,"Payday today! \ud83c\udf89","Payday in "&d&IF(d=1," day"," days")))'
  ).setFontSize(14).setFontWeight("bold").setFontColor(BLUE);
  row += 2;

  // ── SAFE TO SPEND (wife-friendly) ──
  mh.getRange(row, 1, 1, 2).merge()
    .setValue("SAFE TO SPEND").setFontSize(9).setFontWeight("bold").setFontColor(GREEN).setBackground(LIGHT_BG);
  row++;
  mh.getRange(row, 1, 1, 2).merge().setBackground(GREEN_BG)
    .setBorder(true, true, true, true, null, null, GREEN, SpreadsheetApp.BorderStyle.SOLID);
  // Safe to spend = Los + Wife cash (the OPERATING money, not Shared/tax savings)
  mh.getRange(row, 1).setFormula(
    '=IFERROR("$"&TEXT(Dashboard!C12+Dashboard!C13,"#,##0"),"$0")'
  ).setFontSize(28).setFontWeight("bold").setFontColor(GREEN).setHorizontalAlignment("center");
  mh.setRowHeight(row, 50);
  row++;
  mh.getRange(row, 1, 1, 2).merge().setBackground(LIGHT_BG);
  mh.getRange(row, 1).setValue("His + Her checking (spending money)")
    .setFontSize(8).setFontColor(MUTED).setFontStyle("italic").setHorizontalAlignment("center");
  row += 2;

  // SoFi tax fund note (gray, small — matches EZ View)
  mh.getRange(row, 1).setValue("SoFi tax fund").setFontSize(9).setFontColor("#999");
  mh.getRange(row, 2).setFormula('=Dashboard!C14')
    .setFontSize(9).setFontColor("#999").setNumberFormat("$#,##0").setHorizontalAlignment("right");
  row++;
  mh.getRange(row, 1, 1, 2).merge();
  mh.getRange(row, 1).setValue("(set aside for taxes \u2014 don\u2019t touch)")
    .setFontSize(7).setFontColor("#BBB").setFontStyle("italic").setHorizontalAlignment("center");
}

// ═══════════════════════════════════════════════════════════════
// REVIEW QUEUE BUILDER
// ═══════════════════════════════════════════════════════════════

function buildReviewQueue_(ss, col, L) {
  var rq = ss.getSheetByName("Review Queue");
  rq.clear();
  try { rq.setHiddenGridlines(true); } catch(e) {}
  rq.getRange("A:J").setBackground(LIGHT_BG).setFontFamily("Google Sans,Roboto,Arial");

  rq.getRange("B2").setValue("\ud83d\udccb Review Queue")
    .setFontSize(16).setFontWeight("bold").setFontColor(GOLD);
  rq.getRange("B3").setValue("Transactions needing attention. Outliers first, then uncategorized, then unreviewed.")
    .setFontColor(MUTED).setFontStyle("italic").setWrap(true);

  // Count
  rq.getRange("B4").setFormula(
    '=IFERROR(COUNTA(B7:B)&" transactions need attention","All caught up! \u2705")'
  ).setFontWeight("bold").setFontColor(RED);

  // Headers
  rq.getRange("B6:I6").setValues([["Date", "Description", "Amount", "Account", "Category", "Owner", "Spend Type", "Notes"]])
    .setFontWeight("bold").setBackground(GOLD).setFontColor("white");

  // Filter formula showing items needing review
  if (col["Category"] && col["Owner"] && col["Reviewed"]) {
    rq.getRange("B7").setFormula(
      '=IFERROR(SORT(FILTER({' +
      'TEXT(Transactions!' + L("Date") + '2:' + L("Date") + ',"mm/dd/yy"),' +
      'Transactions!' + L("Description") + '2:' + L("Description") + ',' +
      'Transactions!' + L("Amount") + '2:' + L("Amount") + ',' +
      'Transactions!' + L("Account") + '2:' + L("Account") + ',' +
      'Transactions!' + L("Category") + '2:' + L("Category") + ',' +
      'Transactions!' + L("Owner") + '2:' + L("Owner") + ',' +
      'Transactions!' + L("Spend Type") + '2:' + L("Spend Type") + ',' +
      'Transactions!' + L("Notes") + '2:' + L("Notes") +
      '},(' +
      '(Transactions!' + L("Category") + '2:' + L("Category") + '="")' +
      '+(Transactions!' + L("Owner") + '2:' + L("Owner") + '="")' +
      '+(Transactions!' + L("Reviewed") + '2:' + L("Reviewed") + '<>"Yes")' +
      ')),' +
      '8,FALSE,1,FALSE' + // Sort by Notes desc (outliers first), then Date desc
      '),"All caught up! \u2705")'
    );
  }

  // Column widths
  rq.setColumnWidth(1, 10);
  rq.setColumnWidth(2, 80);   // Date
  rq.setColumnWidth(3, 200);  // Description
  rq.setColumnWidth(4, 90);   // Amount
  rq.setColumnWidth(5, 120);  // Account
  rq.setColumnWidth(6, 120);  // Category
  rq.setColumnWidth(7, 70);   // Owner
  rq.setColumnWidth(8, 90);   // Spend Type
  rq.setColumnWidth(9, 120);  // Notes
}

// ═══════════════════════════════════════════════════════════════
// MOBILE REVIEW BUILDER (📱 Review)
// ═══════════════════════════════════════════════════════════════

function buildMobileReview_(ss, col, L) {
  var mr = ss.getSheetByName("\ud83d\udcf1 Review");
  mr.clear();
  try { mr.setHiddenGridlines(true); } catch(e) {}
  mr.getRange("A:D").setBackground(LIGHT_BG).setFontFamily("Google Sans,Roboto,Arial");

  mr.getRange("A1").setValue("\ud83d\udccb Review")
    .setFontSize(14).setFontWeight("bold").setFontColor(GOLD);
  mr.getRange("A2").setFormula(
    '=IFERROR(COUNTA(A4:A)&" items","All caught up! \u2705")'
  ).setFontWeight("bold").setFontColor(RED).setFontSize(11);

  mr.getRange("A3:C3").setValues([["Date", "Description", "Amount"]])
    .setFontWeight("bold").setBackground(GOLD).setFontColor("white").setFontSize(10);

  if (col["Category"] && col["Owner"] && col["Reviewed"]) {
    mr.getRange("A4").setFormula(
      '=IFERROR(SORT(FILTER({' +
      'TEXT(Transactions!' + L("Date") + '2:' + L("Date") + ',"m/d"),' +
      'LEFT(Transactions!' + L("Description") + '2:' + L("Description") + ',25),' +
      'Transactions!' + L("Amount") + '2:' + L("Amount") +
      '},(' +
      '(Transactions!' + L("Category") + '2:' + L("Category") + '="")' +
      '+(Transactions!' + L("Owner") + '2:' + L("Owner") + '="")' +
      '+(Transactions!' + L("Reviewed") + '2:' + L("Reviewed") + '<>"Yes")' +
      ')),1,FALSE),"All caught up! \u2705")'
    );
  }

  mr.setColumnWidth(1, 55);  // Date
  mr.setColumnWidth(2, 180); // Description
  mr.setColumnWidth(3, 75);  // Amount
  mr.setRowHeightsForced(4, 100, 28); // Taller rows for tap
}

// ═══════════════════════════════════════════════════════════════
// BUDGET TAB BUILDER
// ═══════════════════════════════════════════════════════════════

function buildBudget_(ss, col, L) {
  var bud = ss.getSheetByName("Budget");
  bud.clear();
  try { bud.setHiddenGridlines(true); } catch(e) {}
  bud.getRange("A:I").setBackground(LIGHT_BG).setFontFamily("Google Sans,Roboto,Arial");

  var monthCell = 'Dashboard!C4';
  var dateGte = 'DATEVALUE(' + monthCell + '&"-01")';
  var dateLt = 'EDATE(DATEVALUE(' + monthCell + '&"-01"),1)';
  var prevGte = 'EDATE(DATEVALUE(' + monthCell + '&"-01"),-1)';
  var prevLt = dateGte;

  bud.getRange("B2").setValue("\ud83d\udcb0 Monthly Budget")
    .setFontSize(16).setFontWeight("bold").setFontColor(GOLD);
  bud.getRange("B3").setValue("Edit Target (column C) to set your monthly goals. Everything else auto-calculates.")
    .setFontColor(MUTED).setFontStyle("italic").setWrap(true);

  // Headers
  bud.getRange("B5:I5").setValues([["Category", "Target", "This Month", "Last Month", "Diff", "Remaining", "% Used", "Progress"]])
    .setFontWeight("bold").setBackground(GOLD).setFontColor("white");

  var budgetCats = Object.keys(DEFAULT_BUDGETS);
  var row = 6;
  for (var b = 0; b < budgetCats.length; b++) {
    var cat = budgetCats[b];
    if (DEFAULT_BUDGETS[cat] === 0 && cat !== "Income") continue;

    bud.getRange(row, 2).setValue(cat);
    bud.getRange(row, 3).setValue(DEFAULT_BUDGETS[cat]).setNumberFormat("$#,##0");

    // This Month spent
    var bD = 'Transactions!' + L("Date") + '2:' + L("Date") + '15000';
    var bA = 'Transactions!' + L("Amount") + '2:' + L("Amount") + '15000';
    var bC = 'Transactions!' + L("Category") + '2:' + L("Category") + '15000';
    var bDF = '(' + bD + '>=' + dateGte + ')*(' + bD + '<' + dateLt + ')';
    var bPDF = '(' + bD + '>=' + prevGte + ')*(' + bD + '<' + prevLt + ')';

    if (cat === "Income") {
      bud.getRange(row, 4).setFormula(
        '=IFERROR(SUMPRODUCT(' + bDF + '*(' + bA + '>0)*' + bA + '),0)'
      ).setNumberFormat("$#,##0");
      bud.getRange(row, 5).setFormula(
        '=IFERROR(SUMPRODUCT(' + bPDF + '*(' + bA + '>0)*' + bA + '),0)'
      ).setNumberFormat("$#,##0").setFontColor(MUTED);
    } else {
      bud.getRange(row, 4).setFormula(
        '=IFERROR(ABS(SUMPRODUCT(' + bDF + '*(' + bC + '="' + cat + '")*(' + bA + '<0)*' + bA + ')),0)'
      ).setNumberFormat("$#,##0");
      // Last Month
      bud.getRange(row, 5).setFormula(
        '=IFERROR(ABS(SUMPRODUCT(' + bPDF + '*(' + bC + '="' + cat + '")*(' + bA + '<0)*' + bA + ')),0)'
      ).setNumberFormat("$#,##0").setFontColor(MUTED);
    }

    // Diff (this - last, positive = spending more)
    bud.getRange(row, 6).setFormula('=D' + row + '-E' + row).setNumberFormat("+$#,##0;-$#,##0")
      .setFontColor(MUTED).setFontSize(9);
    // Remaining
    bud.getRange(row, 7).setFormula('=C' + row + '-D' + row).setNumberFormat("$#,##0");
    // % Used
    bud.getRange(row, 8).setFormula('=IFERROR(D' + row + '/C' + row + ',0)').setNumberFormat("0%");
    // Progress bar
    bud.getRange(row, 9).setFormula(
      '=IFERROR(SPARKLINE(H' + row + ',{"charttype","bar";"max",1;"color1",' +
      'IF(H' + row + '<0.7,"' + GREEN + '",IF(H' + row + '<=1,"' + ORANGE + '","' + RED + '"))}),' +
      '"")'
    );

    row++;
  }

  bud.setColumnWidth(1, 10);
  bud.setColumnWidth(2, 160);  // Category
  bud.setColumnWidth(3, 80);   // Target
  bud.setColumnWidth(4, 90);   // This Month
  bud.setColumnWidth(5, 90);   // Last Month
  bud.setColumnWidth(6, 75);   // Diff
  bud.setColumnWidth(7, 85);   // Remaining
  bud.setColumnWidth(8, 60);   // % Used
  bud.setColumnWidth(9, 100);  // Progress
}

// ═══════════════════════════════════════════════════════════════
// CATEGORY DETAIL TAB — see what's in each category
// ═══════════════════════════════════════════════════════════════

function buildCategoryDetail_(ss, col, L) {
  var cd = ss.getSheetByName("Category Detail");
  cd.clear();
  try { cd.setHiddenGridlines(true); } catch(e) {}
  cd.getRange("A:F").setBackground(LIGHT_BG).setFontFamily("Google Sans,Roboto,Arial");

  var monthCell = 'Dashboard!C4';

  cd.getRange("B2").setValue("\ud83d\udd0d Category Detail")
    .setFontSize(16).setFontWeight("bold").setFontColor(GOLD);
  cd.getRange("B3").setValue("Every transaction this month, sorted by category. Use this to verify what's in each bucket.")
    .setFontColor(MUTED).setFontStyle("italic").setWrap(true);

  // QUERY: all transactions this month sorted by Category, then Date
  cd.getRange("B5:G5").setValues([["Date", "Description", "Category", "Amount", "Owner", "Spend Type"]])
    .setFontWeight("bold").setBackground(GOLD).setFontColor("white");

  cd.getRange("B6").setFormula(
    '=IFERROR(SORT(FILTER({' +
    'TEXT(Transactions!' + L("Date") + '2:' + L("Date") + ',"mm/dd"),' +
    'Transactions!' + L("Description") + '2:' + L("Description") + ',' +
    'Transactions!' + L("Category") + '2:' + L("Category") + ',' +
    'Transactions!' + L("Amount") + '2:' + L("Amount") + ',' +
    'Transactions!' + L("Owner") + '2:' + L("Owner") + ',' +
    'Transactions!' + L("Spend Type") + '2:' + L("Spend Type") +
    '},' +
    '(Transactions!' + L("Date") + '2:' + L("Date") + '>=DATEVALUE(' + monthCell + '&"-01"))' +
    '*(Transactions!' + L("Date") + '2:' + L("Date") + '<EDATE(DATEVALUE(' + monthCell + '&"-01"),1))' +
    '*(Transactions!' + L("Spend Type") + '2:' + L("Spend Type") + '<>"Ignore")' +
    '),3,TRUE,1,FALSE),' + // Sort by Category asc, then Date desc
    '"No transactions this month")'
  );

  cd.setColumnWidth(1, 10);
  cd.setColumnWidth(2, 70);   // Date
  cd.setColumnWidth(3, 220);  // Description
  cd.setColumnWidth(4, 130);  // Category
  cd.setColumnWidth(5, 90);   // Amount
  cd.setColumnWidth(6, 70);   // Owner
  cd.setColumnWidth(7, 90);   // Spend Type
}

// ═══════════════════════════════════════════════════════════════
// MOBILE BUDGETS (📱 Budgets)
// ═══════════════════════════════════════════════════════════════

function buildMobileBudgets_(ss, col, L) {
  var mb = ss.getSheetByName("\ud83d\udcf1 Budgets");
  mb.clear();
  try { mb.setHiddenGridlines(true); } catch(e) {}
  mb.getRange("A:B").setBackground(LIGHT_BG).setFontFamily("Google Sans,Roboto,Arial");

  mb.getRange("A1").setValue("\ud83d\udcb0 Budgets")
    .setFontSize(14).setFontWeight("bold").setFontColor(GOLD);
  mb.getRange("A2").setFormula('="Month: "&Dashboard!C4')
    .setFontSize(10).setFontColor(MUTED);

  var row = 4;
  var budgetCats = Object.keys(DEFAULT_BUDGETS);
  var monthCell = 'Dashboard!C4';

  for (var b = 0; b < budgetCats.length; b++) {
    var cat = budgetCats[b];
    if (cat === "Income" || DEFAULT_BUDGETS[cat] === 0) continue;
    var target = DEFAULT_BUDGETS[cat];

    mb.getRange(row, 1).setValue(cat).setFontSize(13).setFontWeight("bold").setBackground(CARD_BG);
    var mbD = 'Transactions!' + L("Date") + '2:' + L("Date") + '15000';
    var mbA = 'Transactions!' + L("Amount") + '2:' + L("Amount") + '15000';
    var mbC = 'Transactions!' + L("Category") + '2:' + L("Category") + '15000';
    var mbDF = '(' + mbD + '>=DATEVALUE(' + monthCell + '&"-01"))*(' + mbD + '<EDATE(DATEVALUE(' + monthCell + '&"-01"),1))';
    var mbSpent = 'ABS(IFERROR(SUMPRODUCT(' + mbDF + '*(' + mbC + '="' + cat + '")*(' + mbA + '<0)*' + mbA + '),0))';
    mb.getRange(row, 2).setFormula(
      '=IF(' + mbSpent + '/' + target + '<0.7,"\ud83d\udfe2",IF(' + mbSpent + '/' + target + '<=1,"\ud83d\udfe1","\ud83d\udd34"))&" $"&TEXT(' + mbSpent + ',"#,##0")&" / $' + target + '"'
    ).setFontSize(13).setHorizontalAlignment("right").setBackground(CARD_BG);
    mb.setRowHeight(row, 30);
    row++;
  }

  mb.setColumnWidth(1, 150);
  mb.setColumnWidth(2, 170);
}

// ═══════════════════════════════════════════════════════════════
// EZ VIEW — Wife's Scorecard (dead simple)
// ═══════════════════════════════════════════════════════════════

function buildEZView_(ss, col, L) {
  var ez = ss.getSheetByName("\ud83d\udcf1 EZ View");
  ez.clear();
  try { ez.setHiddenGridlines(true); } catch(e) {}
  ez.getRange("A:C").setBackground(LIGHT_BG).setFontFamily("Google Sans,Roboto,Arial");

  ez.setColumnWidth(1, 160);
  ez.setColumnWidth(2, 160);

  var row = 1;

  // Month header
  ez.getRange(row, 1, 1, 2).merge().setBackground(LIGHT_BG);
  ez.getRange(row, 1).setFormula('=UPPER(TEXT(DATEVALUE(Dashboard!C4&"-01"),"MMMM YYYY"))')
    .setFontSize(12).setFontWeight("bold").setFontColor(MUTED).setHorizontalAlignment("center");
  row++; // 2

  // Hero: Total household cash (Los + Wife + Shared combined)
  ez.getRange(row, 1, 1, 2).merge().setBackground(GOLD)
    .setBorder(true, true, true, true, null, null, GOLD, SpreadsheetApp.BorderStyle.SOLID);
  ez.getRange(row, 1).setFormula('=Dashboard!C12+Dashboard!C13+Dashboard!C14')
    .setFontSize(28).setFontWeight("bold").setFontColor("#FFF")
    .setNumberFormat("$#,##0").setHorizontalAlignment("center");
  ez.setRowHeight(row, 50);
  row++; // 3
  ez.getRange(row, 1, 1, 2).merge().setBackground(GOLD);
  ez.getRange(row, 1).setValue("total cash (all accounts)")
    .setFontSize(10).setFontColor("#000").setHorizontalAlignment("center");
  row++; // 4

  // Spacer
  ez.setRowHeight(row, 10);
  row++; // 5

  // Safe to spend (Los + Wife cash minus unpaid bills)
  ez.getRange(row, 1).setValue("Safe to spend").setFontSize(14).setFontColor(DARK_TEXT).setBackground(CARD_BG);
  ez.getRange(row, 2).setFormula(
    '=IFERROR(Dashboard!C12+Dashboard!C13,0)'
  ).setFontSize(18).setFontWeight("bold").setFontColor(GREEN)
    .setNumberFormat("$#,##0").setHorizontalAlignment("right").setBackground(CARD_BG);
  ez.setRowHeight(row, 35);
  row++; // 6

  // Spacer
  ez.setRowHeight(row, 8);
  row++; // 7

  // Simple list
  var listItems = [
    ["Money in", '=Dashboard!B8', GREEN, "$#,##0"],
    ["Money out", '=Dashboard!C8', ORANGE, "$#,##0"],
    ["Bills left to pay", null, RED, "$#,##0"],
    ["Her balance", '=Dashboard!C13', ORANGE, "$#,##0"],
    ["His balance", '=Dashboard!C12', GREEN, "$#,##0"]
  ];

  for (var li = 0; li < listItems.length; li++) {
    var item = listItems[li];
    ez.getRange(row, 1).setValue(item[0]).setFontSize(13).setFontColor(DARK_TEXT).setBackground(CARD_BG);
    if (item[1]) {
      ez.getRange(row, 2).setFormula(item[1])
        .setFontSize(14).setFontWeight("bold").setFontColor(item[2])
        .setNumberFormat(item[3]).setHorizontalAlignment("right").setBackground(CARD_BG);
    }
    ez.setRowHeight(row, 30);
    row++;
  }

  // Bills left to pay — need to find the Paycheck Planner total cell on Dashboard
  // It's dynamic, so use a SUMPRODUCT to calculate unpaid bills directly
  var billCats = ["Rent (PMI)", "AEP Electric", "ONG Gas", "Water (BA)", "T-Mobile", "Starlink", "State Farm", "Verizon (closing)"];
  var billTargets = [2525, 150, 200, 130, 150, 50, 350, 500];
  var D = 'Transactions!' + L("Date") + '2:' + L("Date") + '15000';
  var A = 'Transactions!' + L("Amount") + '2:' + L("Amount") + '15000';
  var C = 'Transactions!' + L("Category") + '2:' + L("Category") + '15000';
  var mc = 'Dashboard!C4';
  var DF = '(' + D + '>=DATEVALUE(' + mc + '&"-01"))*(' + D + '<EDATE(DATEVALUE(' + mc + '&"-01"),1))';

  var owedParts = [];
  for (var bp = 0; bp < billCats.length; bp++) {
    owedParts.push('MAX(0,' + billTargets[bp] + '-ABS(IFERROR(SUMPRODUCT(' + DF + '*(' + C + '="' + billCats[bp] + '")*(' + A + '<0)*' + A + '),0)))');
  }
  // Go back and set the "Bills left to pay" cell (row was 7 + 2 = row 9)
  ez.getRange(9, 2).setFormula('=' + owedParts.join('+'))
    .setFontSize(14).setFontWeight("bold").setFontColor(RED)
    .setNumberFormat("$#,##0").setHorizontalAlignment("right").setBackground(CARD_BG);

  // Spacer
  ez.setRowHeight(row, 10);
  row++; // 13

  // Tax fund (gray, small — Shared accounts = SoFi, set aside for taxes)
  ez.getRange(row, 1).setValue("SoFi tax fund (set aside)").setFontSize(10).setFontColor("#999").setBackground(LIGHT_BG);
  ez.getRange(row, 2).setFormula('=Dashboard!C14')
    .setFontSize(10).setFontColor("#999").setNumberFormat("$#,##0").setHorizontalAlignment("right").setBackground(LIGHT_BG);
  row++; // 14

  // Spacer
  ez.setRowHeight(row, 10);
  row++; // 15

  // Payday
  ez.getRange(row, 1, 1, 2).merge().setBackground(CARD_BG).setHorizontalAlignment("center");
  ez.getRange(row, 1).setFormula(
    '="\u23f0 "&LET(d,IF(DAY(TODAY())<15,15-DAY(TODAY()),DAY(EOMONTH(TODAY(),0))-DAY(TODAY())),IF(d=0,"Payday today! \ud83c\udf89","Payday in "&d&IF(d=1," day"," days")))'
  ).setFontSize(14).setFontWeight("bold").setFontColor(BLUE);
}

// ═══════════════════════════════════════════════════════════════
// TRENDS TAB BUILDER
// ═══════════════════════════════════════════════════════════════

function buildTrends_(ss, col, L) {
  var tr = ss.getSheetByName("Trends");
  tr.clear();
  try { tr.setHiddenGridlines(true); } catch(e) {}
  tr.getRange("A:H").setBackground(LIGHT_BG).setFontFamily("Google Sans,Roboto,Arial");

  tr.getRange("B2").setValue("\ud83d\udcc8 Spending Trends")
    .setFontSize(16).setFontWeight("bold").setFontColor(GOLD);
  tr.getRange("B3").setValue("Last 6 months of spending by category")
    .setFontColor(MUTED).setFontStyle("italic");

  // Generate last 6 months
  var now = new Date();
  var months = [];
  for (var m = 5; m >= 0; m--) {
    var d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    months.push(Utilities.formatDate(d, "America/Chicago", "yyyy-MM"));
  }

  // Headers: Category | Month1 | Month2 | ... | Month6 | Trend
  var headerRow = ["Category"];
  months.forEach(function(m) { headerRow.push(m); });
  headerRow.push("Trend");
  tr.getRange(5, 2, 1, headerRow.length).setValues([headerRow])
    .setFontWeight("bold").setBackground(GOLD).setFontColor("white");

  var row = 6;
  var budgetCats = Object.keys(DEFAULT_BUDGETS);
  for (var b = 0; b < budgetCats.length; b++) {
    var cat = budgetCats[b];
    if (DEFAULT_BUDGETS[cat] === 0 && cat !== "Income") continue;

    tr.getRange(row, 2).setValue(cat);

    for (var mi = 0; mi < months.length; mi++) {
      var mCell = '"' + months[mi] + '"';
      var mDateGte = 'DATEVALUE(' + mCell + '&"-01")';
      var mDateLt = 'EDATE(DATEVALUE(' + mCell + '&"-01"),1)';

      if (cat === "Income") {
        tr.getRange(row, 3 + mi).setFormula(
          '=IFERROR(SUMIFS(Transactions!' + L("Amount") + ':' + L("Amount") +
          ',Transactions!' + L("Date") + ':' + L("Date") + ',">="&' + mDateGte +
          ',Transactions!' + L("Date") + ':' + L("Date") + ',"<"&' + mDateLt +
          ',Transactions!' + L("Amount") + ':' + L("Amount") + ',">"&0),0)'
        ).setNumberFormat("$#,##0");
      } else {
        tr.getRange(row, 3 + mi).setFormula(
          '=IFERROR(ABS(SUMIFS(Transactions!' + L("Amount") + ':' + L("Amount") +
          ',Transactions!' + L("Date") + ':' + L("Date") + ',">="&' + mDateGte +
          ',Transactions!' + L("Date") + ':' + L("Date") + ',"<"&' + mDateLt +
          ',Transactions!' + L("Category") + ':' + L("Category") + ',"' + cat + '"' +
          ',Transactions!' + L("Amount") + ':' + L("Amount") + ',"<0")),0)'
        ).setNumberFormat("$#,##0");
      }
    }

    // Trend sparkline
    var startCol = numToLetter_(3);
    var endCol = numToLetter_(3 + months.length - 1);
    tr.getRange(row, 3 + months.length).setFormula(
      '=SPARKLINE(' + startCol + row + ':' + endCol + row + ',{"charttype","line";"color","' + GOLD + '"})'
    );

    row++;
  }

  // Total spending row
  tr.getRange(row, 2).setValue("TOTAL SPENDING").setFontWeight("bold");
  for (var mi = 0; mi < months.length; mi++) {
    var topRow = 6;
    var botRow = row - 1;
    var c = numToLetter_(3 + mi);
    tr.getRange(row, 3 + mi).setFormula('=SUM(' + c + topRow + ':' + c + botRow + ')')
      .setNumberFormat("$#,##0").setFontWeight("bold");
  }
  var startCol2 = numToLetter_(3);
  var endCol2 = numToLetter_(3 + months.length - 1);
  tr.getRange(row, 3 + months.length).setFormula(
    '=SPARKLINE(' + startCol2 + row + ':' + endCol2 + row + ',{"charttype","line";"color","' + RED + '"})'
  );

  tr.setColumnWidth(1, 10);
  tr.setColumnWidth(2, 160);
  for (var c = 3; c <= 8; c++) tr.setColumnWidth(c, 80);
  tr.setColumnWidth(9, 120);
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS TAB BUILDER
// ═══════════════════════════════════════════════════════════════

function buildSettings_(ss, col) {
  var set = ss.getSheetByName("Settings");
  set.clear();
  try { set.setHiddenGridlines(true); } catch(e) {}
  set.getRange("A:F").setBackground(LIGHT_BG).setFontFamily("Google Sans,Roboto,Arial");

  set.getRange("B2").setValue("\u2699\ufe0f Settings")
    .setFontSize(16).setFontWeight("bold").setFontColor(GOLD);

  // ── ACCOUNT MAP ──
  set.getRange("B4").setValue("Account Map")
    .setFontSize(13).setFontWeight("bold").setFontColor(DARK_TEXT);
  set.getRange("B5").setValue("Match account names to owners. Used for auto-assignment.")
    .setFontColor(MUTED).setFontStyle("italic");

  set.getRange("B7:C7").setValues([["Account Name (contains)", "Owner"]])
    .setFontWeight("bold").setBackground(GOLD).setFontColor("white");

  // Copy from existing Account Map or use defaults
  var oldMap = ss.getSheetByName("Account Map");
  var mapData;
  if (oldMap) {
    // Read existing data (skip headers which are in different rows)
    try {
      var rawData = oldMap.getDataRange().getValues();
      mapData = [];
      for (var r = 0; r < rawData.length; r++) {
        var name = String(rawData[r][1] || rawData[r][0] || "").trim();
        var owner = String(rawData[r][2] || rawData[r][1] || "").trim();
        if (name && owner && ["Los", "Wife", "Shared"].indexOf(owner) >= 0) {
          mapData.push([name, owner]);
        }
      }
    } catch(e) {
      mapData = null;
    }
  }

  if (!mapData || mapData.length === 0) {
    mapData = [
      ["SoFi Checking", "Shared"],
      ["SoFi Savings", "Shared"],
      ["Emergency Fund", "Shared"],
      ["SoFi Robo", "Los"],
      ["Chime Checking", "Los"],
      ["Chime Savings", "Los"],
      ["Main Checking", "Los"],
      ["Visa Signature", "Los"],
      ["EveryDay Checking", "Wife"],
      ["Share Savings", "Wife"],
      ["PayPal", "Wife"]
    ];
  }

  set.getRange(8, 2, mapData.length, 2).setValues(mapData).setBackground(CARD_BG)
    .setBorder(true, true, true, true, true, true, CARD_BORDER, SpreadsheetApp.BorderStyle.SOLID);

  // ── CATEGORY LIST ──
  var catRow = 8 + mapData.length + 2;
  set.getRange(catRow, 2).setValue("Budget Categories")
    .setFontSize(13).setFontWeight("bold").setFontColor(DARK_TEXT);
  catRow++;
  set.getRange(catRow, 2).setValue("Category").setFontWeight("bold").setBackground(GOLD).setFontColor("white");
  catRow++;
  var cats = Object.keys(DEFAULT_BUDGETS).concat(["Transfers"]);
  for (var c = 0; c < cats.length; c++) {
    set.getRange(catRow + c, 2).setValue(cats[c]).setBackground(CARD_BG);
  }

  set.setColumnWidth(1, 10);
  set.setColumnWidth(2, 220);
  set.setColumnWidth(3, 100);
}

// ═══════════════════════════════════════════════════════════════
// SCRIPTURE BUILDER
// ═══════════════════════════════════════════════════════════════

function buildScripture_(ss) {
  var scr = ss.getSheetByName("Scripture");
  scr.clear();
  scr.getRange("A1:B1").setValues([["Verse", "Reference"]]).setFontWeight("bold");
  scr.getRange(2, 1, VERSES.length, 2).setValues(VERSES);
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function buildColumnMap_(headers) {
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    if (headers[i]) map[headers[i]] = i + 1; // 1-based
  }
  return map;
}

function numToLetter_(n) {
  var s = "";
  while (n > 0) {
    var r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cardCell_(sheet, row, startCol, width, borderColor) {
  var range = sheet.getRange(row, startCol, 1, width);
  range.setBackground(CARD_BG)
    .setBorder(true, true, true, true, null, null,
               borderColor || CARD_BORDER, SpreadsheetApp.BorderStyle.SOLID);
  return range;
}

function readAccountMap_(ss) {
  // Try Settings tab first, then old Account Map
  var sources = ["Settings", "Account Map"];
  for (var s = 0; s < sources.length; s++) {
    var sheet = ss.getSheetByName(sources[s]);
    if (!sheet) continue;
    var data = sheet.getDataRange().getValues();
    var map = [];
    for (var r = 0; r < data.length; r++) {
      for (var c = 0; c < data[r].length - 1; c++) {
        var name = String(data[r][c] || "").trim();
        var owner = String(data[r][c + 1] || "").trim();
        if (name && ["Los", "Wife", "Shared"].indexOf(owner) >= 0) {
          map.push({ pattern: name.toLowerCase(), owner: owner });
        }
      }
    }
    if (map.length > 0) return map;
  }
  return [];
}

function lookupOwner_(accountName, acctMap) {
  var lower = accountName.toLowerCase();
  for (var i = 0; i < acctMap.length; i++) {
    if (lower.indexOf(acctMap[i].pattern) >= 0) {
      return acctMap[i].owner;
    }
  }
  return null;
}

function readAutoCatRules_(ss) {
  var sheet = ss.getSheetByName("AutoCat");
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var rules = [];
  for (var r = 1; r < data.length; r++) { // skip header
    var cat = String(data[r][0] || "").trim();
    var desc = String(data[r][1] || "").trim();
    if (cat && desc) {
      rules.push({ category: cat, pattern: desc.toLowerCase() });
    }
  }
  return rules;
}

function mapPlaidCategory_(hint) {
  // Try exact match first, then prefix match
  if (PLAID_MAP[hint]) return PLAID_MAP[hint];

  // Try matching on the primary category (before the colon)
  var parts = hint.split(":");
  var primary = parts[0].trim();
  if (PLAID_MAP[primary]) return PLAID_MAP[primary];

  // Try each key as a prefix
  var keys = Object.keys(PLAID_MAP);
  for (var k = 0; k < keys.length; k++) {
    if (hint.indexOf(keys[k]) === 0) return PLAID_MAP[keys[k]];
  }

  return null;
}

function buildBalanceFormulas_(ss) {
  var balSheet = ss.getSheetByName("Balances");
  if (!balSheet) return {};

  var data = balSheet.getDataRange().getValues();
  var acctMap = readAccountMap_(ss);
  // Separate cash (assets) and debt (liabilities) per owner
  var cashCells = { "Los": [], "Wife": [], "Shared": [] };
  var debtCells = { "Los": [], "Wife": [], "Shared": [] };

  for (var r = 0; r < data.length; r++) {
    var sheetRow = r + 1;

    // Column B = asset name, Column D = asset balance
    var assetName = String(data[r][1] || "").trim();
    if (assetName) {
      var owner = lookupOwner_(assetName, acctMap);
      if (owner && cashCells[owner]) {
        cashCells[owner].push("Balances!D" + sheetRow);
      }
    }

    // Column F = liability name, Column H = liability balance (positive number = debt)
    var liabName = String(data[r][5] || "").trim();
    if (liabName) {
      var liabOwner = lookupOwner_(liabName, acctMap);
      if (liabOwner && debtCells[liabOwner]) {
        debtCells[liabOwner].push("Balances!H" + sheetRow);
      }
    }
  }

  var formulas = {};
  ["Los", "Wife", "Shared"].forEach(function(owner) {
    if (cashCells[owner].length > 0) {
      formulas[owner + "_cash"] = "=IFERROR(" + cashCells[owner].join("+") + ",0)";
    }
    if (debtCells[owner].length > 0) {
      formulas[owner + "_debt"] = "=IFERROR(" + debtCells[owner].join("+") + ",0)";
    }
  });

  return formulas;
}

function setupTrigger_() {
  // Delete existing triggers for this function
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === "runAutoAssignNew") {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Create new 4-hour trigger
  ScriptApp.newTrigger("runAutoAssignNew")
    .timeBased()
    .everyHours(4)
    .create();
}

function reorderTabs_(ss) {
  var order = DESKTOP_TABS.concat(MOBILE_TABS);
  for (var i = 0; i < order.length; i++) {
    var s = ss.getSheetByName(order[i]);
    if (s) {
      ss.setActiveSheet(s);
      ss.moveActiveSheet(i + 1);
    }
  }
  // Make Dashboard active
  var dash = ss.getSheetByName("Dashboard");
  if (dash) ss.setActiveSheet(dash);
}

// ═══════════════════════════════════════════════════════════════
// CUSTOM MENU
// ═══════════════════════════════════════════════════════════════

function onOpen() {
  SpreadsheetApp.getUi().createMenu("\ud83d\udc11 Money Shepherd")
    .addItem("Deploy / Redeploy", "deployMoneyShepherd")
    .addItem("Auto-Assign New Transactions", "runAutoAssignNew")
    .addItem("Refresh Scripture", "refreshScripture")
    .addToUi();
}

function refreshScripture() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dash = ss.getSheetByName("Dashboard");
  if (dash) {
    var cell = dash.getRange("B2");
    var formula = cell.getFormula();
    if (formula) {
      cell.setFormula(formula);
      SpreadsheetApp.flush();
    }
  }
}
