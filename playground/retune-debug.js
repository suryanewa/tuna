(function() {
  var report = { timestamp: new Date().toISOString(), url: location.href };

  var allVars = new Map();
  var crossOriginSheets = [];
  for (var sheet of document.styleSheets) {
    try {
      for (var rule of sheet.cssRules) {
        if (!(rule instanceof CSSStyleRule)) continue;
        for (var i = 0; i < rule.style.length; i++) {
          var prop = rule.style.item(i);
          if (prop.startsWith('--')) {
            var val = rule.style.getPropertyValue(prop).trim();
            allVars.set(prop, { value: val, selector: rule.selectorText.slice(0, 60) });
          }
        }
      }
    } catch(e) { crossOriginSheets.push(sheet.href || 'inline'); }
  }
  report.totalCssVars = allVars.size;
  report.crossOriginSheets = crossOriginSheets;

  var usageMap = new Map();
  for (var sheet of document.styleSheets) {
    try {
      for (var rule of sheet.cssRules) {
        if (!(rule instanceof CSSStyleRule)) continue;
        if (!rule.cssText.includes('var(')) continue;
        for (var i = 0; i < rule.style.length; i++) {
          var prop = rule.style.item(i);
          if (prop.startsWith('--')) continue;
          var raw = rule.style.getPropertyValue(prop);
          var matches = raw.matchAll(/var\(\s*(--[\w-]+)/g);
          for (var m of matches) {
            if (!usageMap.has(m[1])) usageMap.set(m[1], new Set());
            usageMap.get(m[1]).add(prop);
          }
        }
      }
    } catch(e) {}
  }
  report.varsWithUsage = usageMap.size;
  report.varsWithoutUsage = allVars.size - usageMap.size;

  var suspects = [];
  for (var entry of allVars) {
    var name = entry[0], info = entry[1];
    var usage = usageMap.get(name);
    var usedIn = usage ? Array.from(usage).join(', ') : 'NOT USED IN ANY RULE';
    if (/outline|border-radius|nested/.test(name) ||
        /^--tw-/.test(name) ||
        /^--(p|m|gap|pt|pb|pl|pr|px|py|mt|mb|ml|mr|mx|my)-/.test(name)) {
      suspects.push({ name: name, value: info.value.slice(0, 40), selector: info.selector, usedIn: usedIn });
    }
  }
  report.suspects = suspects.slice(0, 50);

  var utilityClasses = [];
  for (var sheet of document.styleSheets) {
    try {
      for (var rule of sheet.cssRules) {
        if (!(rule instanceof CSSStyleRule)) continue;
        var sel = rule.selectorText;
        if (!sel.startsWith('.') || sel.includes(' ') || sel.includes(':') || sel.includes(',')) continue;
        var className = sel.slice(1);
        var props = [];
        for (var i = 0; i < rule.style.length; i++) {
          var p = rule.style.item(i);
          if (!p.startsWith('--')) props.push(p);
        }
        if (props.length >= 1 && props.length <= 2) {
          utilityClasses.push({ className: className, properties: props.join(', '), count: props.length });
        }
      }
    } catch(e) {}
  }
  report.totalUtilityClasses = utilityClasses.length;

  var spacingUtils = utilityClasses.filter(function(u) {
    return u.properties.includes('padding') || u.properties.includes('margin') || u.properties.includes('gap');
  });
  report.spacingUtilities = spacingUtils.slice(0, 30).map(function(u) { return u.className + ' -> ' + u.properties; });

  var brokenNames = utilityClasses.filter(function(u) {
    return u.className.endsWith('-') || u.className.length <= 2;
  });
  report.brokenClassNames = brokenNames.slice(0, 20).map(function(u) { return '"' + u.className + '" -> ' + u.properties; });

  var pxVars = [];
  for (var entry of allVars) {
    var name = entry[0], info = entry[1];
    if (/^\d/.test(info.value) || /px|rem|em/.test(info.value)) {
      var usage = usageMap.get(name);
      pxVars.push({
        name: name,
        value: info.value.slice(0, 30),
        usedIn: usage ? Array.from(usage).slice(0, 3).join(', ') : 'UNUSED'
      });
    }
  }
  report.pxVarsTotal = pxVars.length;
  report.pxVarsSample = pxVars.slice(0, 30);

  copy(JSON.stringify(report, null, 2));
  return 'Report copied to clipboard. Paste it.';
})();
