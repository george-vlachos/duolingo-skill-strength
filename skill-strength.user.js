/* eslint-disable no-console */
// ==UserScript==
// @name         Duolingo Skill Strength Viewer
// @namespace    http://blog.fabianbecker.eu/
// @version      0.2.2
// @description  Shows individual skill strength
// @author       Fabian Becker
// @match        https://www.duolingo.com/*
// notused-downloadURL  https://github.com/halfdan/duolingo-skill-strength/raw/master/skill-strength.user.js
// notused-updateURL    https://github.com/halfdan/duolingo-skill-strength/raw/master/skill-strength.user.js
// @grant        none
// ==/UserScript==

(function() {
  "use strict";
  addGlobalStyle(
    "#user-skill-strength { margin-top: 1rem; }" +
      "#user-skill-strength > h2 { margin-bottom: 0; } " +
      ".list-skills { font-size: 1rem; overflow: auto; max-height: 270px; }" +
      ".list-skills-item { margin: 0.5rem 0 0 0; line-height: 1.6; color: #999; }" +
      ".list-skills-item:nth-child(even) { background: #E6E6E6; }" +
      ".list-skills-item:nth-child(odd) { background: #FFF; }" +
      ".list-skills-item:before { display: table; content: ''; line-height: 0; }" +
      ".list-skills-item .points { float: right; font-weight: 300; color: #999; }" +
      ".list-skills-item .name { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }" +
      "#user-skill-strength .result { color: #555; }"
  );

  let isLoading = false;
  let timeout = null;
  // eslint-disable-next-line no-unused-vars
  const observer = new MutationObserver((mutations, mutationObserver) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    const skillStr = document.getElementById("user-skill-strength");
    // console.debug(new Date(), skillStr);
    if (!skillStr) {
      timeout = setTimeout(() => {
        if (isHomeScreen()) {
          if (!isLoading) {
            // console.debug(new Date(), "calculate skill strength");
            getVocabulary(() => (isLoading = false));
          }
          isLoading = true;
        } else {
          isLoading = false;
        }
      }, 1000);
    }
  });
  observer.observe(document, {
    childList: true,
    subtree: true
  });
})();

function addGlobalStyle(css) {
  const head = document.getElementsByTagName("head")[0];
  if (!head) return;

  const style = document.createElement("style");
  style.type = "text/css";
  style.innerHTML = css;
  head.appendChild(style);
}

function isHomeScreen() {
  const skillTree = document.querySelectorAll("[data-test='skill-tree']");
  // console.debug(skillTree.length);
  return skillTree.length === 1;
}

function getVocabulary(cb) {
  try {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "/vocabulary/overview");
    xhr.onload = function() {
      if (xhr.status === 200) {
        try {
          handleVocabulary(xhr.responseText, cb);
        } catch (e) {
          console.debug(e);
        }
      } else {
        console.debug(
          `failed to retrieve vocabulary with status ${xhr.status}`
        );
      }
    };
    xhr.send();
  } catch (e) {
    console.debug("failed to retrieve vocabulary");
    console.error(e);
  }
}

function handleVocabulary(response, cb) {
  const data = JSON.parse(response);
  const vocab = data.vocab_overview;
  const {
    averageStrength,
    averageAge,
    medianAge,
    zeroStrength
  } = getVocabProperties(vocab);
  const skillStrength = calculateSkillStrength(vocab);
  const deadwords = vocab.filter(v => v.strength === 0);
  const skillTitles = deadwords.map(a => a.skill_url_title);
  const deadwordsDict = countBy(skillTitles);
  const vocabTitles = vocab.map(a => a.skill_url_title);
  const allwordsDict = countBy(vocabTitles);
  const skillStrengthEl = createElement("div", {
    id: "user-skill-strength",
    className: "box-gray"
  });
  const list = createElement("ul", { className: "list-skills" });
  const language = data.learning_language;

  console.debug("Average Age (hours): " + averageAge / 3600);
  console.debug("Median Age (hours): " + medianAge / 3600);
  console.debug("Average Strength: " + averageStrength);
  console.debug("Dead words (0 strength): " + zeroStrength);
  console.debug("deadwordsDict", deadwordsDict);

  skillStrength.forEach(skill => {
    const { name, url, strength } = skill;
    const pointsVal = `${(strength * 100).toFixed(1)}%`;
    const itemUrl = url in deadwordsDict ? deadwordsDict[skill.url] : 0;
    const info = ` (${itemUrl} / ${allwordsDict[url]})`;
    const title = `${name} ${info} ${pointsVal}`;

    const item = createElement("li", { className: "list-skills-item", title });

    const points = createElement("span", {
      className: "points",
      innerText: pointsVal
    });
    const username = createElement("a", {
      className: "username",
      href: `/skill/${language}/${url}/practice`,
      innerText: name
    });
    item.append(points, username, info);

    list.append(item);
  });

  const h2 = createElement("h2", {
    id: "user-skill-strength",
    innerText: "Skill Strength"
  });

  skillStrengthEl.append(h2, list);

  const strongOS = createElement("strong", { innerText: "Overall Strength: " });
  const textAS = createElement("span", {
    innerText: (averageStrength * 100).toFixed(1)
  });
  const br = createElement("br");
  const strongDW = createElement("strong", {
    innerText: "Dead Words (0 Strength): "
  });
  const textDW = createElement("span", {
    innerText: `${zeroStrength}/${vocab.length}`
  });

  const result = createElement("div", { className: "result" });
  result.append(strongOS, textAS, br, strongDW, textDW);

  skillStrengthEl.append(result);

  displaySkillStrength(skillStrengthEl);
  cb();
}

function getVocabProperties(vocab) {
  const ahora = new Date().getTime();

  const averageStrength = average(
    vocab.map(function(v) {
      return v.strength;
    })
  );

  const averageAge = average(
    vocab.map(function(v) {
      return (ahora - v.last_practiced_ms) / 1000;
    })
  );

  const medianAge = median(
    vocab.map(function(v) {
      return (ahora - v.last_practiced_ms) / 1000;
    })
  );

  const zeroStrength = vocab.filter(function(v) {
    return v.strength === 0;
  }).length;

  return { averageStrength, averageAge, medianAge, zeroStrength };
}

function calculateSkillStrength(vocab) {
  const groupBySkill = groupBy(vocab, "skill");

  const skills = Object.keys(groupBySkill).map(skill => ({
    name: skill,
    strength: average(groupBySkill[skill].map(s => s.strength)),
    url: groupBySkill[skill][0].skill_url_title
  }));

  // Sort by strength (weakest first)
  skills.sort(function(a, b) {
    return a.strength - b.strength;
  });

  return skills;
}

function displaySkillStrength(skillStrengthEl) {
  const sidebarLeftInner = document.querySelectorAll(
    "section.sidebar-left > div.inner"
  );
  if (sidebarLeftInner.length > 0) {
    sidebarLeftInner.append(skillStrengthEl);
  } else {
    const selector = document.querySelectorAll("[data-reactroot] h2");
    if (selector.length > 0) {
      // **huge** assumption here: the last h2 element within
      // the element with attribute "[data-reactroot]" is right one
      // to have the list right after
      const parent = selector[selector.length - 1].parentElement;

      parent.append(skillStrengthEl);
    } else {
      console.debug(`no elements found with selector ${selector}`);
    }
  }
}

function average(data) {
  const sum = data.reduce(function(a, b) {
    return a + b;
  });
  return sum / data.length;
}

function median(data) {
  // extract the .values field and sort the resulting array
  const m = data.sort(function(a, b) {
    return a - b;
  });

  const middle = Math.floor((m.length - 1) / 2); // NB: operator precedence
  if (m.length % 2) {
    return m[middle];
  } else {
    return (m[middle] + m[middle + 1]) / 2.0;
  }
}

function countBy(array) {
  return array.reduce((acc, val) => {
    if (acc[val]) {
      acc[val] += 1;
    } else {
      acc[val] = 1;
    }
    return acc;
  }, {});
}

function groupBy(array, attr) {
  return array.reduce((r, v, i, a, k = v[attr]) => {
    const result = r[k] || (r[k] = []);
    result.push(v);
    return r;
  }, {});
}

function createElement(type, options = {}) {
  const el = document.createElement(type);
  const { id, title, className, innerHTML, innerText, href } = options;

  if (id) {
    el.setAttribute("id", id);
  }

  if (title) {
    el.setAttribute("title", title);
  }

  if (className) {
    el.className = className;
  }

  if (innerHTML) {
    el.innerHTML = innerHTML;
  }

  if (innerText) {
    el.innerText = innerText;
  }

  if (href) {
    el.href = href;
  }

  return el;
}
