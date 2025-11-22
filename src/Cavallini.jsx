import  { useState, useEffect } from 'react';
import './Style.css';
import BrandLogo from './BrandLogo';
import {
  sanitizeNumber,
  calculateMonthlyVar,
  calculateDailyVar,
  calculateSharpeRatio,
  calculateSortinoRatio,
  calculateCorrelation,
  getSharpeRatioWithRF,
  calculateMonthlyReturns,
  formatTableData,
  loadCSV
} from './Helpers';



const Cavallini = () => {
  // Get Sharpe, Sortino, and Correlation to S&P directly from Helpers global state
  const sharpeRatio = calculateSharpeRatio();
  const sortinoRatio = calculateSortinoRatio();
  const correlationSP500 = calculateCorrelation();
  // State for each dataset
  const [returnsData, setReturnsData] = useState({ dates: [], returns: [] });
  const [rfData, setRFData] = useState({ dates: [], returns: [] });
  const [sp500Data, setSP500Data] = useState({ dates: [], returns: [] });

  // Load all CSVs on mount
  useEffect(() => {
    loadCSV(
      dates => setReturnsData(prev => ({ ...prev, dates })),
      returns => setReturnsData(prev => ({ ...prev, returns })),
      '/Returns.csv'
    );
    loadCSV(
      dates => setRFData(prev => ({ ...prev, dates })),
      returns => setRFData(prev => ({ ...prev, returns })),
      '/RF.csv'
    );
    loadCSV(
      dates => setSP500Data(prev => ({ ...prev, dates })),
      returns => setSP500Data(prev => ({ ...prev, returns })),
      '/SP500.csv'
    );
  }, []);

  // Debug: Log loaded datasets
  useEffect(() => {
    console.log('[Cavallini] Returns:', returnsData);
    console.log('[Cavallini] RF:', rfData);
    console.log('[Cavallini] SP500:', sp500Data);
  }, [returnsData, rfData, sp500Data]);
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


  // OPTIONAL: inline fallback dataset (first few rows) to allow UI to render if all fetches fail.

  // Effect hooks
  // Use returnsData for main calculations
  useEffect(() => {
    setDates(returnsData.dates);
    setDailyReturns(returnsData.returns);
  }, [returnsData]);

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
      perfAnnualized,
      inceptionDate: fundStats.inceptionDate || 'Jan. 16th, 2024'
    };
    console.log('[effect monthlyReturns] Computed fund stats:', stats);
    setFundStats(stats);
  }, [monthlyReturns, dailyReturns]);

  return (
    <div className="cavallini-capital">
      {/* Header Section */}
      <div className="header-section">
        <div className="brand-container">
          <BrandLogo />
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
  {/* Statistics Section - now first */}
  <div className="what-we-do" style={{ minWidth: '320px', marginRight: '32px' }}>
    <div className="center-stats">
      <h3>IMPORTANT STATISTICS</h3>
    </div>
    <div className="stats-circle">
      <div className="stat-item inception-date">
        <span className="stat-label">Inception Date:</span>
        <span className="stat-value">{fundStats.inceptionDate || 'Jan. 16th, 2024'}</span>
      </div>
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
      <div className="stat-item sharpe-ratio">
        <span className="stat-label">Sharpe Ratio</span>
        <span className="stat-value">{sharpeRatio}</span>
      </div>
      <div className="stat-item sortino-ratio">
        <span className="stat-label">Sortino Ratio</span>
        <span className="stat-value">{sortinoRatio}</span>
      </div>
      <div className="stat-item correlation-sp500">
        <span className="stat-label">Correlation to S&amp;P</span>
        <span className="stat-value">{correlationSP500}</span>
      </div>
      <div className="stat-item daily-var">
        <span className="stat-label">Daily VAR:</span>
        <span className="stat-value">{Number(fundStats.dailyVar).toFixed(2)}%</span>
      </div>
      <div className="stat-item monthly-var">
        <span className="stat-label">Monthly VAR:</span>
        <span className="stat-value">{Number(fundStats.monthlyVar).toFixed(2)}%</span>
      </div>
      </div>
  </div>

  {/* What We Do Section - now second */}
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
