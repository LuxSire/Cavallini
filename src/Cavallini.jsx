import React, { useState, useEffect, useCallback } from 'react';
import './Style.css';
import Papa from 'papaparse';

// ---- Helper / Calculation Functions ----
const sanitizeNumber = (val) => {
  if (val == null) return NaN;
  if (typeof val === 'number') return val;
  if (typeof val !== 'string') return NaN;
  const cleaned = val.replace(/[^0-9+\-.]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '+') return NaN;
  return parseFloat(cleaned);
};

const calculateMonthlyVar = (monthly, confidenceLevel = 0.95) => {
  const sorted = [...monthly].sort((a, b) => a - b);
  const index = Math.floor((1 - confidenceLevel) * sorted.length);
  const varValue = sorted[index];
  return varValue?.toFixed(2) || '0';
};

const calculateDailyVar = (daily, confidenceLevel = 0.95) => {
  const sorted = [...daily].sort((a, b) => a - b);
  const index = Math.floor((1 - confidenceLevel) * sorted.length);
  const varValue = sorted[index];
  return varValue?.toFixed(2) || '0';
};

const calculateBeta = () => '0.30';
const calculateCorrelation = () => '0.62';

const calculateSharpeRatio = (monthly) => {
  if (!monthly?.length) return '0';
  const meanMonthly = monthly.reduce((a, b) => a + b, 0) / monthly.length;
  const varianceMonthly = monthly.reduce((a, b) => a + Math.pow(b - meanMonthly, 2), 0) / monthly.length;
  const stdDevMonthly = Math.sqrt(varianceMonthly);
  const annualizedReturn = meanMonthly * 12;
  const annualizedStdDev = stdDevMonthly * Math.sqrt(12);
  return (annualizedReturn / annualizedStdDev).toFixed(2);
};

const calculateMonthlyReturns = (dates, dailyReturns) => {
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

const formatTableData = (monthlyReturnsData) => {
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

const Cavallini = () => {
  // State hooks
  const [performanceData, setPerformanceData] = useState([]);
  const [dailyReturns, setDailyReturns] = useState([]);
  const [dates, setDates] = useState([]);
  const [monthlyReturns, setMonthlyReturns] = useState([]);
  const [fundStats, setFundStats] = useState({
    monthlyVar: 0,
    beta: 0,
    correlation: 0,
    sharpeRatio: 0,
    inceptionDate: 'Jan. 16th, 2024'
  });

  // CSV loading function
  const loadReturnsCSV = useCallback(() => {
    console.log('[loadReturnsCSV] Starting CSV load...');
    // Expect user to place Returns.csv under public/ or public/assets/ so dev server serves it verbatim.
    const candidateUrls = [
      '/Returns.csv',    // fallback if server exposes /public prefix
      '/src/assets/Returns.csv' // legacy path fallback

    ];

    const tryFetch = (i = 0) => {
      if (i >= candidateUrls.length) {
        console.error('[loadReturnsCSV] All public path candidates failed. Falling back to inline sample data.');
        parseInlineFallback();
        return;
      }
      const url = candidateUrls[i];
      console.log(`[loadReturnsCSV] Attempting fetch: ${url}`);
      fetch(url, { cache: 'no-store' })
        .then(r => {
          console.log('[loadReturnsCSV] Response status:', r.status, 'ok:', r.ok);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.text();
        })
        .then(csvText => {
          const trimmedStart = csvText.trimStart().slice(0,200);
          if (/^<!DOCTYPE html>/i.test(trimmedStart) || /<html/i.test(trimmedStart)) {
            console.warn(`[loadReturnsCSV] HTML received at ${url}. Trying next path.`);
            tryFetch(i+1);
            return;
          }
          console.log('[loadReturnsCSV] Raw CSV length:', csvText.length);
          Papa.parse(csvText, {
            header: false,
            skipEmptyLines: true,
            complete: (results) => {
              console.log('[loadReturnsCSV] Papa.parse complete. Row count (incl header):', results.data.length);
              if (!results.data.length) { console.warn('[loadReturnsCSV] No rows.'); return; }
              const data = results.data.filter(r => r.some(c => c && c.trim() !== ''));
              // If header row exists, skip it
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
                let value = sanitizeNumber(row[1]);
                if (isNaN(value)) return;
                parsedDates.push(iso);
                parsedDailyReturns.push(value);
              });
              if (euDateConvertedCount) console.log(`[loadReturnsCSV] Converted ${euDateConvertedCount} EU date formats.`);
              console.log('[loadReturnsCSV] Parsed dates length:', parsedDates.length);
              console.log('[loadReturnsCSV] Parsed daily returns length:', parsedDailyReturns.length);
              const nanCount = parsedDailyReturns.filter(v=>isNaN(v)).length;
              if (nanCount) console.warn(`[loadReturnsCSV] NaN daily returns count: ${nanCount}`);
              setDates(parsedDates);
              setDailyReturns(parsedDailyReturns);
            },
            error: (err) => {
              console.error('[loadReturnsCSV] Papa.parse error:', err);
              tryFetch(i+1);
            }
          });
        })
        .catch(err => {
          console.error(`[loadReturnsCSV] Fetch failed for ${url}:`, err.message);
          tryFetch(i+1);
        });
    };
    tryFetch();
  }, []);

  // OPTIONAL: inline fallback dataset (first few rows) to allow UI to render if all fetches fail.
  const parseInlineFallback = () => {
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

  // Effect hooks
  useEffect(() => {
    loadReturnsCSV();
  }, [loadReturnsCSV]);

  useEffect(() => {
    console.log('[effect dates/dailyReturns] Triggered. dates.length =', dates.length, 'dailyReturns.length =', dailyReturns.length);
    if (!dates.length || !dailyReturns.length) {
      if (!dates.length) console.log('[effect dates/dailyReturns] dates array still empty');
      if (!dailyReturns.length) console.log('[effect dates/dailyReturns] dailyReturns array still empty');
      return;
    }
    console.log('[effect dates/dailyReturns] Sample dates:', dates.slice(0,5));
    console.log('[effect dates/dailyReturns] Sample dailyReturns:', dailyReturns.slice(0,5));
    console.log('[effect dates/dailyReturns] Daily Returns (full):', dailyReturns);
    const monthly = calculateMonthlyReturns(dates, dailyReturns);
    console.log('[effect dates/dailyReturns] Calculated monthly returns:', monthly);
    setMonthlyReturns(monthly);
  }, [dates, dailyReturns]);

  useEffect(() => {
    console.log('[effect monthlyReturns] Triggered. monthlyReturns.length =', monthlyReturns.length);
    if (!monthlyReturns.length) return;
    console.log('[effect monthlyReturns] monthlyReturns:', monthlyReturns);
    const tableData = formatTableData(monthlyReturns);
    console.log('[effect monthlyReturns] Formatted performance table data:', tableData);
    setPerformanceData(tableData);

    // Calculate best and worst months
    let bestMonth = null, worstMonth = null;
    if (monthlyReturns.length) {
      bestMonth = monthlyReturns.reduce((max, cur) => cur.return > max.return ? cur : max, monthlyReturns[0]);
      worstMonth = monthlyReturns.reduce((min, cur) => cur.return < min.return ? cur : min, monthlyReturns[0]);
    }

    // Performance since inception
    let perfSinceInception = null;
    let perfAnnualized = null;
    if (monthlyReturns.length) {
      // Compound total return
      const totalReturn = monthlyReturns.reduce((acc, cur) => acc * (1 + cur.return / 100), 1) - 1;
      perfSinceInception = (totalReturn * 100).toFixed(2) + '%';
      // Annualized return
      const months = monthlyReturns.length;
      const annualized = Math.pow(1 + totalReturn, 12 / months) - 1;
      perfAnnualized = (annualized * 100).toFixed(2) + '%';
    }

    const stats = {
      dailyVar: calculateDailyVar(dailyReturns),
      monthlyVar: calculateMonthlyVar(monthlyReturns.map(r => r.return)),
      bestMonth: bestMonth ? `${bestMonth.period}: ${bestMonth.return.toFixed(2)}%` : 'N/A',
      worstMonth: worstMonth ? `${worstMonth.period}: ${worstMonth.return.toFixed(2)}%` : 'N/A',
      perfSinceInception,
      perfAnnualized
    };
    console.log('[effect monthlyReturns] Computed fund stats:', stats);
    setFundStats(stats);
  }, [monthlyReturns, dailyReturns]);

  return (
    <div className="cavallini-capital">
      {/* Header Section */}
      <div className="header-section">
        <div className="brand-container">
          <div className="brand-logo">
            <h1>CAVALLINI CAPITAL</h1>
            <div className="brand-line"></div>
          </div>
        </div>

<div className="header-section flex-row">
  <div className="strategy-info">
    <div className="strategy-header">
      <h2>LONG / SHORT EQUITY STRATEGY</h2>
      
    </div>
    <p>
      Greg Cavallini is a proud graduate of Eckerd College. He began 
      his career by managing financial operations in his family business. 
      Building on this experience, he has spent the past 7 years 
      successfully running an Absolute Long Only Equities Fund. To 
      meet client demand for reduced volatility, he developed a 
      proprietary systematic Long / Short Equities Strategy, allowing the 
      use of responsible leverage to maximize returns. He is currently 
      and independent RIA in the states of Florida and Colorado.
    </p>
  </div>
</div>
  </div>

      {/* Main Content */}
<div className="main-content flex-row">
  {/* What We Do Section */}
  <div className="what-we-do">
    <h3>WHAT WE DO:</h3>
    <p>
      Deliver consistent, single-digit returns 
      by strategically managing Long-Short 
      equity positions while minimizing 
      volatility. We employ prudent 
      leverage to amplify those returns, 
      maintaining a disciplined approach to 
      risk management that secures the 
      preservation of capital and 
      sustainable growth for our investors.
    </p>
  </div>

  {/* Statistics Section */}
  <div className="what-we-do">
    <div className="center-stats">
      <h3>IMPORTANT STATISTICS</h3>
      <p>Inception Date:</p>
      <p>{fundStats.inceptionDate}</p>
    </div>
      <div className="stats-circle">
        <div className="stat-item daily-var">
          <span className="stat-label">Daily VAR:</span>
          <span className="stat-value">{Number(fundStats.dailyVar).toFixed(2)}%</span>
        </div>
        <div className="stat-item monthly-var">
          <span className="stat-label">Monthly VAR:</span>
          <span className="stat-value">{Number(fundStats.monthlyVar).toFixed(2)}%</span>
        </div>
        {/* ...existing code... */}
        <div className="stat-item best-month">
          <span className="stat-label">Best Month</span>
          <span className="stat-value">{fundStats.bestMonth}</span>
        </div>
        <div className="stat-item worst-month">
          <span className="stat-label">Worst Month</span>
          <span className="stat-value">{fundStats.worstMonth}</span>
        </div>
        <div className="stat-item perf-since-inception">
          <span className="stat-label">Performance Since Inception</span>
          <span className="stat-value">{fundStats.perfSinceInception}</span>
        </div>
        <div className="stat-item perf-annualized">
          <span className="stat-label">Performance Annualized</span>
          <span className="stat-value">{fundStats.perfAnnualized}</span>
        </div>
      </div>
  </div>
</div>

      {/* Returns Table Section */}
      <div className="returns-section">
        <h3>CAVALLINI CAPITAL RETURNS</h3>
        <div className="returns-table-container">
          <table className="returns-table">
            <thead>
              <tr>
                <th>YEAR</th>
                <th>JAN</th>
                <th>FEB</th>
                <th>MAR</th>
                <th>APR</th>
                <th>MAY</th>
                <th>JUN</th>
                <th>JUL</th>
                <th>AUG</th>
                <th>SEP</th>
                <th>OCT</th>
                <th>NOV</th>
                <th>DEC</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {console.log('[render] performanceData length:', performanceData.length, 'sample:', performanceData.slice(0,2))}
              {performanceData.map((row, index) => (
                <tr key={index}>
                  <td className="year-cell">{row.year}</td>
                  <td className={`month-cell ${row.jan && parseFloat(row.jan) > 0 ? 'positive' : row.jan && parseFloat(row.jan) < 0 ? 'negative' : ''}`}>{row.jan}</td>
                  <td className={`month-cell ${row.feb && parseFloat(row.feb) > 0 ? 'positive' : row.feb && parseFloat(row.feb) < 0 ? 'negative' : ''}`}>{row.feb}</td>
                  <td className={`month-cell ${row.mar && parseFloat(row.mar) > 0 ? 'positive' : row.mar && parseFloat(row.mar) < 0 ? 'negative' : ''}`}>{row.mar}</td>
                  <td className={`month-cell ${row.apr && parseFloat(row.apr) > 0 ? 'positive' : row.apr && parseFloat(row.apr) < 0 ? 'negative' : ''}`}>{row.apr}</td>
                  <td className={`month-cell ${row.may && parseFloat(row.may) > 0 ? 'positive' : row.may && parseFloat(row.may) < 0 ? 'negative' : ''}`}>{row.may}</td>
                  <td className={`month-cell ${row.jun && parseFloat(row.jun) > 0 ? 'positive' : row.jun && parseFloat(row.jun) < 0 ? 'negative' : ''}`}>{row.jun}</td>
                  <td className={`month-cell ${row.jul && parseFloat(row.jul) > 0 ? 'positive' : row.jul && parseFloat(row.jul) < 0 ? 'negative' : ''}`}>{row.jul}</td>
                  <td className={`month-cell ${row.aug && parseFloat(row.aug) > 0 ? 'positive' : row.aug && parseFloat(row.aug) < 0 ? 'negative' : ''}`}>{row.aug}</td>
                  <td className={`month-cell ${row.sep && parseFloat(row.sep) > 0 ? 'positive' : row.sep && parseFloat(row.sep) < 0 ? 'negative' : ''}`}>{row.sep}</td>
                  <td className={`month-cell ${row.oct && parseFloat(row.oct) > 0 ? 'positive' : row.oct && parseFloat(row.oct) < 0 ? 'negative' : ''}`}>{row.oct}</td>
                  <td className={`month-cell ${row.nov && parseFloat(row.nov) > 0 ? 'positive' : row.nov && parseFloat(row.nov) < 0 ? 'negative' : ''}`}>{row.nov}</td>
                  <td className={`month-cell ${row.dec && parseFloat(row.dec) > 0 ? 'positive' : row.dec && parseFloat(row.dec) < 0 ? 'negative' : ''}`}>{row.dec}</td>
                  <td className="total-cell">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="disclaimer">
        <h4>DISCLAIMER:</h4>
        <p>
          Greg Cavallini provides investment advisory services through Cavallini Management, LLC, ("Cavallini"), an investment adviser, registered in the 
          State of Florida, which does not imply endorsement or approval. Cavallini does not provide legal or tax advice. Investing involves risks, including 
          loss of principal. Past performance does not guarantee future results. For additional important information regarding Cavallini please view 
          Cavallini's ADV Brochure, found here: https://adviserinfo.sec.gov/firm/summary/305058
        </p>
      </div>
    </div>
  );
};

export default Cavallini;
