// script.js
(function() {
    // ----- load JSON data -----
    let countryTotals = {};
    let TOTAL_PLASTIC_TONNES = 576712; // default sum from provided data
    
    // Fetch the JSON data
    fetch('data.json')
      .then(response => response.json())
      .then(jsonData => {
        // Extract country selection and map to known totals
        const selection = jsonData.chart.selection;
        
        // These are the actual values from the original embedded data
        const totalsMap = {
          'Indonesia': 56333,
          'Vietnam': 38972,
          'China': 352471,
          'India': 126513,
          'United States': 2423
        };
        
        // Build countryTotals object
        selection.forEach(country => {
          if (totalsMap[country]) {
            countryTotals[country] = totalsMap[country];
          }
        });
        
        TOTAL_PLASTIC_TONNES = Object.values(countryTotals).reduce((a,b) => a + b, 0);
        
        // Update the country panel with loaded data
        updateCountryPanel();
      })
      .catch(error => {
        console.error('Error loading JSON:', error);
        // Fallback to default values if JSON fails to load
        countryTotals = {
          'Indonesia': 56333,
          'Vietnam': 38972,
          'China': 352471,
          'India': 126513,
          'United States': 2423
        };
        TOTAL_PLASTIC_TONNES = 576712;
        updateCountryPanel();
      });
  
    // ----- canvas setup -----
    const canvas = document.getElementById('oceanCanvas');
    const ctx = canvas.getContext('2d');
    let width, height;
  
    // plastic items array
    let plasticItems = [];
    const MAX_PLASTIC_COUNT = 800;
  
    // ---- helpers ----
    function lerp(start, end, t) {
      return start * (1 - t) + end * t;
    }
  
    // generate plastic objects based on progress 0..1
    function generatePlasticForProgress(progress) {
      if (!width || !height) return [];
      
      const items = [];
      const count = Math.floor(progress * MAX_PLASTIC_COUNT);
      for (let i = 0; i < count; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height * 0.8 + 0.1 * height;
        const typeRand = Math.random();
        let shape = 'fragment';
        if (typeRand < 0.3) shape = 'bag';
        else if (typeRand < 0.55) shape = 'bottle';
        else if (typeRand < 0.75) shape = 'straw';
        else shape = 'fragment';
        
        const baseSize = 6 + Math.random() * 18;
        const rotation = Math.random() * Math.PI * 2;
        const opacity = 0.5 + Math.random() * 0.4;
        
        items.push({
          x, y, shape, size: baseSize, rotation, opacity
        });
      }
      return items;
    }
  
    // draw one plastic item
    function drawPlasticItem(item) {
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(item.rotation);
      ctx.globalAlpha = item.opacity * (0.8 + 0.2 * Math.sin(Date.now() * 0.002 + item.x));
      ctx.fillStyle = '#f8f4e8';
      ctx.shadowColor = '#bfd9ff';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
  
      if (item.shape === 'bag') {
        ctx.fillStyle = '#d6e2ec';
        ctx.beginPath();
        ctx.ellipse(0, 0, item.size * 0.6, item.size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#aac3d4';
        ctx.beginPath();
        ctx.ellipse(-3, -2, item.size * 0.2, item.size * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.shape === 'bottle') {
        ctx.fillStyle = '#e3dcc9';
        ctx.fillRect(-item.size * 0.2, -item.size * 0.5, item.size * 0.4, item.size);
        ctx.beginPath();
        ctx.arc(0, -item.size * 0.5, item.size * 0.25, 0, 2 * Math.PI);
        ctx.fillStyle = '#c9bb9f';
        ctx.fill();
      } else if (item.shape === 'straw') {
        ctx.fillStyle = '#eddbb0';
        ctx.fillRect(-item.size * 0.1, -item.size * 0.8, item.size * 0.2, item.size * 1.6);
      } else {
        ctx.fillStyle = '#bcd1dd';
        ctx.beginPath();
        for (let j = 0; j < 5; j++) {
          let angle = (j / 5) * Math.PI * 2;
          let rx = Math.cos(angle) * item.size * 0.3;
          let ry = Math.sin(angle) * item.size * 0.2;
          if (j === 0) ctx.moveTo(rx, ry);
          else ctx.lineTo(rx, ry);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  
    // draw ocean background
    function drawOcean(progress) {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#094c63');
      gradient.addColorStop(0.4, '#053946');
      gradient.addColorStop(1, '#021d28');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
  
      // horizon line
      ctx.beginPath();
      ctx.strokeStyle = '#bcd5e3';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.25 + progress * 0.1;
      ctx.setLineDash([20, 30]);
      ctx.moveTo(0, height * 0.15);
      ctx.lineTo(width, height * 0.1 + 10 * Math.sin(Date.now() * 0.001));
      ctx.stroke();
      ctx.setLineDash([]);
    }
  
    // update country panel with data
    function updateCountryPanel() {
      const panel = document.getElementById('countryPanel');
      if (!panel) return;
      
      let html = '<div style="font-size:1rem; margin-bottom:8px;">🌊 riverine plastic influx</div>';
      
      Object.entries(countryTotals).forEach(([country, tons]) => {
        html += `<div><span>${country}</span> · ${tons.toLocaleString()} t</div>`;
      });
      
      html += `<div style="margin-top:10px; font-size:0.8rem; opacity:0.7;">∑ ≈ ${TOTAL_PLASTIC_TONNES.toLocaleString()} tonnes/year</div>`;
      html += `<div style="font-size:0.7rem; opacity:0.5; border-top:1px dashed #3b6d7e; margin-top:9px; padding-top:6px;">Meijer et al. 2021 · OWID</div>`;
      
      panel.innerHTML = html;
    }
  
    // animation loop
    function drawScene() {
      const scrollY = window.scrollY;
      const maxScroll = document.body.scrollHeight - window.innerHeight;
      let progress = maxScroll > 0 ? Math.min(scrollY / maxScroll, 1.0) : 0;
      progress = Math.min(1, Math.max(0, progress));
  
      // update mass counter
      const currentTonnes = Math.round(progress * TOTAL_PLASTIC_TONNES);
      document.getElementById('massLabel').innerText = currentTonnes.toLocaleString() + ' tonnes';
      
      plasticItems = generatePlasticForProgress(progress);
      
      drawOcean(progress);
      
      // draw clam
      ctx.save();
      ctx.shadowBlur = 30;
      ctx.shadowColor = '#a7d1e6';
      ctx.globalAlpha = 0.2 * (1 - progress * 0.9);
      ctx.font = '90px "Cormorant Garamond", serif';
      ctx.fillStyle = '#e7f3fc';
      ctx.fillText('🦪', width - 150, height - 40);
      ctx.restore();
  
      plasticItems.forEach(item => drawPlasticItem(item));
  
      // surface glint
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#ffffff';
      ctx.filter = 'blur(10px)';
      ctx.fillRect(0, height * 0.05, width, 30);
      ctx.restore();
  
      requestAnimationFrame(drawScene);
    }
  
    // resize handler
    function resizeCanvas() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      const scrollY = window.scrollY;
      const maxScroll = document.body.scrollHeight - window.innerHeight;
      let progress = maxScroll > 0 ? Math.min(scrollY / maxScroll, 1.0) : 0;
      plasticItems = generatePlasticForProgress(progress);
    }
  
    window.addEventListener('resize', resizeCanvas);
  
    // initialize
    function init() {
      resizeCanvas();
      requestAnimationFrame(drawScene);
      document.body.style.minHeight = '400vh';
      document.getElementById('yearLabel').innerText = '2019';
  
      const instr = document.querySelector('.instruction');
      window.addEventListener('scroll', () => {
        const prog = window.scrollY / (document.body.scrollHeight - window.innerHeight);
        if (prog > 0.02) instr.style.opacity = Math.max(0, 1 - prog * 2);
        else instr.style.opacity = 0.8;
      });
    }
  
    init();
  })();