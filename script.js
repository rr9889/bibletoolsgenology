// Wikipedia API base URL
const WIKI_API_URL = 'https://en.wikipedia.org/w/api.php';

// Local CSV file
const CSV_FILE = 'BibleData-Person.csv';

// Data storage
let peopleData = [];
const peopleCache = new Map();

// Initialize the app
initApp();

async function initApp() {
  await loadCSVData();
  setupSearch();
}

// Load CSV data using PapaParse
async function loadCSVData() {
  return new Promise((resolve) => {
    Papa.parse(CSV_FILE, {
      download: true,
      header: true,
      complete: (results) => {
        peopleData = results.data.filter(row => row.name);
        resolve();
      },
      error: (err) => {
        console.error(`Failed to load ${CSV_FILE}: ${err}`);
        resolve(); // Continue even if CSV fails
      }
    });
  });
}

// Set up search functionality using Fuse.js
function setupSearch() {
  const fuse = new Fuse(peopleData, { keys: ['name'], threshold: 0.3 });
  const searchInput = document.getElementById('search');
  const searchBtn = document.getElementById('search-btn');
  const resultsDiv = document.getElementById('results');

  searchBtn.addEventListener('click', async function() {
    const query = searchInput.value.trim();
    resultsDiv.innerHTML = '';
    if (query.length < 2) {
      resultsDiv.innerHTML = '<p>Please enter at least 2 characters.</p>';
      return;
    }

    // Search CSV first
    const csvResults = fuse.search(query);
    const combinedResults = [...csvResults.map(r => r.item)];

    // Search Wikipedia for additional matches
    try {
      const wikiResults = await searchWikipedia(query);
      wikiResults.forEach(result => {
        if (!combinedResults.some(p => p.name === result.title.replace(' (biblical figure)', ''))) {
          combinedResults.push({ name: result.title.replace(' (biblical figure)', ''), fromWiki: true });
        }
      });
    } catch (error) {
      console.error('Wikipedia search failed:', error);
    }

    if (combinedResults.length === 0) {
      resultsDiv.innerHTML = '<p>No biblical figures found.</p>';
      return;
    }

    combinedResults.forEach(person => {
      const div = document.createElement('div');
      div.className = 'result-item';
      div.innerHTML = `<strong>${person.name}</strong> (${person.sex || 'Unknown'})`;
      div.addEventListener('click', () => fetchPersonDetails(person));
      resultsDiv.appendChild(div);
    });
  });

  searchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') searchBtn.click();
  });
}

// Search Wikipedia for Christian/Jewish biblical figures
async function searchWikipedia(query) {
  const response = await fetch(`${WIKI_API_URL}?action=query&list=search&srsearch=${encodeURIComponent(query + ' (biblical figure) site:en.wikipedia.org "Christian"|"Jewish"')}&format=json&origin=*`);
  if (!response.ok) throw new Error('Wikipedia search failed');
  const data = await response.json();
  return data.query.search.filter(result => 
    result.snippet.includes('biblical') && 
    (result.snippet.includes('Christian') || result.snippet.includes('Jewish'))
  );
}

// Fetch person details
async function fetchPersonDetails(person) {
  if (peopleCache.has(person.name)) {
    showPersonDetails(peopleCache.get(person.name));
    return;
  }

  const csvPerson = peopleData.find(p => p.name === person.name) || {};
  let wikiData = {};

  try {
    // Fetch summary
    const summaryResponse = await fetch(`${WIKI_API_URL}?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(person.name + ' (biblical figure)')}&format=json&origin=*`);
    if (!summaryResponse.ok) throw new Error('Wikipedia fetch failed');
    const summaryData = await summaryResponse.json();
    const page = Object.values(summaryData.query.pages)[0];
    wikiData.summary = page.extract || 'No summary available';

    // Fetch infobox data
    const relationships = await fetchRelationships(person.name + ' (biblical figure)');
    wikiData.father = relationships.father;
    wikiData.mother = relationships.mother;
    wikiData.children = relationships.children;
    wikiData.spouse = relationships.spouse;
    wikiData.birth = relationships.birth;
    wikiData.death = relationships.death;
    wikiData.role = relationships.role;
  } catch (error) {
    console.error(`Wikipedia fetch failed for ${person.name}:`, error);
    wikiData.summary = 'Wikipedia data unavailable';
  }

  const combinedPerson = {
    name: person.name,
    sex: csvPerson.sex || inferSex(person.name),
    father: csvPerson.father || wikiData.father || 'Not listed',
    mother: csvPerson.mother || wikiData.mother || 'Not listed',
    firstVerse: csvPerson.firstVerse || 'Not listed',
    lastVerse: csvPerson.lastVerse || 'Not listed',
    children: findChildren(person.name).length ? findChildren(person.name) : wikiData.children || [],
    spouse: wikiData.spouse || 'Not listed',
    birth: wikiData.birth || 'Not listed',
    death: wikiData.death || 'Not listed',
    role: wikiData.role || 'Not listed',
    summary: wikiData.summary || 'No additional info'
  };

  peopleCache.set(person.name, combinedPerson);
  showPersonDetails(combinedPerson);
}

// Fetch relationships and additional details from Wikipedia infobox
async function fetchRelationships(title) {
  const response = await fetch(`${WIKI_API_URL}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&origin=*`);
  if (!response.ok) return { father: null, mother: null, children: [], spouse: null, birth: null, death: null, role: null };
  const data = await response.json();
  const wikitext = data.parse?.wikitext['*'] || '';

  return {
    father: extractFromInfobox(wikitext, /\|father\s*=\s*([^\n|]+)/i),
    mother: extractFromInfobox(wikitext, /\|mother\s*=\s*([^\n|]+)/i),
    children: extractFromInfobox(wikitext, /\|children\s*=\s*([^\n]+)/i)?.split(/,|\n/).map(c => c.trim().replace(/\[\[|\]\]/g, '')).filter(c => c) || [],
    spouse: extractFromInfobox(wikitext, /\|spouse\s*=\s*([^\n|]+)/i)?.replace(/\[\[|\]\]/g, '') || null,
    birth: extractFromInfobox(wikitext, /\|birth_date\s*=\s*([^\n|]+)/i) || null,
    death: extractFromInfobox(wikitext, /\|death_date\s*=\s*([^\n|]+)/i) || null,
    role: extractFromInfobox(wikitext, /\|occupation\s*=\s*([^\n|]+)/i) || extractFromInfobox(wikitext, /\|title\s*=\s*([^\n|]+)/i) || null
  };
}

function extractFromInfobox(wikitext, regex) {
  const match = wikitext.match(regex);
  return match ? match[1].trim() : null;
}

// Basic heuristic to infer sex based on name
function inferSex(name) {
  const femaleNames = ["Eve", "Sarah", "Rebekah", "Rachel", "Leah", "Miriam"];
  return femaleNames.includes(name) ? "Female" : "Male";
}

// Find children by looking for records where the person is listed as father or mother
function findChildren(name) {
  return peopleData
    .filter(p => p.father === name || p.mother === name)
    .map(p => p.name);
}

// Display person details in the profile section
function showPersonDetails(person) {
  const profileDiv = document.getElementById('profile');
  profileDiv.innerHTML = `
    <h2>${person.name}</h2>
    <p><strong>Sex:</strong> ${person.sex || 'Unknown'}</p>
    <p><strong>Father:</strong> ${person.father}</p>
    <p><strong>Mother:</strong> ${person.mother}</p>
    <p><strong>Spouse:</strong> ${person.spouse}</p>
    <p><strong>Children:</strong> ${person.children.length ? person.children.join(', ') : 'None listed'}</p>
    <p><strong>First Verse:</strong> ${person.firstVerse}</p>
    <p><strong>Last Verse:</strong> ${person.lastVerse}</p>
    <p><strong>Birth:</strong> ${person.birth}</p>
    <p><strong>Death:</strong> ${person.death}</p>
    <p><strong>Role:</strong> ${person.role}</p>
    <p><strong>Summary:</strong> ${person.summary.substring(0, 200)}...</p>
  `;
  profileDiv.classList.add('active');

  drawFamilyTree(person);
}

// Draw a family tree using D3.js
function draw