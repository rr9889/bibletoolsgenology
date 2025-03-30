// Local CSV file (relative path for GitHub)
const CSV_FILE = './BibleData-Person.csv';

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
        // Filter out rows without a name
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

  searchBtn.addEventListener('click', function() {
    const query = searchInput.value.trim();
    resultsDiv.innerHTML = '';
    if (query.length < 2) {
      resultsDiv.innerHTML = '<p>Please enter at least 2 characters.</p>';
      return;
    }

    // Search using Fuse.js over the CSV data
    const csvResults = fuse.search(query);
    const combinedResults = csvResults.map(r => r.item);

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

// Fetch person details using CSV data only
async function fetchPersonDetails(person) {
  if (peopleCache.has(person.name)) {
    showPersonDetails(peopleCache.get(person.name));
    return;
  }

  // Find the corresponding record from the CSV data
  const csvPerson = peopleData.find(p => p.name === person.name) || {};

  const combinedPerson = {
    name: person.name,
    sex: csvPerson.sex || 'Unknown',
    father: csvPerson.father || 'Not listed',
    mother: csvPerson.mother || 'Not listed',
    firstVerse: csvPerson.firstVerse || 'Not listed',
    lastVerse: csvPerson.lastVerse || 'Not listed',
    children: findChildren(person.name)
  };

  peopleCache.set(person.name, combinedPerson);
  showPersonDetails(combinedPerson);
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
  
  // Basic info from CSV
  let profileHTML = `
    <h2>${person.person_name}</h2>
    <p><strong>ID:</strong> ${person.person_id}</p>
    <p><strong>Surname:</strong> ${person.surname}</p>
    <p><strong>Unique Attribute:</strong> ${person.unique_attribute}</p>
    <p><strong>Sex:</strong> ${person.sex}</p>
    <p><strong>Tribe:</strong> ${person.tribe}</p>
    <p><strong>Notes:</strong> ${person.person_notes}</p>
    <p><strong>Instance:</strong> ${person.person_instance}</p>
    <p><strong>Sequence:</strong> ${person.person_sequence}</p>
    <p><strong>Father:</strong> ${person.father}</p>
    <p><strong>Mother:</strong> ${person.mother}</p>
    <p><strong>Children:</strong> ${person.children.length ? person.children.join(', ') : 'None listed'}</p>
    <p><strong>First Verse:</strong> ${person.firstVerse}</p>
    <p><strong>Last Verse:</strong> ${person.lastVerse}</p>
  `;

  // Add alternative names/titles from JSON with a collapsible section
  if (person.labels && person.labels.length > 0) {
    profileHTML += `
      <h3>
        <button class="collapsible">Alternative Names/Titles (${person.labels.length})</button>
      </h3>
      <div class="collapsible-content">
        <ul>
    `;
    person.labels.forEach(label => {
      profileHTML += `
        <li>
          <strong>${label.english_label}</strong> (${label.label_type})<br>
          <strong>Hebrew:</strong> ${label.hebrew_label} (${label.hebrew_label_transliterated}) - ${label.hebrew_label_meaning || 'No meaning provided'} [Strong's ${label.hebrew_strongs_number || 'N/A'}]<br>
          <strong>Greek:</strong> ${label.greek_label} (${label.greek_label_transliterated}) - ${label.greek_label_meaning || 'No meaning provided'} [Strong's ${label.greek_strongs_number || 'N/A'}]<br>
          <strong>Reference:</strong> ${label.label_reference_id}<br>
          <strong>Given by God:</strong> ${label.label_given_by_god === 'Y' ? 'Yes' : 'No'}<br>
          ${label.label_notes ? `<strong>Notes:</strong> ${label.label_notes}` : ''}
        </li>
      `;
    });
    profileHTML += `</ul></div>`;
  } else {
    profileHTML += `<p>No alternative names or titles found.</p>`;
  }

  profileDiv.innerHTML = profileHTML;
  profileDiv.classList.add('active');

  // Add event listeners for collapsible sections
  const collapsibles = document.getElementsByClassName('collapsible');
  for (let i = 0; i < collapsibles.length; i++) {
    collapsibles[i].addEventListener('click', function() {
      this.classList.toggle('active');
      const content = this.nextElementSibling;
      if (content.style.display === 'block') {
        content.style.display = 'none';
      } else {
        content.style.display = 'block';
      }
    });
  }

  drawFamilyTree(person);
}
