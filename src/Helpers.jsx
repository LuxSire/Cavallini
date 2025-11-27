// Calculate correlation between monthly returns of Returns.csv and SP500.csv
export const calculateCorrelation = (monthlyReturnsArr = null, sp500Data = null) => {
  // Use passed monthlyReturnsArr if available, otherwise calculate
  if (!monthlyReturnsArr) {
    if (!Returns.dates.length || !Returns.returns.length) {
      loadCSV(
        dates => Returns.dates = dates,
        returns => Returns.returns = returns,
        '/Returns.csv'
      );
      return 'Loading Returns...';
    }
    monthlyReturnsArr = calculateMonthlyReturns(Returns.dates, Returns.returns);
  }
  let monthlySP500Arr;
  if (sp500Data && sp500Data.dates && sp500Data.returns) {
    monthlySP500Arr = sp500Data.dates.map((date, i) => ({ period: date.slice(0,7), return: sp500Data.returns[i] }));
  } else {
    if (!SP500.dates.length || !SP500.returns.length) {
      loadCSV(
        dates => SP500.dates = dates,
        returns => SP500.returns = returns,
        '/SP500.csv'
      );
      return 'Loading SP500...';
    }
    monthlySP500Arr = SP500.dates.map((date, i) => ({ period: date.slice(0,7), return: SP500.returns[i] }));
  }
  console.log('[Helpers.calculateCorrelation] monthlyReturnsArr:', monthlyReturnsArr);
  console.log('[Helpers.calculateCorrelation] monthlySP500Arr:', monthlySP500Arr);
  // Map period to return for easy lookup
  const returnsMap = Object.fromEntries(monthlyReturnsArr.map(r => [r.period, r.return]));
  const sp500Map = Object.fromEntries(monthlySP500Arr.map(r => [r.period, r.return]));
  // Build arrays of returns for correlation using the length of the two maps
  const periods = Object.keys(returnsMap);
  const x = periods.map(period => returnsMap[period]);
  const y = periods.map((period, i) => sp500Map[period] !== undefined ? sp500Map[period] : sp500Map[Object.keys(sp500Map)[i]]);
  console.log('[Helpers.calculateCorrelation] x:', x);
  console.log('[Helpers.calculateCorrelation] y:', y);
  // Calculate correlation
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  const covXY = x.reduce((acc, xi, i) => acc + (xi - meanX) * (y[i] - meanY), 0) / n;
  const stdX = Math.sqrt(x.reduce((acc, xi) => acc + Math.pow(xi - meanX, 2), 0) / n);
  const stdY = Math.sqrt(y.reduce((acc, yi) => acc + Math.pow(yi - meanY, 2), 0) / n);
  const correlation = stdX && stdY ? (covXY / (stdX * stdY)) : 0;
  console.log('[Helpers.calculateCorrelation] correlation:', correlation);
  return correlation.toFixed(2);
};
// Sortino ratio using global Returns and RF
export const calculateSortinoRatio = (monthlyReturnsArr = null, rfReturnsArr = null) => {
  if (!monthlyReturnsArr) {
    if (!Returns.dates.length || !Returns.returns.length) {
      loadCSV(
        dates => Returns.dates = dates,
        returns => Returns.returns = returns,
        '/Returns.csv'
      );
      return 'Loading Returns...';
    }
    monthlyReturnsArr = calculateMonthlyReturns(Returns.dates, Returns.returns);
  }
  let rfAvg;
  if (rfReturnsArr && rfReturnsArr.length) {
    rfAvg = rfReturnsArr.reduce((a, b) => a + b, 0) / rfReturnsArr.length / 12;
  } else {
    if (!RF.returns.length) {
      loadCSV(
        dates => RF.dates = dates,
        returns => RF.returns = returns,
        '/RF.csv'
      );
      return 'Loading RF...';
    }
    rfAvg = RF.returns.reduce((a, b) => a + b, 0) / RF.returns.length / 12;
  }
  const monthly = monthlyReturnsArr.map(r => r.return);
  if (!monthly.length) return '0';
  const meanMonthly = monthly.reduce((a, b) => a + b, 0) / monthly.length;
  const excessReturn = meanMonthly - rfAvg;
  // Downside deviation (volatility of returns below rfAvg)
  const downsideReturns = monthly.filter(r => r < rfAvg);
  const downsideDeviation = Math.sqrt(
    downsideReturns.reduce((acc, r) => acc + Math.pow(r - rfAvg, 2), 0) / (downsideReturns.length || 1)
  );
  const annualizedExcessReturn = excessReturn * 12;
  const annualizedDownsideDev = downsideDeviation * Math.sqrt(12);
  const result = (annualizedDownsideDev === 0 ? 0 : (annualizedExcessReturn / annualizedDownsideDev)).toFixed(2);
  
  return result;
};
import Papa from 'papaparse';

// Accepts candidateUrls array or single string for flexible CSV loading
export const loadCSV = (setDates, setDailyReturns, candidateUrl = '/Returns.csv') => {
  
  // Accepts either a string or array of strings
  const candidateUrls = Array.isArray(candidateUrl) ? candidateUrl : [candidateUrl];
  const tryFetch = (i = 0) => {
    if (i >= candidateUrls.length) {
      parseInlineFallback(setDates, setDailyReturns);
      return;
    }
    const url = candidateUrls[i];
    fetch(url, { cache: 'no-store' })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(csvText => {
        const trimmedStart = csvText.trimStart().slice(0,200);
        if (/^<!DOCTYPE html>/i.test(trimmedStart) || /<html/i.test(trimmedStart)) {
          tryFetch(i+1);
          return;
        }
        Papa.parse(csvText, {
          header: false,
          skipEmptyLines: true,
          complete: (results) => {
            if (!results.data.length) { console.warn('[loadReturnsCSV] No rows.'); return; }
            const data = results.data.filter(r => r.some(c => c && c.trim() !== ''));
            let rows = data;
            if (rows.length && (rows[0][0].toLowerCase().includes('date') || rows[0][1].toLowerCase().includes('return') || rows[0][1].toLowerCase().includes('value'))) {
              rows = rows.slice(1);
            }
            const parsedDates = [];
            const parsedDailyReturns = [];
            let euDateConvertedCount = 0;
            rows.forEach(row => {
              if (!row || row.length < 2) return;
              let raw = (row[0]||'').trim();
              let iso;
              if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(raw)) iso = raw;
              else if (/^[0-9]{2}\.[0-9]{2}\.[0-9]{4}$/.test(raw)) { const [dd,mm,yyyy]=raw.split('.'); iso=`${yyyy}-${mm}-${dd}`; euDateConvertedCount++; }
              else return;
              let value;
              // Special handling for RF.csv: divide second column by 100, ignore third column
              if (url.includes('RF.csv')) {
                value = sanitizeNumber(row[1]) / 100;
              } else {
                value = sanitizeNumber(row[1]);
              }
              if (isNaN(value)) return;
              parsedDates.push(iso);
              parsedDailyReturns.push(value);
            });
            if (euDateConvertedCount) console.log(`[loadReturnsCSV] Converted ${euDateConvertedCount} EU date formats.`);
            const nanCount = parsedDailyReturns.filter(v=>isNaN(v)).length;
            if (nanCount) console.warn(`[loadReturnsCSV] NaN daily returns count: ${nanCount}`);
            setDates(parsedDates);
            setDailyReturns(parsedDailyReturns);
          },
          error: (err) => {
            tryFetch(i+1);
          }
        });
      })
      .catch(err => {
        tryFetch(i+1);
      });
  };
  tryFetch();
};


// Usage: Load Returns, RF, and SP500 CSVs into separate variables
let Returns = { dates: [], returns: [] };
let RF = { dates: [], returns: [] };
let SP500 = { dates: [], returns: [] };

loadCSV(
  dates => Returns.dates = dates,
  returns => Returns.returns = returns,
  '/Returns.csv'
);
loadCSV(
  dates => RF.dates = dates,
  returns => RF.returns = returns,
  '/RF.csv'
);
loadCSV(
  dates => SP500.dates = dates,
  returns => SP500.returns = returns,
  '/SP500.csv'
);

export const parseInlineFallback = (setDates, setDailyReturns) => {
  const inlineCsv = `Date,Start Balance,Gain / Loss,End Balance ,Basis Points ,Daily Gain / Loss\n2024-01-10,3'000'000.00,-0.05,2'999'999.95,-0,-0.00%\n2024-01-11,2'999'999.95,1.08,3'000'001.03,0,0.00%\n2024-01-12,3'000'001.03,0.48,3'000'001.51,0,0.00%\n2024-01-16,3'000'001.51,4'668.21,3'004'669.72,16,0.16%\n2024-01-17,3'004'669.72,126.28,3'004'796.00,0,0.00%`;
  console.warn('[loadReturnsCSV] Using inline fallback CSV data.');
  Papa.parse(inlineCsv, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const parsedDates = [];
      const parsedDailyReturns = [];
      results.data.forEach(row => {
        const dateStr = row['Date'];
        if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dateStr)) return;
        let basisPoints = sanitizeNumber(row['Basis Points ']);
        let dailyPercent = sanitizeNumber(row['Daily Gain / Loss']);
        if (isNaN(basisPoints) && !isNaN(dailyPercent)) basisPoints = dailyPercent * 100;
        if (isNaN(basisPoints)) return;
        parsedDates.push(dateStr);
        parsedDailyReturns.push(basisPoints);
      });
      setDates(parsedDates);
      setDailyReturns(parsedDailyReturns);
    }
  });
};
export const formatTableData = (monthlyReturnsData) => {
  const yearGroups = {};
  monthlyReturnsData.forEach(({ period, return: ret }) => {
    const [year, month] = period.split('-');
    if (!yearGroups[year]) {
      yearGroups[year] = { year, jan:'', feb:'', mar:'', apr:'', may:'', jun:'', jul:'', aug:'', sep:'', oct:'', nov:'', dec:'', total:'' };
    }
    const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const idx = parseInt(month, 10) - 1;
    const key = monthNames[idx];
    if (key) yearGroups[year][key] = `${ret.toFixed(2)}%`;
  });
  Object.values(yearGroups).forEach(yearData => {
    const vals = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
      .map(m => yearData[m])
      .filter(Boolean)
      .map(v => parseFloat(v));
    if (vals.length) {
      const total = vals.reduce((acc, v) => acc * (1 + v/100), 1) - 1;
      yearData.total = `${(total * 100).toFixed(2)}%`;
    }
  });
  return Object.values(yearGroups).sort((a,b)=> a.year.localeCompare(b.year));
};
// performanceHelpers.jsx
// Helper functions for Cavallini performance calculations

export const sanitizeNumber = (val) => {
  
  if (val == null) return NaN;
  if (typeof val === 'number') return val;
  if (typeof val !== 'string') return NaN;
  const cleaned = val.replace(/[^0-9+\-.]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '+') return NaN;
  const result = parseFloat(cleaned);
  
  return result;
};

export const calculateMonthlyVar = (monthly, confidenceLevel = 0.95) => {
  
  const sorted = [...monthly].sort((a, b) => a - b);
  const index = Math.floor((1 - confidenceLevel) * sorted.length);
  const varValue = sorted[index];
  const result = varValue?.toFixed(2) || '0';
  
  return result;
};

export const calculateDailyVar = (daily, confidenceLevel = 0.95) => {
  
  const sorted = [...daily].sort((a, b) => a - b);
  const index = Math.floor((1 - confidenceLevel) * sorted.length);
  const varValue = sorted[index];
  const result = varValue?.toFixed(2) || '0';
  
  return result;
};

// Sharpe ratio using global Returns and RF
export const calculateSharpeRatio = (monthlyReturnsArr = null, sp500ReturnsArr = null, rfReturnsArr = null) => {
  // Use passed monthlyReturnsArr if available, otherwise calculate
  if (!monthlyReturnsArr) {
    if (!Returns.dates.length || !Returns.returns.length) {
      loadCSV(
        dates => Returns.dates = dates,
        returns => Returns.returns = returns,
        '/Returns.csv'
      );
      return 'Loading Returns...';
    }
    monthlyReturnsArr = calculateMonthlyReturns(Returns.dates, Returns.returns);
  }
  let rfAvg;
  if (rfReturnsArr && rfReturnsArr.length) {
    rfAvg = rfReturnsArr.reduce((a, b) => a + b, 0) / rfReturnsArr.length / 12;
  } else {
    if (!RF.returns.length) {
      loadCSV(
        dates => RF.dates = dates,
        returns => RF.returns = returns,
        '/RF.csv'
      );
      return 'Loading RF...';
    }
    rfAvg = RF.returns.reduce((a, b) => a + b, 0) / RF.returns.length / 12;
  }
  const monthly = monthlyReturnsArr.map(r => r.return);
  if (!monthly.length) return '0';
  const meanMonthly = monthly.reduce((a, b) => a + b, 0) / monthly.length;
  const excessReturn = meanMonthly - rfAvg;
  const varianceMonthly = monthly.reduce((a, b) => a + Math.pow(b - meanMonthly, 2), 0) / monthly.length;
  const stdDevMonthly = Math.sqrt(varianceMonthly);
  const annualizedExcessReturn = excessReturn * 12;
  const annualizedStdDev = stdDevMonthly * Math.sqrt(12);
  const result = (annualizedStdDev === 0 ? 0 : (annualizedExcessReturn / annualizedStdDev)).toFixed(2);
  return result;
};

// Helper to export Sharpe ratio for Cavallini.jsx
export const getSharpeRatioWithRF = (monthlyReturns, rfReturns) => {
  // monthlyReturns: array of { period, return }
  // rfReturns: array of numbers (monthly risk-free rates)
  const monthly = monthlyReturns.map(r => r.return);
  return calculateSharpeRatio(monthly, rfReturns);
};

export const calculateMonthlyReturns = (dates, dailyReturns) => {
  const monthlyGroups = {};
  dates.forEach((date, i) => {
    // date guaranteed ISO YYYY-MM-DD
    const [year, month] = date.split('-');
    const key = `${year}-${month}`;
    const dailyReturnDecimal = dailyReturns[i] / 1; // bps -> decimal
    if (!monthlyGroups[key]) monthlyGroups[key] = [];
    monthlyGroups[key].push(dailyReturnDecimal);
  });
  return Object.entries(monthlyGroups).map(([period, returns]) => {
    const compounded = returns.reduce((acc, r) => acc * (1 + r), 1) - 1;
    return { period, return: compounded * 100 }; // percent
  });
};
