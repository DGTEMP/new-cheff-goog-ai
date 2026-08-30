/* fuzzy-search.js - Pure ES3/ES5 compatible lightweight search */
window.FuzzySearch = (function() {
  function stripAccents(s) {
    if (!s) return '';
    s = String(s).toLowerCase();
    try {
      if (typeof s.normalize === 'function') {
        s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      }
    } catch(e) {}
    var map = {
      'á':'a','à':'a','ã':'a','â':'a','ä':'a',
      'é':'e','è':'e','ê':'e','ë':'e',
      'í':'i','ì':'i','î':'i','ï':'i',
      'ó':'o','ò':'o','õ':'o','ô':'o','ö':'o',
      'ú':'u','ù':'u','û':'u','ü':'u',
      'ç':'c','ñ':'n'
    };
    var res = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      res += map[ch] || ch;
    }
    return res.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var m = a.length, n = b.length;
    var dp = [];
    for (var i = 0; i <= m; i++) { dp[i] = [i]; }
    for (var j = 0; j <= n; j++) { dp[0][j] = j; }
    for (var i = 1; i <= m; i++) {
      for (var j = 1; j <= n; j++) {
        var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  }

  function matchScore(query, text) {
    var qNorm = stripAccents(query);
    var tNorm = stripAccents(text);
    if (!qNorm || !tNorm) return 0;

    if (tNorm.indexOf(qNorm) !== -1) return 100;

    var words = qNorm.split(' ');
    var textWords = tNorm.split(' ');
    var allWordsMatch = true;
    var totalWordScore = 0;
    var validWordCount = 0;

    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (!w) continue;
      validWordCount++;
      var wordFound = false;

      for (var j = 0; j < textWords.length; j++) {
        var tw = textWords[j];
        if (!tw) continue;
        if (tw.indexOf(w) !== -1) {
          wordFound = true;
          totalWordScore += 100;
          break;
        }
        var dist = levenshtein(w, tw);
        var threshold = w.length <= 2 ? 0 : (w.length <= 4 ? 1 : 2);
        if (dist <= threshold) {
          wordFound = true;
          totalWordScore += Math.max(0, 80 - dist * 20);
          break;
        }
      }

      if (!wordFound) {
        allWordsMatch = false;
        break;
      }
    }

    if (!allWordsMatch || validWordCount === 0) return 0;
    return totalWordScore / validWordCount;
  }

  function filter(items, query, getFields) {
    if (!query || !stripAccents(query)) return items;
    var scored = [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var fields = getFields ? getFields(item) : [item.nome || ''];
      var bestScore = 0;
      for (var f = 0; f < fields.length; f++) {
        var score = matchScore(query, fields[f]);
        if (score > bestScore) bestScore = score;
      }
      if (bestScore > 0) {
        scored.push({ item: item, score: bestScore });
      }
    }
    scored.sort(function(a, b) { return b.score - a.score; });
    var results = [];
    for (var k = 0; k < scored.length; k++) {
      results.push(scored[k].item);
    }
    return results;
  }

  return {
    normalize: stripAccents,
    matchScore: matchScore,
    filter: filter,
    levenshtein: levenshtein
  };
})();
